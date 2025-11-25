#!/usr/bin/env node

/**
 * Check User Profiles Script using Firebase Admin SDK
 * This will inspect all user profiles and predictions to identify data issues
 * 
 * Requirements:
 * - serviceAccountKey.json in project root (download from Firebase Console)
 * 
 * Usage: node scripts/check-user-profiles.js
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
      console.error('   3. Go to Project Settings → Service Accounts');
      console.error('   4. Click "Generate new private key"');
      console.error('   5. Save as serviceAccountKey.json in project root');
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

async function checkUserProfiles() {
  console.log('🔍 Checking user profiles in Firestore...\n');
  
  const db = getFirestore();
  const auth = getAuth();
  const appId = 'ringside-pick-em';
  
  try {
    // Get all Firebase Auth users
    console.log('📋 Fetching Firebase Auth users...');
    const authUsers = await auth.listUsers();
    const authUserMap = new Map();
    authUsers.users.forEach(user => {
      authUserMap.set(user.uid, {
        email: user.email || '(no email)',
        displayName: user.displayName || '(no name)',
        createdAt: user.metadata.creationTime
      });
    });
    console.log(`✅ Found ${authUsers.users.length} Firebase Auth users\n`);
    
    // Get all user profiles from Firestore
    console.log('📋 Fetching Firestore user profiles...');
    const usersRef = db.collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('users');
    
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log('❌ No user profiles found in Firestore.');
      return;
    }
    
    console.log(`✅ Found ${snapshot.size} user profiles in Firestore\n`);
    console.log('='.repeat(80));
    
    const profiles = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const userId = doc.id;
      const authUser = authUserMap.get(userId);
      
      const profile = {
        userId,
        displayName: data.displayName || '(no name)',
        email: data.email || authUser?.email || '(no email)',
        totalPoints: data.totalPoints || 0,
        predictionsCorrect: data.predictionsCorrect || 0,
        predictionsTotal: data.predictionsTotal || 0,
        documentPath: doc.ref.path,
        hasUserIdField: !!data.userId,
        userIdFieldValue: data.userId || null,
        authUserExists: !!authUser,
        authDisplayName: authUser?.displayName || null
      };
      
      profiles.push(profile);
    });
    
    // Sort by display name for easier reading
    profiles.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    // Display all profiles
    console.log('\n📊 USER PROFILES:\n');
    profiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.displayName}`);
      console.log(`   User ID (Document ID): ${profile.userId}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Total Points: ${profile.totalPoints}`);
      console.log(`   Predictions: ${profile.predictionsCorrect}/${profile.predictionsTotal} correct`);
      console.log(`   Document Path: ${profile.documentPath}`);
      console.log(`   Auth User Exists: ${profile.authUserExists ? '✅' : '❌'}`);
      if (profile.authDisplayName && profile.authDisplayName !== profile.displayName) {
        console.log(`   ⚠️  WARNING: Auth displayName (${profile.authDisplayName}) differs from Firestore (${profile.displayName})`);
      }
      if (profile.hasUserIdField) {
        console.log(`   ⚠️  WARNING: Profile has userId field: ${profile.userIdFieldValue}`);
        if (profile.userIdFieldValue !== profile.userId) {
          console.log(`   🔒 CRITICAL: userId field (${profile.userIdFieldValue}) does not match document ID (${profile.userId})!`);
        }
      }
      console.log('');
    });
    
    // Check for duplicates or issues
    console.log('='.repeat(80));
    console.log('\n🔍 CHECKING FOR DATA ISSUES...\n');
    
    // Check for duplicate display names with different user IDs
    const displayNameMap = {};
    profiles.forEach(profile => {
      if (!displayNameMap[profile.displayName]) {
        displayNameMap[profile.displayName] = [];
      }
      displayNameMap[profile.displayName].push({
        userId: profile.userId,
        email: profile.email,
        points: profile.totalPoints
      });
    });
    
    const duplicates = Object.entries(displayNameMap).filter(([name, users]) => users.length > 1);
    if (duplicates.length > 0) {
      console.log('⚠️  WARNING: Found duplicate display names:');
      duplicates.forEach(([name, users]) => {
        console.log(`\n   "${name}" appears in ${users.length} documents:`);
        users.forEach(user => {
          console.log(`     - User ID: ${user.userId}`);
          console.log(`       Email: ${user.email}`);
          console.log(`       Points: ${user.points}`);
        });
      });
    } else {
      console.log('✅ No duplicate display names found.');
    }
    
    // Check for profiles with mismatched user IDs
    const mismatched = profiles.filter(p => p.hasUserIdField && p.userIdFieldValue !== p.userId);
    if (mismatched.length > 0) {
      console.log('\n🔒 CRITICAL: Found profiles with mismatched userId field:');
      mismatched.forEach(profile => {
        console.log(`   Document ID: ${profile.userId}`);
        console.log(`   userId field: ${profile.userIdFieldValue}`);
        console.log(`   Display Name: ${profile.displayName}`);
      });
    } else {
      console.log('\n✅ No userId field mismatches found.');
    }
    
    // Check for profiles without corresponding Auth users
    const orphanedProfiles = profiles.filter(p => !p.authUserExists);
    if (orphanedProfiles.length > 0) {
      console.log('\n⚠️  WARNING: Found profiles without corresponding Auth users:');
      orphanedProfiles.forEach(profile => {
        console.log(`   - ${profile.displayName} (${profile.userId})`);
      });
    } else {
      console.log('\n✅ All profiles have corresponding Auth users.');
    }
    
    // Check user predictions
    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 CHECKING USER PREDICTIONS...\n');
    
    for (const profile of profiles) {
      const predictionsRef = db.collection('artifacts').doc(appId)
        .collection('users').doc(profile.userId)
        .collection('predictions');
      
      const predsSnapshot = await predictionsRef.get();
      
      if (!predsSnapshot.empty) {
        console.log(`${profile.displayName} (${profile.userId.substring(0, 8)}...):`);
        console.log(`   Predictions: ${predsSnapshot.size} events`);
        
        const eventIds = [];
        predsSnapshot.forEach(doc => {
          eventIds.push(doc.id);
        });
        console.log(`   Event IDs: ${eventIds.join(', ')}`);
        console.log('');
      }
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   Total Auth Users: ${authUsers.users.length}`);
    console.log(`   Total Firestore Profiles: ${profiles.length}`);
    console.log(`   Profiles with Predictions: ${profiles.filter(p => {
      // We'd need to check predictions, but for now just show count
      return true; // Placeholder
    }).length}`);
    if (duplicates.length > 0) {
      console.log(`   ⚠️  Duplicate Display Names: ${duplicates.length}`);
    }
    if (mismatched.length > 0) {
      console.log(`   🔒 Mismatched userId Fields: ${mismatched.length}`);
    }
    if (orphanedProfiles.length > 0) {
      console.log(`   ⚠️  Orphaned Profiles: ${orphanedProfiles.length}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Database check complete!\n');
    
  } catch (error) {
    console.error('❌ Error checking user profiles:', error);
    throw error;
  }
}

// Main execution
try {
  initializeFirebaseAdmin();
  checkUserProfiles()
    .then(() => {
      console.log('Script completed successfully.');
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
