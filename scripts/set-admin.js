#!/usr/bin/env node

/**
 * Script to grant or revoke admin privileges
 * 
 * Usage:
 *   node scripts/set-admin.js <email> grant
 *   node scripts/set-admin.js <email> revoke
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const email = process.argv[2];
const action = process.argv[3];

if (!email || !action || !['grant', 'revoke'].includes(action)) {
  console.log('Usage: node scripts/set-admin.js <email> <grant|revoke>');
  console.log('\nExample:');
  console.log('  node scripts/set-admin.js user@example.com grant');
  console.log('  node scripts/set-admin.js user@example.com revoke');
  process.exit(1);
}

// Initialize Firebase Admin SDK
const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
if (!existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found!');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();
const appId = serviceAccount.project_id;

async function setAdmin() {
  try {
    console.log(`\n🔍 Looking for user: ${email}\n`);
    
    // Find user by email in Authentication
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found user: ${userRecord.displayName || userRecord.uid}`);
    
    const userId = userRecord.uid;
    
    // Update user profile in Firestore
    const userDocRef = db
      .collection('artifacts')
      .doc(appId)
      .collection('public')
      .doc('data')
      .collection('users')
      .doc(userId);
    
    const isAdmin = action === 'grant';
    
    await userDocRef.set({
      isAdmin: isAdmin,
      adminGrantedAt: isAdmin ? admin.firestore.FieldValue.serverTimestamp() : null
    }, { merge: true });
    
    if (isAdmin) {
      console.log(`\n✅ Admin privileges GRANTED to ${email}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Display Name: ${userRecord.displayName || 'N/A'}\n`);
    } else {
      console.log(`\n✅ Admin privileges REVOKED from ${email}`);
      console.log(`   User ID: ${userId}\n`);
    }
    
    // List all current admins
    console.log('📋 Current admins:\n');
    const usersSnapshot = await db
      .collection('artifacts')
      .doc(appId)
      .collection('public')
      .doc('data')
      .collection('users')
      .where('isAdmin', '==', true)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('   No admins found\n');
    } else {
      for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        try {
          const authUser = await admin.auth().getUser(doc.id);
          console.log(`   • ${authUser.email} (${data.displayName || authUser.displayName || 'No name'})`);
        } catch (e) {
          console.log(`   • ${doc.id} (${data.displayName || 'Unknown'})`);
        }
      }
      console.log('');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

setAdmin();
