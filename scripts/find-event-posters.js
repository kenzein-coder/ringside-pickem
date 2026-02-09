import https from 'https';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DELAY_MS = 1000;

// Initialize Firebase Admin
let db = null;
let appId = null;

const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
if (existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }
  
  db = admin.firestore();
  appId = serviceAccount.project_id;
  console.log('✅ Firebase Admin SDK initialized\n');
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function searchWikipediaPoster(eventName) {
  try {
    // Clean event name for search
    const searchName = eventName
      .replace(/\s*\d{4}\s*$/, '') // Remove year
      .replace(/\s*20\d{2}\s*$/, '') // Remove 20xx year
      .trim();
    
    console.log(`  🔍 Searching Wikipedia for: "${searchName}"`);
    
    // Search Wikipedia
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=${encodeURIComponent(searchName)}&limit=3`;
    const searchData = await fetchURL(searchUrl);
    const searchResults = JSON.parse(searchData);
    
    if (!searchResults[3] || searchResults[3].length === 0) {
      console.log(`  ❌ No Wikipedia page found`);
      return null;
    }
    
    // Get page title from first result
    const pageTitle = searchResults[1][0];
    console.log(`  📄 Found Wikipedia page: "${pageTitle}"`);
    
    // Get page images
    const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=1000`;
    const imageData = await fetchURL(imageUrl);
    const imageJson = JSON.parse(imageData);
    
    const pages = imageJson.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pages[pageId]?.thumbnail?.source) {
        const posterUrl = pages[pageId].thumbnail.source;
        console.log(`  ✅ Found poster: ${posterUrl.substring(0, 80)}...`);
        return posterUrl;
      }
    }
    
    console.log(`  ⚠️  No poster image found on page`);
    return null;
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function updateEventPosters() {
  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }
  
  console.log('🖼️  Finding and updating event posters\n');
  console.log('━'.repeat(60) + '\n');
  
  try {
    const eventsRef = db
      .collection('artifacts')
      .doc(appId)
      .collection('public')
      .doc('data')
      .collection('events');
    
    // Get events without posters (only posterUrl missing, allow bannerUrl)
    const snapshot = await eventsRef.get();
    
    const eventsWithoutPosters = [];
    snapshot.forEach(doc => {
      const event = doc.data();
      // Focus on major PPVs (isPPV) without posters
      if (event.isPPV && !event.posterUrl) {
        eventsWithoutPosters.push({
          id: doc.id,
          ref: doc.ref,
          ...event
        });
      }
    });
    
    console.log(`📊 Found ${eventsWithoutPosters.length} PPV events without posters\n`);
    
    if (eventsWithoutPosters.length === 0) {
      console.log('✅ All PPV events already have posters!\n');
      process.exit(0);
    }
    
    // Sort by date (most recent first)
    eventsWithoutPosters.sort((a, b) => {
      // Simple date comparison (works for most formats)
      return b.date.localeCompare(a.date);
    });
    
    let updated = 0;
    let failed = 0;
    
    // Process first 10 events to avoid rate limiting
    for (let i = 0; i < Math.min(10, eventsWithoutPosters.length); i++) {
      const event = eventsWithoutPosters[i];
      
      console.log(`\n${i + 1}. ${event.name}`);
      console.log(`   Date: ${event.date}`);
      console.log(`   Promotion: ${event.promotionName || 'Unknown'}`);
      
      const posterUrl = await searchWikipediaPoster(event.name);
      
      if (posterUrl) {
        // Update Firestore
        try {
          await event.ref.update({
            posterUrl: posterUrl,
            posterSource: 'wikipedia',
            posterUpdatedAt: new Date().toISOString()
          });
          
          console.log(`   ✅ Updated in Firestore`);
          updated++;
        } catch (error) {
          console.log(`   ❌ Failed to update Firestore: ${error.message}`);
          failed++;
        }
      } else {
        failed++;
      }
      
      // Rate limiting
      if (i < eventsWithoutPosters.length - 1) {
        console.log(`\n   ⏳ Waiting ${DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   ❌ Failed/No poster found: ${failed}`);
    console.log(`   📝 Remaining without posters: ${eventsWithoutPosters.length - updated - failed}`);
    
    console.log('\n💡 Tip: You can also add posters manually via the Admin Panel\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateEventPosters().then(() => {
  console.log('✅ Complete\n');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
