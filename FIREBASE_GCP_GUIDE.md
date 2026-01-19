# ⚙️ Configuration Checklist - Ringside Pick'em

Complete configuration guide for GCP, Firebase, and Vercel.

---

## 🔐 1. FIREBASE CONSOLE

### Project Overview
- **Project ID:** `ringside-pickem`
- **Console URL:** https://console.firebase.google.com/project/ringside-pickem

---

### A. Authentication

**URL:** https://console.firebase.google.com/project/ringside-pickem/authentication/providers

#### Sign-in Methods:
- ✅ **Google** (Enabled)
- ✅ **Email/Password** (Enabled)
- ✅ **Anonymous** (Enabled)

#### Settings:
**URL:** https://console.firebase.google.com/project/ringside-pickem/authentication/settings

**Authorized Domains:**
- ✅ `localhost`
- ✅ `ringside-pickem-em.firebaseapp.com`
- [ ] Add your Vercel domain: `ringside-pickem-arwm689us-kenzein-coders-projects.vercel.app`

---

### B. Firestore Database

**URL:** https://console.firebase.google.com/project/ringside-pickem/firestore

#### Database Location:
- Check what region your database is in
- Recommended: `us-central1` or closest to your users

#### Security Rules:
**URL:** https://console.firebase.google.com/project/ringside-pickem/firestore/rules

**Current Status:** 🚨 INSECURE (allows public writes)

**Action Required:**
1. Go to Rules tab
2. Copy rules from `firestore-rules-SECURE.txt`
3. Click **Publish**
4. Test app still works

**Rules to deploy:**
```javascript
// See firestore-rules-SECURE.txt for full rules
```

---

### C. Storage

**URL:** https://console.firebase.google.com/project/ringside-pickem/storage

**Storage Bucket:** `ringside-pickem.firebasestorage.app`

