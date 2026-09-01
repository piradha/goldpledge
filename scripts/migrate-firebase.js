const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');

const oldConfig = {
  projectId: "studio-9277126120-1485e",
  appId: "1:1070515785158:web:f2359f32ded9cfac0876c7",
  apiKey: "AIzaSyBlnERURInbd_3uACIYBtppJlyj61wET8k",
  authDomain: "studio-9277126120-1485e.firebaseapp.com",
  storageBucket: "studio-9277126120-1485e.appspot.com",
  messagingSenderId: "1070515785158"
};

const newConfig = {
  apiKey: "AIzaSyCjYy0pFG10A5RqNh-wGpE7Qiu54-LAOJw",
  authDomain: "goldpledge-fa9b0.firebaseapp.com",
  projectId: "goldpledge-fa9b0",
  storageBucket: "goldpledge-fa9b0.firebasestorage.app",
  messagingSenderId: "145134285254",
  appId: "1:145134285254:web:fae39d69bb2109b6ce82c7",
  measurementId: "G-BDBKYHHQ8V"
};

const oldApp = initializeApp(oldConfig, 'oldApp');
const newApp = initializeApp(newConfig, 'newApp');

const oldDb = getFirestore(oldApp);
const newDb = getFirestore(newApp);

const collectionsToMigrate = [
  'users',
  'shops',
  'schemes',
  'customers',
  'pledges',
  'payments',
  'bank_pledge_groups'
];

async function run() {
  console.log('=== Starting Firestore Data Migration ===');
  let totalDocsMigrated = 0;

  for (const colName of collectionsToMigrate) {
    console.log(`\nChecking collection: "${colName}"...`);
    try {
      const colRef = collection(oldDb, colName);
      const snapshot = await getDocs(colRef);
      console.log(`Found ${snapshot.docs.length} documents in "${colName}".`);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const targetDocRef = doc(newDb, colName, docSnap.id);
        try {
          await setDoc(targetDocRef, data);
          console.log(`  [SUCCESS] Copied doc ID "${docSnap.id}"`);
          totalDocsMigrated++;
        } catch (writeErr) {
          console.error(`  [WRITE ERROR] Failed to write doc "${docSnap.id}" into new project:`, writeErr.message);
        }
      }
    } catch (readErr) {
      console.error(`  [READ ERROR] Failed to read collection "${colName}" from old project:`, readErr.message);
    }
  }

  console.log(`\n=== Migration Complete: Total ${totalDocsMigrated} documents migrated ===`);
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
