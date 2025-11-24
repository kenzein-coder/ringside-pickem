#!/usr/bin/env node

/**
 * Reset All Accounts Script
 * WARNING: This will delete ALL user accounts and their data from Firestore
 * 
 * Usage: node scripts/reset-all-accounts.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase initialization
let db = null;
let appId = 'default-app-id';

function initFirebase() {
  try {
    const envPath = join(__dirname, '../.env');
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf-8');
      const envVars = {};
      envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) {
          envVars[match[1].trim()] = match[2].trim();
        }
      });
      
      if (envVars.VITE_FIREBASE_API_KEY && envVars.VITE_FIREBASE_API_KEY !== 'AIzaSyD...') {
        const firebaseConfig = {
          apiKey: envVars.VITE_FIREBASE_API_KEY,
          authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: envVars.VITE_FIREBASE_PROJECT_ID,
          storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: envVars.VITE_FIREBASE_APP_ID
        };
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        appId = envVars.VITE_FIREBASE_PROJECT_ID || 'default-app-id';
        console.log('✅ Firebase initialized\n');
        return true;
      }
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error.message);
  }
  return false;
}

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
  if (!db) {
    console.error('❌ Firebase not initialized. Please check your .env file.');
    process.exit(1);
  }

  console.log('⚠️  WARNING: This will delete ALL user accounts and their data!');
  console.log('This includes:');
  console.log('  - All user profiles');
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

  console.log('\n🔄 Starting reset...\n');

  try {
    // Get all users
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    console.log(`📊 Found ${usersSnapshot.size} user accounts\n`);

    // Delete all user profiles
    let deletedUsers = 0;
    const batch = writeBatch(db);
    let batchCount = 0;

    usersSnapshot.forEach((userDoc) => {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', userDoc.id);
      batch.delete(userRef);
      batchCount++;
      deletedUsers++;

      // Firestore batch limit is 500
      if (batchCount >= 500) {
        console.log(`  Deleting batch of ${batchCount} users...`);
        batchCount = 0;
      }
    });

    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Deleted ${deletedUsers} user profiles\n`);
    }

    // Delete all predictions - need to find all user UIDs that have predictions
    console.log('🔄 Deleting all predictions...');
    let deletedPredictions = 0;
    
    // First, try to get users from profiles
    const allUsersSnapshot = await getDocs(usersRef);
    const userIdsFromProfiles = new Set(allUsersSnapshot.docs.map(doc => doc.id));
    
    // Also check the users collection directly for any UIDs that might have predictions
    // but no profile
    try {
      const usersCollectionRef = collection(db, 'artifacts', appId, 'users');
      const usersCollectionSnapshot = await getDocs(usersCollectionRef);
      usersCollectionSnapshot.docs.forEach(userDoc => {
        userIdsFromProfiles.add(userDoc.id);
      });
    } catch (error) {
      console.log('  (Could not access users collection directly)');
    }
    
    // Delete predictions for all found user IDs
    for (const userId of userIdsFromProfiles) {
      try {
        const predictionsRef = collection(db, 'artifacts', appId, 'users', userId, 'predictions');
        const predictionsSnapshot = await getDocs(predictionsRef);
        
        const predBatch = writeBatch(db);
        let predBatchCount = 0;
        
        predictionsSnapshot.forEach((predDoc) => {
          const predRef = doc(db, 'artifacts', appId, 'users', userId, 'predictions', predDoc.id);
          predBatch.delete(predRef);
          predBatchCount++;
          deletedPredictions++;
        });

        if (predBatchCount > 0) {
          await predBatch.commit();
        }
      } catch (error) {
        // Skip if collection doesn't exist or can't be accessed
        console.log(`  (Skipping predictions for user ${userId})`);
      }
    }

    console.log(`✅ Deleted ${deletedPredictions} prediction documents\n`);

    // Reset global scores
    console.log('🔄 Resetting global scores...');
    const scoresRef = doc(db, 'artifacts', appId, 'public', 'data', 'scores', 'global');
    try {
      await deleteDoc(scoresRef);
      console.log('✅ Reset global scores\n');
    } catch (error) {
      console.log('⚠️  Could not reset scores (may not exist)\n');
    }

    console.log('✅ Reset complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Deleted ${deletedUsers} user accounts`);
    console.log(`   - Deleted ${deletedPredictions} prediction documents`);
    console.log(`   - Reset global scores`);

  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  }
}

// Main execution
if (initFirebase()) {
  resetAllAccounts().then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
} else {
  console.error('❌ Failed to initialize Firebase');
  process.exit(1);
}

