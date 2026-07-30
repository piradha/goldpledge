
'use client';

import { Pledge, Payment, Shop } from '@/lib/types';
import { collection, Firestore, doc, runTransaction, getDocs, writeBatch, query, where, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { calculateInterest } from '@/lib/interest';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

// Function to get the next sequential ID for pledges for a specific shop
async function getNextPledgeId(firestore: Firestore, shop: Shop): Promise<string> {
    const counterRef = doc(firestore, 'counters', `pledge_${shop.id}`);

    try {
        const newId = await runTransaction(firestore, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let nextId = 1;
            if (counterDoc.exists()) {
                nextId = (counterDoc.data().lastId || 0) + 1;
            }

            transaction.set(counterRef, { lastId: nextId }, { merge: true });

            return nextId;
        });

        // Use the custom prefix if it exists, otherwise fall back to the first 3 chars of the shop name.
        const prefix = shop.prefix ? shop.prefix.toUpperCase() : shop.name.substring(0, 3).toUpperCase();

        return `${prefix}-${newId}`;
    } catch (error) {
        console.error("Transaction to get next pledge ID failed: ", error);
        throw new Error("Could not generate a new Pledge ID.");
    }
}


export async function addPledge(firestore: Firestore, pledgeData: Omit<Pledge, 'id' | 'status' | 'paidAmount'>, oldPledgeId?: string): Promise<string> {
    if (!pledgeData.shopId) {
        throw new Error("Shop ID is required to create a pledge.");
    }

    const shopRef = doc(firestore, 'shops', pledgeData.shopId);
    const shopDoc = await getDoc(shopRef);

    if (!shopDoc.exists()) {
        throw new Error(`Shop with ID ${pledgeData.shopId} not found.`);
    }

    const shop = { ...shopDoc.data(), id: shopDoc.id } as Shop;

    const newPledgeId = await getNextPledgeId(firestore, shop);
    const newPledgeRef = doc(firestore, 'pledges', newPledgeId);

    const newPledge: Pledge = {
        ...pledgeData,
        id: newPledgeId,
        status: 'ACTIVE',
        paidAmount: 0,
        interestPaid: 0,
    };

    await setDoc(newPledgeRef, newPledge).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: newPledgeRef.path,
            operation: 'create',
            requestResourceData: newPledge,
        }));
        // Re-throw the original error after emitting
        throw error;
    });

    // If this is a repledge, close the old one
    if (oldPledgeId) {
        const oldPledgeRef = doc(firestore, 'pledges', oldPledgeId);
        try {
            await updateDoc(oldPledgeRef, { status: 'CLOSED' });
        } catch (error) {
            console.warn(`Failed to close old pledge ${oldPledgeId}:`, error);
            // We don't throw here, as the primary operation (creating the new pledge) succeeded.
            // We can log this for monitoring.
        }
    }


    return newPledgeId;
}

export async function clearAllPledges(firestore: Firestore, shopId: string) {
    // This is a dangerous operation, so ensure it's restricted.
    const pledgesCollection = collection(firestore, 'pledges');
    const q = query(pledgesCollection, where('shopId', '==', shopId));
    const pledgesSnapshot = await getDocs(q);

    if (pledgesSnapshot.empty) {
        return;
    }

    const batch = writeBatch(firestore);
    pledgesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    const counterRef = doc(firestore, 'counters', `pledge_${shopId}`);
    batch.set(counterRef, { lastId: 0 });

    await batch.commit();
}

