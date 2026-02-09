#!/usr/bin/env node

/**
 * Verify Wrestler Image Integration
 * Checks if wrestler images from ProFightDB are being saved correctly
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

async function verifyWrestlerImages() {
  console.log('🔍 Verifying wrestler image integration...\n');
  
  initFirebase();
  
  if (!db) {
    console.log('❌ Cannot verify - Firebase not configured');
    return;
  }
  
  try {
    const eventsRef = db.collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('events');
    
    // Check Wrestle Kingdom 20 specifically
    const wk20Ref = eventsRef.doc('profightdb-wrestle-kingdom-20-57867');
    const wk20Doc = await wk20Ref.get();
    
    if (wk20Doc.exists) {
      const data = wk20Doc.data();
      const matches = data.matches || [];
      
      console.log(`📊 Wrestle Kingdom 20: ${matches.length} matches\n`);
      
      let totalWrestlers = 0;
      let wrestlersWithImages = 0;
      const imageSources = {
        profightdb: 0,
        other: 0,
        none: 0
      };
      
      matches.forEach((match, idx) => {
        console.log(`Match ${idx + 1}: ${match.title || match.type || 'Match'}`);
        console.log(`  ${match.p1} vs ${match.p2}`);
        
        // Check p1 images
        if (match.p1Members) {
          match.p1Members.forEach(m => {
            totalWrestlers++;
            if (m.image) {
              wrestlersWithImages++;
              if (m.image.includes('profightdb.com')) {
                imageSources.profightdb++;
                console.log(`    ✅ ${m.name}: ${m.image.substring(0, 60)}...`);
              } else {
                imageSources.other++;
                console.log(`    📷 ${m.name}: ${m.image.substring(0, 60)}... (other source)`);
              }
            } else {
              imageSources.none++;
              console.log(`    ❌ ${m.name}: No image`);
            }
          });
        } else if (match.p1Image) {
          totalWrestlers++;
          wrestlersWithImages++;
          if (match.p1Image.includes('profightdb.com')) {
            imageSources.profightdb++;
            console.log(`    ✅ ${match.p1}: ${match.p1Image.substring(0, 60)}...`);
          } else {
            imageSources.other++;
            console.log(`    📷 ${match.p1}: ${match.p1Image.substring(0, 60)}... (other source)`);
          }
        }
        
        // Check p2 images
        if (match.p2Members) {
          match.p2Members.forEach(m => {
            totalWrestlers++;
            if (m.image) {
              wrestlersWithImages++;
              if (m.image.includes('profightdb.com')) {
                imageSources.profightdb++;
                console.log(`    ✅ ${m.name}: ${m.image.substring(0, 60)}...`);
              } else {
                imageSources.other++;
                console.log(`    📷 ${m.name}: ${m.image.substring(0, 60)}... (other source)`);
              }
            } else {
              imageSources.none++;
              console.log(`    ❌ ${m.name}: No image`);
            }
          });
        } else if (match.p2Image) {
          totalWrestlers++;
          wrestlersWithImages++;
          if (match.p2Image.includes('profightdb.com')) {
            imageSources.profightdb++;
            console.log(`    ✅ ${match.p2}: ${match.p2Image.substring(0, 60)}...`);
          } else {
            imageSources.other++;
            console.log(`    📷 ${match.p2}: ${match.p2Image.substring(0, 60)}... (other source)`);
          }
        }
        
        console.log('');
      });
      
      console.log('='.repeat(80));
      console.log('\n📈 Summary:');
      console.log(`  Total wrestlers: ${totalWrestlers}`);
      console.log(`  With images: ${wrestlersWithImages} (${Math.round(wrestlersWithImages / totalWrestlers * 100)}%)`);
      console.log(`  ProFightDB images: ${imageSources.profightdb}`);
      console.log(`  Other source images: ${imageSources.other}`);
      console.log(`  No images: ${imageSources.none}`);
      
      if (imageSources.profightdb > 0) {
        console.log('\n✅ SUCCESS: ProFightDB images are being integrated!');
      } else {
        console.log('\n⚠️  WARNING: No ProFightDB images found');
      }
    } else {
      console.log('❌ Wrestle Kingdom 20 not found in Firestore');
    }
    
    // Also check a few other events
    console.log('\n\n🔍 Checking other events...\n');
    const eventsSnap = await eventsRef.limit(5).get();
    let eventsWithImages = 0;
    let totalEvents = 0;
    
    eventsSnap.forEach(doc => {
      const data = doc.data();
      const matches = data.matches || [];
      totalEvents++;
      
      const hasProFightDBImages = matches.some(m => {
        const p1HasImage = (m.p1Members && m.p1Members.some(mem => mem.image && mem.image.includes('profightdb.com'))) ||
                           (m.p1Image && m.p1Image.includes('profightdb.com'));
        const p2HasImage = (m.p2Members && m.p2Members.some(mem => mem.image && mem.image.includes('profightdb.com'))) ||
                           (m.p2Image && m.p2Image.includes('profightdb.com'));
        return p1HasImage || p2HasImage;
      });
      
      if (hasProFightDBImages) {
        eventsWithImages++;
        console.log(`  ✅ ${data.name}: Has ProFightDB images`);
      } else {
        console.log(`  ⚠️  ${data.name}: No ProFightDB images`);
      }
    });
    
    console.log(`\n📊 Events with ProFightDB images: ${eventsWithImages}/${totalEvents}`);
    
  } catch (error) {
    console.error('❌ Error verifying images:', error);
  }
}

verifyWrestlerImages();
