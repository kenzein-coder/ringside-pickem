#!/usr/bin/env node

/**
 * Compare Firebase Auth Users with Firestore User Profiles
 * This will check if Auth users match Firestore profiles and identify discrepancies
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

async function compareUsers() {
  console.log('🔍 Comparing Firebase Auth users with Firestore profiles...\n');
  
  const db = getFirestore();
  const auth = getAuth();
  const appId = 'ringside-pick-em';
  
  try {
    // Get all Firebase Auth users
    console.log('📋 Fetching Firebase Auth users...');
    const authUsersResult = await auth.listUsers();
    const authUsers = authUsersResult.users;
    console.log(`✅ Found ${authUsers.length} Firebase Auth users\n`);
    
    // Create a map of Auth users
    const authUserMap = new Map();
    authUsers.forEach(user => {
      authUserMap.set(user.uid, {
        uid: user.uid,
        email: user.email || '(no email)',
        displayName: user.displayName || '(no name)',
        provider: user.providerData?.[0]?.providerId || 'unknown',
        isAnonymous: user.providerData?.length === 0,
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime || 'Never'
      });
    });
    
    // Get all Firestore user profiles
    console.log('📋 Fetching Firestore user profiles...');
    const usersRef = db.collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('users');
    
    const profileSnapshot = await usersRef.get();
    console.log(`✅ Found ${profileSnapshot.size} Firestore user profiles\n`);
    
    // Create a map of Firestore profiles
    const profileMap = new Map();
    profileSnapshot.forEach(doc => {
      const data = doc.data();
      profileMap.set(doc.id, {
        uid: doc.id,
        displayName: data.displayName || '(no name)',
        email: data.email || '(no email)',
        totalPoints: data.totalPoints || 0,
        predictionsCorrect: data.predictionsCorrect || 0,
        predictionsTotal: data.predictionsTotal || 0,
        documentPath: doc.ref.path
      });
    });
    
    console.log('='.repeat(80));
    console.log('📊 COMPARISON RESULTS');
    console.log('='.repeat(80));
    
    // Find matches
    const matches = [];
    const authOnly = [];
    const profileOnly = [];
    
    // Check Auth users
    authUserMap.forEach((authUser, uid) => {
      if (profileMap.has(uid)) {
        matches.push({ auth: authUser, profile: profileMap.get(uid) });
      } else {
        authOnly.push(authUser);
      }
    });
    
    // Check Firestore profiles
    profileMap.forEach((profile, uid) => {
      if (!authUserMap.has(uid)) {
        profileOnly.push(profile);
      }
    });
    
    // Display matches
    console.log(`\n✅ MATCHES (${matches.length}):`);
    console.log('   Users that exist in both Firebase Auth and Firestore\n');
    
    matches.forEach((match, index) => {
      const { auth, profile } = match;
      console.log(`${index + 1}. ${profile.displayName} (${auth.uid.substring(0, 12)}...)`);
      console.log(`   Auth Email: ${auth.email}`);
      console.log(`   Auth Display Name: ${auth.displayName}`);
      console.log(`   Profile Display Name: ${profile.displayName}`);
      console.log(`   Profile Email: ${profile.email}`);
      console.log(`   Provider: ${auth.provider}${auth.isAnonymous ? ' (Anonymous)' : ''}`);
      console.log(`   Points: ${profile.totalPoints}`);
      console.log(`   Predictions: ${profile.predictionsCorrect}/${profile.predictionsTotal}`);
      
      // Check for mismatches
      const mismatches = [];
      if (auth.displayName !== profile.displayName && auth.displayName !== '(no name)') {
        mismatches.push(`Display name: Auth="${auth.displayName}" vs Profile="${profile.displayName}"`);
      }
      if (auth.email !== profile.email && auth.email !== '(no email)' && profile.email !== '(no email)') {
        mismatches.push(`Email: Auth="${auth.email}" vs Profile="${profile.email}"`);
      }
      
      if (mismatches.length > 0) {
        console.log(`   ⚠️  WARNINGS:`);
        mismatches.forEach(m => console.log(`      - ${m}`));
      }
      console.log('');
    });
    
    // Display Auth-only users
    if (authOnly.length > 0) {
      console.log(`\n⚠️  AUTH ONLY (${authOnly.length}):`);
      console.log('   Users in Firebase Auth but NOT in Firestore\n');
      
      authOnly.forEach((user, index) => {
        console.log(`${index + 1}. ${user.displayName} (${user.uid.substring(0, 12)}...)`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Provider: ${user.provider}${user.isAnonymous ? ' (Anonymous)' : ''}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   Last Sign In: ${user.lastSignIn}`);
        console.log('');
      });
    } else {
      console.log(`\n✅ No Auth-only users (all Auth users have profiles)`);
    }
    
    // Display Profile-only users
    if (profileOnly.length > 0) {
      console.log(`\n🔒 PROFILE ONLY (${profileOnly.length}):`);
      console.log('   Users in Firestore but NOT in Firebase Auth (ORPHANED)\n');
      
      profileOnly.forEach((profile, index) => {
        console.log(`${index + 1}. ${profile.displayName} (${profile.uid.substring(0, 12)}...)`);
        console.log(`   Email: ${profile.email}`);
        console.log(`   Points: ${profile.totalPoints}`);
        console.log(`   Predictions: ${profile.predictionsCorrect}/${profile.predictionsTotal}`);
        console.log(`   Document Path: ${profile.documentPath}`);
        console.log('');
      });
    } else {
      console.log(`\n✅ No Profile-only users (all profiles have Auth accounts)`);
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`   Total Firebase Auth Users: ${authUsers.length}`);
    console.log(`   Total Firestore Profiles: ${profileSnapshot.size}`);
    console.log(`   Matches: ${matches.length}`);
    console.log(`   Auth-Only: ${authOnly.length}`);
    console.log(`   Profile-Only (Orphaned): ${profileOnly.length}`);
    
    if (authOnly.length > 0 || profileOnly.length > 0) {
      console.log('\n⚠️  WARNING: There are discrepancies between Auth and Firestore!');
      if (authOnly.length > 0) {
        console.log(`   - ${authOnly.length} Auth user(s) need profile creation`);
      }
      if (profileOnly.length > 0) {
        console.log(`   - ${profileOnly.length} orphaned profile(s) should be cleaned up`);
      }
    } else {
      console.log('\n✅ Perfect match! All Auth users have profiles and all profiles have Auth users.');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Comparison complete!\n');
    
  } catch (error) {
    console.error('❌ Error comparing users:', error);
    throw error;
  }
}

// Main execution
try {
  initializeFirebaseAdmin();
  compareUsers()
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


