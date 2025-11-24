# Firestore Security Rules Setup

Your app needs Firestore security rules to allow reads and writes. Here's how to set them up:

## Quick Setup (Test Mode)

1. Go to Firebase Console → Firestore Database → Rules tab
2. Replace the rules with this:

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
    
    // Allow authenticated users to read public data (leaderboard, scores)
    match /artifacts/{appId}/public/data/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Allow authenticated users to read leaderboard
    match /artifacts/{appId}/public/data/users/{userId} {
      allow read: if request.auth != null;
    }
  }
}
```

3. Click "Publish" to save the rules

## What These Rules Do:

- **Users can read/write their own profile**: Only the authenticated user can modify their own user document
- **Users can read/write their predictions**: Users can manage their own predictions
- **Users can read public data**: All authenticated users can read leaderboards and scores
- **Users can write public data**: Authenticated users can write to public collections (for scores, etc.)

## Testing

After updating the rules, try clicking "Start Career" again in your app.

