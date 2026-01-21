import https from 'https';
import admin from 'firebase-admin';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DELAY_MS = 1500;

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
    https.get(url, {
      headers: {
        'User-Agent': 'RingsidePickem/1.0 (Wrestling Pick\'em App; Educational)',
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

async function searchWikipediaPage(eventName, promotionName) {
  try {
    // Clean event name for search
    let searchName = eventName
      .replace(/\s*\d{4}\s*$/, '') // Remove year
      .replace(/\s*20\d{2}\s*$/, '') // Remove 20xx year
      .trim();
    
    // Add promotion for better results
    if (promotionName && !searchName.toLowerCase().includes(promotionName.toLowerCase().substring(0, 3))) {
      searchName = `${promotionName} ${searchName}`;
    }
    
    console.log(`  🔍 Searching Wikipedia for: "${searchName}"`);
    
    // Search Wikipedia
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=${encodeURIComponent(searchName)}&limit=5`;
    const searchData = await fetchURL(searchUrl);
    const searchResults = JSON.parse(searchData);
    
    if (!searchResults[1] || searchResults[1].length === 0) {
      console.log(`  ❌ No Wikipedia page found`);
      return null;
    }
    
    // Get page title from first result that looks like an event
    let pageTitle = null;
    for (const title of searchResults[1]) {
      // Look for year in title (indicates it's a specific event, not the general page)
      if (/20\d{2}/.test(title) || title.toLowerCase().includes(eventName.toLowerCase())) {
        pageTitle = title;
        break;
      }
    }
    
    if (!pageTitle) {
      pageTitle = searchResults[1][0]; // Fallback to first result
    }
    
    console.log(`  📄 Found page: "${pageTitle}"`);
    
    return pageTitle;
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function extractWikipediaResults(pageTitle) {
  try {
    console.log(`  📖 Extracting match results from page...`);
    
    // Get page content via Parse API
    const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&format=json&page=${encodeURIComponent(pageTitle)}&prop=text&section=0`;
    const parseData = await fetchURL(parseUrl);
    const parseJson = JSON.parse(parseData);
    
    if (parseJson.error) {
      console.log(`  ❌ Page not found: ${parseJson.error.info}`);
      return [];
    }
    
    const html = parseJson.parse?.text?.['*'];
    if (!html) {
      console.log(`  ❌ No content found`);
      return [];
    }
    
    // Look for results table (usually in infobox or results section)
    // Wikipedia wrestling pages typically have a "Results" section with match outcomes
    const matches = [];
    
    // Pattern 1: Look for "defeated" in content
    const defeatedMatches = html.match(/([A-Z][a-zA-Z\s\.]+)\s+defeated\s+([A-Z][a-zA-Z\s\.]+)/g);
    if (defeatedMatches) {
      defeatedMatches.forEach(match => {
        const parts = match.match(/([A-Z][a-zA-Z\s\.]+)\s+defeated\s+([A-Z][a-zA-Z\s\.]+)/);
        if (parts) {
          matches.push({
            winner: parts[1].trim(),
            loser: parts[2].trim(),
            pattern: 'defeated'
          });
        }
      });
    }
    
    // Pattern 2: Look for match tables with "Winner" columns
    // This is complex as it requires parsing HTML tables
    
    if (matches.length > 0) {
      console.log(`  ✅ Found ${matches.length} match result(s)`);
    } else {
      console.log(`  ⚠️  No clear match results found in page`);
    }
    
    return matches;
    
  } catch (error) {
    console.log(`  ❌ Error extracting results: ${error.message}`);
    return [];
  }
}

async function crossCheckEvent(event) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📅 ${event.name}`);
  console.log(`   Date: ${event.date}`);
  console.log(`   Promotion: ${event.promotionName || 'Unknown'}`);
  console.log(`   Matches: ${event.matches?.length || 0}`);
  console.log(`${'='.repeat(70)}`);
  
  // Search for Wikipedia page
  const wikiPage = await searchWikipediaPage(event.name, event.promotionName);
  
  if (!wikiPage) {
    console.log(`  ⏭️  Skipping - no Wikipedia page found\n`);
    return {
      event: event.name,
      status: 'no_wiki_page',
      matches: []
    };
  }
  
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  
  // Extract results from Wikipedia
  const wikiResults = await extractWikipediaResults(wikiPage);
  
  if (wikiResults.length === 0) {
    console.log(`  ⏭️  Skipping - no results on Wikipedia page\n`);
    return {
      event: event.name,
      wikiPage,
      status: 'no_results',
      matches: []
    };
  }
  
  // Compare with Cagematch data
  const comparison = {
    event: event.name,
    wikiPage,
    status: 'has_results',
    matches: [],
    agreementRate: 0
  };
  
  let agreements = 0;
  let total = 0;
  
  console.log(`\n  📊 Cross-checking results:\n`);
  
  for (const wikiMatch of wikiResults) {
    // Try to find corresponding match in Cagematch data
    const cagematchMatch = event.matches?.find(m => 
      (m.p1 && m.p1.toLowerCase().includes(wikiMatch.winner.toLowerCase().split(' ')[0])) ||
      (m.p2 && m.p2.toLowerCase().includes(wikiMatch.winner.toLowerCase().split(' ')[0]))
    );
    
    if (cagematchMatch) {
      total++;
      const cagematchWinner = cagematchMatch.winner;
      const winnersMatch = cagematchWinner && 
        (cagematchWinner.toLowerCase() === wikiMatch.winner.toLowerCase() ||
         cagematchWinner.toLowerCase().includes(wikiMatch.winner.toLowerCase()) ||
         wikiMatch.winner.toLowerCase().includes(cagematchWinner.toLowerCase()));
      
      if (winnersMatch) {
        agreements++;
        console.log(`  ✅ MATCH: ${wikiMatch.winner} defeated ${wikiMatch.loser}`);
        console.log(`     Cagematch agrees: ${cagematchWinner}\n`);
      } else if (cagematchWinner) {
        console.log(`  ⚠️  MISMATCH: Wikipedia says ${wikiMatch.winner}, Cagematch says ${cagematchWinner}\n`);
      } else {
        console.log(`  ℹ️  NEW: Wikipedia has result (${wikiMatch.winner}) but Cagematch doesn't\n`);
      }
      
      comparison.matches.push({
        wikipedia: wikiMatch.winner,
        cagematch: cagematchWinner || 'NOT SET',
        match: winnersMatch ? 'AGREE' : 'DISAGREE',
        suggestion: !cagematchWinner ? 'ADD_TO_CAGEMATCH' : (winnersMatch ? 'VERIFIED' : 'NEEDS_REVIEW')
      });
    }
  }
  
  if (total > 0) {
    comparison.agreementRate = (agreements / total * 100).toFixed(1);
    console.log(`  📈 Agreement rate: ${comparison.agreementRate}% (${agreements}/${total})\n`);
  }
  
  return comparison;
}

