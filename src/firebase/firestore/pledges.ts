
'use client';

import { Pledge, Payment, Shop, Scheme } from '@/lib/types';
import { collection, Firestore, doc, runTransaction, getDocs, writeBatch, query, where, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { calculateInterest } from '@/lib/interest';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

// Function to get the next sequential ID for pledges for a specific shop
async function getNextPledgeId(firestore: Firestore, shop: Shop): Promise<{ pledgeId: string; pledgeNo: number }> {
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

        return {
            pledgeId: `${prefix}-${newId}`,
            pledgeNo: newId,
        };
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

    const { pledgeId: newPledgeId, pledgeNo } = await getNextPledgeId(firestore, shop);
    const newPledgeRef = doc(firestore, 'pledges', newPledgeId);

    const sanitizedPledge: any = {};
    for (const [key, value] of Object.entries(pledgeData)) {
        if (value !== undefined) {
            sanitizedPledge[key] = value;
        }
    }

    const newPledge: Pledge = {
        ...sanitizedPledge,
        id: newPledgeId,
        pledgeNo,
        status: 'ACTIVE',
        paidAmount: 0,
        interestPaid: 0,
    };

    if (oldPledgeId) {
        newPledge.isRepledge = true;
        if (!newPledge.previousPledgeDocId) {
            newPledge.previousPledgeDocId = oldPledgeId;
        }
        if (!newPledge.previousPledgeId) {
            newPledge.previousPledgeId = oldPledgeId;
        }
        if (!newPledge.repledgeDate) {
            newPledge.repledgeDate = new Date().toISOString();
        }
    }

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
        const currentPaidAmount = Number(pledge.paidAmount) || 0;
        const currentInterestPaid = Number(pledge.interestPaid) || 0;
        const loanAmount = Number(pledge.loanAmount) || 0;
        const paymentAmount = Number(paymentData.amount) || 0;
        const validPrincipalPayment = Number(principalPayment) || 0;

        let newPaidAmount = currentPaidAmount;
        let newInterestPaid = currentInterestPaid;

        const updates: any = {};

        if (paymentData.paymentType === 'Interest') {
            newInterestPaid += paymentAmount;
            updates.interestPaid = newInterestPaid;
        } else if (paymentData.paymentType === 'Partial' || paymentData.paymentType === 'Settlement') {
            newPaidAmount += validPrincipalPayment;
            updates.paidAmount = newPaidAmount;

            // In settlement, also track interest paid if any part of the payment was interest
            // Usually Settlement amount = principal + interest. 
            // The caller passes principalPayment. Interest component = paymentData.amount - principalPayment
            const interestComponent = paymentAmount - validPrincipalPayment;
            if (interestComponent > 0) {
                newInterestPaid += interestComponent;
                updates.interestPaid = newInterestPaid;
            }

            // Auto-close on settlement or if fully paid
            if (paymentData.paymentType === 'Settlement' || newPaidAmount >= loanAmount) {
                updates.status = 'CLOSED';
                if (pledge.bankCoverage && typeof pledge.bankCoverage === 'object') {
                    updates.bankCoverage = {
                        ...pledge.bankCoverage,
                        status: 'Released'
                    };
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            transaction.update(pledgeRef, updates);
        }

        const newPayment: Payment = {
            id: paymentRef.id,
            pledgeId: pledgeId,
            shopId: pledge.shopId,
            paymentType: paymentData.paymentType,
            amount: paymentAmount,
            adjustment: Number(paymentData.adjustment) || 0,
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

        let scheme: Scheme | null = null;
        if (pledge.schemeId) {
            const schemeRef = doc(firestore, 'schemes', pledge.schemeId);
            const schemeDoc = await transaction.get(schemeRef);
            if (schemeDoc.exists()) {
                scheme = { ...schemeDoc.data(), id: schemeDoc.id } as Scheme;
            }
        }

        const { interestDue } = calculateInterest(pledge, scheme, new Date(), payments);
        const outstandingPrincipal = (Number(pledge.loanAmount) || 0) - (Number(pledge.paidAmount) || 0);
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

/**
 * Backfills numeric `pledgeNo` on any existing pledge documents for a shop that don't have it yet.
 * Runs in batches of 400 to stay well within Firestore batch limits.
 */
export async function backfillPledgeNumbers(
    firestore: Firestore,
    shopId: string,
    onProgress?: (processed: number, total: number) => void
): Promise<{ updated: number; total: number }> {
    const q = query(collection(firestore, 'pledges'), where('shopId', '==', shopId));
    const snap = await getDocs(q);

    let updated = 0;
    const docsToUpdate = snap.docs.filter(d => {
        const data = d.data();
        return data.pledgeNo === undefined || data.pledgeNo === null;
    });

    const BATCH_SIZE = 400;
    for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = docsToUpdate.slice(i, i + BATCH_SIZE);
        for (const docSnap of chunk) {
            const docId = docSnap.id;
            const parts = docId.split('-');
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num)) {
                batch.update(docSnap.ref, { pledgeNo: num });
                updated++;
            }
        }
        await batch.commit();
        if (onProgress) {
            onProgress(Math.min(i + BATCH_SIZE, docsToUpdate.length), docsToUpdate.length);
        }
    }

    return { updated, total: snap.docs.length };
}

