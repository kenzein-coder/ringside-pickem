#!/usr/bin/env node

/**
 * Audit PPV Events
 * Checks all PPVs to ensure they're configured correctly with matches
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

async function auditPPVs() {
  console.log('🔍 Auditing PPV Events...\n');
  
  initFirebase();
  
  if (!db) {
    console.log('❌ Cannot audit - Firebase not configured');
    return;
  }
  
  try {
    // Get all events from Firestore
    const eventsRef = db.collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('events');
    
    const eventsSnap = await eventsRef.get();
    
    const events = [];
    eventsSnap.forEach(doc => {
      const data = doc.data();
      events.push({
        id: doc.id,
        name: data.name,
        date: data.date,
        promotionName: data.promotionName || data.promoId,
        matches: data.matches || [],
        matchCount: (data.matches || []).length,
        isPPV: data.isPPV !== false, // Default to true
        manuallyEdited: data.manuallyEdited || false,
        source: data.source || 'unknown'
      });
    });
    
    // Sort by date
    events.sort((a, b) => {
      const dateA = new Date(a.date || '9999-12-31');
      const dateB = new Date(b.date || '9999-12-31');
      return dateA - dateB;
    });
    
    console.log(`📊 Found ${events.length} total events in Firestore\n`);
    
    // Filter to PPVs only (upcoming and recent past)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const threeMonthsFuture = new Date(today);
    threeMonthsFuture.setMonth(threeMonthsFuture.getMonth() + 3);
    
    const ppvs = events.filter(ev => {
      const eventDate = new Date(ev.date || '9999-12-31');
      return ev.isPPV && 
             eventDate >= sixMonthsAgo && 
             eventDate <= threeMonthsFuture;
    });
    
    console.log(`🎯 Found ${ppvs.length} PPVs (within 6 months past to 3 months future)\n`);
    console.log('='.repeat(80));
    
    // Categorize PPVs
    const withMatches = [];
    const withoutMatches = [];
    const manuallyEdited = [];
    
    ppvs.forEach(ppv => {
      if (ppv.manuallyEdited) {
        manuallyEdited.push(ppv);
      } else if (ppv.matchCount > 0) {
        withMatches.push(ppv);
      } else {
        withoutMatches.push(ppv);
      }
    });
    
    // Report
    console.log(`\n✅ PPVs WITH matches (${withMatches.length}):`);
    console.log('-'.repeat(80));
    withMatches.forEach(ppv => {
      console.log(`  ✓ ${ppv.name.padEnd(50)} | ${ppv.matchCount.toString().padStart(2)} matches | ${ppv.date} | ${ppv.promotionName} | ${ppv.source}`);
    });
    
    console.log(`\n⚠️  PPVs WITHOUT matches (${withoutMatches.length}):`);
    console.log('-'.repeat(80));
    if (withoutMatches.length > 0) {
      withoutMatches.forEach(ppv => {
        console.log(`  ✗ ${ppv.name.padEnd(50)} | ${ppv.date} | ${ppv.promotionName} | ${ppv.source}`);
      });
    } else {
      console.log('  (None - all PPVs have matches!)');
    }
    
    console.log(`\n🛡️  Manually edited PPVs (${manuallyEdited.length}):`);
    console.log('-'.repeat(80));
    if (manuallyEdited.length > 0) {
      manuallyEdited.forEach(ppv => {
        console.log(`  🛡️  ${ppv.name.padEnd(50)} | ${ppv.matchCount.toString().padStart(2)} matches | ${ppv.date} | ${ppv.promotionName}`);
      });
    } else {
      console.log('  (None)');
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 Summary:');
    console.log(`  Total PPVs: ${ppvs.length}`);
    console.log(`  With matches: ${withMatches.length} (${Math.round(withMatches.length / ppvs.length * 100)}%)`);
    console.log(`  Without matches: ${withoutMatches.length} (${Math.round(withoutMatches.length / ppvs.length * 100)}%)`);
    console.log(`  Manually edited: ${manuallyEdited.length}`);
    
    // Recommendations
    if (withoutMatches.length > 0) {
      console.log('\n💡 Recommendations:');
      console.log('  1. Run the ProFightDB scraper to get match data for events without matches');
      console.log('  2. Check if events are being filtered out as weekly shows');
      console.log('  3. Verify event names match between sources');
    }
    
  } catch (error) {
    console.error('❌ Error auditing PPVs:', error);
  }
}

auditPPVs();
