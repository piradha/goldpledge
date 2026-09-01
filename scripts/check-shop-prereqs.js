const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

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
const db = getFirestore(app);

async function checkShopPrerequisites() {
  const shopsSnap = await getDocs(collection(db, 'shops'));
  for (const shopDoc of shopsSnap.docs) {
    const shop = shopDoc.data();
    const shopId = shopDoc.id;
    console.log(`\n=== Checking Shop: ${shop.name} (${shop.prefix}) [${shopId}] ===`);

    // Check customers
    const custSnap = await getDocs(collection(db, 'customers'));
    const shopCusts = custSnap.docs.filter(d => d.data().shopId === shopId);
    console.log(`  Customers: ${shopCusts.length}`);

    // Check schemes
    const schemeSnap = await getDocs(collection(db, 'schemes'));
    const shopSchemes = schemeSnap.docs.filter(d => d.data().shopId === shopId);
    console.log(`  Schemes: ${shopSchemes.length}`);

    // Check itemTypes
    const goldItemTypeDoc = await getDoc(doc(db, 'itemTypes', `Gold_${shopId}`));
    const silverItemTypeDoc = await getDoc(doc(db, 'itemTypes', `Silver_${shopId}`));
    console.log(`  Gold itemTypes: ${goldItemTypeDoc.exists() ? goldItemTypeDoc.data().types?.length : 'NOT_FOUND'}`);
    console.log(`  Silver itemTypes: ${silverItemTypeDoc.exists() ? silverItemTypeDoc.data().types?.length : 'NOT_FOUND'}`);
  }
}

checkShopPrerequisites().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
