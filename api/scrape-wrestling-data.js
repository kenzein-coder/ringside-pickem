/**
 * Vercel Serverless Function for Scraping Wrestling Data
 * Runs on a schedule via Vercel Cron
 * 
 * Cron schedule: Runs daily at 2 AM UTC
 * 
 * To test locally: curl http://localhost:3000/api/scrape-wrestling-data
 */

import https from 'https';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Rate limiting
const DELAY_MS = 2000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    };

    https.get(url, options, (res) => {
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

function parseEvents(html) {
  const events = [];
  const eventRowRegex = /<tr[^>]*class="TRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  const seenEvents = new Set();
  
  while ((match = eventRowRegex.exec(html)) !== null) {
    const row = match[1];
    
    const dateMatch = row.match(/<td[^>]*class="TCol[^"]*"[^>]*>(\d{2}\.\d{2}\.\d{4})<\/td>/);
    const date = dateMatch ? dateMatch[1] : null;
    
    const promoMatch = row.match(/<a[^>]*href="\?id=8&amp;nr=(\d+)"[^>]*>[\s\S]*?alt="([^"]+)"[^>]*>/);
    const promoId = promoMatch ? promoMatch[1] : null;
    const promoName = promoMatch ? promoMatch[2] : null;
    
    const eventMatch = row.match(/<a[^>]*href="\?id=1&amp;nr=(\d+)"[^>]*>([^<]+)<\/a>/);
    if (eventMatch && promoId) {
      const eventId = eventMatch[1];
      const eventName = eventMatch[2].trim();
      
      if (!seenEvents.has(eventId) && eventName.length > 0) {
        seenEvents.add(eventId);
        
        // Filter for major promotions
        const majorPromoIds = ['1', '2287', '7', '5', '122'];
        if (majorPromoIds.includes(promoId) || 
            promoName?.toUpperCase().includes('WWE') ||
            promoName?.toUpperCase().includes('AEW') ||
            promoName?.toUpperCase().includes('NJPW')) {
          events.push({
            id: `cagematch-${eventId}`,
            cagematchEventId: eventId,
            promotionId: promoId,
            promotionName: promoName,
            name: eventName,
            date: date
          });
        }
      }
    }
  }
  
  return events;
}

export default async function handler(req, res) {
  // Only allow GET requests (or cron triggers)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🚀 Starting scheduled wrestling data scrape...');

  try {
    // Fetch recent events
    const url = 'https://www.cagematch.net/?id=1';
    const html = await fetchHTML(url);
    const events = parseEvents(html);
    
    console.log(`✅ Found ${events.length} events from major promotions`);

    // Save to Firestore if environment variables are set
    let savedCount = 0;
    if (process.env.VITE_FIREBASE_API_KEY && process.env.VITE_FIREBASE_API_KEY !== 'AIzaSyD...') {
      try {
        const firebaseConfig = {
          apiKey: process.env.VITE_FIREBASE_API_KEY,
          authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.VITE_FIREBASE_APP_ID
        };
        
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const appId = process.env.VITE_FIREBASE_PROJECT_ID || 'default-app-id';
        
        for (const event of events.slice(0, 20)) { // Limit to 20 per run
          try {
            await setDoc(
              doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id),
              {
                ...event,
                updatedAt: new Date().toISOString(),
                scrapedAt: new Date().toISOString()
              },
              { merge: true }
            );
            savedCount++;
          } catch (error) {
            console.error(`Error saving ${event.name}:`, error.message);
          }
        }
        
        console.log(`✅ Saved ${savedCount} events to Firestore`);
      } catch (error) {
        console.error('Firebase error:', error.message);
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      eventsFound: events.length,
      eventsSaved: savedCount,
      events: events.slice(0, 10) // Return first 10
    });

  } catch (error) {
    console.error('❌ Scraping error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

