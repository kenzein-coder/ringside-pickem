# Firebase Setup Instructions

Your app needs Firebase credentials to work. Follow these steps:

## 1. Get Your Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one called "ringside-pickem")
3. Click the gear icon ⚙️ next to "Project Overview" → **Project Settings**
4. Scroll down to "Your apps" section
5. If you don't have a web app, click **"Add app"** → **Web** (</> icon)
6. Copy the config values from the Firebase SDK snippet

## 2. Create .env File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and replace the placeholder values with your actual Firebase credentials:
   ```
   VITE_FIREBASE_API_KEY=AIzaSy... (your actual key)
   VITE_FIREBASE_AUTH_DOMAIN=ringside-pickem.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=ringside-pickem
   VITE_FIREBASE_STORAGE_BUCKET=ringside-pickem.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 (your actual ID)
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123 (your actual app ID)
   ```

## 3. Enable Firebase Authentication

1. In Firebase Console, go to **Authentication** → **Get Started**
2. Enable **Anonymous** authentication:
   - Click "Sign-in method" tab
   - Click "Anonymous"
   - Enable it and click "Save"

## 4. Enable Firestore Database

1. In Firebase Console, go to **Firestore Database** → **Create database**
2. Start in **test mode** (for development)
3. Choose a location for your database
4. Click "Enable"

## 5. Restart Your Dev Server

After creating the `.env` file, restart your dev server:
```bash
npm run dev
```

Your app should now connect to Firebase successfully!

