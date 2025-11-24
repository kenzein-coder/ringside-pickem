# Cagematch.net Scraper Status

## ✅ What's Working

1. **Promotions Scraping**: Successfully scraping promotions from Cagematch.net
   - Found 100+ promotions
   - Correctly identifying major promotions (WWE, AEW, NJPW, etc.)
   - Saving to `data/promotions.json`

## 🔧 What Needs Work

1. **Events Scraping**: Currently finding 0 events
   - Need to inspect the actual events page HTML structure
   - May need to use different URL format or parsing logic

2. **Event Details**: Not yet implemented
   - Need to scrape individual event pages for:
     - Match cards
     - Venue information
     - Full event details

3. **Match Data**: Not yet implemented
   - Need to parse match tables from event pages
   - Extract wrestler names, match types, results

## 📝 Next Steps

1. **Inspect Events Page HTML**:
   ```bash
   # Check what the events page actually looks like
   cat data/event-*-raw.html
   ```

2. **Update Parser**: Adjust `parseHTML()` function based on actual HTML structure

3. **Add Match Parsing**: Create function to parse match cards from event detail pages

4. **Firestore Integration**: Instead of saving to JSON, save directly to Firestore:
   ```javascript
   // In your scraper
   import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
   ```

5. **Scheduled Runs**: Set up Vercel Cron or Firebase Cloud Functions to run daily

## 🎯 Current Scraper Features

- ✅ Fetches HTML from Cagematch.net
- ✅ Parses promotions list
- ✅ Filters major promotions
- ✅ Rate limiting (2 second delays)
- ✅ Saves raw HTML for inspection
- ✅ Error handling

## 📊 Data Structure

### Promotions (Working)
```json
{
  "id": "2287",
  "name": "All Elite Wrestling",
  "cagematchId": "2287",
  "slug": "all-elite-wrestling"
}
```

### Events (In Progress)
```json
{
  "id": "cagematch-435820",
  "cagematchEventId": "435820",
  "promotionId": "2287",
  "promotionName": "All Elite Wrestling",
  "name": "AEW Dynamite #319 - Blood & Guts 2025",
  "date": "12.11.2025",
  "slug": "aew-dynamite-319-blood-guts-2025"
}
```

## 🚀 Usage

```bash
# Run the scraper
npm run scrape

# Check results
cat data/promotions.json
cat data/events.json
```

