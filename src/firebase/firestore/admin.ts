'use client';

import {
  collection,
  doc,
  Firestore,
  writeBatch,
  query,
  where,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import type { Shop, UserProfile } from '@/lib/types';

/**
 * Creates a new shop and links it to a user by their email address.
 * If the user document already exists, it updates it with the new shop info.
 * If the user document doesn't exist, it creates it.
 * A unique shop number is generated based on the current timestamp.
 *
 * @param firestore The Firestore instance.
 * @param shopName The name of the new shop.
 * @param ownerEmail The email of the user to be assigned as the owner.
 */
export async function createShopAndLinkToUser(
  firestore: Firestore,
  shopName: string,
  ownerEmail: string
): Promise<{ shop: Shop; userProfile: UserProfile }> {
  const batch = writeBatch(firestore);
  const usersRef = collection(firestore, 'users');
  const userQuery = query(usersRef, where('email', '==', ownerEmail));
  const userSnapshot = await getDocs(userQuery);

  const shopNumber = String(Date.now());
  const newShopRef = doc(collection(firestore, 'shops'));

  let userId: string;
  let userProfileData: Omit<UserProfile, 'id'>;

  if (!userSnapshot.empty) {
    // User already exists, update their profile
    const existingUserDoc = userSnapshot.docs[0];
    userId = existingUserDoc.id;
    batch.update(existingUserDoc.ref, {
      role: 'owner',
      shopId: newShopRef.id,
      shopName: shopName,
      shopNumber: shopNumber,
    });
  } else {
    // New user, create a new user profile document
    // IMPORTANT: The UID is not known yet. This ID is temporary until first login.
    // The AuthenticationGuard will handle re-linking if needed. For now, we create a profile.
    const newUserRef = doc(usersRef); // Firestore generates a unique ID
    userId = newUserRef.id;
    userProfileData = {
      email: ownerEmail,
      role: 'owner',
      shopId: newShopRef.id,
      shopName: shopName,
      shopNumber: shopNumber,
    };
    batch.set(newUserRef, userProfileData);
  }

  const newShop: Omit<Shop, 'id'> = {
    name: shopName,
    shopNumber: shopNumber,
    createdAt: new Date().toISOString(),
    ownerId: userId, // This ownerId might be a temporary doc ID
  };
  batch.set(newShopRef, newShop);

  await batch.commit();

  // We return optimistic data. The actual IDs are now in Firestore.
  return { 
    shop: { ...newShop, id: newShopRef.id }, 
    userProfile: { ...userSnapshot.docs[0]?.data() || userProfileData, id: userId } as UserProfile
  };
}


/**
 * Reassigns a shop to a new owner by email.
 * It finds or creates the new owner's profile, updates the shop's ownerId,
 * updates the new owner's profile, and clears the shop from the old owner's profile.
 *
 * @param firestore The Firestore instance.
 * @param shop The shop object to be reassigned.
 * @param newOwnerEmail The email of the new owner.
 */
export async function reassignShopOwner(firestore: Firestore, shop: Shop, newOwnerEmail: string) {
  
  return runTransaction(firestore, async (transaction) => {
    // 1. Find the shop
    const shopRef = doc(firestore, 'shops', shop.id);
    
    // 2. Find or create the new owner's user profile
    const usersRef = collection(firestore, 'users');
    const newOwnerQuery = query(usersRef, where('email', '==', newOwnerEmail));
    const newOwnerSnapshot = await getDocs(newOwnerQuery);
    
    let newOwnerId: string;
    let newOwnerRef: any; // Can be DocumentReference

    if (!newOwnerSnapshot.empty) {
        newOwnerRef = newOwnerSnapshot.docs[0].ref;
        newOwnerId = newOwnerSnapshot.docs[0].id;
    } else {
        newOwnerRef = doc(usersRef);
        newOwnerId = newOwnerRef.id;
        // The user document will be created fresh
    }

    // 3. Update the shop with the new owner's ID
    transaction.update(shopRef, { ownerId: newOwnerId });

    // 4. Update the new owner's profile
    const newOwnerProfileData = {
        email: newOwnerEmail,
        role: 'owner',
        shopId: shop.id,
        shopName: shop.name,
        shopNumber: shop.shopNumber,
    };
    transaction.set(newOwnerRef, newOwnerProfileData, { merge: true });

    // 5. If there was an old owner, unlink the shop from their profile
    if (shop.ownerId) {
        const oldOwnerRef = doc(firestore, 'users', shop.ownerId);
        // Check if the old owner document exists before trying to update it
        const oldOwnerDoc = await transaction.get(oldOwnerRef);
        if (oldOwnerDoc.exists()) {
             transaction.update(oldOwnerRef, {
                shopId: '',
                shopName: '',
                shopNumber: '',
                role: 'staff', // Or some other default role
            });
        }
    }
  });
}
