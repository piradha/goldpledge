
'use client';

import { Scheme } from '@/lib/types';
import { collection, doc, Firestore, setDoc, deleteDoc } from 'firebase/firestore';

export function addScheme(firestore: Firestore, scheme: Omit<Scheme, 'id'>) {
    if (!scheme.shopId) throw new Error("shopId is required");
    const schemesCollection = collection(firestore, 'schemes');
    const newSchemeRef = doc(schemesCollection);
    const newSchemeData = { ...scheme, id: newSchemeRef.id };
    return setDoc(newSchemeRef, newSchemeData);
}

export function updateScheme(firestore: Firestore, schemeId: string, scheme: Omit<Scheme, 'id'>) {
    if (!scheme.shopId) throw new Error("shopId is required");
    const schemeRef = doc(firestore, 'schemes', schemeId);
    // Use merge:true to avoid overwriting fields if the object is partial
    return setDoc(schemeRef, scheme, { merge: true });
}

export function deleteScheme(firestore: Firestore, schemeId: string) {
    const schemeRef = doc(firestore, 'schemes', schemeId);
    return deleteDoc(schemeRef);
}
