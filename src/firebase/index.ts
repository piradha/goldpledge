'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore } from 'firebase/firestore';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (getApps().length === 0) {
    // If no apps are initialized, initialize with the config object.
    // This is the standard path for client-side web apps.
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  } else {
    // If an app is already initialized, get the existing app and return its SDKs.
    // This prevents re-initialization errors.
    return getSdks(getApp());
  }
}


export function getSdks(firebaseApp: FirebaseApp) {
  let firestore: Firestore;
  try {
    firestore = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (e) {
    // Fallback if already initialized (e.g. fast-refresh / re-render)
    firestore = getFirestore(firebaseApp);
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './firestore/repledge-history';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';