export async function addPaymentAndUpdatePledge(
    firestore: Firestore,
    pledgeId: string,
    paymentData: Omit<Payment, 'id' | 'pledgeId' | 'shopId'>,
    principalPayment: number
): Promise<string> {
    const pledgeRef = doc(firestore, 'pledges', pledgeId);
    const paymentRef = doc(collection(firestore, 'payments'));

    await runTransaction(firestore, async (transaction) => {
        const pledgeDoc = await transaction.get(pledgeRef);
        if (!pledgeDoc.exists()) {
            throw new Error("Pledge does not exist!");
        }

        const pledge = pledgeDoc.data() as Pledge;
        let newPaidAmount = pledge.paidAmount;
        let newInterestPaid = pledge.interestPaid || 0;

        const updates: any = {};

        if (paymentData.paymentType === 'Interest') {
            newInterestPaid += paymentData.amount;
            updates.interestPaid = newInterestPaid;
        } else if (paymentData.paymentType === 'Partial' || paymentData.paymentType === 'Settlement') {
            newPaidAmount += principalPayment;
            updates.paidAmount = newPaidAmount;

            // In settlement, also track interest paid if any part of the payment was interest
            // Usually Settlement amount = principal + interest. 
            // The caller passes principalPayment. Interest component = paymentData.amount - principalPayment
            const interestComponent = paymentData.amount - principalPayment;
            if (interestComponent > 0) {
                newInterestPaid += interestComponent;
                updates.interestPaid = newInterestPaid;
            }

            // Auto-close on settlement or if fully paid
            if (paymentData.paymentType === 'Settlement' || newPaidAmount >= pledge.loanAmount) {
                updates.status = 'CLOSED';
                if (pledge.bankCoverage) {
                    updates['bankCoverage.status'] = 'Released';
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            transaction.update(pledgeRef, updates);
        }

        const newPayment: Payment = {
            ...paymentData,
            id: paymentRef.id,
            pledgeId: pledgeId,
            shopId: pledge.shopId,
            paymentDate: paymentData.paymentDate || new Date().toISOString(),
        };

        transaction.set(paymentRef, newPayment);
    }).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: pledgeRef.path,
            operation: 'update',
            requestResourceData: { paidAmount: '...' }, // Can't easily get new paid amount here
        }));
        throw error;
    });

    return paymentRef.id;
}


export async function releasePledge(firestore: Firestore, pledgeId: string) {
    const pledgeRef = doc(firestore, 'pledges', pledgeId);

    await runTransaction(firestore, async (transaction) => {
        const pledgeDoc = await transaction.get(pledgeRef);
        if (!pledgeDoc.exists()) {
            throw new Error("Pledge not found!");
        }

        const pledge = pledgeDoc.data() as Pledge;

        // Fetch payments to calculate accurate interest
        const paymentsQuery = query(collection(firestore, 'payments'), where('pledgeId', '==', pledgeId));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const payments = paymentsSnapshot.docs.map(d => d.data() as Payment);

        const { interestDue } = calculateInterest(pledge, new Date(), payments);
        const outstandingPrincipal = pledge.loanAmount - pledge.paidAmount;
        const totalOutstanding = outstandingPrincipal + interestDue;

        if (totalOutstanding > 0.1) { // Allow for small rounding differences
            throw new Error(`Cannot release pledge. Outstanding balance of ₹${totalOutstanding.toFixed(2)} remains.`);
        }

        transaction.update(pledgeRef, { status: 'CLOSED' });
    }).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: pledgeRef.path,
            operation: 'update',
            requestResourceData: { status: 'CLOSED' },
        }));
        throw error;
    });
}

export async function deletePledge(firestore: Firestore, pledgeId: string) {
    const pledgeRef = doc(firestore, 'pledges', pledgeId);
    await runTransaction(firestore, async (transaction) => {
        const pledgeDoc = await transaction.get(pledgeRef);
        if (!pledgeDoc.exists()) {
            throw new Error("Pledge not found!");
        }
        transaction.delete(pledgeRef);
    }).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: pledgeRef.path,
            operation: 'delete',
        }));
        throw error;
    });
}

export async function updatePledge(firestore: Firestore, pledgeId: string, pledgeData: Partial<Pledge>) {
    const pledgeRef = doc(firestore, 'pledges', pledgeId);
    await updateDoc(pledgeRef, pledgeData).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: pledgeRef.path,
            operation: 'update',
            requestResourceData: pledgeData,
        }));
        throw error;
    });
}
