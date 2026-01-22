#!/usr/bin/env node

/**
 * Remove Wrestle Kingdom 20 Duplicate
 * Removes the version without matches
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase
let db = null;
let appId = 'default-app-id';

function initFirebase() {
  try {
    const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
    if (existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
      initializeApp({
        credential: cert(serviceAccount)
      });
      db = getFirestore();
      appId = serviceAccount.project_id;
      console.log('✅ Firebase Admin SDK initialized\n');
      return true;
    }
  } catch (error) {
    console.log('⚠️  Firebase not configured\n');
  }
  return false;
}

async function removeWK20Duplicate() {
  console.log('🔍 Removing Wrestle Kingdom 20 duplicate...\n');
  
  initFirebase();
  
  if (!db) {
    console.log('❌ Cannot remove - Firebase not configured');
    return;
  }
  
  try {
    const eventsRef = db.collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('events');
    
    // Find the one without matches
    const wk20WithoutMatches = eventsRef.doc('cagematch-426904');
    const doc = await wk20WithoutMatches.get();
    
    if (doc.exists) {
      const data = doc.data();
      const matchCount = (data.matches || []).length;
      
      if (matchCount === 0) {
        await wk20WithoutMatches.delete();
        console.log(`✅ Deleted: ${data.name} (no matches)`);
        console.log(`   Kept: profightdb-wrestle-kingdom-20-57867 (9 matches)`);
      } else {
        console.log(`⚠️  Event has ${matchCount} matches, not deleting`);
      }
    } else {
      console.log('✅ Duplicate already removed or not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

removeWK20Duplicate();
