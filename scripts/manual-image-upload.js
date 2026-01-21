#!/usr/bin/env node

/**
 * Manual Image Upload Helper
 * 
 * This script helps you upload wrestler images that you've downloaded manually.
 * 
 * Usage:
 * 1. Download wrestler images to a folder (e.g., /tmp/wrestler-images/)
 * 2. Name them clearly (e.g., "jon_moxley.jpg", "kenny_omega.png")
 * 3. Run: node scripts/manual-image-upload.js /path/to/images/folder
 * 4. Script will upload all images to Firebase Storage
 * 5. Copy the output URLs to WRESTLER_IMAGES in App.jsx
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get folder path from command line
const folderPath = process.argv[2];

if (!folderPath) {
  console.log('❌ Usage: node scripts/manual-image-upload.js /path/to/images/folder\n');
  console.log('Example folder structure:');
  console.log('  /tmp/wrestler-images/');
  console.log('    ├── jon_moxley.jpg');
  console.log('    ├── kenny_omega.png');
  console.log('    └── cody_rhodes.jpg');
  process.exit(1);
}

if (!existsSync(folderPath)) {
  console.error(`❌ Folder not found: ${folderPath}`);
  process.exit(1);
}

// Initialize Firebase
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

const storage = admin.storage().bucket();
const db = admin.firestore();
const appId = serviceAccount.project_id;

async function uploadImage(filePath, wrestlerName) {
  try {
    const fileExtension = extname(filePath).substring(1);
    const safeName = wrestlerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const storagePath = `images/wrestlers/${safeName}.${fileExtension}`;
    
    const file = storage.file(storagePath);
    const imageData = readFileSync(filePath);
    
    await file.save(imageData, {
      metadata: {
        contentType: `image/${fileExtension}`,
        metadata: {
          wrestlerName: wrestlerName,
          uploadedAt: new Date().toISOString()
        }
      },
      public: true
    });
    
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
    
    // Save to Firestore
    const imageDoc = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('images').doc('wrestlers');
    const currentData = await imageDoc.get();
    const existingImages = currentData.exists ? currentData.data() : {};
    
    await imageDoc.set({
      ...existingImages,
      [wrestlerName]: publicUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return publicUrl;
  } catch (error) {
    throw error;
  }
}

async function main() {
  console.log('📤 Manual Image Upload Helper\n');
  console.log(`📁 Scanning folder: ${folderPath}\n`);
  
  // Get all image files
  const files = readdirSync(folderPath)
    .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
    .map(file => ({
      path: join(folderPath, file),
      name: basename(file, extname(file))
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase()) // Title case
    }));
  
  if (files.length === 0) {
    console.log('❌ No image files found in folder');
    process.exit(1);
  }
  
  console.log(`Found ${files.length} images:\n`);
  files.forEach(f => console.log(`   - ${f.name} (${basename(f.path)})`));
  console.log('');
  
  const results = [];
  
  for (const file of files) {
    try {
      console.log(`📤 Uploading: ${file.name}...`);
      const url = await uploadImage(file.path, file.name);
      console.log(`   ✅ Success!`);
      results.push({ name: file.name, url });
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n\n✅ Upload Complete!\n');
  console.log('📋 Copy these lines to WRESTLER_IMAGES in App.jsx:\n');
  console.log('const WRESTLER_IMAGES = {');
  results.forEach(r => {
    console.log(`  '${r.name}': '${r.url}',`);
  });
  console.log('};\n');
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
