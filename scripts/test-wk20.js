#!/usr/bin/env node

/**
 * Test Wrestle Kingdom 20
 * Verifies that Wrestle Kingdom 20 has matches loaded correctly
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

async function testWK20() {
  console.log('🔍 Testing Wrestle Kingdom 20...\n');
  
  initFirebase();
  
  if (!db) {
    console.log('❌ Cannot test - Firebase not configured');
    return;
  }
  
  try {
    const eventsRef = db.collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('events');
    
    // Search for Wrestle Kingdom 20 by various name variations
    const searchTerms = [
      'Wrestle Kingdom 20',
      'Wrestle Kingdom 20 In Tokyo Dome',
      'wrestle-kingdom-20',
      'profightdb-wrestle-kingdom-20'
    ];
    
    const eventsSnap = await eventsRef.get();
    
    const wk20Events = [];
    eventsSnap.forEach(doc => {
      const data = doc.data();
      const name = (data.name || '').toLowerCase();
      const id = doc.id.toLowerCase();
      
      if (name.includes('wrestle kingdom 20') || id.includes('wrestle-kingdom-20') || id.includes('wk20')) {
        wk20Events.push({
          id: doc.id,
          name: data.name,
          date: data.date,
          matches: data.matches || [],
          matchCount: (data.matches || []).length,
          source: data.source || 'unknown',
          promoId: data.promoId,
          promotionName: data.promotionName
        });
      }
    });
    
    console.log(`📊 Found ${wk20Events.length} Wrestle Kingdom 20 event(s):\n`);
    
    if (wk20Events.length === 0) {
      console.log('❌ No Wrestle Kingdom 20 events found in Firestore!');
      return;
    }
    
    wk20Events.forEach((event, idx) => {
      console.log(`Event ${idx + 1}:`);
      console.log(`  ID: ${event.id}`);
      console.log(`  Name: ${event.name}`);
      console.log(`  Date: ${event.date}`);
      console.log(`  Promotion: ${event.promotionName || event.promoId}`);
      console.log(`  Source: ${event.source}`);
      console.log(`  Matches: ${event.matchCount}`);
      
      if (event.matchCount > 0) {
        console.log(`  ✅ HAS MATCHES!`);
        console.log(`  Match details:`);
        event.matches.slice(0, 5).forEach((match, i) => {
          console.log(`    ${i + 1}. ${match.p1 || 'TBD'} vs ${match.p2 || 'TBD'} - ${match.title || match.type || 'Match'}`);
        });
        if (event.matches.length > 5) {
          console.log(`    ... and ${event.matches.length - 5} more matches`);
        }
      } else {
        console.log(`  ❌ NO MATCHES - needs to be scraped!`);
      }
      console.log('');
    });
    
    // Summary
    const withMatches = wk20Events.filter(e => e.matchCount > 0);
    const withoutMatches = wk20Events.filter(e => e.matchCount === 0);
    
    console.log('='.repeat(80));
    console.log('\n📈 Summary:');
    console.log(`  Total WK20 events: ${wk20Events.length}`);
    console.log(`  With matches: ${withMatches.length}`);
    console.log(`  Without matches: ${withoutMatches.length}`);
    
    if (withMatches.length > 0) {
      console.log('\n✅ SUCCESS: Wrestle Kingdom 20 has matches!');
      console.log(`   Best event: ${withMatches[0].name} (${withMatches[0].matchCount} matches)`);
    } else {
      console.log('\n❌ ISSUE: No Wrestle Kingdom 20 events have matches');
      console.log('   Recommendation: Run the ProFightDB scraper to get match data');
    }
    
  } catch (error) {
    console.error('❌ Error testing WK20:', error);
  }
}

testWK20();
