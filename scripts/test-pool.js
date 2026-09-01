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

async function testConcurrent() {
  const snap = await getDocs(collection(oldDb, 'customers'));
  console.log(`Fetched ${snap.docs.length} docs. Testing pool write...`);
  
  const pool = [];
  const CONCURRENCY = 15;
  let count = 0;

  for (const d of snap.docs) {
    const p = setDoc(doc(newDb, 'customers', d.id), d.data()).then(() => {
      count++;
      if (count % 200 === 0) {
        console.log(`Saved ${count} / ${snap.docs.length}...`);
      }
    });
    pool.push(p);
    if (pool.length >= CONCURRENCY) {
      await Promise.race(pool);
      // remove finished promises
      for (let i = pool.length - 1; i >= 0; i--) {
        // If settled, remove
      }
    }
  }
}
