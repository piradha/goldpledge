
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
    
    // Firestore does not allow `undefined` values. Ensure all fields are valid.
    const newCustomerData: Omit<Customer, 'id'> = {
        shopId: customer.shopId,
        name: customer.name || '',
        fatherName: customer.fatherName || '',
        mobileNumber: customer.mobileNumber || '',
        alternateMobile: customer.alternateMobile || '',
        address: customer.address || '',
        idProofType: customer.idProofType || 'Aadhar',
        idProofNumber: customer.idProofNumber || '',
        idProofPhotoUrl: customer.idProofPhotoUrl || '',
        photoUrl: customer.photoUrl || '',
        reference: customer.reference || '',
        notes: customer.notes || '',
        createdAt: new Date().toISOString(),
    };

    return setDoc(newCustomerRef, newCustomerData).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: newCustomerRef.path,
            operation: 'create',
            requestResourceData: newCustomerData,
        }));
        throw error;
    });
}

export function updateCustomer(firestore: Firestore, customerId: string, customerData: Partial<Omit<Customer, 'id' | 'shopId'>>) {
    const customerRef = doc(firestore, 'customers', customerId);

    const sanitizedData: any = {};
    for (const [key, value] of Object.entries(customerData)) {
        if (value !== undefined) {
            sanitizedData[key] = value;
        }
    }

    return updateDoc(customerRef, sanitizedData).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: customerRef.path,
            operation: 'update',
            requestResourceData: sanitizedData,
        }));
        throw error;
    });
}
