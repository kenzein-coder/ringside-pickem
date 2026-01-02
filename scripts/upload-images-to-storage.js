/**
 * Script to upload all hardcoded wrestler images to Firebase Storage
 * This ensures reliable image delivery without relying on external URLs
 */

import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const envPath = path.join(__dirname, '../.env');
let envVars = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

// Firebase config
const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase Client SDK
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);
const appId = firebaseConfig.projectId || 'default-app-id';

// Hardcoded wrestler images from App.jsx
const WRESTLER_IMAGES = {
  // WWE
  'The Rock': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Dwayne_%22The_Rock%22_Johnson_Visits_the_Pentagon_%2841%29_%28cropped%29.jpg',
  'John Cena': 'https://upload.wikimedia.org/wikipedia/commons/6/60/John_Cena_July_2018.jpg',
  'Roman Reigns': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Roman_Reigns_Tribute_to_the_Troops_2016.jpg',
  'CM Punk': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/CM_Punk_Tribute_to_the_Troops_2010_crop.jpg',
  'Randy Orton': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Randy_Orton_September_2016.jpg',
  'Seth Rollins': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Seth_Rollins_2018.jpg',
  'Becky Lynch': 'https://upload.wikimedia.org/wikipedia/commons/6/66/Becky_Lynch_in_April_2019.jpg',
  'Charlotte Flair': 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Charlotte_Flair_April_2018.jpg',
  'Sasha Banks': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Sasha_Banks_2016.jpg',
  'Bayley': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Bayley_in_April_2017.jpg',
  'AJ Styles': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/AJ_Styles_in_April_2017.jpg',
  'Kevin Owens': 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Kevin_Owens_September_2016.jpg',
  'Sami Zayn': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Sami_Zayn_Axxess_2017.jpg',
  'Brock Lesnar': 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Brock_Lesnar_in_March_2015.jpg',
  'The Undertaker': 'https://upload.wikimedia.org/wikipedia/commons/3/30/Undertaker_with_Paul_Bearer.jpg',
  'Triple H': 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Triple_H_Axxess_2014.jpg',
  'Shawn Michaels': 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Shawn_Michaels_in_March_2010.jpg',
  'Rhea Ripley': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Rhea_Ripley_NXT_2019.jpg',
  'Bianca Belair': 'https://upload.wikimedia.org/wikipedia/commons/3/32/Bianca_Belair_NXT_2020.jpg',
  'Asuka': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Asuka_WrestleMania_34.jpg',
  'Drew McIntyre': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Drew_McIntyre_2018.jpg',
  'Cody Rhodes': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Cody_Rhodes_WWE_2016.jpg',
  'Finn Balor': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Finn_B%C3%A1lor_NXT_Champ.jpg',
  
  // AEW
  'Jon Moxley': 'https://upload.wikimedia.org/wikipedia/commons/6/67/Dean_Ambrose_Axxess_2014.jpg',
  'Kenny Omega': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Kenny_Omega_2019_Show_1.jpg',
  'Chris Jericho': 'https://upload.wikimedia.org/wikipedia/commons/0/04/Chris_Jericho_Axxess_2014.jpg',
  'Sting': 'https://upload.wikimedia.org/wikipedia/commons/8/84/Sting_November_2014.jpg',
  'Darby Allin': 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Darby_Allin_2019.jpg',
  'MJF': 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Maxwell_Jacob_Friedman_2019.jpg',
  'Adam Cole': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Adam_Cole_NXT_2019.jpg',
  'Orange Cassidy': 'https://upload.wikimedia.org/wikipedia/commons/7/77/Orange_Cassidy_2019.jpg',
  'Will Ospreay': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Will_Ospreay_at_Bound_for_Glory.jpg',
  'Hangman Adam Page': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Adam_Page_2019.jpg',
  'Mercedes Moné': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Sasha_Banks_2016.jpg',
  'Jamie Hayter': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Jamie_Hayter_2022.jpg',
  'Toni Storm': 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Toni_Storm_in_2018.jpg',
  
  // NJPW
  'Tetsuya Naito': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Naito_Tetsuya_2022.jpg',
  'Kazuchika Okada': 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Kazuchika_Okada_2017.jpg',
  'Hiroshi Tanahashi': 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Hiroshi_Tanahashi_2017.jpg',
  'Zack Sabre Jr.': 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Zack_Sabre_Jr_2018.jpg',
  'Hiromu Takahashi': 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Hiromu_Takahashi_2019.jpg',
  'Kota Ibushi': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Ibushi_Kota_2017.jpg',
  'Jay White': 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Jay_White_2019.jpg',
  'SANADA': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Sanada_2017.jpg',
  'EVIL': 'https://upload.wikimedia.org/wikipedia/commons/d/da/Evil_2017.jpg',
  'Shingo Takagi': 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Shingo_Takagi_2019.jpg',
  'El Desperado': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/El_Desperado_2020.jpg/400px-El_Desperado_2020.jpg',
  
  // TNA/Impact
  'Nic Nemeth': 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Dolph_Ziggler_2017.jpg',
  'Josh Alexander': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Josh_Alexander_Impact_Wrestling.jpg',
  'Jordynne Grace': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Jordynne_Grace_2022.jpg',
  'Masha Slamovich': 'https://upload.wikimedia.org/wikipedia/commons/6/65/Masha_Slamovich_2022.jpg',
  'Moose': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Moose_2018.jpg',
  
  // ROH
  'Mark Briscoe': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Mark_Briscoe_2022.jpg',
  'Eddie Kingston': 'https://upload.wikimedia.org/wikipedia/commons/3/34/Eddie_Kingston_2019.jpg',
  'Athena': 'https://upload.wikimedia.org/wikipedia/commons/8/82/Ember_Moon_Axxess_2018.jpg',
  'Billie Starkz': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Billie_Starkz.jpg',
};

