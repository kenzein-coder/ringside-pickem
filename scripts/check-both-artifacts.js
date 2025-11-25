#!/usr/bin/env node

/**
 * Check Both Artifacts Script
 * This will check both 'default-app-id' and 'ringside-pick-em' artifacts
 * to see which one is being used and which can be safely removed
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  try {
    const projectRoot = join(__dirname, '..');
    let serviceAccountPath = join(projectRoot, 'serviceAccountKey.json');
    
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
      process.exit(1);
    }
    
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    initializeApp({
      credential: cert(serviceAccount)
    });
    
    console.log('✅ Firebase Admin SDK initialized\n');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    process.exit(1);
  }
}

async function checkArtifact(appId, db) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Checking artifact: "${appId}"`);
  console.log('='.repeat(80));
  
  try {
    const artifactRef = db.collection('artifacts').doc(appId);
    
    // Check users (this is the main indicator if the artifact exists)
    const usersRef = artifactRef.collection('public').doc('data').collection('users');
    const usersSnapshot = await usersRef.get();
    const userCount = usersSnapshot.size;
    
    if (userCount === 0) {
      // Check if there are any subcollections at all
      const publicRef = artifactRef.collection('public');
      const publicSnapshot = await publicRef.get();
      
      if (publicSnapshot.empty) {
        console.log(`❌ Artifact "${appId}" does not exist or has no data in Firestore.`);
        return { exists: false, users: 0, predictions: 0, events: 0 };
      }
    }
    
    console.log(`✅ Artifact "${appId}" exists.`);
    console.log(`   Users: ${userCount}`);
    
    if (userCount > 0) {
      console.log(`   User IDs:`);
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`     - ${doc.id}: ${data.displayName || '(no name)'} (${data.totalPoints || 0} points)`);
      });
    }
    
    // Check predictions (need to check each user)
    let totalPredictions = 0;
    const userPredictions = {};
    if (userCount > 0) {
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const predsRef = artifactRef.collection('users').doc(userId).collection('predictions');
        const predsSnapshot = await predsRef.get();
        const predCount = predsSnapshot.size;
        totalPredictions += predCount;
        if (predCount > 0) {
          userPredictions[userId] = predCount;
        }
      }
    }
    console.log(`   Total Predictions: ${totalPredictions}`);
    if (totalPredictions > 0) {
      console.log(`   Predictions by user:`);
      Object.entries(userPredictions).forEach(([userId, count]) => {
        const userDoc = usersSnapshot.docs.find(d => d.id === userId);
        const userName = userDoc?.data()?.displayName || userId.substring(0, 8);
        console.log(`     - ${userName}: ${count} events`);
      });
    }
    
    // Check events
    const eventsRef = artifactRef.collection('public').doc('data').collection('events');
    const eventsSnapshot = await eventsRef.get();
    const eventCount = eventsSnapshot.size;
    console.log(`   Events: ${eventCount}`);
    
    // Check scores
    const scoresRef = artifactRef.collection('public').doc('data').collection('scores');
    const scoresDoc = await scoresRef.doc('global').get();
    const hasScores = scoresDoc.exists;
    console.log(`   Global Scores: ${hasScores ? '✅' : '❌'}`);
    
    return {
      exists: true,
      users: userCount,
      predictions: totalPredictions,
      events: eventCount,
      hasScores
    };
    
  } catch (error) {
    console.error(`❌ Error checking artifact "${appId}":`, error.message);
    return { exists: false, error: error.message };
  }
}

async function checkBothArtifacts() {
  console.log('🔍 Checking both artifacts in Firestore...\n');
  
  const db = getFirestore();
  const artifacts = ['default-app-id', 'ringside-pick-em'];
  
  const results = {};
  
  for (const appId of artifacts) {
    results[appId] = await checkArtifact(appId, db);
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  artifacts.forEach(appId => {
    const result = results[appId];
    console.log(`\n${appId}:`);
    if (result.exists) {
      console.log(`   ✅ Exists`);
      console.log(`   Users: ${result.users}`);
      console.log(`   Predictions: ${result.predictions}`);
      console.log(`   Events: ${result.events}`);
      console.log(`   Has Scores: ${result.hasScores ? 'Yes' : 'No'}`);
    } else {
      console.log(`   ❌ Does not exist`);
    }
  });
  
  // Determine which one is active
  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMMENDATION');
  console.log('='.repeat(80));
  
  const defaultResult = results['default-app-id'];
  const ringsideResult = results['ringside-pick-em'];
  
  if (ringsideResult.exists && ringsideResult.users > 0) {
    console.log('\n✅ "ringside-pick-em" appears to be the ACTIVE artifact:');
    console.log(`   - Has ${ringsideResult.users} users`);
    console.log(`   - Has ${ringsideResult.predictions} predictions`);
    console.log(`   - Has ${ringsideResult.events} events`);
    
    if (defaultResult.exists && defaultResult.users === 0) {
      console.log('\n🗑️  "default-app-id" can likely be safely removed:');
      console.log('   - Has no users or data');
    } else if (defaultResult.exists && defaultResult.users > 0) {
      console.log('\n⚠️  WARNING: "default-app-id" also has data:');
      console.log(`   - Has ${defaultResult.users} users`);
      console.log(`   - Has ${defaultResult.predictions} predictions`);
      console.log('\n   You may need to migrate data or verify which one is correct.');
    }
  } else if (defaultResult.exists && defaultResult.users > 0) {
    console.log('\n✅ "default-app-id" appears to be the ACTIVE artifact:');
    console.log(`   - Has ${defaultResult.users} users`);
    console.log(`   - Has ${defaultResult.predictions} predictions`);
    console.log('\n⚠️  Your app is configured to use "ringside-pick-em" but data is in "default-app-id"');
    console.log('   You may need to update the appId in your code or migrate the data.');
  } else {
    console.log('\n⚠️  Neither artifact has significant data.');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete!\n');
}

// Main execution
try {
  initializeFirebaseAdmin();
  checkBothArtifacts()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
} catch (error) {
  console.error('Failed to initialize:', error);
  process.exit(1);
}

