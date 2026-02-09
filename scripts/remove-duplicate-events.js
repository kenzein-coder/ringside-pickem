#!/usr/bin/env node

/**
 * Remove Duplicate Events
 * Removes duplicate events, keeping the one with matches
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

async function removeDuplicates() {
  console.log('🔍 Finding and removing duplicate events...\n');
  
  initFirebase();
  
  if (!db) {
    console.log('❌ Cannot remove duplicates - Firebase not configured');
    return;
  }
  
  try {
    const eventsRef = db.collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('events');
    
    const eventsSnap = await eventsRef.get();
    
    const events = [];
    eventsSnap.forEach(doc => {
      const data = doc.data();
      events.push({
        id: doc.id,
        name: data.name || '',
        matches: data.matches || [],
        matchCount: (data.matches || []).length,
        manuallyEdited: data.manuallyEdited || false,
        source: data.source || 'unknown'
      });
    });
    
    // Group by normalized name
    const nameGroups = new Map();
    
    events.forEach(event => {
      const normalizedName = event.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!nameGroups.has(normalizedName)) {
        nameGroups.set(normalizedName, []);
      }
      nameGroups.get(normalizedName).push(event);
    });
    
    // Find duplicates
    const duplicates = [];
    nameGroups.forEach((group, normalizedName) => {
      if (group.length > 1) {
        duplicates.push({
          normalizedName,
          events: group
        });
      }
    });
    
    console.log(`📊 Found ${duplicates.length} duplicate event groups\n`);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    let deletedCount = 0;
    
    for (const dup of duplicates) {
      console.log(`\n📋 "${dup.events[0].name}" (${dup.events.length} versions):`);
      
      // Sort by match count (descending), then by source (prefer profightdb)
      dup.events.sort((a, b) => {
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount;
        }
        // If match counts are equal, prefer profightdb
        if (a.source === 'profightdb' && b.source !== 'profightdb') return -1;
        if (b.source === 'profightdb' && a.source !== 'profightdb') return 1;
        return 0;
      });
      
      const keep = dup.events[0];
      const toDelete = dup.events.slice(1);
      
      console.log(`  ✅ Keeping: ${keep.name} (${keep.matchCount} matches, source: ${keep.source})`);
      
      for (const event of toDelete) {
        if (event.manuallyEdited) {
          console.log(`  🛡️  Skipping: ${event.name} - manually edited (protected)`);
          continue;
        }
        
        try {
          await eventsRef.doc(event.id).delete();
          console.log(`  🗑️  Deleted: ${event.name} (${event.matchCount} matches, source: ${event.source})`);
          deletedCount++;
        } catch (error) {
          console.error(`  ❌ Error deleting ${event.name}:`, error.message);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n📈 Summary: ${deletedCount} duplicate events removed`);
    
  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
  }
}

removeDuplicates();
