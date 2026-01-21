const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkUserSubscriptions() {
  console.log('🔍 Checking user subscriptions in Firestore...\n');
  
  // Get all users
  const usersRef = db.collection('artifacts/ringside-pick-em/public/data/users');
  const snapshot = await usersRef.get();
  
  console.log(`Found ${snapshot.size} users\n`);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`👤 User: ${data.displayName || 'Unknown'}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Subscriptions:`, data.subscriptions || []);
    console.log(`   Score: ${data.score || 0}`);
    console.log('');
  });
  
  process.exit(0);
}

checkUserSubscriptions().catch(console.error);
