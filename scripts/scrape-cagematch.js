#!/usr/bin/env node

/**
 * Cagematch.net Scraper
 * Fetches wrestling data: promotions, events, matches, wrestlers
 * 
 * Usage: node scripts/scrape-cagematch.js
 */

import https from 'https';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Rate limiting - be respectful (2 seconds between requests)
const DELAY_MS = 2000;

// Firebase initialization (optional - only if .env exists)
let db = null;
let appId = 'default-app-id';

function initFirebase() {
  try {
    // Try to load environment variables
    const envPath = join(__dirname, '../.env');
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf-8');
      const envVars = {};
      envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) {
          envVars[match[1].trim()] = match[2].trim();
        }
      });
      
      if (envVars.VITE_FIREBASE_API_KEY && envVars.VITE_FIREBASE_API_KEY !== 'AIzaSyD...') {
        const firebaseConfig = {
          apiKey: envVars.VITE_FIREBASE_API_KEY,
          authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: envVars.VITE_FIREBASE_PROJECT_ID,
          storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: envVars.VITE_FIREBASE_APP_ID
        };
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        appId = envVars.VITE_FIREBASE_PROJECT_ID || 'default-app-id';
        console.log('✅ Firebase initialized\n');
        return true;
      }
    }
  } catch (error) {
    console.log('⚠️  Firebase not configured, saving to JSON files only\n');
  }
  return false;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    };

    https.get(url, options, (res) => {
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

function parseHTML(html) {
  const results = {
    promotions: [],
    events: [],
    matches: []
  };
  
  // Extract promotions from promotion list page (id=8)
  // Format: <a href="?id=8&nr=123">Promotion Name</a>
  const promoRegex = /<a[^>]*href="\?id=8&amp;nr=(\d+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  const seenPromos = new Set();
  
  while ((match = promoRegex.exec(html)) !== null) {
    const id = match[1];
    const name = match[2].trim();
    if (!seenPromos.has(id) && name.length > 0 && !name.includes('<img')) {
      seenPromos.add(id);
      results.promotions.push({
        id: id,
        name: name,
        cagematchId: id,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      });
    }
  }
  
  // Extract events from event list page (id=1)
  // Format: <a href="?id=1&nr=EVENT_ID">Event Name</a>
  // Also extract promotion: <a href="?id=8&nr=PROMO_ID">
  // And date from table row: <td class="TCol TColSeparator">DD.MM.YYYY</td>
  const eventRowRegex = /<tr[^>]*class="TRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  const seenEvents = new Set();
  
  while ((match = eventRowRegex.exec(html)) !== null) {
    const row = match[1];
    
    // Extract date
    const dateMatch = row.match(/<td[^>]*class="TCol[^"]*"[^>]*>(\d{2}\.\d{2}\.\d{4})<\/td>/);
    const date = dateMatch ? dateMatch[1] : null;
    
    // Extract promotion ID and name
    const promoMatch = row.match(/<a[^>]*href="\?id=8&amp;nr=(\d+)"[^>]*>[\s\S]*?alt="([^"]+)"[^>]*>/);
    const promoId = promoMatch ? promoMatch[1] : null;
    const promoName = promoMatch ? promoMatch[2] : null;
    
    // Extract event ID and name
    const eventMatch = row.match(/<a[^>]*href="\?id=1&amp;nr=(\d+)"[^>]*>([^<]+)<\/a>/);
    if (eventMatch && promoId) {
      const eventId = eventMatch[1];
      const eventName = eventMatch[2].trim();
      const key = eventId;
      
      if (!seenEvents.has(key) && eventName.length > 0) {
        seenEvents.add(key);
        results.events.push({
          id: `cagematch-${eventId}`,
          cagematchEventId: eventId,
          promotionId: promoId,
          promotionName: promoName,
          name: eventName,
          date: date,
          slug: eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        });
      }
    }
  }
  
  return results;
}

async function scrapePromotions() {
  console.log('🔍 Scraping promotions from Cagematch.net...');
  
  try {
    // Promotions page is id=8
    const url = 'https://www.cagematch.net/?id=8&view=promotions';
    console.log(`📡 Fetching: ${url}`);
    const html = await fetchHTML(url);
    
    // Save raw HTML for inspection
    writeFileSync(join(__dirname, '../data/cagematch-promotions-raw.html'), html);
    console.log('💾 Saved raw HTML to data/cagematch-promotions-raw.html');
    
    const results = parseHTML(html);
    const promotions = results.promotions;
    
    console.log(`✅ Found ${promotions.length} promotions`);
    
    // Filter major promotions
    const majorPromotions = promotions.filter(p => {
      const name = p.name.toUpperCase();
      return name.includes('WWE') || 
             name.includes('AEW') || 
             name.includes('NJPW') || 
             name.includes('TNA') || 
             name.includes('ROH') ||
             name.includes('IMPACT') ||
             name.includes('STARDOM');
    });
    
    console.log(`⭐ Found ${majorPromotions.length} major promotions`);
    
    writeFileSync(join(__dirname, '../data/promotions.json'), JSON.stringify(majorPromotions, null, 2));
    console.log('💾 Saved to data/promotions.json');
    
    // Save to Firestore if available
    if (db) {
      console.log('🔥 Saving promotions to Firestore...');
      for (const promo of majorPromotions) {
        try {
          await setDoc(
            doc(db, 'artifacts', appId, 'public', 'data', 'promotions', promo.id),
            {
              ...promo,
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          );
        } catch (error) {
          console.error(`  ⚠️  Error saving ${promo.name}:`, error.message);
        }
      }
      console.log('✅ Promotions saved to Firestore\n');
    } else {
      console.log('');
    }
    
    return majorPromotions;
  } catch (error) {
    console.error('❌ Error scraping promotions:', error.message);
    throw error;
  }
}

async function scrapeRecentEvents() {
  console.log('🔍 Scraping recent events from Cagematch.net...');
  
  try {
    // Main events page shows recent events
    const url = 'https://www.cagematch.net/?id=1';
    console.log(`📡 Fetching: ${url}`);
    const html = await fetchHTML(url);
    
    await delay(DELAY_MS); // Be respectful
    
    const results = parseHTML(html);
    const events = results.events;
    
    console.log(`✅ Found ${events.length} events`);
    
    // Filter for major promotions only
    const majorPromoIds = ['1', '2287', '7', '5', '122']; // WWE, AEW, NJPW, TNA, ROH
    const majorEvents = events.filter(e => 
      majorPromoIds.includes(e.promotionId) ||
      e.promotionName?.toUpperCase().includes('WWE') ||
      e.promotionName?.toUpperCase().includes('AEW') ||
      e.promotionName?.toUpperCase().includes('NJPW') ||
      e.promotionName?.toUpperCase().includes('TNA') ||
      e.promotionName?.toUpperCase().includes('ROH')
    );
    
    console.log(`⭐ Found ${majorEvents.length} events from major promotions`);
    
    return majorEvents;
  } catch (error) {
    console.error(`❌ Error scraping events:`, error.message);
    return [];
  }
}

function parseEventDetails(html) {
  const details = {
    date: null,
    venue: null,
    arena: null,
    location: null,
    matches: []
  };
  
  // Extract date from InformationBoxRow
  const dateMatch = html.match(/<div class="InformationBoxTitle">Date:<\/div><div class="InformationBoxContents"><a[^>]*>(\d{2}\.\d{2}\.\d{4})<\/a><\/div>/);
  if (dateMatch) {
    details.date = dateMatch[1];
  }
  
  // Extract location
  const locationMatch = html.match(/<div class="InformationBoxTitle">Location:<\/div><div class="InformationBoxContents"><a[^>]*>([^<]+)<\/a><\/div>/);
  if (locationMatch) {
    details.location = locationMatch[1].trim();
  }
  
  // Extract arena
  const arenaMatch = html.match(/<div class="InformationBoxTitle">Arena:<\/div><div class="InformationBoxContents"><a[^>]*>([^<]+)<\/a><\/div>/);
  if (arenaMatch) {
    details.arena = arenaMatch[1].trim();
  }
  
  // Combine location and arena for venue
  if (details.location || details.arena) {
    details.venue = [details.arena, details.location].filter(Boolean).join(', ');
  }
  
  // Extract matches from <div class="Matches"> - match until ContentDivider
  const matchesSectionMatch = html.match(/<div class="Matches">([\s\S]*?)<hr class="ContentDivider"/);
  if (matchesSectionMatch) {
    const matchesHtml = matchesSectionMatch[1];
    
    // Each match is in <div class="Match"> - need to match the full div including nested divs
    // Pattern: <div class="Match">...content with nested divs...</div></div>
    // We'll match by finding Match divs and their content until the closing </div></div>
    const matchBlocks = matchesHtml.split(/<div class="Match">/);
    
    for (let i = 1; i < matchBlocks.length; i++) {
      const matchBlock = matchBlocks[i];
      
      // Find where this match div ends (closing </div></div>)
      let depth = 1;
      let endIndex = 0;
      for (let j = 0; j < matchBlock.length; j++) {
        if (matchBlock.substring(j).startsWith('<div')) {
          depth++;
        } else if (matchBlock.substring(j).startsWith('</div>')) {
          depth--;
          if (depth === 0) {
            endIndex = j;
            break;
          }
        }
      }
      
      const matchHtml = matchBlock.substring(0, endIndex);
      
      // Extract match type
      const typeMatch = matchHtml.match(/<div class="MatchType">([^<]+)<\/div>/);
      const matchType = typeMatch ? typeMatch[1].trim() : 'Unknown';
      
      // Extract match results
      const resultsMatch = matchHtml.match(/<div class="MatchResults">([\s\S]*?)<\/div>/);
      if (resultsMatch) {
        const resultsHtml = resultsMatch[1];
        
        // Extract all wrestler names from links (skip managers in parentheses)
        const wrestlerPattern = /<a[^>]*href="\?id=2&amp;nr=\d+[^"]*"[^>]*>([^<]+)<\/a>/g;
        const allLinks = [];
        let linkMatch;
        while ((linkMatch = wrestlerPattern.exec(resultsHtml)) !== null) {
          allLinks.push({
            name: linkMatch[1].trim(),
            position: linkMatch.index
          });
        }
        
        // Extract winner and loser from "defeats" pattern
        let winner = null;
        let loser = null;
        let p1 = null;
        let p2 = null;
        
        if (resultsHtml.includes('defeats')) {
          const defeatsIndex = resultsHtml.indexOf('defeats');
          
          // Get last link before "defeats" as winner
          const beforeDefeats = allLinks.filter(l => l.position < defeatsIndex);
          if (beforeDefeats.length > 0) {
            winner = beforeDefeats[beforeDefeats.length - 1].name;
            p1 = winner;
          }
          
          // Get first link after "defeats" (before time) as loser
          const afterDefeats = allLinks.filter(l => l.position > defeatsIndex);
          if (afterDefeats.length > 0) {
            // Skip manager links (usually right after defeats)
            const loserLink = afterDefeats.find(l => {
              const textAfter = resultsHtml.substring(l.position);
              return !textAfter.match(/^[^<]*\(/); // Not immediately followed by (
            }) || afterDefeats[0];
            loser = loserLink.name;
            p2 = loser;
          }
        } else if (allLinks.length >= 2) {
          // If no "defeats", use first two main wrestlers (skip managers)
          const mainWrestlers = allLinks.filter((l, idx) => {
            // Skip if it's in parentheses (manager)
            const beforeLink = resultsHtml.substring(0, l.position);
            return !beforeLink.endsWith('(w/') && !beforeLink.endsWith('(');
          });
          
          if (mainWrestlers.length >= 2) {
            p1 = mainWrestlers[0].name;
            p2 = mainWrestlers[1].name;
          } else if (allLinks.length >= 2) {
            p1 = allLinks[0].name;
            p2 = allLinks[1].name;
          }
        }
        
        // Extract match time
        const timeMatch = resultsHtml.match(/\((\d+:\d+)\)/);
        const matchTime = timeMatch ? timeMatch[1] : null;
        
        // Extract title from match type
        let title = null;
        if (matchType.toLowerCase().includes('title') || 
            matchType.toLowerCase().includes('championship') ||
            matchType.toLowerCase().includes('champion')) {
          title = matchType;
        }
        
        if (p1 && p2) {
          details.matches.push({
            id: i,
            type: matchType,
            p1: p1,
            p2: p2,
            winner: winner,
            time: matchTime,
            title: title || matchType
          });
        }
      }
    }
  }
  
  return details;
}

async function scrapeEventDetails(event) {
  console.log(`🔍 Scraping details for ${event.name}...`);
  
  try {
    // Use page=2 for the card view
    const url = `https://www.cagematch.net/?id=1&nr=${event.cagematchEventId}&page=2`;
    console.log(`📡 Fetching: ${url}`);
    const html = await fetchHTML(url);
    
    await delay(DELAY_MS); // Be respectful
    
    // Parse event details
    const details = parseEventDetails(html);
    
    const eventDetails = {
      ...event,
      date: details.date || event.date,
      venue: details.venue || details.location || details.arena,
      location: details.location,
      arena: details.arena,
      matches: details.matches
    };
    
    console.log(`✅ Found ${details.matches.length} matches, venue: ${eventDetails.venue || 'N/A'}`);
    
    return eventDetails;
  } catch (error) {
    console.error(`❌ Error scraping event details for ${event.name}:`, error.message);
    return event;
  }
}

async function main() {
  console.log('🚀 Starting Cagematch.net scraper...\n');
  
  // Initialize Firebase if available
  const useFirestore = initFirebase();
  
  try {
    // Step 1: Scrape promotions
    const promotions = await scrapePromotions();
    await delay(DELAY_MS);
    
    // Step 2: Scrape recent events from main page
    const allEvents = await scrapeRecentEvents();
    
    writeFileSync(join(__dirname, '../data/events.json'), JSON.stringify(allEvents, null, 2));
    console.log(`💾 Saved ${allEvents.length} events to data/events.json`);
    
    // Step 3: Scrape details for all events and save to Firestore
    console.log('\n🔍 Scraping event details and match cards...\n');
    const eventsWithDetails = [];
    
    for (let i = 0; i < Math.min(allEvents.length, 10); i++) { // Limit to 10 for testing
      const event = allEvents[i];
      const eventDetails = await scrapeEventDetails(event);
      eventsWithDetails.push(eventDetails);
      
      // Save to Firestore if available
      if (db) {
        try {
          await setDoc(
            doc(db, 'artifacts', appId, 'public', 'data', 'events', eventDetails.id),
            {
              ...eventDetails,
              updatedAt: new Date().toISOString(),
              scrapedAt: new Date().toISOString()
            },
            { merge: true }
          );
          console.log(`  ✅ Saved ${eventDetails.name} to Firestore`);
        } catch (error) {
          console.error(`  ⚠️  Error saving ${eventDetails.name}:`, error.message);
        }
      }
      
      await delay(DELAY_MS);
    }
    
    writeFileSync(
      join(__dirname, '../data/events-with-details.json'), 
      JSON.stringify(eventsWithDetails, null, 2)
    );
    console.log(`\n💾 Saved ${eventsWithDetails.length} events with details to data/events-with-details.json`);
    
    if (db) {
      console.log('✅ All events saved to Firestore');
    }
    
    console.log('\n✅ Scraping complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Inspect the raw HTML files in data/ directory');
    console.log('2. Adjust parseHTML() function to match actual Cagematch.net structure');
    console.log('3. Add parsing for dates, venues, and match cards');
    console.log('4. Set up scheduled runs (Vercel Cron or Firebase Cloud Functions)');
    console.log('5. Store data in Firestore instead of JSON files');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
