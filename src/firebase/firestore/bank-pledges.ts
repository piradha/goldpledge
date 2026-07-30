'use client';

import { BankPledgeGroup, Pledge } from '@/lib/types';
import { Firestore, doc, runTransaction, collection, query, where, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export async function createBankPledgeGroup(
    firestore: Firestore,
    shopId: string,
    groupData: Omit<BankPledgeGroup, 'id' | 'shopId' | 'status' | 'createdAt'>
): Promise<string> {
    const groupRef = doc(collection(firestore, 'bank_pledge_groups'));
    const groupId = groupRef.id;

    const newGroup: BankPledgeGroup = {
        ...groupData,
        id: groupId,
        shopId: shopId,
        status: 'In Bank',
        createdAt: new Date().toISOString(),
    };

    await runTransaction(firestore, async (transaction) => {
        // 1. READ all pledges first (All reads must come before any writes)
        const pledgeRefs = groupData.pledgeIds.map(id => doc(firestore, 'pledges', id));
        const pledgeDocs = [];

        for (const pledgeRef of pledgeRefs) {
            const pledgeDoc = await transaction.get(pledgeRef);
            if (!pledgeDoc.exists()) {
                throw new Error(`Pledge ${pledgeRef.id} not found`);
            }
            pledgeDocs.push(pledgeDoc);
        }

        // 2. PERFORM all writes after all reads are done
        // Create the group
        transaction.set(groupRef, newGroup);

        // Update each pledge in the group
        for (const pledgeRef of pledgeRefs) {
            transaction.update(pledgeRef, {
                bankCoverage: {
                    bankName: groupData.bankName,
                    bankLoanAmount: groupData.bankLoanAmount,
                    depositDate: groupData.depositDate,
                    scheme: groupData.scheme,
                    duration: groupData.duration,
                    status: 'In Bank'
                }
            });
        }
    }).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: groupRef.path,
            operation: 'create',
            requestResourceData: newGroup,
        }));
        throw error;
    });

    return groupId;
}

export async function releaseBankPledgeGroup(
    firestore: Firestore,
    groupId: string
) {
    const groupRef = doc(firestore, 'bank_pledge_groups', groupId);

    await runTransaction(firestore, async (transaction) => {
        const groupDoc = await transaction.get(groupRef);
        if (!groupDoc.exists()) {
            throw new Error('Bank pledge group not found');
        }

        const group = groupDoc.data() as BankPledgeGroup;

        // 1. Update the group status
        transaction.update(groupRef, { status: 'Released' });

        // 2. Update each pledge status in the group
        for (const pledgeId of group.pledgeIds) {
            const pledgeRef = doc(firestore, 'pledges', pledgeId);
            transaction.update(pledgeRef, {
                'bankCoverage.status': 'Released'
            });
        }
    }).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: groupRef.path,
            operation: 'update',
            requestResourceData: { status: 'Released' },
        }));
        throw error;
    });
}

export async function releaseSinglePledgeFromBank(
    firestore: Firestore,
    pledgeId: string
) {
    const pledgeRef = doc(firestore, 'pledges', pledgeId);

    await runTransaction(firestore, async (transaction) => {
        const pledgeDoc = await transaction.get(pledgeRef);
        if (!pledgeDoc.exists()) {
            throw new Error('Pledge not found');
        }

        const pledge = pledgeDoc.data() as Pledge;
        if (!pledge.bankCoverage) {
            throw new Error('Pledge is not bank-covered');
        }

        // Update pledge status
        transaction.update(pledgeRef, {
            'bankCoverage.status': 'Released'
        });

        // We could also search for the group and update it if all pledges are released,
        // but for now let's keep it simple.
    }).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: pledgeRef.path,
            operation: 'update',
            requestResourceData: { 'bankCoverage.status': 'Released' },
        }));
        throw error;
    });
}
