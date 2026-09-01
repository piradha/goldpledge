const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc } = require('firebase/firestore');

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

async function migrateCollectionSequential(colName) {
  console.log(`\n=== Migrating collection: "${colName}" ===`);
  const snapshot = await getDocs(collection(oldDb, colName));
  console.log(`Found ${snapshot.docs.length} documents in old "${colName}".`);

  let count = 0;
  const CHUNK_SIZE = 10;
  
  for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
    const chunk = snapshot.docs.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (docSnap) => {
      const data = docSnap.data();
      const targetRef = doc(newDb, colName, docSnap.id);
      await setDoc(targetRef, data, { merge: true });
    }));
    count += chunk.length;
    if (count % 200 === 0 || count === snapshot.docs.length) {
      console.log(`  Saved ${count} / ${snapshot.docs.length} docs to "${colName}"`);
    }
  }

  console.log(`  Successfully finished "${colName}". Total: ${count}`);
}

async function syncAndValidateCounters() {
  console.log('\n=== Synchronizing and Validating Counters with Live Pledges ===');
  const pledgesSnap = await getDocs(collection(newDb, 'pledges'));
  const maxPledgeByShop = {};

  pledgesSnap.forEach(d => {
    const data = d.data();
    const shopId = data.shopId;
    if (!shopId) return;

    const parts = d.id.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) {
      if (!maxPledgeByShop[shopId] || num > maxPledgeByShop[shopId]) {
        maxPledgeByShop[shopId] = num;
      }
    }
  });

  const shopsSnap = await getDocs(collection(newDb, 'shops'));
  for (const shopDoc of shopsSnap.docs) {
    const shopId = shopDoc.id;
    const shopData = shopDoc.data();
    const maxNum = maxPledgeByShop[shopId] || 0;
    const counterRef = doc(newDb, 'counters', `pledge_${shopId}`);
    
    await setDoc(counterRef, { lastId: maxNum }, { merge: true });
    console.log(`  Shop "${shopData.name}" (${shopData.prefix || 'N/A'}) [${shopId}] -> counter set to lastId = ${maxNum}. Next pledge will be: ${(shopData.prefix || shopData.name.substring(0,3)).toUpperCase()}-${maxNum + 1}`);
  }
}

async function run() {
  await migrateCollectionSequential('customers');
  await migrateCollectionSequential('itemTypes');
  await migrateCollectionSequential('counters');
  await syncAndValidateCounters();
  console.log('\n=== ALL LIVE DATA SYNCED AND VALIDATED SUCCESSFULLY ===');
}

run().then(() => process.exit(0)).catch(e => { console.error('Migration failed:', e); process.exit(1); });
