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

const checkCols = [
  'users',
  'shops',
  'schemes',
  'customers',
  'pledges',
  'payments',
  'bank_pledge_groups',
  'counters',
  'itemTypes'
];

async function compare() {
  console.log('=== Comparing Collections between Old DB and New DB ===\n');
  for (const col of checkCols) {
    let oldCount = 'Error';
    let newCount = 'Error';
    try {
      const snapOld = await getDocs(collection(oldDb, col));
      oldCount = snapOld.size;
    } catch (e) {
      oldCount = `ERR: ${e.message}`;
    }

    try {
      const snapNew = await getDocs(collection(newDb, col));
      newCount = snapNew.size;
    } catch (e) {
      newCount = `ERR: ${e.message}`;
    }

    console.log(`Collection "${col}": Old = ${oldCount} | New = ${newCount}`);
  }
}

compare().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
