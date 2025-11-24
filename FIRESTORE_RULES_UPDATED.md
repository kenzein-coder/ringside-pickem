# Updated Firestore Security Rules

Update your Firestore rules to allow the scraper to write data. Go to Firebase Console → Firestore Database → Rules and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /artifacts/{appId}/public/data/users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write their predictions
    match /artifacts/{appId}/users/{userId}/predictions/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow public read access to promotions, events, and matches
    // Allow write access for automated scrapers (you may want to restrict this)
    match /artifacts/{appId}/public/data/promotions/{promoId} {
      allow read: if true;
      allow write: if true; // For scraper - consider adding authentication
    }
    
    match /artifacts/{appId}/public/data/events/{eventId} {
      allow read: if true;
      allow write: if true; // For scraper - consider adding authentication
    }
    
    // Allow authenticated users to read public data (leaderboard, scores)
    match /artifacts/{appId}/public/data/{document=**} {
      allow read: if request.auth != null || true; // Public read
      allow write: if true; // For scraper - consider restricting
    }
    
    // Allow authenticated users to read leaderboard
    match /artifacts/{appId}/public/data/users/{userId} {
      allow read: if request.auth != null || true; // Public read for leaderboard
    }
  }
}
```

**Note**: The `allow write: if true` is permissive for development. For production, consider:
- Using Firebase Admin SDK with service account
- Adding authentication tokens
- Using Cloud Functions with proper IAM roles

