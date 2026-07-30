
'use client';

import { doc, Firestore, setDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import type { UserProfile, Shop } from '@/lib/types';

/**
 * Creates a user profile and ensures a shop exists.
 * If a shop with the given shopNumber already exists, it uses that shop's info.
 * Otherwise, it creates a new shop.
 * @param firestore The Firestore instance.
 * @param userId The user's authentication ID (uid).
 * @param userEmail The user's email.
 * @param defaultShopName The name to use for a new shop if one doesn't exist.
 * @param shopNumber A unique number for the shop.
 */
export async function createProfileAndShop(
  firestore: Firestore,
  userId: string,
  userEmail: string,
  defaultShopName: string,
  shopNumber: string,
) {
  const batch = writeBatch(firestore);
  const shopsRef = collection(firestore, 'shops');
  const shopQuery = query(shopsRef, where("shopNumber", "==", shopNumber));
  
  const shopSnapshot = await getDocs(shopQuery);

  let finalShop: Shop;
  let shopId: string;

  if (!shopSnapshot.empty) {
    // Shop already exists, use its data.
    const existingShopDoc = shopSnapshot.docs[0];
    finalShop = existingShopDoc.data() as Shop;
    shopId = existingShopDoc.id;
  } else {
    // Shop doesn't exist, create a new one.
    const newShopRef = doc(shopsRef);
    shopId = newShopRef.id;
    finalShop = {
      id: shopId,
      name: defaultShopName,
      ownerId: userId,
      createdAt: new Date().toISOString(),
      shopNumber: shopNumber,
    };
    batch.set(newShopRef, finalShop);
  }

  // Create the user profile document, linking it to the determined shop.
  const userRef = doc(firestore, 'users', userId);
  const userProfile: Omit<UserProfile, 'id'> = {
    email: userEmail,
    shopId: shopId,
    shopName: finalShop.name, // Use the final shop name
    shopNumber: shopNumber,
    role: 'owner', // First user is always the owner
  };
  batch.set(userRef, userProfile);
  
  // Commit the transaction.
  await batch.commit();

  return { userProfile, shop: finalShop };
}


/**
 * Creates or overwrites a user's profile document in Firestore.
 * @param firestore The Firestore instance.
 * @param userId The user's authentication ID (uid).
 * @param data The user profile data to save.
 */
export function createUserProfile(
  firestore: Firestore,
  userId: string,
  data: Omit<UserProfile, 'id'>
) {
  const userRef = doc(firestore, 'users', userId);
  // We use setDoc here to ensure the document is created with the specific userId
  return setDoc(userRef, data);
}
