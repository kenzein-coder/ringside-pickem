#!/usr/bin/env node

/**
 * Complete Reset Script using Firebase Admin SDK
 * This will delete:
 * - All Firebase Authentication users
 * - All Firestore user profiles
 * - All predictions
 * - All scores
 * 
 * Requirements:
 * - serviceAccountKey.json in project root (download from Firebase Console)
 * 
 * Usage: node scripts/reset-all-accounts-admin.js --yes
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  try {
    const projectRoot = join(__dirname, '..');
    
    // Try serviceAccountKey.json first
    let serviceAccountPath = join(projectRoot, 'serviceAccountKey.json');
    
    // If not found, look for any firebase-adminsdk JSON files
    if (!existsSync(serviceAccountPath)) {
      const files = readdirSync(projectRoot);
      const adminKeyFile = files.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));
      if (adminKeyFile) {
        serviceAccountPath = join(projectRoot, adminKeyFile);
        console.log(`📁 Found service account key: ${adminKeyFile}`);
      }
    }
    
    if (!existsSync(serviceAccountPath)) {
      console.error('❌ Service account key file not found!');
      console.error('\n📋 To get your service account key:');
      console.error('   1. Go to: https://console.firebase.google.com/');
      console.error('   2. Select your project: ringside-pick-em');
      console.error('   3. Go to: Project Settings → Service Accounts');
      console.error('   4. Click "Generate new private key"');
      console.error('   5. Save the file in the project root');
      console.error('   6. Make sure it\'s in .gitignore (it should be)\n');
      return false;
    }
    
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
    
    initializeApp({
      credential: cert(serviceAccount)
    });
    
    console.log('✅ Firebase Admin SDK initialized\n');
    return true;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    return false;
  }
}

// Function to ask a question in interactive mode
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function resetAllAccounts() {
  if (!initializeFirebaseAdmin()) {
    process.exit(1);
  }

  const db = getFirestore();
  const auth = getAuth();
  const appId = process.env.VITE_FIREBASE_PROJECT_ID || 'ringside-pick-em';

  console.log('⚠️  WARNING: This will delete ALL user accounts and their data!');
  console.log('This includes:');
  console.log('  - All Firebase Authentication users');
  console.log('  - All user profiles in Firestore');
  console.log('  - All predictions');
  console.log('  - All leaderboard data');
  console.log('  - All scores\n');

  // Check for --yes flag for non-interactive mode
  const skipConfirmation = process.argv.includes('--yes') || process.argv.includes('-y');
  
  if (!skipConfirmation) {
    const confirmation = await askQuestion('Type "RESET ALL" to confirm: ');
    
    if (confirmation !== 'RESET ALL') {
      console.log('❌ Reset cancelled.');
      process.exit(0);
    }
  } else {
    console.log('⚠️  Running in non-interactive mode (--yes flag detected)\n');
  }

  console.log('\n🔄 Starting complete reset...\n');

  try {
    // 1. Delete all Firebase Authentication users
    console.log('🔄 Deleting Firebase Authentication users...');
    let deletedAuthUsers = 0;
    let nextPageToken;
    
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      const uidsToDelete = listUsersResult.users.map(userRecord => userRecord.uid);
      
      if (uidsToDelete.length > 0) {
        // Delete in batches of 1000 (Firebase limit)
        for (let i = 0; i < uidsToDelete.length; i += 1000) {
          const batch = uidsToDelete.slice(i, i + 1000);
          await auth.deleteUsers(batch);
          deletedAuthUsers += batch.length;
          console.log(`   Deleted ${batch.length} auth users (total: ${deletedAuthUsers})`);
        }
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    console.log(`✅ Deleted ${deletedAuthUsers} Firebase Authentication users\n`);

    // 2. Delete all user profiles from Firestore
    console.log('🔄 Deleting user profiles from Firestore...');
    const usersRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users');
    const userDocs = await usersRef.listDocuments();
    
    let deletedProfiles = 0;
    const batch = db.batch();
    userDocs.forEach((docRef, index) => {
      batch.delete(docRef);
      deletedProfiles++;
      
      // Firestore batch limit is 500
      if ((index + 1) % 500 === 0) {
        console.log(`   Committing batch of 500 profiles...`);
      }
    });
    
    if (deletedProfiles > 0) {
      await batch.commit();
    }
    console.log(`✅ Deleted ${deletedProfiles} user profiles\n`);

    // 3. Delete all predictions
    console.log('🔄 Deleting all predictions...');
    let deletedPredictions = 0;
    
    // Get all user UIDs from the users collection
    const usersCollectionRef = db.collection('artifacts').doc(appId).collection('users');
    const usersCollectionSnapshot = await usersCollectionRef.listDocuments();
    
    for (const userDocRef of usersCollectionSnapshot) {
      try {
        const predictionsRef = userDocRef.collection('predictions');
        const predictionsSnapshot = await predictionsRef.listDocuments();
        
        const predBatch = db.batch();
        predictionsSnapshot.forEach((predDocRef) => {
          predBatch.delete(predDocRef);
          deletedPredictions++;
        });
        
        if (predictionsSnapshot.length > 0) {
          await predBatch.commit();
        }
      } catch (error) {
        // Skip if collection doesn't exist
        console.log(`   (Skipping predictions for user ${userDocRef.id})`);
      }
    }
    
    console.log(`✅ Deleted ${deletedPredictions} prediction documents\n`);

    // 4. Reset global scores
    console.log('🔄 Resetting global scores...');
    const scoresRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('scores').doc('global');
    try {
      await scoresRef.delete();
      console.log('✅ Reset global scores\n');
    } catch (error) {
      console.log('⚠️  Could not reset scores (may not exist)\n');
    }

    // 5. Reset images cache
    console.log('🔄 Resetting images cache...');
    const imagesRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('images');
    try {
      const imageTypes = ['promotions', 'wrestlers', 'events'];
      let deletedImages = 0;
      
      for (const imageType of imageTypes) {
        const imageTypeRef = imagesRef.doc(imageType);
        const imageDoc = await imageTypeRef.get();
        if (imageDoc.exists()) {
          await imageTypeRef.delete();
          deletedImages++;
          console.log(`   Deleted ${imageType} images cache`);
        }
      }
      
      if (deletedImages > 0) {
        console.log(`✅ Reset ${deletedImages} image cache collections\n`);
      } else {
        console.log('✅ No image cache to reset\n');
      }
    } catch (error) {
      console.log('⚠️  Could not reset images cache (may not exist)\n');
    }

    console.log('✅ Complete reset finished!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Deleted ${deletedAuthUsers} Firebase Authentication users`);
    console.log(`   - Deleted ${deletedProfiles} user profiles`);
    console.log(`   - Deleted ${deletedPredictions} prediction documents`);
    console.log(`   - Reset global scores`);
    console.log(`   - Reset images cache`);

  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  }
}

// Main execution
resetAllAccounts().then(() => {
  console.log('\n✅ All done!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

