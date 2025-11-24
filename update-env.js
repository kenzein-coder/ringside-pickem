#!/usr/bin/env node

/**
 * Quick script to update .env file with Firebase config
 * Usage: node update-env.js
 * Then paste your Firebase config values when prompted
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

console.log('🔥 Firebase Config Updater\n');
console.log('Paste your Firebase config values from the SDK snippet.\n');
console.log('The config looks like this:');
console.log('const firebaseConfig = {');
console.log('  apiKey: "AIzaSy...",');
console.log('  authDomain: "...",');
console.log('  projectId: "...",');
console.log('  storageBucket: "...",');
console.log('  messagingSenderId: "...",');
console.log('  appId: "..."');
console.log('};\n');

const apiKey = await question('apiKey: ');
const authDomain = await question('authDomain: ');
const projectId = await question('projectId: ');
const storageBucket = await question('storageBucket: ');
const messagingSenderId = await question('messagingSenderId: ');
const appId = await question('appId: ');

const envContent = `# Firebase Configuration
# Get these values from: Firebase Console > Project Settings > Your apps > Web app config

VITE_FIREBASE_API_KEY=${apiKey.trim().replace(/['"]/g, '')}
VITE_FIREBASE_AUTH_DOMAIN=${authDomain.trim().replace(/['"]/g, '')}
VITE_FIREBASE_PROJECT_ID=${projectId.trim().replace(/['"]/g, '')}
VITE_FIREBASE_STORAGE_BUCKET=${storageBucket.trim().replace(/['"]/g, '')}
VITE_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId.trim().replace(/['"]/g, '')}
VITE_FIREBASE_APP_ID=${appId.trim().replace(/['"]/g, '')}
`;

writeFileSync(envPath, envContent);

console.log('\n✅ .env file updated successfully!');
console.log('\nNext steps:');
console.log('1. Enable Authentication → Anonymous sign-in in Firebase Console');
console.log('2. Enable Firestore Database → Create database (test mode)');
console.log('3. Restart your dev server: npm run dev\n');

rl.close();

