#!/usr/bin/env node

/**
 * ProFightDB.com Scraper
 * Fetches PPV events, match cards, and results from The Internet Wrestling Database
 * 
 * Usage: node scripts/scrape-profightdb.js
 */

import https from 'https';
import http from 'http';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Rate limiting - be respectful
const DELAY_MS = 2000;

// Firebase initialization (optional)
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    };

    // Use http for HTTP URLs, https for HTTPS URLs
    const client = url.startsWith('https://') ? https : http;
    
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

// Map promotion names to our promoIds
function mapPromotionName(promoName) {
  const promoMap = {
    'WWE': { id: 'wwe', promotionId: '1' },
    'AEW': { id: 'aew', promotionId: '2287' },
    'NJPW': { id: 'njpw', promotionId: '7' },
    'TNA': { id: 'tna', promotionId: '5' },
    'Impact Wrestling': { id: 'tna', promotionId: '5' },
    'ROH': { id: 'roh', promotionId: '122' },
    'Ring of Honor': { id: 'roh', promotionId: '122' },
    'STARDOM': { id: 'stardom', promotionId: null },
    'CMLL': { id: 'cmll', promotionId: null },
    'AAA': { id: 'aaa', promotionId: null },
    'GCW': { id: 'gcw', promotionId: null },
    'MLW': { id: 'mlw', promotionId: null }
  };
  
  for (const [key, value] of Object.entries(promoMap)) {
    if (promoName.toUpperCase().includes(key)) {
      return value;
    }
  }
  return null;
}

// Parse date from various formats and normalize to "Month DD, YYYY"
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Handle "Jan 4th 2026" format (with ordinal suffixes)
  const ordinalMatch = dateStr.match(/([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})/);
  if (ordinalMatch) {
    const [, month, day, year] = ordinalMatch;
    // Normalize to "Jan 4, 2026" format (remove ordinal)
    return `${month} ${parseInt(day)}, ${year}`;
  }
  
  // Try "Month DD, YYYY" format
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  
  // Try "DD.MM.YYYY" format
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
  }
  
  return dateStr;
}

