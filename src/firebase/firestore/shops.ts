
'use client';

import {
  collection,
  doc,
  Firestore,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Shop } from '@/lib/types';

/**
 * Creates a new shop document in Firestore.
 * @param firestore The Firestore instance.
 * @param data The shop data to save.
 * @returns The newly created shop object, including its ID.
 */
export async function createShop(
  firestore: Firestore,
  data: Omit<Shop, 'id' | 'createdAt'>
): Promise<Shop> {
  const newShopRef = doc(collection(firestore, 'shops'));

  const newShop: Shop = {
    id: newShopRef.id,
    ...data,
    createdAt: new Date().toISOString(),
  };

  await setDoc(newShopRef, newShop);

  return newShop;
}
