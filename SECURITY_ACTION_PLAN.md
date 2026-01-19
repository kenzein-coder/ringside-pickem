# 🚨 URGENT: Security Action Plan

## ⚡ DO THIS NOW (5 minutes)

### 1. Secure Firestore Rules

**Current Risk:** 🔴 **CRITICAL** - Anyone can write to your database!

**Fix:**
1. Open: https://console.firebase.google.com/project/ringside-pickem/firestore/rules
2. Click the **Rules** tab
3. Delete all current rules
4. Copy-paste from: `firestore-rules-SECURE.txt`
5. Click **Publish**

**Test it worked:**
```javascript
// Open browser console and try this (should fail):
const db = firebase.firestore();
await db.collection('artifacts/ringside-pickem/public/data/events')
  .doc('test-hack').set({ hacked: true });
// Expected: ❌ "Missing or insufficient permissions"
```

---

### 2. Restrict API Key

**Current Risk:** 🟡 **MEDIUM** - API key can be used from anywhere

**Fix:**
1. Open: https://console.cloud.google.com/apis/credentials?project=ringside-pickem
2. Find key: `AIzaSyAdi9cMCfjmiaRpoo64QRjPIZOzggbda8I`
3. Click **Edit** (pencil icon)
4. **Application restrictions** → Select **HTTP referrers**
   - Add: `localhost:*`
   - Add: `*.firebaseapp.com/*`
   - Add: `*.vercel.app/*`
5. **API restrictions** → Select **Restrict key**
   - Enable: Cloud Firestore API
   - Enable: Identity Toolkit API
   - Enable: Token Service API
6. Click **Save**

---

### 3. Verify OAuth Redirect URIs

**Current:** ✅ Should be working (you just fixed this)

**Double-check:**
1. Open: https://console.cloud.google.com/apis/credentials?project=ringside-pickem
2. Find **Web client (auto created by Google Service)**
3. Verify these are listed:
   - `http://localhost:5173/__/auth/handler`
   - `https://ringside-pickem-em.firebaseapp.com/__/auth/handler`

---

## 📋 DO THIS SOON (30 minutes)

### 4. Test Everything Still Works

After deploying new Firestore rules:

- [ ] Login with Google
- [ ] Login with Email/Password
- [ ] Guest login
- [ ] Make a prediction
- [ ] View leaderboard
- [ ] **Run scraper:** `npm run scrape-cagematch`
- [ ] Lock an event
- [ ] Simulate event results

---

### 5. Update Vercel Environment Variables

**Current:** ✅ Already set (verified earlier)

**If you ever need to update:**
1. Go to: https://vercel.com/kenzein-coders-projects/ringside-pickem/settings/environment-variables
2. Click **Edit** next to `VITE_FIREBASE_API_KEY`
3. Update value
4. Redeploy: `vercel --prod --yes`

---

### 6. Add Production Domains to Firebase

**If using custom domain or latest Vercel URL:**

1. Go to: https://console.firebase.google.com/project/ringside-pickem/authentication/settings
2. Under **Authorized domains**, add:
   - Your custom domain (if you have one)
   - Latest Vercel URL: `ringside-pickem-arwm689us-kenzein-coders-projects.vercel.app`

---

## 🎯 OPTIONAL (Future Improvements)

### 7. Set Up Admin Role

For manually setting event results:

```javascript
// In a server-side script:
import admin from 'firebase-admin';

await admin.auth().setCustomUserClaims('YOUR_USER_ID', { 
  admin: true 
});
```

Then update Firestore rules:
```javascript
function isAdmin() {
  return request.auth.token.admin == true;
}

match /artifacts/{appId}/public/data/scores/{document=**} {
  allow read: if true;
  allow write: if isAdmin(); // Only admins can set results
}
```

---

### 8. Set Up Monitoring

**Firebase Console:** https://console.firebase.google.com/project/ringside-pickem/monitoring

- Set up alerts for unusual activity
- Monitor authentication attempts
- Track Firestore usage

---

### 9. Add Rate Limiting

Prevent abuse by limiting:
- Sign-ups per hour
- Predictions per minute
- API calls per user

**Implementation:** Use Cloud Functions with Redis/Memcache

---

## 🧪 SECURITY TESTING

### Test 1: Anonymous Write (Should Fail)
```javascript
// In browser console:
const db = firebase.firestore();
await db.doc('artifacts/ringside-pickem/public/data/events/test').set({ hack: 1 });
// Expected: ❌ Error: Missing or insufficient permissions
```

### Test 2: Cross-User Data Access (Should Fail)
```javascript
// Try to read another user's predictions:
await db.doc('artifacts/ringside-pickem/users/OTHER_USER_ID/predictions/event1').get();
// Expected: ❌ Error: Missing or insufficient permissions
```

### Test 3: Own Data Access (Should Work)
```javascript
// Read your own predictions:
const userId = firebase.auth().currentUser.uid;
await db.doc(`artifacts/ringside-pickem/users/${userId}/predictions/event1`).get();
// Expected: ✅ Success
```

---

## 📊 IMPACT SUMMARY

| Action | Time | Security Gain | Risk Reduced |
|--------|------|---------------|--------------|
| Secure Firestore Rules | 5 min | 🔴 Critical | Database corruption, malicious edits |
| Restrict API Key | 5 min | 🟡 Medium | Quota abuse, unauthorized use |
| Verify OAuth | 2 min | 🟢 Low | Already fixed earlier |
| Test Everything | 15 min | - | Ensure no breaking changes |

---

## ✅ COMPLETION CHECKLIST

After completing all actions:

- [ ] Firestore rules deployed
- [ ] API key restricted
- [ ] OAuth URIs verified
- [ ] App tested and working
- [ ] Scraper tested and working
- [ ] No errors in browser console
- [ ] Anonymous writes blocked (tested)
- [ ] Documentation reviewed

---

## 🆘 IF SOMETHING BREAKS

### App won't load / "Permission denied" everywhere
**Likely cause:** Firestore rules too restrictive

**Fix:**
1. Go to Firestore Rules
2. Temporarily add this for testing:
```javascript
match /{document=**} {
  allow read, write: if request.auth != null;
}
```
3. Find which specific rule is blocking
4. Adjust and redeploy proper rules

### Scraper fails with "Permission denied"
**Likely cause:** Service account key issue

**Check:**
- `serviceAccountKey.json` exists
- File is valid JSON
- Script uses Admin SDK (not client SDK)

**Fix:** Download new service account key from Firebase Console

### Google Sign-In breaks
**Likely cause:** OAuth redirect URI not set

**Fix:** Add the URL to OAuth client redirect URIs (see step 3)

---

## 📞 NEED HELP?

1. **Check logs:**
   - Browser Console (F12)
   - Firebase Console → Firestore → Usage
   - Vercel Deployment Logs

2. **Review docs:**
   - `SECURITY_AUDIT.md` - Full analysis
   - `CONFIGURATION_CHECKLIST.md` - All settings
   - `firestore-rules-SECURE.txt` - Secure rules

3. **Test locally first:**
   - Run `npm run dev`
   - Test on localhost before production
   - Check browser console for errors

---

**Priority:** Do steps 1-3 NOW (under 15 minutes total)

**Good luck! 🚀**
