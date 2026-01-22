#!/usr/bin/env node

/**
 * Cleanup Weekly Shows from Firestore
 * Removes or fixes weekly shows that were incorrectly saved as PPVs
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

// Check if event name looks like a weekly show
function isWeeklyShow(eventName) {
  const weeklyPatterns = [
    /dynamite/i, /collision/i, /rampage/i, 
    /raw\s*#/i, /monday\s*night\s*raw/i,
    /smackdown\s*#/i, /friday\s*night\s*smackdown/i,
    /nxt\s*#/i, /nxt(?!\s*(takeover|stand|deliver|deadline|vengeance|battleground|stand|deliver))/i,
    /main\s*event/i, /superstars/i, /thunder/i, /nitro/i,
    /impact(?!\s*(slammiversary|bound|hard|sacrifice|rebellion|against|genesis))/i,
    /dark(?:\s|$)/i, /elevation/i, 
    /world\s*tag\s*league\s*-\s*tag\s*\d+/i, // World Tag League individual shows
    /strong/i, /road\s*to/i,
    /tv\s*#/i, /taping/i, /live\s*event/i,
    /#\d+/i // Any event with a number like "#321" is likely a weekly show
  ];
  return weeklyPatterns.some(pattern => pattern.test(eventName));
}

async function cleanupWeeklyShows() {
  console.log('🧹 Cleaning up weekly shows from Firestore...\n');
  
  initFirebase();
  
  if (!db) {
    console.log('❌ Cannot cleanup - Firebase not configured');
    return;
  }
  
  try {
    const eventsRef = db.collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('events');
    
    const eventsSnap = await eventsRef.get();
    
    const weeklyShows = [];
    const ppvs = [];
    
    eventsSnap.forEach(doc => {
      const data = doc.data();
      const eventName = data.name || '';
      
      if (isWeeklyShow(eventName)) {
        weeklyShows.push({
          id: doc.id,
          name: eventName,
          date: data.date,
          isPPV: data.isPPV,
          manuallyEdited: data.manuallyEdited || false
        });
      } else {
        ppvs.push({
          id: doc.id,
          name: eventName
        });
      }
    });
    
    console.log(`📊 Found ${weeklyShows.length} weekly shows incorrectly saved as PPVs`);
    console.log(`📊 Found ${ppvs.length} legitimate PPVs\n`);
    
    if (weeklyShows.length === 0) {
      console.log('✅ No weekly shows to clean up!');
      return;
    }
    
    console.log('⚠️  Weekly shows found:');
    weeklyShows.forEach(ws => {
      console.log(`  - ${ws.name} (${ws.date}) - ${ws.manuallyEdited ? '🛡️ PROTECTED' : 'can delete'}`);
    });
    
    console.log('\n🗑️  Deleting weekly shows...\n');
    
    let deletedCount = 0;
    let protectedCount = 0;
    
    for (const ws of weeklyShows) {
      if (ws.manuallyEdited) {
        console.log(`  🛡️  Skipping ${ws.name} - manually edited (protected)`);
        protectedCount++;
        continue;
      }
      
      try {
        await eventsRef.doc(ws.id).delete();
        console.log(`  ✅ Deleted: ${ws.name}`);
        deletedCount++;
      } catch (error) {
        console.error(`  ❌ Error deleting ${ws.name}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 Cleanup Summary:');
    console.log(`  Total weekly shows found: ${weeklyShows.length}`);
    console.log(`  Deleted: ${deletedCount}`);
    console.log(`  Protected (skipped): ${protectedCount}`);
    console.log(`  Remaining PPVs: ${ppvs.length}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupWeeklyShows();
