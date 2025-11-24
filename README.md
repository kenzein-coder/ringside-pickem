# Ringside Pick'em

A pro wrestling prediction app where users make picks on upcoming matches and compete on leaderboards.

## Features

- **Event Predictions**: Make picks on upcoming wrestling matches
- **Community Sentiment**: See what percentage of users picked each wrestler
- **Prop Bets**: Predict method of victory (Pinfall, Submission, DQ, etc.)
- **Leaderboards**: Compete globally, by country, region, or with friends
- **Multiple Promotions**: WWE, AEW, NJPW, and more
- **Authentication**: Email/password, Google Sign-In, or Guest mode

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Firebase**:
   - Create a `.env` file in the root directory
   - Add your Firebase configuration:
     ```
     VITE_FIREBASE_API_KEY=your_api_key
     VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     ```

3. **Firebase Setup**:
   - Enable Authentication (Anonymous, Email/Password, Google)
   - Create Firestore Database
   - Update Firestore security rules (see `firestore-rules.txt`)

4. **Run development server**:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run scrape` - Scrape wrestling data from Cagematch.net
- `npm run reset-accounts` - Reset all user accounts (use with caution)

## Deployment

The app is configured for Vercel deployment. The scraper runs automatically via Vercel Cron at 2 AM daily.

## Tech Stack

- React + Vite
- Firebase (Authentication, Firestore)
- Tailwind CSS
- Lucide React (Icons)
