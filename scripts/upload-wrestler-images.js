#!/usr/bin/env node

/**
 * Script to fetch wrestler images from Wikipedia and upload to Firebase Storage
 * This ensures images never break and have no CORS issues
 * 
 * Usage: node scripts/upload-wrestler-images.js
 */

import https from 'https';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
if (!existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found!');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
});

const db = admin.firestore();
const storage = admin.storage().bucket();
const appId = serviceAccount.project_id;

const DELAY_MS = 1000; // 1 second between requests

// List of wrestlers to fetch images for (prioritized)
const WRESTLERS = [
  // AEW
  'Jon Moxley',
  'Kenny Omega',
  'Chris Jericho',
  'MJF',
  'Darby Allin',
  'Will Ospreay',
  'Hangman Adam Page',
  'Orange Cassidy',
  'Adam Cole',
  'Sting',
  'Mercedes Moné',
  'Jamie Hayter',
  'Toni Storm',
  'Ricochet',
  'Sammy Guevara',
  'Jack Perry',
  'Nick Jackson',
  'Matt Jackson',
  'Bandido',
  
  // WWE
  'Cody Rhodes',
  'Roman Reigns',
  'Seth Rollins',
  'Drew McIntyre',
  'CM Punk',
  'Kevin Owens',
  'Randy Orton',
  'John Cena',
  'The Rock',
  'Becky Lynch',
  'Charlotte Flair',
  'Rhea Ripley',
  'Bianca Belair',
  
  // NJPW
  'Tetsuya Naito',
  'Kazuchika Okada',
  'Hiroshi Tanahashi',
  'Zack Sabre Jr.',
  'Hiromu Takahashi',
  'Shingo Takagi',
  'SANADA',
  'El Desperado',
  
  // TNA
  'Nic Nemeth',
  'Josh Alexander',
  'Jordynne Grace',
  'Masha Slamovich',
  'Moose',
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch wrestler image from Wikipedia API
async function fetchWikipediaImage(wrestlerName) {
  try {
    // Try with "(wrestler)" suffix first
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(wrestlerName + ' (wrestler)')}&pithumbsize=800`;
    
    const searchData = await new Promise((resolve, reject) => {
      https.get(searchUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    
    if (searchData.query && searchData.query.pages) {
      const pages = Object.values(searchData.query.pages);
      if (pages.length > 0 && pages[0].thumbnail) {
        return pages[0].thumbnail.source;
      }
    }
    
    // Try without "(wrestler)" suffix
    const searchUrl2 = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(wrestlerName)}&pithumbsize=800`;
    
    const searchData2 = await new Promise((resolve, reject) => {
      https.get(searchUrl2, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    
    if (searchData2.query && searchData2.query.pages) {
      const pages = Object.values(searchData2.query.pages);
      if (pages.length > 0 && pages[0].thumbnail) {
        return pages[0].thumbnail.source;
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Wikipedia API failed: ${error.message}`);
  }
  
  return null;
}

// Download image and upload to Firebase Storage
async function downloadAndUploadToStorage(imageUrl, wrestlerName) {
  if (!imageUrl) return null;
  
  try {
    const safeName = wrestlerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const fileExtension = imageUrl.split('.').pop().split('?')[0].replace(/[^a-z]/gi, '') || 'jpg';
    const storagePath = `images/wrestlers/${safeName}.${fileExtension}`;
    
    // Check if already exists
    const file = storage.file(storagePath);
    const [exists] = await file.exists();
    if (exists) {
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
      return publicUrl;
    }
    
    // Download the image
    const imageData = await new Promise((resolve, reject) => {
      const chunks = [];
      https.get(imageUrl, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
    
    // Upload to Storage
    await file.save(imageData, {
      metadata: {
        contentType: `image/${fileExtension}`,
        metadata: {
          originalUrl: imageUrl,
          wrestlerName: wrestlerName,
          uploadedAt: new Date().toISOString()
        }
      },
      public: true
    });
    
    // Get public URL
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
    return publicUrl;
  } catch (error) {
    throw error;
  }
}

// Save image URL to Firestore
async function saveImageToFirestore(wrestlerName, imageUrl) {
  if (!db || !appId || !imageUrl) return;
  
  try {
    const imageDoc = db
      .collection('artifacts')
      .doc(appId)
      .collection('public')
      .doc('data')
      .collection('images')
      .doc('wrestlers');
    
    const currentData = await imageDoc.get();
    const existingImages = currentData.exists ? currentData.data() : {};
    
    await imageDoc.set({
      ...existingImages,
      [wrestlerName]: imageUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.log(`   ⚠️  Failed to save to Firestore: ${error.message}`);
  }
}

// Main function
async function main() {
  console.log('🎭 Wrestler Image Uploader\n');
  console.log(`📊 Processing ${WRESTLERS.length} wrestlers\n`);
  
  const results = {
    success: [],
    failed: [],
    skipped: []
  };
  
  for (const wrestlerName of WRESTLERS) {
    console.log(`\n🔍 Processing: ${wrestlerName}...`);
    
    try {
      // Try Wikipedia first
      console.log('   📡 Fetching from Wikipedia...');
      const wikipediaUrl = await fetchWikipediaImage(wrestlerName);
      
      if (wikipediaUrl) {
        console.log(`   ✓ Found on Wikipedia`);
        console.log('   📤 Uploading to Firebase Storage...');
        
        const storageUrl = await downloadAndUploadToStorage(wikipediaUrl, wrestlerName);
        
        if (storageUrl) {
          console.log('   💾 Saving to Firestore...');
          await saveImageToFirestore(wrestlerName, storageUrl);
          console.log(`   ✅ Success! ${wrestlerName}`);
          results.success.push({ name: wrestlerName, url: storageUrl });
        } else {
          console.log(`   ❌ Upload failed`);
          results.failed.push(wrestlerName);
        }
      } else {
        console.log(`   ⚠️  No image found on Wikipedia`);
        results.skipped.push(wrestlerName);
      }
      
      // Rate limiting
      await delay(DELAY_MS);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.failed.push(wrestlerName);
    }
  }
  
  // Summary
  console.log('\n\n📊 SUMMARY\n');
  console.log(`✅ Successful: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Skipped (no image): ${results.skipped.length}`);
  
  if (results.success.length > 0) {
    console.log('\n\n✅ Successfully uploaded images for:');
    results.success.forEach(r => {
      console.log(`   '${r.name}': '${r.url}',`);
    });
    console.log('\n💡 Copy these URLs to WRESTLER_IMAGES in App.jsx\n');
  }
  
  if (results.failed.length > 0) {
    console.log('\n\n❌ Failed to process:');
    results.failed.forEach(name => console.log(`   - ${name}`));
  }
  
  if (results.skipped.length > 0) {
    console.log('\n\n⚠️  No images found for:');
    results.skipped.forEach(name => console.log(`   - ${name}`));
  }
  
  console.log('\n✨ Done!\n');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
