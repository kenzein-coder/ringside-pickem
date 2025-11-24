#!/usr/bin/env node

/**
 * Firebase Setup Helper Script
 * This script helps you set up Firebase for your app
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔥 Firebase Setup Helper\n');
console.log('This script will help you set up Firebase for your app.\n');

// Check if .env already exists
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Opening it for you to update...\n');
  try {
    execSync(`open -e "${envPath}"`, { stdio: 'inherit' });
  } catch (e) {
    console.log('Please edit .env manually');
  }
} else {
  console.log('📝 Creating .env file from template...\n');
  const envExample = readFileSync(join(__dirname, '.env.example'), 'utf-8');
  writeFileSync(envPath, envExample);
  console.log('✅ Created .env file\n');
  try {
    execSync(`open -e "${envPath}"`, { stdio: 'inherit' });
  } catch (e) {
    console.log('Please edit .env manually');
  }
}

console.log('\n📋 Next Steps:\n');
console.log('1. Open Firebase Console: https://console.firebase.google.com/');
console.log('2. Create a new project (or select existing) called "ringside-pickem"');
console.log('3. Click the gear icon ⚙️ → Project Settings');
console.log('4. Scroll to "Your apps" → Click "Add app" → Select Web (</>)');
console.log('5. Copy the config values and paste them into the .env file');
console.log('\n6. Enable Authentication:');
console.log('   - Go to Authentication → Get Started');
console.log('   - Enable "Anonymous" sign-in method');
console.log('\n7. Enable Firestore:');
console.log('   - Go to Firestore Database → Create database');
console.log('   - Start in "test mode"');
console.log('   - Choose a location');
console.log('\n8. After updating .env, restart your dev server: npm run dev\n');

// Try to open Firebase console
console.log('🌐 Opening Firebase Console...\n');
try {
  execSync('open "https://console.firebase.google.com/"', { stdio: 'inherit' });
} catch (e) {
  console.log('Please visit: https://console.firebase.google.com/\n');
}

console.log('✅ Setup helper complete! Follow the steps above.\n');

