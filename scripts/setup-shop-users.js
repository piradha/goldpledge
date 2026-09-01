const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCjYy0pFG10A5RqNh-wGpE7Qiu54-LAOJw",
  authDomain: "goldpledge-fa9b0.firebaseapp.com",
  projectId: "goldpledge-fa9b0",
  storageBucket: "goldpledge-fa9b0.firebasestorage.app",
  messagingSenderId: "145134285254",
  appId: "1:145134285254:web:fae39d69bb2109b6ce82c7",
  measurementId: "G-BDBKYHHQ8V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const shopUsers = [
  {
    email: 'puthan@example.com',
    code: 'PSP',
    password: '123456',
    shopId: '0o4TSfHhuCd37ZoQxz3h',
    shopName: 'Puthan Santhai',
    shopNumber: '1765986674803',
    role: 'owner'
  },
  {
    email: 'thiruchncode@gold.com',
    code: 'TCD',
    password: '123456',
    shopId: 'UQvHmSSNiKLi3xds9uy6',
    shopName: 'Thiruchncode',
    shopNumber: '1765986477048',
    role: 'owner'
  },
  {
    email: 'spb@gold.com',
    code: 'SPB',
    password: '123456',
    shopId: 'Zyqas9Cpj0p2T2rCaWnR',
    shopName: 'SPB Colony',
    shopNumber: '1765982003719',
    role: 'owner'
  },
  {
    email: 'thuvaranai@gold.com',
    code: 'TVK',
    password: '123456',
    shopId: 'aR41oHzO8cenCHxp5zZy',
    shopName: 'Thuvarankurichi',
    shopNumber: '1765986433894',
    role: 'owner'
  },
  {
    email: 'rsraod@gold.com',
    code: 'PRS',
    password: '123456',
    shopId: 'l1gA9gUsTtU27LHGkyc1',
    shopName: 'RS Road',
    shopNumber: '1765980573998',
    role: 'owner'
  },
  {
    email: 'edamalai@gold.com',
    code: 'TEP',
    password: '123456',
    shopId: 'lrSHGd20Hzk8bjJUiUEQ',
    shopName: 'Edamalaipatty Puthur',
    shopNumber: '1765986388008',
    role: 'owner'
  },
  {
    email: 'ram@gold.com',
    code: 'ADMIN',
    password: '123456',
    shopId: 'J3fLurTSKP8Rx2XiyE7k',
    shopName: 'Test Shop',
    shopNumber: '1766334511278',
    role: 'admin'
  }
];

async function syncUsersAndShops() {
  console.log('--- Checking and synchronizing Auth & Firestore User Profiles ---');
  
  // 1. Fetch current users collection in Firestore
  const currentUsersSnap = await getDocs(collection(db, 'users'));
  const currentUsers = [];
  currentUsersSnap.forEach(d => currentUsers.push({ docId: d.id, ...d.data() }));

  console.log(`Found ${currentUsers.length} existing user documents in Firestore.`);

  for (const item of shopUsers) {
    console.log(`\nProcessing: ${item.email} (${item.code})`);
    
    // Login to verify Auth and get UID
    let uid = null;
    try {
      const userCred = await signInWithEmailAndPassword(auth, item.email, item.password);
      uid = userCred.user.uid;
      console.log(`  Auth Verified. UID: ${uid}`);
    } catch (err) {
      console.error(`  Auth failed for ${item.email}:`, err.message);
      continue;
    }

    // Prepare profile data
    const profileData = {
      id: uid,
      email: item.email,
      shopId: item.shopId,
      shopName: item.shopName,
      shopNumber: item.shopNumber,
      role: item.role
    };

    // Save profile with doc ID = uid (matches firestore.rules and standard structure)
    await setDoc(doc(db, 'users', uid), profileData, { merge: true });
    console.log(`  Saved /users/${uid}:`, profileData);

    // Update shop doc with ownerId = uid
    if (item.shopId) {
      try {
        await updateDoc(doc(db, 'shops', item.shopId), {
          ownerId: uid,
          name: item.shopName,
          shopNumber: item.shopNumber,
          prefix: item.code === 'ADMIN' ? '' : item.code
        });
        console.log(`  Updated /shops/${item.shopId} ownerId to ${uid}`);
      } catch (shopErr) {
        console.error(`  Error updating shop ${item.shopId}:`, shopErr.message);
      }
    }

    // Clean up any stale user docs with matching email but old/wrong docId
    for (const oldUser of currentUsers) {
      if (oldUser.email === item.email && oldUser.docId !== uid) {
        console.log(`  Removing stale user document: /users/${oldUser.docId} (${oldUser.email})`);
        await deleteDoc(doc(db, 'users', oldUser.docId));
      }
    }
  }

  console.log('\n=== All shop users configured successfully! ===');
}

syncUsersAndShops()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