async function runCrossCheck() {
  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }
  
  console.log('🔄 Wikipedia Results Cross-Checker');
  console.log('━'.repeat(70) + '\n');
  
  try {
    const eventsRef = db
      .collection('artifacts')
      .doc(appId)
      .collection('public')
      .doc('data')
      .collection('events');
    
    // Get past PPV events (most likely to have Wikipedia coverage)
    const snapshot = await eventsRef.get();
    
    const pastPPVs = [];
    const now = new Date();
    
    snapshot.forEach(doc => {
      const event = doc.data();
      
      // Try to parse date
      let eventDate;
      try {
        // Handle various date formats
        if (event.date.includes(',')) {
          eventDate = new Date(event.date);
        } else if (event.date.match(/\d{2}\.\d{2}\.\d{4}/)) {
          const [day, month, year] = event.date.split('.');
          eventDate = new Date(`${year}-${month}-${day}`);
        } else {
          eventDate = new Date(event.date);
        }
      } catch (e) {
        return; // Skip if date unparseable
      }
      
      // Only past PPV events from last 3 months
      const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
      if (event.isPPV && eventDate < now && eventDate > threeMonthsAgo) {
        pastPPVs.push({
          id: doc.id,
          ref: doc.ref,
          eventDate,
          ...event
        });
      }
    });
    
    // Sort by date (most recent first)
    pastPPVs.sort((a, b) => b.eventDate - a.eventDate);
    
    console.log(`📊 Found ${pastPPVs.length} past PPV events (last 3 months)\n`);
    
    if (pastPPVs.length === 0) {
      console.log('✅ No past PPV events to check\n');
      process.exit(0);
    }
    
    const results = [];
    
    // Process first 5 events to avoid rate limiting
    for (let i = 0; i < Math.min(5, pastPPVs.length); i++) {
      const event = pastPPVs[i];
      
      const comparison = await crossCheckEvent(event);
      results.push(comparison);
      
      // Rate limiting
      if (i < Math.min(5, pastPPVs.length) - 1) {
        console.log(`⏳ Waiting ${DELAY_MS}ms before next check...\n`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    // Save results to file
    const resultsFile = join(__dirname, '../data/wikipedia-cross-check-results.json');
    writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    // Summary
    console.log('\n' + '━'.repeat(70));
    console.log('\n📊 SUMMARY\n');
    
    const withWikiPage = results.filter(r => r.status !== 'no_wiki_page').length;
    const withResults = results.filter(r => r.status === 'has_results').length;
    const totalAgreements = results.reduce((sum, r) => sum + (r.matches?.filter(m => m.match === 'AGREE').length || 0), 0);
    const totalComparisons = results.reduce((sum, r) => sum + (r.matches?.length || 0), 0);
    
    console.log(`Events checked: ${results.length}`);
    console.log(`With Wikipedia page: ${withWikiPage} (${(withWikiPage/results.length*100).toFixed(1)}%)`);
    console.log(`With results on Wikipedia: ${withResults} (${(withResults/results.length*100).toFixed(1)}%)`);
    
    if (totalComparisons > 0) {
      console.log(`\nMatch comparisons: ${totalComparisons}`);
      console.log(`Agreements: ${totalAgreements} (${(totalAgreements/totalComparisons*100).toFixed(1)}%)`);
      console.log(`Disagreements/Missing: ${totalComparisons - totalAgreements}`);
    }
    
    console.log(`\n💾 Detailed results saved to: ${resultsFile}\n`);
    
    // Recommendations
    console.log('💡 RECOMMENDATIONS:\n');
    
    const needsReview = results.flatMap(r => 
      r.matches?.filter(m => m.suggestion === 'NEEDS_REVIEW') || []
    );
    
    const canAdd = results.flatMap(r => 
      r.matches?.filter(m => m.suggestion === 'ADD_TO_CAGEMATCH') || []
    );
    
    if (needsReview.length > 0) {
      console.log(`⚠️  ${needsReview.length} mismatch(es) need admin review`);
    }
    
    if (canAdd.length > 0) {
      console.log(`✨ ${canAdd.length} result(s) from Wikipedia can be added to Cagematch data`);
    }
    
    if (needsReview.length === 0 && canAdd.length === 0) {
      console.log(`✅ All data is consistent!`);
    }
    
    console.log('\n💡 Use Admin Panel to update any mismatches or add missing winners\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runCrossCheck().then(() => {
  console.log('✅ Cross-check complete\n');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
