# 🔒 Security Audit Report - Ringside Pick'em
**Date:** January 19, 2026  
**Project:** ringside-pickem  
**Firebase Project ID:** ringside-pickem

---

## ✅ WHAT'S SECURE

### 1. **Environment Variables (Client-Side)**
- ✅ Stored in `.env` file (gitignored)
- ✅ Never committed to Git
- ✅ Properly prefixed with `VITE_` for Vite exposure
- ✅ Set in Vercel for production

**Current Configuration:**
```
VITE_FIREBASE_API_KEY=AIzaSyAdi9cMCfjmiaRpoo64QRjPIZOzggbda8I
VITE_FIREBASE_AUTH_DOMAIN=ringside-pickem-em.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ringside-pickem
VITE_FIREBASE_STORAGE_BUCKET=ringside-pickem.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=782435640306
VITE_FIREBASE_APP_ID=1:782435640306:web:f2ffb50d431c5f5f1fb55d
```

**Note:** Firebase web API keys are safe to expose in client code - they're not secret. Security is enforced by Firestore Rules.

### 2. **Service Account Key (Server-Side)**
- ✅ File: `serviceAccountKey.json` (2.4 KB)
- ✅ Gitignored (never committed)
- ✅ Used only in server-side scripts (scraper)
- ✅ Has admin privileges for Firestore

**⚠️ CRITICAL:** This file should NEVER be committed or deployed to client-side builds.

### 3. **Git Security**
- ✅ No sensitive files in Git history
- ✅ Proper `.gitignore` configuration
- ✅ `.env` excluded
- ✅ `serviceAccountKey.json` excluded

---

## ⚠️ SECURITY ISSUES FOUND

### 🚨 CRITICAL: Firestore Rules Allow Public Writes

**Current Rules (firestore-rules.txt):**

```javascript
// Lines 23-24: Promotions - PUBLIC WRITE ACCESS
match /artifacts/{appId}/public/data/promotions/{promoId} {
  allow read: if true;
  allow write: if true;  // ❌ ANYONE CAN WRITE!
}

// Lines 27-29: Events - PUBLIC WRITE ACCESS
match /artifacts/{appId}/public/data/events/{eventId} {
  allow read: if true;
  allow write: if true;  // ❌ ANYONE CAN WRITE!
}

// Lines 33-35: All public data - PUBLIC WRITE ACCESS
match /artifacts/{appId}/public/data/{document=**} {
  allow read: if request.auth != null || true;
  allow write: if true;  // ❌ ANYONE CAN WRITE!
}
```

**Risk:**
- Malicious users can modify events, promotions, matches
- Anyone can corrupt your database
- No authentication required for writes

**Who can exploit this:** Any user with dev tools open in their browser.

---

## 🔧 RECOMMENDED FIXES

### Priority 1: Secure Firestore Rules

#### Option A: Server-Side Only (Most Secure)
Only allow writes from server-side scripts using Admin SDK:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User data - users can only access their own
    match /artifacts/{appId}/public/data/users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User predictions - users can only access their own
    match /artifacts/{appId}/users/{userId}/predictions/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User locked events - users can only access their own
    match /artifacts/{appId}/users/{userId}/lockedEvents/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Public data - READ ONLY for clients
    match /artifacts/{appId}/public/data/promotions/{promoId} {
      allow read: if true;
      allow write: if false; // ✅ Only server-side scripts can write
    }
    
    match /artifacts/{appId}/public/data/events/{eventId} {
      allow read: if true;
      allow write: if false; // ✅ Only server-side scripts can write
    }
    
    // Scores - READ ONLY for clients
    match /artifacts/{appId}/public/data/scores/{document=**} {
      allow read: if true;
      allow write: if false; // ✅ Only server-side scripts can write
    }
    
    // Images - READ ONLY for clients
    match /artifacts/{appId}/public/data/images/{document=**} {
      allow read: if true;
      allow write: if false; // ✅ Only server-side scripts can write
    }
    
    // Leaderboard - Everyone can read
    match /artifacts/{appId}/public/data/users/{userId} {
      allow read: if true;
      allow write: if false; // ✅ Only via Cloud Functions
    }
  }
}
```

#### Option B: Admin Role (Medium Security)
Allow writes only for specific admin users:

```javascript
// Helper function to check if user is admin
function isAdmin() {
  return request.auth != null && 
         request.auth.token.admin == true;
}

