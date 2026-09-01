const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, setDoc } = require('firebase/firestore');

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

async function checkPledgesAndCounters() {
  console.log('=== Checking Counters ===');
  const countersSnap = await getDocs(collection(db, 'counters'));
  const countersMap = {};
  countersSnap.forEach(d => {
    countersMap[d.id] = d.data();
    console.log(d.id, '->', JSON.stringify(d.data()));
  });

  console.log('\n=== Checking Existing Pledges per shop ===');
  const pledgesSnap = await getDocs(collection(db, 'pledges'));
  const pledgesByShop = {};
  pledgesSnap.forEach(d => {
    const data = d.data();
    const shopId = data.shopId || 'NO_SHOP';
    if (!pledgesByShop[shopId]) pledgesByShop[shopId] = [];
    pledgesByShop[shopId].push({ id: d.id, pledgeNumber: data.pledgeNumber, createdAt: data.createdAt });
  });

  const shopsSnap = await getDocs(collection(db, 'shops'));
  const shops = {};
  shopsSnap.forEach(d => { shops[d.id] = d.data(); });

  for (const [shopId, shopData] of Object.entries(shops)) {
    const list = pledgesByShop[shopId] || [];
    const counterKey = `pledge_${shopId}`;
    const currentCounter = countersMap[counterKey]?.lastId || 0;

    let maxPledgeNum = 0;
    list.forEach(p => {
      // IDs format is typically PREFIX-NUMBER or similar
      const parts = p.id.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxPledgeNum) {
        maxPledgeNum = num;
      }
    });

    console.log(`\nShop: "${shopData.name}" (${shopData.prefix || 'No prefix'}) [ID: ${shopId}]`);
    console.log(`  Existing Pledges: ${list.length}`);
    console.log(`  Highest existing pledge number extracted from IDs: ${maxPledgeNum}`);
    console.log(`  Current counter in Firestore (counters/${counterKey}): ${currentCounter}`);

    if (maxPledgeNum > currentCounter) {
      console.log(`  [ALERT] Counter (${currentCounter}) is less than highest existing pledge (${maxPledgeNum})! Next new pledge could collide!`);
    } else {
      console.log(`  [OK] Counter is synchronized. Next pledge ID will be: ${(shopData.prefix || shopData.name.substring(0,3)).toUpperCase()}-${currentCounter + 1}`);
    }
  }
}

checkPledgesAndCounters().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