// Helper function to download and upload image
async function downloadAndUploadImage(imageUrl, wrestlerName) {
  if (!imageUrl || !wrestlerName) return null;
  
  try {
    const safeName = wrestlerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const fileExtension = imageUrl.split('.').pop().split('?')[0] || 'jpg';
    const storagePath = `images/wrestlers/${safeName}.${fileExtension}`;
    
    // Check if already exists
    try {
      const storageRef = ref(storage, storagePath);
      const existingUrl = await getDownloadURL(storageRef);
      console.log(`   ✓ Already exists: ${wrestlerName}`);
      return existingUrl;
    } catch (e) {
      // Doesn't exist, continue
    }
    
    // Download the image
    console.log(`   📥 Downloading: ${wrestlerName}...`);
    const response = await fetch(imageUrl, {
      mode: 'cors',
      referrerPolicy: 'no-referrer'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // Upload to Storage
    console.log(`   📤 Uploading: ${wrestlerName}...`);
    const storageRef = ref(storage, storagePath);
    const metadata = {
      contentType: blob.type || `image/${fileExtension}`,
      customMetadata: {
        originalUrl: imageUrl,
        wrestlerName: wrestlerName,
        uploadedAt: new Date().toISOString()
      }
    };
    
    await uploadBytes(storageRef, blob, metadata);
    const downloadURL = await getDownloadURL(storageRef);
    
    // Save to Firestore
    const imageDoc = doc(db, 'artifacts', appId, 'public', 'data', 'images', 'wrestlers');
    const currentData = await getDoc(imageDoc);
    const existingImages = currentData.exists() ? currentData.data() : {};
    
    await setDoc(imageDoc, {
      ...existingImages,
      [wrestlerName]: downloadURL,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log(`   ✅ Uploaded: ${wrestlerName}`);
    return downloadURL;
  } catch (error) {
    console.log(`   ❌ Failed: ${wrestlerName} - ${error.message}`);
    return null;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting image upload to Firebase Storage...\n');
  console.log(`📊 Total wrestlers: ${Object.keys(WRESTLER_IMAGES).length}\n`);
  
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  
  for (const [wrestlerName, imageUrl] of Object.entries(WRESTLER_IMAGES)) {
    try {
      const result = await downloadAndUploadImage(imageUrl, wrestlerName);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`   ❌ Error processing ${wrestlerName}:`, error.message);
      failCount++;
    }
  }
  
  console.log('\n✅ Upload complete!');
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Skipped: ${skipCount}`);
}

main().catch(console.error);

