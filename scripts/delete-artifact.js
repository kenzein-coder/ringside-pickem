#!/usr/bin/env node

/**
 * Delete Artifact Script
 * This will delete an entire artifact and all its subcollections
 * 
 * Usage: node scripts/delete-artifact.js <artifact-id>
 * Example: node scripts/delete-artifact.js default-app-id
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

// Function to ask a question
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

// Recursive function to delete all subcollections and documents
async function deleteSubcollections(ref, db) {
  const collections = await ref.listCollections();
  
  for (const collectionRef of collections) {
    // Get all document references
    const docRefs = await collectionRef.listDocuments();
    
    // Delete documents in batches of 500 (Firestore limit)
    for (let i = 0; i < docRefs.length; i += 500) {
      const batch = db.batch();
      const batchRefs = docRefs.slice(i, i + 500);
      
      for (const docRef of batchRefs) {
        // Recursively delete subcollections first
        await deleteSubcollections(docRef, db);
        // Add document deletion to batch
        batch.delete(docRef);
      }
      
      if (batchRefs.length > 0) {
        await batch.commit();
      }
    }
  }
}

async function deleteArtifact(artifactId) {
  const db = getFirestore();
  
  console.log(`\n⚠️  WARNING: This will delete the entire artifact "${artifactId}" and ALL its data!`);
  console.log('This includes:');
  console.log('  - All user profiles');
  console.log('  - All predictions');
  console.log('  - All events');
  console.log('  - All scores');
  console.log('  - All images cache');
  console.log('  - Everything else in this artifact\n');
  
  // Check what's in the artifact first
  const artifactRef = db.collection('artifacts').doc(artifactId);
  
  // Count users
  const usersRef = artifactRef.collection('public').doc('data').collection('users');
  const usersSnapshot = await usersRef.get();
  const userCount = usersSnapshot.size;
  
  console.log(`📊 Current data in "${artifactId}":`);
  console.log(`   Users: ${userCount}`);
  
  if (userCount > 0) {
    console.log(`   User IDs (first 5):`);
    usersSnapshot.docs.slice(0, 5).forEach(doc => {
      const data = doc.data();
      console.log(`     - ${doc.id}: ${data.displayName || '(no name)'}`);
    });
    if (userCount > 5) {
      console.log(`     ... and ${userCount - 5} more`);
    }
  }
  
  console.log('\n');
  
  // Check for --yes flag for non-interactive mode
  const skipConfirmation = process.argv.includes('--yes') || process.argv.includes('-y');
  
  if (!skipConfirmation) {
    // Ask for confirmation
    const answer = await askQuestion(`Type "DELETE ${artifactId}" to confirm deletion: `);
    
    if (answer !== `DELETE ${artifactId}`) {
      console.log('\n❌ Deletion cancelled. The confirmation text did not match.');
      return;
    }
  } else {
    console.log('⚠️  Running in non-interactive mode (--yes flag detected)\n');
  }
  
  console.log('\n🗑️  Deleting artifact...');
  
  try {
    // Delete all subcollections recursively
    console.log('   Deleting all subcollections...');
    await deleteSubcollections(artifactRef, db);
    console.log('   ✅ All subcollections deleted');
    
    // Delete the artifact document itself (if it exists)
    const artifactDoc = await artifactRef.get();
    if (artifactDoc.exists) {
      await artifactRef.delete();
      console.log('   ✅ Artifact document deleted');
    }
    
    console.log(`\n✅ Successfully deleted artifact "${artifactId}"!`);
  } catch (error) {
    console.error(`\n❌ Error deleting artifact:`, error);
    throw error;
  }
}

// Main execution
const artifactId = process.argv[2];

if (!artifactId) {
  console.error('❌ Error: Please provide an artifact ID to delete.');
  console.error('\nUsage: node scripts/delete-artifact.js <artifact-id>');
  console.error('Example: node scripts/delete-artifact.js default-app-id');
  process.exit(1);
}

try {
  initializeFirebaseAdmin();
  deleteArtifact(artifactId)
    .then(() => {
      console.log('\nScript completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
} catch (error) {
  console.error('Failed to initialize:', error);
  process.exit(1);
}