match /artifacts/{appId}/public/data/events/{eventId} {
  allow read: if true;
  allow write: if isAdmin();
}
```

Then set admin claim via Firebase Admin SDK:
```javascript
admin.auth().setCustomUserClaims(adminUserId, { admin: true });
```

---

### Priority 2: API Key Restrictions (Google Cloud Console)

**Current Status:** Need to verify restrictions

**Recommended Settings:**

1. **Go to:** https://console.cloud.google.com/apis/credentials?project=ringside-pickem

2. **Find API Key:** `AIzaSyAdi9cMCfjmiaRpoo64QRjPIZOzggbda8I`

3. **Set Application Restrictions:**
   - ✅ HTTP referrers (web sites)
   - Add: `localhost:*`
   - Add: `*.firebaseapp.com/*`
   - Add: `*.vercel.app/*`

4. **Set API Restrictions:**
   - ✅ Restrict key
   - Enable ONLY:
     - Cloud Firestore API
     - Firebase Authentication API
     - Identity Toolkit API
     - Token Service API
     - Firebase Storage API

---

### Priority 3: Authentication Configuration

**OAuth 2.0 Settings:**

**Go to:** https://console.cloud.google.com/apis/credentials?project=ringside-pickem

**Web Client (auto created by Firebase):**

**Authorized JavaScript origins:**
```
http://localhost:5173
http://localhost:4173
https://ringside-pickem-em.firebaseapp.com
https://ringside-pickem-arwm689us-kenzein-coders-projects.vercel.app
```

**Authorized redirect URIs:**
```
http://localhost:5173/__/auth/handler
http://localhost:4173/__/auth/handler
https://ringside-pickem-em.firebaseapp.com/__/auth/handler
https://ringside-pickem-arwm689us-kenzein-coders-projects.vercel.app/__/auth/handler
```

---

### Priority 4: Firebase Authentication Authorized Domains

**Go to:** https://console.firebase.google.com/project/ringside-pickem/authentication/settings

**Add these domains:**
- ✅ `localhost`
- ✅ `ringside-pickem-em.firebaseapp.com`
- ✅ `ringside-pickem-arwm689us-kenzein-coders-projects.vercel.app`

---

## 📋 ACTION ITEMS

### Immediate (Do Now):

- [ ] **Deploy new Firestore Rules** (see Priority 1)
  - Copy the secure rules above
  - Go to Firebase Console → Firestore → Rules
  - Paste and deploy

- [ ] **Test that scraper still works** after rule changes
  - The scraper uses Admin SDK, so it should bypass rules

- [ ] **Verify API Key restrictions** (Priority 2)

### Soon:

- [ ] Set up Cloud Functions for:
  - Leaderboard calculation
  - Score updates
  - Event result submission (admin only)

- [ ] Add rate limiting to prevent abuse

- [ ] Set up Firebase App Check for additional security

### Optional:

- [ ] Rotate Firebase API key if concerned about exposure
- [ ] Set up monitoring/alerts for suspicious activity
- [ ] Add CAPTCHA to prevent bot signups

---

## 🎯 SECURITY BEST PRACTICES

### ✅ Already Following:

1. Service account keys in gitignore
2. Environment variables not in Git
3. Separate client/server credentials
4. Firebase Auth for user authentication
5. Path-based security rules

### ⚠️ Need to Improve:

1. Firestore write permissions too open
2. No admin role system
3. No rate limiting
4. No monitoring/alerts

---

## 📊 RISK ASSESSMENT

| Issue | Severity | Impact | Ease of Fix |
|-------|----------|--------|-------------|
| Public write access to events/promotions | 🔴 **CRITICAL** | Data corruption | ✅ Easy (5 min) |
| API key not restricted | 🟡 **MEDIUM** | Quota abuse | ✅ Easy (5 min) |
| No rate limiting | 🟡 **MEDIUM** | DoS, spam | 🟠 Medium (30 min) |
| No admin role system | 🟢 **LOW** | Manual work | 🟠 Medium (1 hour) |

---

## 🔍 HOW TO VERIFY SECURITY

### Test 1: Can anonymous users write?

```javascript
// Open browser console on your app
const db = firebase.firestore();
await db.collection('artifacts/ringside-pickem/public/data/events')
  .doc('test-hack')
  .set({ malicious: true });
```

**Expected after fix:** ❌ Permission denied  
**Current behavior:** ✅ Success (BAD!)

### Test 2: Can users access other users' data?

```javascript
// Try to read another user's predictions
const db = firebase.firestore();
const otherUserPredictions = await db
  .collection('artifacts/ringside-pickem/users/OTHER_USER_ID/predictions')
  .get();
```

**Expected:** ❌ Permission denied  
**Current behavior:** ✅ Correctly blocked

---

## 🚀 QUICK FIX (Copy-Paste Ready)

**Step 1:** Go to https://console.firebase.google.com/project/ringside-pickem/firestore/rules

**Step 2:** Replace all rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /artifacts/{appId}/public/data/{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

**Step 3:** Click **Publish**

**Step 4:** Test your app - everything should still work!

---

## ✅ NEXT STEPS

1. Review this document
2. Apply Priority 1 fix (Firestore Rules) immediately
3. Verify API key restrictions in Google Cloud Console
4. Test the scraper still works
5. Plan for Cloud Functions setup (optional)

---

**Contact:** Need help? Check Firebase docs or reach out to Firebase support.
