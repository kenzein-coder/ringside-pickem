# 🚀 Deployment Guide - Ringside Pick'em

## Prerequisites Checklist

- [x] Production build successful (`npm run build`)
- [x] Vercel CLI installed
- [ ] Vercel account created (https://vercel.com)
- [ ] Firebase project configured
- [ ] Environment variables ready

## Step 1: Deploy to Vercel

### Option A: Using Vercel CLI (Recommended)

```bash
cd /Users/zelzein/Desktop/ringside-pickem/ringside-pickem
vercel
```

**Follow the prompts:**
1. "Set up and deploy?" → **Yes**
2. "Which scope?" → Select your account
3. "Link to existing project?" → **No** (first time)
4. "What's your project's name?" → `ringside-pickem`
5. "In which directory is your code located?" → `./` (press Enter)
6. "Want to override the settings?" → **No**

### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import Git Repository (if using GitHub)
3. Or drag and drop the `ringside-pickem` folder
4. Configure project settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

## Step 2: Configure Environment Variables

### In Vercel Dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add these variables:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Where to find these values:**
- Go to Firebase Console → Project Settings → General
- Scroll to "Your apps" → Web app
- Copy the config values

### Or Using Vercel CLI:

```bash
vercel env add VITE_FIREBASE_API_KEY
# Paste your API key when prompted
# Repeat for each variable
```

## Step 3: Redeploy with Environment Variables

```bash
vercel --prod
```

This will:
- Build your app with environment variables
- Deploy to production domain
- Give you a live URL!

## Step 4: Configure Firebase for Production

### Update Firebase Console:

1. **Authentication** → **Settings** → **Authorized domains**
   - Add your Vercel domain: `your-project.vercel.app`

2. **Firestore Rules** (if not already set):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /artifacts/{appId}/public/data/{document=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

3. **Storage Rules**:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

## Step 5: Test Your Deployment

Visit your Vercel URL and test:
- ✅ Guest login
- ✅ Email signup/signin
- ✅ Google OAuth
- ✅ Making predictions
- ✅ Leaderboard
- ✅ Settings

## Troubleshooting

### "Firebase not configured" error
→ Environment variables not set. Check Vercel dashboard.

### "Unauthorized domain" error
→ Add your Vercel domain to Firebase authorized domains.

### Build fails
→ Check build logs in Vercel dashboard for specific errors.

### CORS errors
→ Ensure Firebase Storage rules allow public read access.

## Custom Domain (Optional)

1. Go to Vercel → Project → **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Add custom domain to Firebase authorized domains

## Continuous Deployment

### With GitHub:
1. Push your code to GitHub
2. Connect repository in Vercel dashboard
3. Every push to `main` branch auto-deploys!

### Manual Deployment:
```bash
vercel --prod
```

## Environment Management

### Development:
- Uses `.env` file locally
- Run `npm run dev`

### Production:
- Uses Vercel environment variables
- Deployed via `vercel --prod`

## Post-Deployment Checklist

- [ ] App loads successfully
- [ ] Authentication works
- [ ] Database reads/writes work
- [ ] Images load correctly
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Performance is good (check Lighthouse)

## Monitoring

- **Vercel Analytics**: Automatic (check dashboard)
- **Firebase Console**: Monitor usage, errors
- **Browser DevTools**: Check for console errors

## Next Steps

1. Share your live URL! 🎉
2. Monitor Firebase quotas
3. Set up alerts for errors
4. Consider adding:
   - Custom domain
   - Analytics
   - Error tracking (Sentry)
   - Performance monitoring

---

## Quick Reference

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls

# Remove deployment
vercel rm [deployment-url]
```

**Your app is ready for the world!** 🚀
