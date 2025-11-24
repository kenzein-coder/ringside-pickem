# Wrestling Data Automation - Implementation Summary

## ✅ Completed Features

### 1. Match Card Parsing ✅
- **Status**: Implemented
- **Location**: `scripts/scrape-cagematch.js` → `parseEventDetails()`
- **Features**:
  - Extracts match types (Singles, Tag Team, etc.)
  - Extracts wrestler names from match results
  - Identifies winners and losers
  - Extracts match times
  - Identifies title matches

### 2. Firestore Integration ✅
- **Status**: Implemented
- **Location**: `scripts/scrape-cagematch.js` → `initFirebase()` and save functions
- **Features**:
  - Automatically detects Firebase config from `.env`
  - Saves promotions to Firestore
  - Saves events with full details to Firestore
  - Saves match cards with each event
  - Falls back to JSON files if Firebase not configured

### 3. Vercel Cron Job ✅
- **Status**: Implemented
- **Location**: 
  - `api/scrape-wrestling-data.js` - Serverless function
  - `vercel.json` - Cron configuration
- **Schedule**: Daily at 2 AM UTC (`0 2 * * *`)
- **Features**:
  - Scrapes recent events automatically
  - Saves to Firestore
  - Returns JSON response with results

## 📁 File Structure

```
ringside-pickem/
├── scripts/
│   └── scrape-cagematch.js          # Main scraper (local use)
├── api/
│   └── scrape-wrestling-data.js     # Vercel serverless function
├── data/                            # Scraped data (gitignored)
│   ├── promotions.json
│   ├── events.json
│   └── events-with-details.json
├── vercel.json                      # Vercel config with cron
└── .env                             # Firebase config (gitignored)
```

## 🔧 Setup Instructions

### 1. Update Firestore Security Rules

Go to Firebase Console → Firestore Database → Rules and use the rules from `FIRESTORE_RULES_UPDATED.md`:

```javascript
// Allow public read, write for scraper
match /artifacts/{appId}/public/data/promotions/{promoId} {
  allow read: if true;
  allow write: if true; // For scraper
}

match /artifacts/{appId}/public/data/events/{eventId} {
  allow read: if true;
  allow write: if true; // For scraper
}
```

### 2. Local Testing

```bash
# Run scraper locally
npm run scrape

# Check results
cat data/events-with-details.json
```

### 3. Deploy to Vercel

```bash
# Commit and push
git add .
git commit -m "Add wrestling data scraper with Firestore and cron"
git push

# Vercel will automatically:
# 1. Deploy the API function
# 2. Set up the cron job
# 3. Run daily at 2 AM UTC
```

### 4. Test Cron Job

After deployment, test the endpoint:
```bash
curl https://your-app.vercel.app/api/scrape-wrestling-data
```

## 📊 Data Structure in Firestore

### Promotions
```
artifacts/{appId}/public/data/promotions/{promoId}
{
  id: "2287",
  name: "All Elite Wrestling",
  cagematchId: "2287",
  slug: "all-elite-wrestling",
  updatedAt: "2025-11-24T..."
}
```

### Events
```
artifacts/{appId}/public/data/events/{eventId}
{
  id: "cagematch-435820",
  cagematchEventId: "435820",
  promotionId: "2287",
  promotionName: "All Elite Wrestling",
  name: "AEW Dynamite #319 - Blood & Guts 2025",
  date: "12.11.2025",
  venue: "First Horizon Coliseum, Greensboro, North Carolina, USA",
  location: "Greensboro, North Carolina, USA",
  arena: "First Horizon Coliseum",
  matches: [
    {
      id: 1,
      type: "Singles Match",
      p1: "Wrestler 1",
      p2: "Wrestler 2",
      winner: "Wrestler 1",
      time: "15:30",
      title: "AEW World Championship"
    }
  ],
  updatedAt: "2025-11-24T...",
  scrapedAt: "2025-11-24T..."
}
```

## 🚀 Usage in Your App

Update `src/App.jsx` to read from Firestore instead of `INITIAL_EVENTS`:

```javascript
// Replace INITIAL_EVENTS with Firestore query
useEffect(() => {
  const eventsQuery = query(
    collection(db, 'artifacts', appId, 'public', 'data', 'events'),
    orderBy('date', 'desc'),
    limit(20)
  );
  
  const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
    const events = [];
    snapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });
    setEvents(events);
  });
  
  return () => unsubscribe();
}, []);
```

## ⚙️ Configuration

### Environment Variables (Vercel)

Add these to Vercel Dashboard → Settings → Environment Variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Cron Schedule

Edit `vercel.json` to change schedule:
- `"0 2 * * *"` - Daily at 2 AM UTC
- `"0 */6 * * *"` - Every 6 hours
- `"0 0 * * *"` - Daily at midnight UTC

## 📝 Next Steps

1. ✅ Match parsing - DONE
2. ✅ Firestore integration - DONE  
3. ✅ Vercel cron - DONE
4. 🔄 Update app to use Firestore data
5. 🔄 Add error handling and retries
6. 🔄 Add notification system for new events

## 🐛 Known Issues

- Firestore permissions need to be updated (see `FIRESTORE_RULES_UPDATED.md`)
- Some events may not have match cards yet (upcoming shows)
- Match parsing may need refinement for complex match types

## 📚 Documentation

- `WRESTLING_DATA_SOURCES.md` - Research on data sources
- `SCRAPER_STATUS.md` - Scraper development status
- `FIRESTORE_RULES_UPDATED.md` - Security rules for Firestore

