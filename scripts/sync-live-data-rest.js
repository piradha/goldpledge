const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const oldConfig = {
  projectId: "studio-9277126120-1485e",
  appId: "1:1070515785158:web:f2359f32ded9cfac0876c7",
  apiKey: "AIzaSyBlnERURInbd_3uACIYBtppJlyj61wET8k",
  authDomain: "studio-9277126120-1485e.firebaseapp.com",
  storageBucket: "studio-9277126120-1485e.appspot.com",
  messagingSenderId: "1070515785158"
};

const newApiKey = "AIzaSyCjYy0pFG10A5RqNh-wGpE7Qiu54-LAOJw";
const newProjectId = "goldpledge-fa9b0";

const oldApp = initializeApp(oldConfig, 'oldApp');
const oldDb = getFirestore(oldApp);

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

async function commitBatchRest(writes) {
  const url = `https://firestore.googleapis.com/v1/projects/${newProjectId}/databases/(default)/documents:commit?key=${newApiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`REST commit failed (${res.status}): ${errText}`);
  }
}

async function migrateCollectionRest(colName, batchSize = 25) {
  console.log(`\n=== Migrating collection via REST: "${colName}" (batch size: ${batchSize}) ===`);
  const snapshot = await getDocs(collection(oldDb, colName));
  console.log(`Found ${snapshot.docs.length} documents in old "${colName}".`);

  let writes = [];
  let totalCommitted = 0;

  for (let i = 0; i < snapshot.docs.length; i++) {
    const docSnap = snapshot.docs[i];
    const data = docSnap.data();
    const docPath = `projects/${newProjectId}/databases/(default)/documents/${colName}/${docSnap.id}`;

    writes.push({
      update: {
        name: docPath,
        fields: toFirestoreFields(data)
      }
    });

    if (writes.length >= batchSize || i === snapshot.docs.length - 1) {
      await commitBatchRest(writes);
      totalCommitted += writes.length;
      if (totalCommitted % 200 === 0 || totalCommitted === snapshot.docs.length) {
        console.log(`  Committed ${totalCommitted} / ${snapshot.docs.length} docs to "${colName}"`);
      }
      writes = [];
    }
  }

  console.log(`  Finished "${colName}" successfully!`);
}

async function syncAndValidateCounters() {
  console.log('\n=== Synchronizing and Validating Counters with Live Pledges ===');
  
  const oldPledges = await getDocs(collection(oldDb, 'pledges'));
  const maxPledgeByShop = {};

  oldPledges.forEach(d => {
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

  const oldShops = await getDocs(collection(oldDb, 'shops'));
  const counterWrites = [];

  for (const shopDoc of oldShops.docs) {
    const shopId = shopDoc.id;
    const shopData = shopDoc.data();
    const maxNum = maxPledgeByShop[shopId] || 0;
    const docPath = `projects/${newProjectId}/databases/(default)/documents/counters/pledge_${shopId}`;

    counterWrites.push({
      update: {
        name: docPath,
        fields: {
          lastId: { integerValue: String(maxNum) }
        }
      }
    });

    console.log(`  Shop "${shopData.name}" (${shopData.prefix || 'N/A'}) [${shopId}] -> counter set to lastId = ${maxNum}. Next pledge will be: ${(shopData.prefix || shopData.name.substring(0,3)).toUpperCase()}-${maxNum + 1}`);
  }

  await commitBatchRest(counterWrites);
  console.log('  Counters successfully saved to Firestore!');
}

async function run() {
  await migrateCollectionRest('customers', 20);
  await migrateCollectionRest('itemTypes', 50);
  await syncAndValidateCounters();
  console.log('\n=== ALL LIVE DATA SYNCED AND VALIDATED SUCCESSFULLY VIA REST ===');
}

run().then(() => process.exit(0)).catch(e => { console.error('Migration failed:', e); process.exit(1); });
