
'use client';

import { Customer } from '@/lib/types';
import { collection, doc, Firestore, setDoc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function addCustomer(firestore: Firestore, customer: Omit<Customer, 'id' | 'createdAt'>) {
    if (!customer.shopId) {
        throw new Error("shopId is required to add a customer.");
    }
    const customersCollection = collection(firestore, 'customers');
    const newCustomerRef = doc(customersCollection);
    
    // Firestore does not allow `undefined` values. Ensure they are converted to something valid.
    const newCustomerData: Omit<Customer, 'id'> = {
        ...customer,
        photoUrl: customer.photoUrl || '',
        idProofPhotoUrl: customer.idProofPhotoUrl || '',
        createdAt: new Date().toISOString(),
    };

    return setDoc(newCustomerRef, newCustomerData).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: newCustomerRef.path,
            operation: 'create',
            requestResourceData: newCustomerData,
        }));
    });
}

export function updateCustomer(firestore: Firestore, customerId: string, customerData: Partial<Omit<Customer, 'id' | 'shopId'>>) {
    const customerRef = doc(firestore, 'customers', customerId);
    return updateDoc(customerRef, customerData).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: customerRef.path,
            operation: 'update',
            requestResourceData: customerData,
        }));
    });
}
