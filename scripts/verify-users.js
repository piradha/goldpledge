const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyCjYy0pFG10A5RqNh-wGpE7Qiu54-LAOJw',
  authDomain: 'goldpledge-fa9b0.firebaseapp.com',
  projectId: 'goldpledge-fa9b0',
  storageBucket: 'goldpledge-fa9b0.firebasestorage.app',
  messagingSenderId: '145134285254',
  appId: '1:145134285254:web:fae39d69bb2109b6ce82c7',
  measurementId: 'G-BDBKYHHQ8V'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const testList = [
  { email: 'puthan@example.com', code: 'PSP' },
  { email: 'thiruchncode@gold.com', code: 'TCD' },
  { email: 'spb@gold.com', code: 'SPB' },
  { email: 'thuvaranai@gold.com', code: 'TVK' },
  { email: 'rsraod@gold.com', code: 'PRS' },
  { email: 'edamalai@gold.com', code: 'TEP' }
];

async function verifyAll() {
  console.log('--- Verifying login and Firestore records for all shops ---');
  for (const item of testList) {
    const cred = await signInWithEmailAndPassword(auth, item.email, '123456');
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    const shopDoc = await getDoc(doc(db, 'shops', userDoc.data().shopId));
    console.log(`[OK] ${item.email} (${item.code}) -> Shop: ${shopDoc.data().name} | Prefix: ${shopDoc.data().prefix} | Shop#: ${shopDoc.data().shopNumber}`);
  }
}

verifyAll().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
