#!/usr/bin/env node

/**
 * Fetch Wrestler Images from ProFightDB
 * Scrapes wrestler pages to get image URLs and stores them in Firestore
 */

import https from 'https';
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Rate limiting
const DELAY_MS = 2000;

// Firebase initialization
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    };

    client.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    }).on('error', reject);
  });
}

// Extract wrestler image from ProFightDB wrestler page
async function getWrestlerImage(wrestlerSlug) {
  try {
    const url = `http://www.profightdb.com/wrestlers/${wrestlerSlug}.html`;
    const html = await fetchHTML(url);
    
    // Look for the wrestler image - usually in /img/wrestlers/thumbs-600/
    const imgMatch = html.match(/<img[^>]*src=["'](\/img\/wrestlers\/thumbs-600\/[^"']*\.jpg)["'][^>]*>/i);
    if (imgMatch) {
      const imagePath = imgMatch[1];
      const imageUrl = `http://www.profightdb.com${imagePath}`;
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error(`  ⚠️  Error fetching image for ${wrestlerSlug}:`, error.message);
    return null;
  }
}

// Get wrestler images for all wrestlers in an event
async function getEventWrestlerImages(event) {
  if (!event.matches || event.matches.length === 0) {
    return event;
  }
  
  console.log(`🖼️  Fetching wrestler images for ${event.name}...`);
  
  const wrestlerSlugs = new Set();
  
  // Collect all unique wrestler slugs from matches
  event.matches.forEach(match => {
    if (match.p1Members) {
      match.p1Members.forEach(m => {
        if (m.slug) wrestlerSlugs.add(m.slug);
      });
    }
    if (match.p2Members) {
      match.p2Members.forEach(m => {
        if (m.slug) wrestlerSlugs.add(m.slug);
      });
    }
  });
  
  console.log(`  Found ${wrestlerSlugs.size} unique wrestlers`);
  
  // Fetch images for each wrestler
  const imageMap = {};
  let fetchedCount = 0;
  
  for (const slug of wrestlerSlugs) {
    await delay(DELAY_MS);
    const imageUrl = await getWrestlerImage(slug);
    if (imageUrl) {
      imageMap[slug] = imageUrl;
      fetchedCount++;
      console.log(`  ✅ ${slug}: ${imageUrl}`);
    }
  }
  
  console.log(`  📊 Fetched ${fetchedCount}/${wrestlerSlugs.size} images\n`);
  
  // Update matches with image URLs
  const updatedMatches = event.matches.map(match => {
    const updatedMatch = { ...match };
    
    // Update p1Members images
    if (match.p1Members) {
      updatedMatch.p1Members = match.p1Members.map(m => ({
        ...m,
        image: m.slug && imageMap[m.slug] ? imageMap[m.slug] : m.image
      }));
      updatedMatch.p1Image = updatedMatch.p1Members[0]?.image || match.p1Image;
    }
    
    // Update p2Members images
    if (match.p2Members) {
      updatedMatch.p2Members = match.p2Members.map(m => ({
        ...m,
        image: m.slug && imageMap[m.slug] ? imageMap[m.slug] : m.image
      }));
      updatedMatch.p2Image = updatedMatch.p2Members[0]?.image || match.p2Image;
    }
    
    return updatedMatch;
  });
  
  return {
    ...event,
    matches: updatedMatches
  };
}

// Main function - update wrestler images for events
async function main() {
  console.log('🚀 Starting wrestler image fetcher from ProFightDB...\n');
  
  initFirebase();
  
  if (!db) {
    console.log('❌ Cannot fetch images - Firebase not configured');
    return;
  }
  
  try {
    // Get events that need images (events with matches but no images)
    const eventsRef = db.collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('events');
    
    const eventsSnap = await eventsRef.get();
    
    const eventsToUpdate = [];
    eventsSnap.forEach(doc => {
      const data = doc.data();
      const matches = data.matches || [];
      
      // Check if any matches have wrestlers but no images
      const needsImages = matches.some(m => {
        const hasP1Members = m.p1Members && m.p1Members.length > 0;
        const hasP2Members = m.p2Members && m.p2Members.length > 0;
        const p1HasImages = hasP1Members && m.p1Members.some(mem => mem.image);
        const p2HasImages = hasP2Members && m.p2Members.some(mem => mem.image);
        return (hasP1Members && !p1HasImages) || (hasP2Members && !p2HasImages);
      });
      
      if (needsImages && matches.length > 0) {
        eventsToUpdate.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    console.log(`📊 Found ${eventsToUpdate.length} events that need wrestler images\n`);
    
    // Update images for first 5 events (to avoid rate limiting)
    for (let i = 0; i < Math.min(eventsToUpdate.length, 5); i++) {
      const event = eventsToUpdate[i];
      const updatedEvent = await getEventWrestlerImages(event);
      
      // Save to Firestore
      try {
        await eventsRef.doc(event.id).update({
          matches: updatedEvent.matches
        });
        console.log(`✅ Updated ${event.name} with wrestler images\n`);
      } catch (error) {
        console.error(`❌ Error updating ${event.name}:`, error.message);
      }
    }
    
    console.log('✅ Wrestler image fetching complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