**Rules:** (if using storage for images)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{allPaths=**} {
      allow read: if true;
      allow write: if false; // Only via Admin SDK
    }
  }
}
```

---

## ☁️ 2. GOOGLE CLOUD PLATFORM

### Project
- **Project ID:** `ringside-pickem`
- **Project Number:** `782435640306`
- **Console URL:** https://console.cloud.google.com/?project=ringside-pickem

---

### A. API Key

**URL:** https://console.cloud.google.com/apis/credentials?project=ringside-pickem

#### Web API Key:
- **Key:** `AIzaSyAdi9cMCfjmiaRpoo64QRjPIZOzggbda8I`
- **Name:** Browser key (auto created by Firebase)

#### Current Configuration:
Click **Edit** on the API key and set:

**Application restrictions:**
- ⚪ None (NOT RECOMMENDED)
- 🔴 HTTP referrers (websites) ← SELECT THIS
  - Add: `localhost:*`
  - Add: `*.firebaseapp.com/*`
  - Add: `*.vercel.app/*`

**API restrictions:**
- ⚪ Don't restrict key (NOT RECOMMENDED)
- 🔴 Restrict key ← SELECT THIS
  - ✅ Cloud Firestore API
  - ✅ Identity Toolkit API
  - ✅ Token Service API
  - ✅ Firebase Installations API
  - ✅ Cloud Storage API (if using storage)

---

### B. OAuth 2.0 Credentials

**URL:** https://console.cloud.google.com/apis/credentials?project=ringside-pickem

#### Web Client (auto created by Google Service)

**Find it in the list and click Edit.**

**Authorized JavaScript origins:**
```
http://localhost:5173
http://localhost:4173
https://ringside-pickem-em.firebaseapp.com
```

**Authorized redirect URIs:**
```
http://localhost:5173/__/auth/handler
http://localhost:4173/__/auth/handler
https://ringside-pickem-em.firebaseapp.com/__/auth/handler
```

**For Vercel (add your deployment URL):**
```
https://ringside-pickem-arwm689us-kenzein-coders-projects.vercel.app
https://ringside-pickem-arwm689us-kenzein-coders-projects.vercel.app/__/auth/handler
```

---

### C. OAuth Consent Screen

**URL:** https://console.cloud.google.com/apis/credentials/consent?project=ringside-pickem

**App Information:**
- **App name:** Ringside Pick'em
- **User support email:** Your email
- **Developer contact:** Your email

**App Domain:**
- **Application home page:** `https://ringside-pickem-em.firebaseapp.com`
- **Privacy policy:** (create one if needed)
- **Terms of service:** (create one if needed)

**Authorized Domains:**
- `firebaseapp.com`
- `vercel.app` (if using Vercel)

**Scopes:**
- `email`
- `profile`
- `openid`

**Test Users (if in Testing mode):**
- Add `ziad.elzein@gmail.com`
- Add other test users

---

### D. Enabled APIs

**URL:** https://console.cloud.google.com/apis/dashboard?project=ringside-pickem

**Required APIs (should be enabled):**
- ✅ Cloud Firestore API
- ✅ Firebase Authentication API
- ✅ Identity Toolkit API
- ✅ Token Service API
- ✅ Firebase Installations API
- ✅ Cloud Storage API (if using storage)

---

## 🚀 3. VERCEL

**Project URL:** https://vercel.com/kenzein-coders-projects/ringside-pickem

---

### A. Environment Variables

**URL:** https://vercel.com/kenzein-coders-projects/ringside-pickem/settings/environment-variables

**Required Variables:**
| Variable | Value | Environments |
|----------|-------|--------------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyAdi9cMCfjmiaRpoo64QRjPIZOzggbda8I` | Production, Preview, Development |
| `VITE_FIREBASE_AUTH_DOMAIN` | `ringside-pickem-em.firebaseapp.com` | Production, Preview, Development |
| `VITE_FIREBASE_PROJECT_ID` | `ringside-pickem` | Production, Preview, Development |
| `VITE_FIREBASE_STORAGE_BUCKET` | `ringside-pickem.firebasestorage.app` | Production, Preview, Development |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `782435640306` | Production, Preview, Development |
| `VITE_FIREBASE_APP_ID` | `1:782435640306:web:f2ffb50d431c5f5f1fb55d` | Production, Preview, Development |

**How to update:**
1. Go to Environment Variables settings
2. Click **Edit** next to each variable
3. Update the value
4. Save
5. Redeploy: `vercel --prod --yes`

---

### B. Domains

**URL:** https://vercel.com/kenzein-coders-projects/ringside-pickem/settings/domains

**Current Domains:**
- `ringside-pickem-arwm689us-kenzein-coders-projects.vercel.app` (latest)
- Multiple preview/branch deployments

**Custom Domain (optional):**
- Add your own domain: `ringside-pickem.com`
- Update DNS records
- Add to Firebase authorized domains
- Add to OAuth redirect URIs

---

### C. Git Integration

**URL:** https://vercel.com/kenzein-coders-projects/ringside-pickem/settings/git

**Repository:** `github.com/kenzein-coder/ringside-pickem`

**Branch:**
- `main` → Production deployments

**Auto-deploy:**
- ✅ Enabled for `main` branch

---

## 📝 4. LOCAL ENVIRONMENT

### .env File

**Location:** `/Users/zelzein/Desktop/ringside-pickem/ringside-pickem/.env`

**Contents:**
```env
VITE_FIREBASE_API_KEY=AIzaSyAdi9cMCfjmiaRpoo64QRjPIZOzggbda8I
VITE_FIREBASE_AUTH_DOMAIN=ringside-pickem-em.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ringside-pickem
VITE_FIREBASE_STORAGE_BUCKET=ringside-pickem.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=782435640306
VITE_FIREBASE_APP_ID=1:782435640306:web:f2ffb50d431c5f5f1fb55d
```

**⚠️ CRITICAL:** This file should NEVER be committed to Git!

---

### Service Account Key

**Location:** `/Users/zelzein/Desktop/ringside-pickem/ringside-pickem/serviceAccountKey.json`

**Used By:**
- `scripts/scrape-cagematch.js`
- `scripts/reset-all-accounts-admin.js`

**How to download (if lost):**
1. Go to: https://console.firebase.google.com/project/ringside-pickem/settings/serviceaccounts/adminsdk
2. Click **Generate new private key**
3. Download JSON file
4. Rename to `serviceAccountKey.json`
5. Place in project root

**⚠️ CRITICAL:** This file gives full admin access. NEVER commit to Git or expose publicly!

---

## ✅ VERIFICATION CHECKLIST

### After Configuration:

- [ ] Google Sign-In works on localhost
- [ ] Google Sign-In works on production (Vercel/Firebase)
- [ ] Users can create predictions
- [ ] Users can only see their own predictions
- [ ] Leaderboard shows all users (public data)
- [ ] Anonymous users CANNOT write to events/promotions (test in console)
- [ ] Scraper still works (run `npm run scrape-cagematch`)
- [ ] No sensitive data in Git repository
- [ ] All environment variables set in Vercel

---

## 🆘 TROUBLESHOOTING

### Google Sign-In: "redirect_uri_mismatch"
**Fix:** Add the redirect URI to OAuth client in Google Cloud Console

### Google Sign-In: "This app's request is invalid"
**Fix:** Check OAuth consent screen configuration

### Firestore: "Permission denied"
**Fix:** Check Firestore security rules match user authentication

### Scraper: "PERMISSION_DENIED"
**Fix:** Ensure `serviceAccountKey.json` is present and valid

### App slow on localhost
**Normal:** Dev mode has debugging overhead. Test with `npm run build && npx vite preview`

---

## 📞 SUPPORT LINKS

- **Firebase Console:** https://console.firebase.google.com/
- **GCP Console:** https://console.cloud.google.com/
- **Firebase Docs:** https://firebase.google.com/docs
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub Repo:** https://github.com/kenzein-coder/ringside-pickem

---

**Last Updated:** January 19, 2026