// Scrape PPV events from the cards listing page
async function scrapePPVEvents() {
  console.log('🔍 Scraping PPV events from ProFightDB.com...\n');
  
  try {
    // Scrape multiple pages to get more events
    const events = [];
    const maxPages = 5; // Scrape first 5 pages
    
    for (let page = 1; page <= maxPages; page++) {
      const url = `http://www.profightdb.com/cards/pg${page}-yes.html?order=&type=`;
      console.log(`📡 Fetching page ${page}: ${url}`);
      
      const html = await fetchHTML(url);
      await delay(DELAY_MS);
      
      // Parse events from the table
      // Skip header row (class="head")
      const eventRowRegex = /<tr[^>]*class="(?!head)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
      let match;
      
      while ((match = eventRowRegex.exec(html)) !== null) {
        const row = match[1];
        
        // Extract date - format: <a href='/this-day-in-history/01-18-2026.html'>Jan 18th 2026</a>
        const dateMatch = row.match(/<a[^>]*href=['"]\/this-day-in-history\/([^"']+)\.html['"][^>]*>([^<]+)<\/a>/);
        if (!dateMatch) continue;
        const date = parseDate(dateMatch[2].trim());
        
        // Extract promotion - format: <a href="/cards/gcw-cards-pg1-yes-226.html" class="black"><strong>GCW</strong></a>
        const promoMatch = row.match(/<a[^>]*href=["']\/cards\/([^"']+)-cards[^"']*\.html["'][^>]*>[\s\S]*?<strong>([^<]+)<\/strong><\/a>/);
        if (!promoMatch) continue;
        const promoName = promoMatch[2].trim();
        const promoInfo = mapPromotionName(promoName);
        
        // Skip if not a major promotion we support
        if (!promoInfo) continue;
        
        // Extract event name and link - format: <a href="/cards/gcw/crime-wave-2026-57986.html">Crime Wave 2026</a>
        const eventMatch = row.match(/<a[^>]*href=["']\/cards\/([^"']+)\/([^"']+)\.html["'][^>]*>([^<]+)<\/a>/);
        if (!eventMatch) continue;
        
        const promoSlug = eventMatch[1];
        const eventSlug = eventMatch[2];
        const eventName = eventMatch[3].trim();
        const eventUrl = `http://www.profightdb.com/cards/${promoSlug}/${eventSlug}.html`;
        
        // Extract location - format: <a href="/locations/...">City</a>, <a href="/locations/...">State</a>
        const locationMatches = row.match(/<a[^>]*href=["']\/locations[^"']*\.html["'][^>]*>([^<]+)<\/a>/g);
        let location = null;
        if (locationMatches && locationMatches.length > 0) {
          const locationParts = locationMatches.map(m => {
            const nameMatch = m.match(/>([^<]+)</);
            return nameMatch ? nameMatch[1].trim() : null;
          }).filter(Boolean);
          location = locationParts.join(', ');
        }
        
        // Filter out weekly shows - be more aggressive
        const weeklyPatterns = [
          /dynamite/i, /collision/i, /rampage/i, 
          /raw\s*#/i, /monday\s*night\s*raw/i,
          /smackdown\s*#/i, /friday\s*night\s*smackdown/i,
          /nxt\s*#/i, /nxt(?!\s*(takeover|stand|deliver|deadline|vengeance|battleground|vengeance|battleground|stand|deliver))/i,
          /main\s*event/i, /superstars/i, /thunder/i, /nitro/i,
          /impact(?!\s*(slammiversary|bound|hard|sacrifice|rebellion|against|genesis))/i,
          /dark(?:\s|$)/i, /elevation/i, 
          /world\s*tag\s*league\s*-\s*tag\s*\d+/i, // World Tag League individual shows
          /strong/i, /road\s*to/i,
          /tv\s*#/i, /taping/i, /live\s*event/i,
          /#\d+/i // Any event with a number like "#321" is likely a weekly show
        ];
        const isWeekly = weeklyPatterns.some(pattern => pattern.test(eventName));
        if (isWeekly) {
          console.log(`  ⏭️  Skipping weekly show: ${eventName}`);
          continue;
        }
        
        // Check if event is in the future or recent past (last 6 months)
        const eventDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        if (eventDate < sixMonthsAgo) continue; // Skip events older than 6 months
        
        // Normalize event name for better matching (remove "In Tokyo Dome", "In Osaka", etc.)
        const normalizedName = eventName
          .replace(/\s+in\s+[^,]+(?:,\s*[^,]+)?/i, '') // Remove "In [Venue], [Location]"
          .replace(/\s+at\s+[^,]+(?:,\s*[^,]+)?/i, '') // Remove "At [Venue], [Location]"
          .trim();
        
        events.push({
          id: `profightdb-${eventSlug}`,
          profightdbSlug: eventSlug,
          profightdbUrl: eventUrl,
          name: eventName,
          normalizedName: normalizedName, // Add normalized name for better matching
          date: date,
          venue: location,
          promotionId: promoInfo.promotionId,
          promotionName: promoName,
          promoId: promoInfo.id,
          isPPV: true,
          source: 'profightdb'
        });
      }
      
      console.log(`✅ Found ${events.length} total events so far...`);
    }
    
    // Remove duplicates
    const uniqueEvents = [];
    const seenIds = new Set();
    for (const event of events) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        uniqueEvents.push(event);
      }
    }
    
    console.log(`\n✅ Scraped ${uniqueEvents.length} unique PPV events from ProFightDB\n`);
    return uniqueEvents;
    
  } catch (error) {
    console.error('❌ Error scraping ProFightDB events:', error);
    return [];
  }
}

// Fetch wrestler image from ProFightDB wrestler page
async function getWrestlerImageFromProFightDB(slug) {
  try {
    const url = `http://www.profightdb.com/wrestlers/${slug}.html`;
    const html = await fetchHTML(url);
    await delay(DELAY_MS / 2); // Shorter delay for image fetching
    
    // Look for the wrestler image - usually in /img/wrestlers/thumbs-600/
    const imgMatch = html.match(/<img[^>]*src=["'](\/img\/wrestlers\/thumbs-600\/[^"']*\.jpg)["'][^>]*>/i);
    if (imgMatch) {
      const imagePath = imgMatch[1];
      return `http://www.profightdb.com${imagePath}`;
    }
    
    return null;
  } catch (error) {
    // Silently fail - image fetching is optional
    return null;
  }
}

// Scrape match details from an individual event page
async function scrapeEventDetails(event) {
  if (!event.profightdbUrl) {
    return event;
  }
  
  console.log(`🔍 Scraping details for ${event.name}...`);
  
  try {
    const html = await fetchHTML(event.profightdbUrl);
    await delay(DELAY_MS);
    
    const matches = [];
    
    // Extract matches from the page
    // ProFightDB has matches in a table with structure:
    // <tr><td>no.</td><td>winner(s)</td><td>def. (pin)</td><td>loser(s)</td><td>duration</td><td>match type</td><td>title</td></tr>
    
    // Find the matches table - look for "Matches for" heading followed by table
    const matchesSectionMatch = html.match(/<h2[^>]*>[\s\S]*?Matches for[^<]*<\/h2>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!matchesSectionMatch) {
      return { ...event, matches: event.matches || [] };
    }
    
    const tableHtml = matchesSectionMatch[1];
    
    // Extract match rows (skip header row with class="head")
    // Match all rows except header - handle rows with or without class attribute
    const rowRegex = /<tr[^>]*(?:class="(?!head)[^"]*")?[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let matchId = 1;
    
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const row = rowMatch[1];
      
      // Extract match number (first td) - handle both <i>1</i>, _1_, and just 1
      // Also handle italicized rows (pre-show matches)
      const matchNumMatch = row.match(/<td[^>]*>[\s\S]*?[<i>_]?(\d+)[<\/i>_]?[\s\S]*?<\/td>/);
      if (!matchNumMatch) continue;
      
      // Split row into TDs more reliably
      const tdMatches = [];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
      let tdMatch;
      while ((tdMatch = tdRegex.exec(row)) !== null) {
        tdMatches.push(tdMatch[1]);
      }
      
      if (tdMatches.length < 4) continue; // Need at least: num, winner, def, loser
      
      // Extract winner(s) - second td (index 1)
      // Handle italicized content (pre-show matches)
      const winnerHtml = tdMatches[1];
      
      // Extract winner wrestler data (name and slug for image fetching)
      const winners = [];
      const winnerLinks = winnerHtml.match(/<a[^>]*href=["']\/wrestlers\/([^"']*)\.html["'][^>]*>([^<]+)<\/a>/g);
      if (!winnerLinks || winnerLinks.length === 0) continue;
      if (winnerLinks && winnerLinks.length > 0) {
        for (const link of winnerLinks) {
          const nameMatch = link.match(/>([^<]+)</);
          const slugMatch = link.match(/href=["']\/wrestlers\/([^"']*)\.html["']/);
          if (nameMatch && slugMatch) {
            const name = nameMatch[1].trim();
            const slug = slugMatch[1];
            // Store slug - we'll fetch the actual image URL from the wrestler page
            winners.push({ name, slug, profightdbSlug: slug });
          }
        }
      }
      
      // Extract loser wrestler data (name and slug for image fetching)
      const losers = [];
      const loserHtml = tdMatches[3];
      const loserLinks = loserHtml.match(/<a[^>]*href=["']\/wrestlers\/([^"']*)\.html["'][^>]*>([^<]+)<\/a>/g);
      if (loserLinks && loserLinks.length > 0) {
        for (const link of loserLinks) {
          const nameMatch = link.match(/>([^<]+)</);
          const slugMatch = link.match(/href=["']\/wrestlers\/([^"']*)\.html["']/);
          if (nameMatch && slugMatch) {
            const name = nameMatch[1].trim();
            const slug = slugMatch[1];
            // Store slug - we'll fetch the actual image URL from the wrestler page
            losers.push({ name, slug, profightdbSlug: slug });
          }
        }
      }
      
      if (winners.length === 0 || losers.length === 0) continue;
      
      // Extract duration (fifth td, index 4) - handle italicized
      const duration = tdMatches[4] ? tdMatches[4].replace(/<[^>]*>/g, '').replace(/[_\*]/g, '').trim() : null;
      
      // Extract match type (sixth td, index 5) - handle italicized and empty
      let matchType = tdMatches[5] ? tdMatches[5].replace(/<[^>]*>/g, '').replace(/[_\*]/g, '').trim() : null;
      // Clean up match type - remove extra whitespace and empty values
      if (matchType && (matchType === '&nbsp;' || matchType === '' || matchType.length < 2)) {
        matchType = null;
      }
      
      // Extract title (seventh td, index 6) - handle italicized
      const titleHtml = tdMatches[6] || '';
      // Look for championship/title mentions
      const titleMatch = titleHtml.match(/([^<]+(?:Championship|Title|Championships|Title\(title change\))[^<]*)/i);
      let title = null;
      if (titleMatch) {
        title = titleMatch[1].replace(/<[^>]*>/g, '').replace(/[_\*]/g, '').trim();
      }
      // If no title found, use match type or default
      if (!title) {
        title = matchType || `Match ${matchId}`;
      }
      
      // Build participant strings
      const p1 = winners.length > 1 ? winners.map(w => w.name).join(' & ') : winners[0].name;
      const p2 = losers.length > 1 ? losers.map(l => l.name).join(' & ') : losers[0].name;
      
      // Store members with slugs for image fetching later
      const p1Members = winners.map(w => ({ 
        name: w.name, 
        profightdbSlug: w.slug,
        // Image will be fetched separately
        image: null
      }));
      const p2Members = losers.map(l => ({ 
        name: l.name, 
        profightdbSlug: l.slug,
        // Image will be fetched separately
        image: null
      }));
      
      // Set primary images (will be populated when images are fetched)
      const p1Image = null; // Will be set when images are fetched
      const p2Image = null; // Will be set when images are fetched
      
      matches.push({
        id: matchId++,
        title: title,
        p1: p1,
        p2: p2,
        p1Image: p1Image,
        p2Image: p2Image,
        p1Members: p1Members,
        p2Members: p2Members,
        isTeamMatch: winners.length > 1 || losers.length > 1,
        winner: p1, // Winner is p1 (first column)
        time: duration,
        type: matchType, // Match type (e.g., "pre-show", "four-way", "10-person tag")
        matchType: matchType // Alias for compatibility
      });
    }
    
    // Also try to extract venue if not already set
    const venueMatch = html.match(/<td[^>]*>([^<]*Location[^<]*)<\/td>/i) || 
                       html.match(/<div[^>]*>([^<]*Venue[^<]*)<\/div>/i);
    if (venueMatch && !event.venue) {
      event.venue = venueMatch[1].replace(/Location|Venue/gi, '').trim();
    }
    
    console.log(`✅ Found ${matches.length} matches for ${event.name}`);
    
    // Fetch wrestler images for matches (limit to avoid rate limiting)
    if (matches.length > 0) {
      console.log(`🖼️  Fetching wrestler images...`);
      const wrestlerSlugs = new Set();
      
      // Collect all unique wrestler slugs
      matches.forEach(match => {
        if (match.p1Members) {
          match.p1Members.forEach(m => {
            if (m.profightdbSlug) wrestlerSlugs.add(m.profightdbSlug);
          });
        }
        if (match.p2Members) {
          match.p2Members.forEach(m => {
            if (m.profightdbSlug) wrestlerSlugs.add(m.profightdbSlug);
          });
        }
      });
      
      // Fetch images for all wrestlers (with rate limiting)
      const imageMap = {};
      const slugsToFetch = Array.from(wrestlerSlugs);
      let fetchedCount = 0;
      
      console.log(`  📋 Fetching images for ${slugsToFetch.length} wrestlers...`);
      
      for (const slug of slugsToFetch) {
        const imageUrl = await getWrestlerImageFromProFightDB(slug);
        if (imageUrl) {
          imageMap[slug] = imageUrl;
          fetchedCount++;
        }
      }
      
      console.log(`  ✅ Fetched ${fetchedCount}/${slugsToFetch.length} wrestler images`);
      
      // Update matches with image URLs
      matches.forEach(match => {
        if (match.p1Members) {
          match.p1Members.forEach(m => {
            if (m.profightdbSlug && imageMap[m.profightdbSlug]) {
              m.image = imageMap[m.profightdbSlug];
            }
          });
          match.p1Image = match.p1Members[0]?.image || null;
        }
        if (match.p2Members) {
          match.p2Members.forEach(m => {
            if (m.profightdbSlug && imageMap[m.profightdbSlug]) {
              m.image = imageMap[m.profightdbSlug];
            }
          });
          match.p2Image = match.p2Members[0]?.image || null;
        }
      });
    }
    
    return {
      ...event,
      matches: matches.length > 0 ? matches : event.matches || []
    };
    
  } catch (error) {
    console.error(`❌ Error scraping event details for ${event.name}:`, error.message);
    return event;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting ProFightDB.com scraper...\n');
  
  initFirebase();
  
  try {
    // Scrape PPV events
    const events = await scrapePPVEvents();
    
    // Scrape details for each event (limit to first 20 to avoid rate limiting)
    const eventsWithDetails = [];
    for (let i = 0; i < Math.min(events.length, 20); i++) {
      const event = events[i];
      const detailedEvent = await scrapeEventDetails(event);
      eventsWithDetails.push(detailedEvent);
      
      // Save to Firestore if available
      if (db && detailedEvent.promoId) {
        try {
          const eventRef = db.collection('artifacts').doc(appId)
            .collection('public').doc('data')
            .collection('events').doc(detailedEvent.id);
          
          const existingDoc = await eventRef.get();
          
          // Skip if manually edited
          if (existingDoc.exists && existingDoc.data().manuallyEdited) {
            console.log(`  ⚠️ Skipping ${detailedEvent.name} - manually edited by admin`);
            continue;
          }
          
          await eventRef.set({
            ...detailedEvent,
            updatedAt: new Date().toISOString(),
            scrapedAt: new Date().toISOString(),
            source: 'profightdb'
          }, { merge: true });
          
          console.log(`  ✅ Saved ${detailedEvent.name} to Firestore`);
        } catch (error) {
          console.error(`  ⚠️  Error saving ${detailedEvent.name}:`, error.message);
        }
      }
    }
    
    // Save to JSON file
    const outputPath = join(__dirname, '../data/profightdb-events.json');
    writeFileSync(outputPath, JSON.stringify(eventsWithDetails, null, 2));
    console.log(`\n💾 Saved ${eventsWithDetails.length} events to ${outputPath}`);
    
    console.log('\n✅ ProFightDB scraping complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scrapePPVEvents, scrapeEventDetails };
