const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, limit, query } = require('firebase/firestore');

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

async function testCustomerMigration() {
  const snap = await getDocs(query(collection(oldDb, 'customers'), limit(3)));
  console.log(`Fetched ${snap.size} sample customers from oldDb`);
  for (const d of snap.docs) {
    console.log('Customer doc ID:', d.id);
    console.log('Data:', JSON.stringify(d.data()));
    try {
      await setDoc(doc(newDb, 'customers', d.id), d.data());
      console.log('Successfully wrote to newDb!');
    } catch (e) {
      console.error('Error writing to newDb:', e.message);
    }
  }
}

testCustomerMigration().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
