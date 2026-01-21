import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { initializeApp } from 'firebase/app';
// Lazy-loaded components for code splitting
const LoginView = lazy(() => import('./components/auth/LoginView'));
const OnboardingFlow = lazy(() => import('./components/auth/OnboardingFlow'));
const SettingsPanel = lazy(() => import('./components/views/SettingsPanel'));
const LeaderboardView = lazy(() => import('./components/views/LeaderboardView'));
// UI components (keep eager - they're small)
import Toggle from './components/ui/Toggle';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  updateProfile,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  limit,
  getDoc,
  getDocs
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject
} from 'firebase/storage';
import { 
  Trophy, 
  Calendar, 
  User, 
  CheckCircle, 
  Activity, 
  Users, 
  ChevronRight,
  Globe,
  Flame,
  Settings,
  Filter,
  MapPin,
  Flag,
  UserPlus,
  ArrowRight,
  Sparkles,
  BarChart3,
  LogOut,
  Shield,
  Loader2,
  Tv,
  Clock,
  Edit,
  Trash2,
  Save,
  X as XIcon,
  XCircle,
  PlusCircle,
  Upload,
  FileText,
  Search
} from 'lucide-react';
import { validateDisplayName, isValidEmail, validatePassword, sanitizeString } from './utils/inputValidation.js';
import { authRateLimiter, predictionRateLimiter } from './utils/rateLimiter.js';
import { wrestlerNamesMatch } from './utils/wrestlerNameMatcher.js';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };

// Validate Firebase config
let firebaseError = null;
let app, auth, db;

try {
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase API Key is missing. Make sure VITE_FIREBASE_API_KEY is set in your .env file.');
  }
  if (firebaseConfig.apiKey.includes('...') || firebaseConfig.apiKey.includes('your_')) {
    throw new Error('Firebase API Key appears to be a placeholder. Please replace with your actual API key.');
  }
  if (firebaseConfig.apiKey.length < 20) {
    throw new Error('Firebase API Key is too short. Please check your .env file.');
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  firebaseError = error.message;
}

// Initialize Firebase Storage
let storage = null;
try {
  if (app) {
    storage = getStorage(app);
  }
} catch (error) {
  console.error('❌ Firebase Storage initialization error:', error);
}
// Use Firebase project ID from config, fall back to __app_id or default
const appId = firebaseConfig.projectId || (typeof __app_id !== 'undefined' ? __app_id : 'default-app-id');
const googleProvider = new GoogleAuthProvider();
// Configure Google provider to always show account selection
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// --- ASSETS ---
// Alternative image sources for wrestlers - using public APIs that don't block sourcing
// Priority: 1) Provided URLs, 2) Hardcoded Wikipedia Commons, 3) Wikimedia API search, 4) Proxy services, 5) Initials fallback

// Cache for Wikimedia search results to avoid repeated API calls
// To clear cache: wikimediaCache.clear() or restart the app
const wikimediaCache = new Map();
const promotionLogoCache = new Map();

// Function to clear the image cache (useful for re-scraping)
export const clearImageCache = () => {
  wikimediaCache.clear();
  promotionLogoCache.clear();
};

// Helper function to search Wikimedia Commons for promotion logos
const searchWikimediaCommonsForLogo = async (promotionName) => {
  // Check cache first
  if (promotionLogoCache.has(promotionName)) {
    return promotionLogoCache.get(promotionName);
  }
  
  try {
    // Search for promotion logos/logos in Wikimedia Commons
    const searchQuery = encodeURIComponent(`${promotionName} logo`);
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${searchQuery}&srnamespace=6&srlimit=5`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.query?.search?.length > 0) {
      // Get image info for the first result
      const pageId = data.query.search[0].pageid;
      const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&pageids=${pageId}&prop=imageinfo&iiprop=url&iiurlwidth=200`;
      
      const imageResponse = await fetch(imageInfoUrl);
      const imageData = await imageResponse.json();
      
      const pages = imageData.query?.pages;
      if (pages && pages[pageId]?.imageinfo?.[0]?.thumburl) {
        const imageUrl = pages[pageId].imageinfo[0].thumburl;
        // Cache the result
        promotionLogoCache.set(promotionName, imageUrl);
        return imageUrl;
      }
    }
  } catch (error) {
    console.log(`Wikimedia logo search failed for ${promotionName}:`, error);
  }
  
  // Cache null result to avoid repeated failed searches
  promotionLogoCache.set(promotionName, null);
  return null;
};

// Helper function to search Wikimedia Commons for wrestler images
// Wikimedia Commons API is free, requires no API key, and is CORS-friendly
const searchWikimediaCommons = async (wrestlerName) => {
  // Check cache first
  if (wikimediaCache.has(wrestlerName)) {
    return wikimediaCache.get(wrestlerName);
  }
  
  try {
    // Wikimedia Commons API - no API key required, CORS-friendly
    // Search for images in the File namespace (namespace 6)
    const searchQuery = encodeURIComponent(`${wrestlerName} wrestler`);
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${searchQuery}&srnamespace=6&srlimit=5`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.query?.search?.length > 0) {
      // Get image info for the first result
      const pageId = data.query.search[0].pageid;
      const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&pageids=${pageId}&prop=imageinfo&iiprop=url&iiurlwidth=400`;
      
      const imageResponse = await fetch(imageInfoUrl);
      const imageData = await imageResponse.json();
      
      const pages = imageData.query?.pages;
      if (pages && pages[pageId]?.imageinfo?.[0]?.thumburl) {
        const imageUrl = pages[pageId].imageinfo[0].thumburl;
        // Cache the result
        wikimediaCache.set(wrestlerName, imageUrl);
        return imageUrl;
      }
    }
  } catch (error) {
    console.log(`Wikimedia search failed for ${wrestlerName}:`, error);
  }
  
  // Cache null result to avoid repeated failed searches
  wikimediaCache.set(wrestlerName, null);
  return null;
};

// Helper function to search Unsplash (free, no API key needed for basic usage)
const searchUnsplashImage = async (wrestlerName) => {
  try {
    // Unsplash Source API - free tier, no API key needed
    // Note: This uses Unsplash Source which provides random images based on search
    const searchQuery = encodeURIComponent(`${wrestlerName} professional wrestler`);
    
    // Try Unsplash Source (random image based on search term)
    // This is not perfect but provides free images
    const unsplashUrl = `https://source.unsplash.com/400x500/?${searchQuery}`;
    
    // Verify the image exists by trying to load it
    // Note: Unsplash Source returns random images, so this is a best-effort approach
    return unsplashUrl;
  } catch (error) {
    return null;
  }
};

// Helper function to get Pixabay image URL (using their CDN pattern)
const getPixabayImage = (wrestlerName) => {
  // Pixabay doesn't have a reliable direct URL pattern, so we'll skip this
  return null;
};

// Cache for failed image URLs to avoid repeated retries
const failedImageCache = new Map();

// Helper function to verify if an image URL is accessible
const verifyImageUrl = async (url, timeout = 5000) => {
  if (!url) return false;
  
  // Check cache first
  if (failedImageCache.has(url)) {
    return false;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors', // Use no-cors to avoid CORS issues, but we can't check status
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // With no-cors, we can't check response.ok, so we'll try loading it
    // Return true optimistically - the onError handler will catch failures
    return true;
  } catch (error) {
    // Mark as failed in cache
    failedImageCache.set(url, true);
    // Clear cache after 5 minutes
    setTimeout(() => failedImageCache.delete(url), 5 * 60 * 1000);
    return false;
  }
};

// Helper function to use image proxy services that support multiple sources
const getProxiedImageUrl = (originalUrl, width = 400, height = 500, proxyType = 'wsrv') => {
  if (!originalUrl) return null;
  const encoded = encodeURIComponent(originalUrl);
  // Using multiple proxy services as fallbacks
  const proxies = {
    wsrv: `https://wsrv.nl/?url=${encoded}&w=${width}&h=${height}&fit=cover&a=attention`,
    images: `https://images.weserv.nl/?url=${encoded}&w=${width}&h=${height}&fit=cover&a=attention`,
  };
  return proxies[proxyType] || proxies.wsrv;
};

// Promotion logos - using Wikipedia Commons and alternative sources
const PROMOTION_LOGOS = {
  // WWE - Wikipedia Commons logos
  'wwe': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/WWE_Logo.svg/200px-WWE_Logo.svg.png',
  '1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/WWE_Logo.svg/200px-WWE_Logo.svg.png',
  
  // AEW - Wikipedia Commons logos
  'aew': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/All_Elite_Wrestling_logo.svg/200px-All_Elite_Wrestling_logo.svg.png',
  '2287': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/All_Elite_Wrestling_logo.svg/200px-All_Elite_Wrestling_logo.svg.png',
  
  // NJPW - Wikipedia Commons logos
  'njpw': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/New_Japan_Pro-Wrestling_logo.svg/200px-New_Japan_Pro-Wrestling_logo.svg.png',
  '7': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/New_Japan_Pro-Wrestling_logo.svg/200px-New_Japan_Pro-Wrestling_logo.svg.png',
  
  // TNA/Impact - Wikipedia Commons logos
  'tna': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Impact_Wrestling_logo.svg/200px-Impact_Wrestling_logo.svg.png',
  '5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Impact_Wrestling_logo.svg/200px-Impact_Wrestling_logo.svg.png',
  
  // ROH - Wikipedia Commons logos
  'roh': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Ring_of_Honor_logo.svg/200px-Ring_of_Honor_logo.svg.png',
  '122': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Ring_of_Honor_logo.svg/200px-Ring_of_Honor_logo.svg.png',
  
  // Stardom
  'stardom': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/World_Wonder_Ring_Stardom_logo.svg/200px-World_Wonder_Ring_Stardom_logo.svg.png',
  '745': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/World_Wonder_Ring_Stardom_logo.svg/200px-World_Wonder_Ring_Stardom_logo.svg.png',
  
  // CMLL - Wikipedia Commons (multiple fallback options)
  'cmll': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/CMLL_logo.svg/200px-CMLL_logo.svg.png',
  'Consejo Mundial de Lucha Libre': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/CMLL_logo.svg/200px-CMLL_logo.svg.png',
  
  // AAA - Wikipedia Commons (Lucha Libre AAA Worldwide)
  'aaa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Lucha_Libre_AAA_Worldwide_logo.svg/200px-Lucha_Libre_AAA_Worldwide_logo.svg.png',
  'Lucha Libre AAA Worldwide': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Lucha_Libre_AAA_Worldwide_logo.svg/200px-Lucha_Libre_AAA_Worldwide_logo.svg.png',
  
  // GCW - Try multiple sources (will be searched if this fails)
  'gcw': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Game_Changer_Wrestling_logo.png/200px-Game_Changer_Wrestling_logo.png',
  'Game Changer Wrestling': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Game_Changer_Wrestling_logo.png/200px-Game_Changer_Wrestling_logo.png',
  
  // MLW - Try multiple sources (will be searched if this fails)
  'mlw': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Major_League_Wrestling_logo.svg/200px-Major_League_Wrestling_logo.svg.png',
  'Major League Wrestling': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Major_League_Wrestling_logo.svg/200px-Major_League_Wrestling_logo.svg.png',
};

// NOTE: All image uploads are now handled server-side by the scraper
// Client-side upload logic has been removed due to Firebase Storage security rules

// Helper function to get image URL from Firestore
const getImageFromFirestore = async (type, identifier) => {
  if (!db || !appId) return null;
  
  try {
    const imageDoc = doc(db, 'artifacts', appId, 'public', 'data', 'images', type);
    const imageData = await getDoc(imageDoc);
    
    if (imageData.exists()) {
      const data = imageData.data();
      const url = data[identifier] || null;
      // If the URL is from Firebase Storage, return it directly
      if (url && url.includes('firebasestorage.googleapis.com')) {
        return url;
      }
      return url;
    }
  } catch (error) {
    console.log(`Failed to get image from Firestore:`, error);
  }
  
  return null;
};

// Helper function to check if a local image exists
// In Vite, files in /public are served at the root URL
// Cache for failed local image checks to avoid repeated 404s
// Use localStorage to persist across page reloads
const getFailedImageCache = () => {
  try {
    const cached = localStorage.getItem('failedLocalImages');
    return cached ? new Set(JSON.parse(cached)) : new Set();
  } catch {
    return new Set();
  }
};

const saveFailedImageCache = (cache) => {
  try {
    // Only store last 1000 failed paths to avoid localStorage bloat
    const arr = Array.from(cache).slice(-1000);
    localStorage.setItem('failedLocalImages', JSON.stringify(arr));
  } catch {
    // Ignore localStorage errors
  }
};

const checkLocalImage = async (path) => {
  const failedCache = getFailedImageCache();
  
  // Skip if we've already checked this path and it failed
  if (failedCache.has(path)) {
    return null;
  }
  
  try {
    // Use HEAD request first to check if file exists (lighter than GET)
    const response = await fetch(path, { 
      method: 'HEAD',
      cache: 'no-cache',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    if (response.ok && response.status === 200) {
      // Verify it's actually an image by checking content type
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        return path;
      }
    }
    // If not found, cache the failure
    failedCache.add(path);
    saveFailedImageCache(failedCache);
  } catch (error) {
    // Image doesn't exist locally or failed to load - cache the failure
    failedCache.add(path);
    saveFailedImageCache(failedCache);
  }
  return null;
};

// Helper function to get local promotion logo path
const getLocalPromotionLogo = (promotionId) => {
  // Try common file extensions
  const extensions = ['svg', 'png', 'jpg', 'webp'];
  const basePath = `/images/promotions/${promotionId.toLowerCase()}`;
  
  // Return the first path - the checkLocalImage function will verify it exists
  // We'll check all extensions in the search function
  return basePath;
};

// Helper function to search Wikipedia page for logo in infobox
const searchWikipediaInfobox = async (pageTitle) => {
  try {
    // Try to get the full page HTML and extract infobox image
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(pageTitle)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) return null;
    
    const html = await response.text();
    // Look for infobox image patterns
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const infobox = doc.querySelector('.infobox, .infobox_v2, .infobox_v3');
    if (infobox) {
      const img = infobox.querySelector('img');
      if (img && img.src) {
        // Convert relative URLs to absolute
        if (img.src.startsWith('//')) {
          return `https:${img.src}`;
        } else if (img.src.startsWith('/')) {
          return `https://en.wikipedia.org${img.src}`;
        }
        return img.src;
      }
    }
  } catch (error) {
    // Silently fail
  }
  return null;
};

// Helper function to try multiple Wikimedia Commons search variations
const searchWikimediaCommonsVariations = async (promotionName) => {
  const searchVariations = [
    `${promotionName} logo`,
    `${promotionName} wrestling logo`,
    `Logo of ${promotionName}`,
    `${promotionName} emblem`,
  ];
  
  for (const searchQuery of searchVariations) {
    try {
      const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(searchQuery)}&srnamespace=6&srlimit=3`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.query?.search?.length > 0) {
        // Try each result
        for (const result of data.query.search) {
          const pageId = result.pageid;
          const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&pageids=${pageId}&prop=imageinfo&iiprop=url&iiurlwidth=200`;
          const imageResponse = await fetch(imageInfoUrl);
          const imageData = await imageResponse.json();
          
          const pages = imageData.query?.pages;
          if (pages && pages[pageId]?.imageinfo?.[0]?.thumburl) {
            const imageUrl = pages[pageId].imageinfo[0].thumburl;
            // Verify it's likely a logo (check filename)
            const filename = result.title.toLowerCase();
            if (filename.includes('logo') || filename.includes('emblem') || filename.includes('symbol')) {
              return imageUrl;
            }
          }
        }
      }
    } catch (error) {
      continue;
    }
  }
  return null;
};

// Helper function to search multiple sources for promotion logos
const searchPromotionLogo = async (promotionId, promotionName) => {
  // PRIORITY 1: Check for local image files first (user-provided)
  // Files should be placed in: public/images/promotions/{promotionId}.{ext}
  // Check PNG first since that's what most users provide, then SVG, then others
  const extensions = ['png', 'svg', 'jpg', 'jpeg', 'webp'];
  for (const ext of extensions) {
    const localPath = `/images/promotions/${promotionId.toLowerCase()}.${ext}`;
    const localImage = await checkLocalImage(localPath);
    if (localImage) {
      // Save local path to Firestore for future use
      saveImageToFirestore('promotions', promotionId, localImage);
      return localImage;
    }
  }
  
  // PRIORITY 2: Check Firestore cache
  const firestoreUrl = await getImageFromFirestore('promotions', promotionId);
  if (firestoreUrl) {
    return firestoreUrl;
  }
  
  // PRIORITY 3: Check hardcoded logos
  if (PROMOTION_LOGOS[promotionId]) {
    const url = PROMOTION_LOGOS[promotionId];
    // Save to Firestore for future use
    saveImageToFirestore('promotions', promotionId, url);
    return url;
  }
  
  // Try Wikimedia Commons with variations
  try {
    const wikimediaUrl = await searchWikimediaCommonsVariations(promotionName);
    if (wikimediaUrl) {
      saveImageToFirestore('promotions', promotionId, wikimediaUrl);
      return wikimediaUrl;
    }
  } catch (error) {
    console.log(`Wikimedia search failed for ${promotionName}`);
  }
  
  // Try original Wikimedia Commons search as fallback
  try {
    const wikimediaUrl = await searchWikimediaCommonsForLogo(promotionName);
    if (wikimediaUrl) {
      saveImageToFirestore('promotions', promotionId, wikimediaUrl);
      return wikimediaUrl;
    }
  } catch (error) {
    console.log(`Wikimedia search failed for ${promotionName}`);
  }
  
  // Try Wikipedia API search with variations
  try {
    const nameVariations = [
      promotionName,
      `${promotionName} (wrestling)`,
      `${promotionName} wrestling`,
      `List of ${promotionName} events`,
    ];
    
    for (const nameVar of nameVariations) {
      try {
        const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nameVar)}`;
        const response = await fetch(apiUrl);
        if (!response.ok) continue;
        
        const data = await response.json();
        
        if (data.thumbnail?.source) {
          const imageUrl = data.thumbnail.source;
          saveImageToFirestore('promotions', promotionId, imageUrl);
          return imageUrl;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.log(`Wikipedia API search failed for ${promotionName}`);
  }
  
  // Try Wikipedia infobox extraction
  try {
    const nameVariations = [
      promotionName,
      `${promotionName} (wrestling)`,
    ];
    
    for (const nameVar of nameVariations) {
      const infoboxImage = await searchWikipediaInfobox(nameVar);
      if (infoboxImage) {
        saveImageToFirestore('promotions', promotionId, infoboxImage);
        return infoboxImage;
      }
    }
  } catch (error) {
    // Silently fail
  }
  
  // Try direct Wikipedia Commons URL patterns (common logo file patterns)
  try {
    const normalizedName = promotionName.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');
    
    const commonPatterns = [
      `${normalizedName}_logo.svg`,
      `${normalizedName}_logo.png`,
      `Logo_of_${normalizedName}.svg`,
      `Logo_of_${normalizedName}.png`,
      `${normalizedName}_emblem.svg`,
      `${normalizedName}_emblem.png`,
    ];
    
    for (const pattern of commonPatterns) {
      try {
        // Try to fetch the file info directly
        const fileUrl = `File:${pattern}`;
        const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(fileUrl)}&prop=imageinfo&iiprop=url&iiurlwidth=200`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        const pages = data.query?.pages;
        if (pages) {
          const pageId = Object.keys(pages)[0];
          const page = pages[pageId];
          if (page.imageinfo?.[0]?.thumburl && page.missing === undefined) {
            const imageUrl = page.imageinfo[0].thumburl;
            saveImageToFirestore('promotions', promotionId, imageUrl);
            return imageUrl;
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    // Silently fail
  }
  
  return null;
};

// Helper to normalize wrestler name for matching
const normalizeWrestlerName = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\./g, '') // Remove periods
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/[^\w\s]/g, ''); // Remove special chars except spaces
};

// Helper function to search Imgur for wrestler images
const searchImgurImage = async (wrestlerName) => {
  try {
    // Imgur has a public API but requires client ID for search
    // For now, we'll use a proxy service that can search Imgur
    // Alternative: Use Imgur's gallery search via proxy
    const searchQuery = encodeURIComponent(`${wrestlerName} wrestler`);
    // Using a proxy to search Imgur (this is a simplified approach)
    // Note: Full Imgur API would require authentication
    return null; // Disabled for now - would need API key
  } catch (error) {
    return null;
  }
};

// Helper function to search Pexels for wrestler images (free API)
const searchPexelsImage = async (wrestlerName) => {
  try {
    // Pexels has a free API but requires an API key
    // For now, we'll skip direct Pexels API calls
    // Alternative: Use Unsplash which has better free tier
    return null;
  } catch (error) {
    return null;
  }
};

// Helper function to search via SerpAPI or similar (free image search)
// Note: Most free image search APIs require keys, so we'll use Unsplash as primary
const searchImageAPI = async (wrestlerName) => {
  try {
    // This is a placeholder for future image API integration
    // Options: SerpAPI, Bing Image Search API, Google Custom Search
    // All require API keys, so we'll stick with Unsplash for now
    return null;
  } catch (error) {
    return null;
  }
};

// Helper function to search multiple sources for wrestler images
const searchWrestlerImage = async (wrestlerName) => {
  // PRIORITY 1: Check Firestore (skip Cagematch URLs)
  const firestoreUrl = await getImageFromFirestore('wrestlers', wrestlerName);
  if (firestoreUrl) {
    // Skip Cagematch URLs
    if (firestoreUrl.includes('cagematch.net')) {
      // Don't use Cagematch - continue to other sources
    } else {
      return firestoreUrl;
    }
  }
  
  // PRIORITY 2: Check hardcoded images with normalization (skip Wikimedia)
  if (WRESTLER_IMAGES[wrestlerName]) {
    const url = WRESTLER_IMAGES[wrestlerName];
    // Skip Wikimedia URLs
    if (url.includes('wikimedia.org') || url.includes('wikipedia.org')) {
      // Don't use Wikimedia - continue to other sources
    } else {
      saveImageToFirestore('wrestlers', wrestlerName, url);
      return url;
    }
  }
  
  // Try normalized name matching for hardcoded images (skip Wikimedia)
  const normalizedName = normalizeWrestlerName(wrestlerName);
  for (const [key, url] of Object.entries(WRESTLER_IMAGES)) {
    if (normalizeWrestlerName(key) === normalizedName) {
      // Skip Wikimedia URLs
      if (url.includes('wikimedia.org') || url.includes('wikipedia.org')) {
        continue;
      }
      saveImageToFirestore('wrestlers', wrestlerName, url);
      return url;
    }
  }
  
  // PRIORITY 3: Try Unsplash (free, no API key needed for basic usage)
  try {
    const unsplashUrl = await searchUnsplashImage(wrestlerName);
    if (unsplashUrl) {
      saveImageToFirestore('wrestlers', wrestlerName, unsplashUrl);
      return unsplashUrl;
    }
  } catch (error) {
    // Silently fail
  }
  
  // PRIORITY 4: Try Online World of Wrestling (reliable wrestling database)
  try {
    const owowUrl = await searchOWOWImage(wrestlerName);
    if (owowUrl) {
      saveImageToFirestore('wrestlers', wrestlerName, owowUrl);
      return owowUrl;
    }
  } catch (error) {
    // Silently fail
  }
  
  // PRIORITY 5: Try DuckDuckGo Image Search (no API key needed)
  try {
    const ddgUrl = await searchDuckDuckGoImage(wrestlerName);
    if (ddgUrl) {
      saveImageToFirestore('wrestlers', wrestlerName, ddgUrl);
      return ddgUrl;
    }
  } catch (error) {
    // Silently fail
  }
  
  // Skip Wikipedia/Wikimedia search per user request
  // (Hardcoded Wikimedia images are still used, but downloaded to Storage)
  
  return null;
};

// Helper function to search Wikimedia Commons for event posters/banners
const searchWikimediaCommonsForEvent = async (eventName) => {
  try {
    // Search for event posters/banners in Wikimedia Commons with multiple variations
    const searchQueries = [
      `${eventName} poster`,
      `${eventName} banner`,
      `${eventName} wrestling event`,
      `${eventName} PPV`,
      `${eventName} pay-per-view`,
      `Poster ${eventName}`,
      `${eventName} promotional poster`,
      `${eventName} event poster`,
    ];
    
    for (const searchQuery of searchQueries) {
      try {
        const encodedQuery = encodeURIComponent(searchQuery);
        const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodedQuery}&srnamespace=6&srlimit=10`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.query?.search?.length > 0) {
          // Try each result to find the best match
          for (const result of data.query.search) {
            const filename = result.title.toLowerCase();
            // Prefer files that contain "poster", "banner", or "promotional"
            if (filename.includes('poster') || filename.includes('banner') || filename.includes('promotional')) {
              const pageId = result.pageid;
              const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&pageids=${pageId}&prop=imageinfo&iiprop=url&iiurlwidth=800`;
              
              const imageResponse = await fetch(imageInfoUrl);
              const imageData = await imageResponse.json();
              
              const pages = imageData.query?.pages;
              if (pages && pages[pageId]?.imageinfo?.[0]?.thumburl) {
                const imageUrl = pages[pageId].imageinfo[0].thumburl;
                return imageUrl;
              }
            }
          }
          
          // If no poster/banner found, use first result
          const pageId = data.query.search[0].pageid;
          const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&pageids=${pageId}&prop=imageinfo&iiprop=url&iiurlwidth=800`;
          
          const imageResponse = await fetch(imageInfoUrl);
          const imageData = await imageResponse.json();
          
          const pages = imageData.query?.pages;
          if (pages && pages[pageId]?.imageinfo?.[0]?.thumburl) {
            const imageUrl = pages[pageId].imageinfo[0].thumburl;
            return imageUrl;
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.log(`Wikimedia event search failed for ${eventName}:`, error);
  }
  
  return null;
};

// Helper function to search multiple sources for event posters/banners
const searchEventPoster = async (eventId, eventName) => {
  // PRIORITY 1: Check Firestore cache FIRST (fastest, no network requests)
  const firestoreUrl = await getImageFromFirestore('events', eventId);
  if (firestoreUrl) {
    return firestoreUrl;
  }
  
  // PRIORITY 2: Check for local image files (user-provided)
  // Only try most common formats and paths to reduce 404s
  const extensions = ['jpg', 'png']; // Reduced from 4 to 2 most common formats
  const sanitizedId = eventId.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const sanitizedName = eventName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  // Only try eventId-based paths (most reliable), skip eventName variations to reduce requests
  for (const ext of extensions) {
    const localPath = `/images/events/${sanitizedId}.${ext}`;
    const localImage = await checkLocalImage(localPath);
    if (localImage) {
      // Save local path to Firestore for future use
      saveImageToFirestore('events', eventId, localImage);
      return localImage;
    }
  }
  
  // PRIORITY 3: Skip Wikimedia/Wikipedia per user request
  // (Previously tried Wikimedia Commons, Wikipedia API, Wikipedia infobox, Wikipedia Commons patterns)
  
  return null;
};

// Known event posters from reliable sources
// These are curated, verified working URLs
// To add more: Use Admin Panel → Edit Event → Add Poster URL
const KNOWN_EVENT_POSTERS = {
  // WWE 2026
  'wwe-royal-rumble-2026': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Royal_Rumble_%282024%29.jpg/220px-Royal_Rumble_%282024%29.jpg',
  'wwe-elimination-chamber-2026': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/92/Elimination_Chamber_2024.jpg/220px-Elimination_Chamber_2024.jpg',
  
  // WWE 2025
  'wwe-survivor-series-2025': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/58/Survivor_Series_WarGames_2023_poster.jpg/220px-Survivor_Series_WarGames_2023_poster.jpg',
  
  // AEW 2025-2026
  'aew-full-gear-2025': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/97/AEW_Full_Gear_2023_logo.jpg/220px-AEW_Full_Gear_2023_logo.jpg',
  'cagematch-431204': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/55/AEW_Worlds_End_2023.jpg/220px-AEW_Worlds_End_2023.jpg', // Worlds End 2025
  'revolution-2026': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/AEW_Revolution_2024.jpg/220px-AEW_Revolution_2024.jpg',
  
  // NJPW
  'cagematch-426904': 'https://upload.wikimedia.org/wikipedia/en/thumb/3/35/Wrestle_Kingdom_17_poster.jpg/220px-Wrestle_Kingdom_17_poster.jpg', // Wrestle Kingdom 20
  
  // Note: These are using previous year's posters as placeholders
  // Admins should update with 2026 posters when available via Admin Panel
};

// Helper function to get event poster/banner with fallback
const getEventImage = async (event) => {
  if (!event) return null;
  
  // If bannerUrl or posterUrl is provided and not from cagematch.net, use it
  if (event.bannerUrl && !event.bannerUrl.includes('cagematch.net')) {
    saveImageToFirestore('events', event.id, event.bannerUrl);
    return event.bannerUrl;
  }
  
  if (event.posterUrl && !event.posterUrl.includes('cagematch.net')) {
    saveImageToFirestore('events', event.id, event.posterUrl);
    return event.posterUrl;
  }
  
  // Check known event posters
  if (KNOWN_EVENT_POSTERS[event.id]) {
    const knownUrl = KNOWN_EVENT_POSTERS[event.id];
    saveImageToFirestore('events', event.id, knownUrl);
    return knownUrl;
  }
  
  // Search for event poster
  const foundUrl = await searchEventPoster(event.id, event.name);
  if (foundUrl) {
    return foundUrl;
  }
  
  // Fallback to placeholder
  return `https://picsum.photos/seed/${event.id}/800/400`;
};

// Using reliable image sources - primarily Wikipedia Commons (public domain/CC licensed)
const WRESTLER_IMAGES = {
  // WWE - Real photos from Wikipedia (verified working)
  'The Rock': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Dwayne_%22The_Rock%22_Johnson_Visits_the_Pentagon_%2841%29_%28cropped%29.jpg',
  'John Cena': 'https://upload.wikimedia.org/wikipedia/commons/6/60/John_Cena_July_2018.jpg',
  'Roman Reigns': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Roman_Reigns_Tribute_to_the_Troops_2016.jpg',
  'CM Punk': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/CM_Punk_Tribute_to_the_Troops_2010_crop.jpg',
  'Randy Orton': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Randy_Orton_September_2016.jpg',
  'Seth Rollins': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Seth_Rollins_2018.jpg',
  'Becky Lynch': 'https://upload.wikimedia.org/wikipedia/commons/6/66/Becky_Lynch_in_April_2019.jpg',
  'Charlotte Flair': 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Charlotte_Flair_April_2018.jpg',
  'Sasha Banks': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Sasha_Banks_2016.jpg',
  'Bayley': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Bayley_in_April_2017.jpg',
  'AJ Styles': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/AJ_Styles_in_April_2017.jpg',
  'Kevin Owens': 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Kevin_Owens_September_2016.jpg',
  'Sami Zayn': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Sami_Zayn_Axxess_2017.jpg',
  'Brock Lesnar': 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Brock_Lesnar_in_March_2015.jpg',
  'The Undertaker': 'https://upload.wikimedia.org/wikipedia/commons/3/30/Undertaker_with_Paul_Bearer.jpg',
  'Triple H': 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Triple_H_Axxess_2014.jpg',
  'Shawn Michaels': 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Shawn_Michaels_in_March_2010.jpg',
  'Rhea Ripley': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Rhea_Ripley_NXT_2019.jpg',
  'Bianca Belair': 'https://upload.wikimedia.org/wikipedia/commons/3/32/Bianca_Belair_NXT_2020.jpg',
  'Asuka': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Asuka_WrestleMania_34.jpg',
  'Drew McIntyre': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Drew_McIntyre_2018.jpg',
  'Cody Rhodes': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Cody_Rhodes_WWE_2016.jpg',
  'Finn Balor': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Finn_B%C3%A1lor_NXT_Champ.jpg',
  
  // AEW - (Wikimedia URLs were outdated/404, using fallback initials which look great)
  // Note: Add working image URLs here as you find them
  // 'Jon Moxley': 'url',
  // 'Kenny Omega': 'url',
  
  // NJPW - Real photos  
  'Tetsuya Naito': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Naito_Tetsuya_2022.jpg',
  'Kazuchika Okada': 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Kazuchika_Okada_2017.jpg',
  'Hiroshi Tanahashi': 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Hiroshi_Tanahashi_2017.jpg',
  'Zack Sabre Jr.': 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Zack_Sabre_Jr_2018.jpg',
  'Hiromu Takahashi': 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Hiromu_Takahashi_2019.jpg',
  'Kota Ibushi': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Ibushi_Kota_2017.jpg',
  'Jay White': 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Jay_White_2019.jpg',
  'SANADA': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Sanada_2017.jpg',
  'EVIL': 'https://upload.wikimedia.org/wikipedia/commons/d/da/Evil_2017.jpg',
  'Shingo Takagi': 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Shingo_Takagi_2019.jpg',
  
  // Additional wrestlers for better coverage
  'El Desperado': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/El_Desperado_2020.jpg/400px-El_Desperado_2020.jpg',
  
  // TNA/Impact
  'Nic Nemeth': 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Dolph_Ziggler_2017.jpg',
  'Josh Alexander': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Josh_Alexander_Impact_Wrestling.jpg',
  'Jordynne Grace': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Jordynne_Grace_2022.jpg',
  'Masha Slamovich': 'https://upload.wikimedia.org/wikipedia/commons/6/65/Masha_Slamovich_2022.jpg',
  'Moose': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Moose_2018.jpg',
  
  // ROH
  'Mark Briscoe': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Mark_Briscoe_2022.jpg',
  'Eddie Kingston': 'https://upload.wikimedia.org/wikipedia/commons/3/34/Eddie_Kingston_2019.jpg',
  'Athena': 'https://upload.wikimedia.org/wikipedia/commons/8/82/Ember_Moon_Axxess_2018.jpg',
  'Billie Starkz': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Billie_Starkz.jpg',
  
  // Tag Teams / Factions (using representative member)
  'Bloodline 2.0': 'https://upload.wikimedia.org/wikipedia/commons/7/7e/The_Usos_2014.jpg',
  'Original Bloodline': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Roman_Reigns_Tribute_to_the_Troops_2016.jpg',
  'House of Black': 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Malakai_Black_AEW.jpg',
  'The Acclaimed': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/The_Acclaimed_2022.jpg',
  'FTR': 'https://upload.wikimedia.org/wikipedia/commons/7/73/The_Revival_WM_Axxess_2017.jpg',
  'The Young Bucks': 'https://upload.wikimedia.org/wikipedia/commons/6/66/The_Young_Bucks_April_2017.jpg',
  
  // Legends
  'Hulk Hogan': 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Hulk_Hogan_2011.jpg',
  'Stone Cold Steve Austin': 'https://upload.wikimedia.org/wikipedia/commons/8/80/Stone_Cold_Steve_Austin_2011.jpg',
  'The Ultimate Warrior': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Ultimate_Warrior_in_1991.jpg',
  'Ric Flair': 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Ric_Flair_2014.jpg',
};

const PROMOTIONS = [
    { id: 'wwe', name: 'WWE', color: 'text-blue-500', bg: 'bg-slate-900', border: 'border-blue-500/30' },
    { id: 'aew', name: 'AEW', color: 'text-yellow-400', bg: 'bg-slate-900', border: 'border-yellow-500/30' },
    { id: 'njpw', name: 'NJPW', color: 'text-red-600', bg: 'bg-slate-900', border: 'border-red-600/30' },
    { id: 'tna', name: 'TNA', color: 'text-yellow-500', bg: 'bg-slate-900', border: 'border-yellow-600/30' },
    { id: 'roh', name: 'ROH', color: 'text-red-500', bg: 'bg-slate-900', border: 'border-red-800/30' },
    { id: 'stardom', name: 'Stardom', color: 'text-pink-500', bg: 'bg-slate-900', border: 'border-pink-500/30' },
    { id: 'cmll', name: 'CMLL', color: 'text-blue-400', bg: 'bg-slate-900', border: 'border-blue-500/30' },
    { id: 'aaa', name: 'AAA', color: 'text-red-500', bg: 'bg-slate-900', border: 'border-red-500/30' },
    { id: 'gcw', name: 'GCW', color: 'text-stone-400', bg: 'bg-slate-900', border: 'border-stone-600/30' },
    { id: 'mlw', name: 'MLW', color: 'text-white', bg: 'bg-slate-900', border: 'border-white/30' },
];

// --- COMMUNITY SENTIMENT SIMULATION ENGINE ---
// Popular/Face wrestlers get more crowd support - generates realistic community sentiment
const POPULARITY_SCORES = {
  // Mega Stars (80-95% crowd support when facing heels)
  'Cody Rhodes': 95, 'Roman Reigns': 90, 'The Rock': 95, 'John Cena': 92, 
  'CM Punk': 88, 'Seth Rollins': 85, 'Rhea Ripley': 88, 'Becky Lynch': 87,
  'Randy Orton': 82, 'Kevin Owens': 80, 'Sami Zayn': 85, 'Drew McIntyre': 78,
  
  // AEW Top Stars
  'Kenny Omega': 88, 'MJF': 75, 'Jon Moxley': 82, 'Will Ospreay': 90,
  'Hangman Adam Page': 80, 'Orange Cassidy': 85, 'Sting': 92, 'Darby Allin': 82,
  'Chris Jericho': 78, 'Mercedes Moné': 80, 'Jamie Hayter': 78, 'Toni Storm': 82,
  
  // NJPW Stars
  'Kazuchika Okada': 88, 'Hiroshi Tanahashi': 90, 'Tetsuya Naito': 85,
  'Zack Sabre Jr.': 75, 'Shingo Takagi': 80, 'Hiromu Takahashi': 82,
  
  // TNA/Impact Stars
  'Nic Nemeth': 80, 'Josh Alexander': 78, 'Jordynne Grace': 82, 'Moose': 72,
  
  // Tag Teams & Factions
  'OG Bloodline': 88, 'Original Bloodline': 88, 'Team Rhea': 85, 'The Young Bucks': 70,
  'FTR': 80, 'The Acclaimed': 82, 'House of Black': 72, 'Death Riders': 70,
  'The Elite': 75, 'New Bloodline': 65, 'Team Liv': 72, 'Bloodline 2.0': 65,
  
  // Legends
  'The Undertaker': 95, 'Triple H': 85, 'Shawn Michaels': 92, 'Stone Cold Steve Austin': 95,
  'Hulk Hogan': 80, 'Ric Flair': 88,
};

// Generate a deterministic but seemingly random number based on string
const seededRandom = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(Math.sin(hash) * 10000) % 1;
};

// Get popularity score for a wrestler (returns 50-80 for unknown wrestlers)
const getPopularityScore = (name) => {
  if (!name) return 60;
  // Check direct match
  if (POPULARITY_SCORES[name]) return POPULARITY_SCORES[name];
  // Check if name contains a known wrestler
  for (const [wrestler, score] of Object.entries(POPULARITY_SCORES)) {
    if (name.toLowerCase().includes(wrestler.toLowerCase()) || 
        wrestler.toLowerCase().includes(name.toLowerCase())) {
      return score;
    }
  }
  // Generate a consistent score based on name hash
  return 50 + Math.floor(seededRandom(name) * 30);
};

// Generate simulated community sentiment for a match
const generateSimulatedSentiment = (match, eventId) => {
  const p1Score = getPopularityScore(match.p1);
  const p2Score = getPopularityScore(match.p2);
  
  // Calculate base percentage with some variance
  const totalScore = p1Score + p2Score;
  let p1Base = (p1Score / totalScore) * 100;
  
  // Add some realistic variance based on match/event seed
  const variance = seededRandom(`${eventId}-${match.id}`) * 12 - 6; // -6 to +6
  p1Base = Math.min(85, Math.max(15, p1Base + variance)); // Clamp between 15-85%
  
  const p1Pct = Math.round(p1Base);
  const p2Pct = 100 - p1Pct;
  
  // Generate realistic total picks (100-2000 based on match importance)
  const isMainEvent = match.id === 1 || (match.title?.toLowerCase().includes('championship'));
  const baseTotal = isMainEvent ? 800 : 300;
  const totalVariance = Math.floor(seededRandom(`total-${eventId}-${match.id}`) * baseTotal);
  const total = baseTotal + totalVariance;
  
  return { p1: p1Pct, p2: p2Pct, total, simulated: true };
};

const INITIAL_EVENTS = [
  {
    id: 'wwe-survivor-2025', promoId: 'wwe', name: 'Survivor Series', date: 'Nov 30, 2025', venue: 'Chicago, IL',
    matches: [
      { id: 1, p1: 'OG Bloodline', p2: 'New Bloodline', title: "Men's WarGames Match", isTeamMatch: true },
      { id: 2, p1: 'Team Rhea', p2: 'Team Liv', title: "Women's WarGames Match", isTeamMatch: true },
      { id: 3, p1: 'Cody Rhodes', p2: 'Kevin Owens', title: 'Undisputed WWE Championship' },
      { id: 4, p1: 'Gunther', p2: 'Damian Priest', title: 'World Heavyweight Championship' },
      { id: 5, p1: 'LA Knight', p2: 'Shinsuke Nakamura', title: 'United States Championship' }
    ]
  },
  {
    id: 'aew-worlds-end-2025', promoId: 'aew', name: 'Worlds End', date: 'Dec 28, 2025', venue: 'Orlando, FL',
    matches: [
      { id: 1, p1: 'Jon Moxley', p2: 'Hangman Adam Page', title: 'AEW World Championship' },
      { id: 2, p1: 'Will Ospreay', p2: 'Kenny Omega', title: 'International Championship' },
      { id: 3, p1: 'Mercedes Moné', p2: 'Jamie Hayter', title: 'TBS Championship' },
      { id: 4, p1: 'The Young Bucks', p2: 'FTR', title: 'AEW Tag Team Championship', isTeamMatch: true },
      { id: 5, p1: 'Death Riders', p2: 'The Elite', title: 'Blood & Guts Match', isTeamMatch: true }
    ]
  },
  {
    id: 'njpw-wk20', promoId: 'njpw', name: 'Wrestle Kingdom 20', date: 'Jan 4, 2026', venue: 'Tokyo Dome',
    matches: [
      { id: 1, p1: 'Zack Sabre Jr.', p2: 'Shingo Takagi', title: 'IWGP World Heavyweight Championship' },
      { id: 2, p1: 'Tetsuya Naito', p2: 'SANADA', title: 'Special Singles Match' },
      { id: 3, p1: 'Hiromu Takahashi', p2: 'El Desperado', title: 'IWGP Junior Heavyweight Championship' },
      { id: 4, p1: 'TMDK', p2: 'Bullet Club War Dogs', title: 'IWGP Tag Team Championship', isTeamMatch: true },
      { id: 5, p1: 'Los Ingobernables', p2: 'House of Torture', title: 'NEVER Openweight 6-Man Tag', isTeamMatch: true }
    ]
  },
  {
    id: 'tna-hardto-2026', promoId: 'tna', name: 'Hard To Kill 2026', date: 'Jan 13, 2026', venue: 'Las Vegas, NV',
    matches: [
      { id: 1, p1: 'Nic Nemeth', p2: 'Josh Alexander', title: 'TNA World Championship' },
      { id: 2, p1: 'Jordynne Grace', p2: 'Masha Slamovich', title: 'Knockouts Championship' },
      { id: 3, p1: 'The System', p2: 'The Hardys', title: 'TNA Tag Team Championship', isTeamMatch: true },
      { id: 4, p1: 'Mike Santana', p2: 'Moose', title: 'X Division Championship' }
    ]
  },
  {
    id: 'roh-final-battle-2025', promoId: 'roh', name: 'Final Battle', date: 'Dec 15, 2025', venue: 'New York, NY',
    matches: [
      { id: 1, p1: 'Mark Briscoe', p2: 'Chris Jericho', title: 'ROH World Championship' },
      { id: 2, p1: 'Athena', p2: 'Billie Starkz', title: "ROH Women's World Championship" },
      { id: 3, p1: 'Undisputed Kingdom', p2: 'The Infantry', title: 'ROH Tag Team Championship', isTeamMatch: true },
      { id: 4, p1: 'Dustin Rhodes', p2: 'Kyle Fletcher', title: 'ROH TV Championship' }
    ]
  },
  // Upcoming weekly shows
  {
    id: 'aew-dynamite-327', promoId: 'aew', name: 'AEW Dynamite #327', date: 'Jan 7, 2026', venue: 'TBD',
    matches: []
  },
  {
    id: 'aew-dynamite-328', promoId: 'aew', name: 'AEW Dynamite #328', date: 'Jan 14, 2026', venue: 'TBD',
    matches: []
  },
  {
    id: 'aew-collision-126', promoId: 'aew', name: 'AEW Collision #126', date: 'Jan 10, 2026', venue: 'TBD',
    matches: []
  },
  {
    id: 'wwe-raw-1700', promoId: 'wwe', name: 'WWE Monday Night RAW #1700', date: 'Jan 5, 2026', venue: 'TBD',
    matches: []
  },
  {
    id: 'wwe-raw-1701', promoId: 'wwe', name: 'WWE Monday Night RAW #1701', date: 'Jan 12, 2026', venue: 'TBD',
    matches: []
  },
  {
    id: 'wwe-smackdown-1375', promoId: 'wwe', name: 'WWE Friday Night SmackDown #1375', date: 'Jan 2, 2026', venue: 'TBD',
    matches: []
  },
  {
    id: 'wwe-smackdown-1376', promoId: 'wwe', name: 'WWE Friday Night SmackDown #1376', date: 'Jan 9, 2026', venue: 'TBD',
    matches: []
  },
  {
    id: 'wwe-nxt-818', promoId: 'wwe', name: 'WWE NXT #818', date: 'Jan 6, 2026', venue: 'TBD',
    matches: []
  },
  {
    id: 'wwe-nxt-819', promoId: 'wwe', name: 'WWE NXT #819', date: 'Jan 13, 2026', venue: 'TBD',
    matches: []
  }
];

// --- HELPER COMPONENTS ---

const BrandLogo = ({ id, className = "w-full h-full object-contain", logoUrl }) => {
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [imageSource, setImageSource] = useState('initial'); // 'initial', 'wikimedia', 'proxy', 'fallback'
  const [isLoading, setIsLoading] = useState(true);
  
  // Brand colors for each promotion (fallback)
  const brandColors = {
    wwe: { bg: 'bg-gradient-to-br from-red-600 to-red-800', text: 'text-white' },
    aew: { bg: 'bg-gradient-to-br from-yellow-500 to-amber-600', text: 'text-black' },
    njpw: { bg: 'bg-gradient-to-br from-red-700 to-red-900', text: 'text-white' },
    tna: { bg: 'bg-gradient-to-br from-green-500 to-green-700', text: 'text-white' },
    roh: { bg: 'bg-gradient-to-br from-red-600 to-black', text: 'text-white' },
    stardom: { bg: 'bg-gradient-to-br from-pink-500 to-pink-700', text: 'text-white' },
    cmll: { bg: 'bg-gradient-to-br from-blue-600 to-blue-800', text: 'text-yellow-400' },
    aaa: { bg: 'bg-gradient-to-br from-red-600 to-orange-600', text: 'text-white' },
    gcw: { bg: 'bg-gradient-to-br from-stone-700 to-stone-900', text: 'text-white' },
    mlw: { bg: 'bg-gradient-to-br from-slate-700 to-slate-900', text: 'text-yellow-400' },
  };
  
  const colors = brandColors[id] || { bg: 'bg-gradient-to-br from-slate-700 to-slate-900', text: 'text-white' };
  
  useEffect(() => {
    // Reset state when id or logoUrl changes
    setIsLoading(true);
    setImageSource('initial');
    
    // Priority order:
    // 1. Provided logoUrl (if not from cagematch.net)
    // 2. Local image files (user-provided in public/images/promotions/)
    // 3. Firestore database (cached images)
    // 4. Hardcoded PROMOTION_LOGOS
    // 5. Search multiple sources (Wikimedia, Wikipedia API)
    // 6. Use proxy services
    // 7. Fallback to colored gradient with text
    
    const loadLogo = async () => {
      // Step 1: Check provided logoUrl (skip cagematch.net)
      if (logoUrl && !logoUrl.includes('cagematch.net')) {
        setCurrentLogoUrl(logoUrl);
        setImageSource('initial');
        // Save to Firestore for future use
        saveImageToFirestore('promotions', id, logoUrl);
        return;
      }
      
      // Step 2: Check for local image files (user-provided)
      // Files should be in: public/images/promotions/{id}.{ext}
      // Check PNG first since that's what most users provide, then SVG, then others
      const extensions = ['png', 'svg', 'jpg', 'jpeg', 'webp'];
      for (const ext of extensions) {
        const localPath = `/images/promotions/${id.toLowerCase()}.${ext}`;
        const localImage = await checkLocalImage(localPath);
        if (localImage) {
          setCurrentLogoUrl(localImage);
          setImageSource('local');
          // Save local path to Firestore for future use
          saveImageToFirestore('promotions', id, localImage);
          return;
        }
      }
      
      // Step 3: Check Firestore database
      try {
        const firestoreUrl = await getImageFromFirestore('promotions', id);
        if (firestoreUrl) {
          setCurrentLogoUrl(firestoreUrl);
          setImageSource('database');
          return;
        }
      } catch (error) {
        console.log(`Firestore lookup failed for ${id}`);
      }
      
      // Step 3: Check hardcoded PROMOTION_LOGOS
      if (PROMOTION_LOGOS[id]) {
        const url = PROMOTION_LOGOS[id];
        setCurrentLogoUrl(url);
        setImageSource('initial');
        // Save to Firestore for future use
        saveImageToFirestore('promotions', id, url);
        return;
      }
      
      // Step 4: Search multiple sources
      try {
        // Get promotion name from PROMOTIONS array or use id
        const promo = PROMOTIONS.find(p => p.id === id);
        const promotionName = promo?.name || id;
        const foundUrl = await searchPromotionLogo(id, promotionName);
        if (foundUrl) {
          setCurrentLogoUrl(foundUrl);
          setImageSource('database');
          return;
        }
      } catch (error) {
        console.log(`Logo search failed for ${id}`);
      }
      
      // Step 5: No logo found - will use fallback
      setCurrentLogoUrl(null);
      setImageSource('fallback');
    };
    
    loadLogo();
  }, [id, logoUrl]);
  
  // Try alternative proxy if current one fails
  const handleImageError = () => {
    if (imageSource === 'initial' && currentLogoUrl) {
      // Try with proxy
      const proxied = getProxiedImageUrl(currentLogoUrl, 200, 200, 'wsrv');
      setCurrentLogoUrl(proxied);
      setImageSource('proxy');
    } else if (imageSource === 'proxy' && currentLogoUrl) {
      // Try alternative proxy
      const originalUrl = logoUrl && !logoUrl.includes('cagematch.net') 
        ? logoUrl 
        : (PROMOTION_LOGOS[id] || logoUrl);
      if (originalUrl) {
        const proxied = getProxiedImageUrl(originalUrl, 200, 200, 'images');
        setCurrentLogoUrl(proxied);
      } else {
        setImageSource('fallback');
      }
    } else if (imageSource === 'wikimedia' && currentLogoUrl) {
      // Try proxying the Wikimedia image
      const proxied = getProxiedImageUrl(currentLogoUrl, 200, 200, 'wsrv');
      setCurrentLogoUrl(proxied);
      setImageSource('proxy');
    } else {
      setImageSource('fallback');
    }
  };
  
  // Fallback - colored gradient with text
  if (!currentLogoUrl || imageSource === 'fallback') {
    return (
      <div className={`w-full h-full flex items-center justify-center ${colors.bg} ${colors.text} font-black text-xs uppercase rounded tracking-tight shadow-inner ${className}`}>
        {id.toUpperCase()}
      </div>
    );
  }
  
  return (
    <img 
      src={currentLogoUrl} 
      alt={`${id} logo`} 
      className={`object-contain ${className}`} 
      onError={handleImageError}
      onLoad={() => setIsLoading(false)}
      referrerPolicy="no-referrer" 
      crossOrigin="anonymous"
      loading="lazy" 
    />
  );
};

const WrestlerImage = ({ name, className, imageUrl }) => {
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [imageSource, setImageSource] = useState('loading');
  const [isLoading, setIsLoading] = useState(true);
  const retryCountRef = useRef(0);
  const maxRetries = 2;
  
  useEffect(() => {
    setIsLoading(true);
    setImageSource('loading');
    retryCountRef.current = 0;
    
    const loadImage = async () => {
      // Strategy 1: Try hardcoded images first (most reliable)
      const hardcodedUrl = WRESTLER_IMAGES[name] || WRESTLER_IMAGES[normalizeWrestlerName(name)];
      if (hardcodedUrl && !hardcodedUrl.includes('cagematch.net')) {
        setCurrentImageUrl(hardcodedUrl);
        setImageSource('hardcoded');
        return;
      }
      
      // Strategy 2: Try provided imageUrl (proxy if it's Firebase Storage or external)
      if (imageUrl) {
        if (imageUrl.includes('firebasestorage.googleapis.com')) {
          // Firebase Storage URL - use directly
          setCurrentImageUrl(imageUrl);
          setImageSource('storage');
          return;
        } else if (!imageUrl.includes('wikimedia.org') && !imageUrl.includes('wikipedia.org')) {
          // External URL (including Cagematch) - proxy it
          const proxiedUrl = getProxiedImageUrl(imageUrl, 400, 500, 'wsrv');
          setCurrentImageUrl(proxiedUrl);
          setImageSource('proxy');
          return;
        }
      }
      
      // Strategy 3: Try Firestore (images saved by scraper)
      try {
        const firestoreUrl = await getImageFromFirestore('wrestlers', name);
        if (firestoreUrl) {
          if (firestoreUrl.includes('firebasestorage.googleapis.com')) {
            // Firebase Storage URL - use directly
            setCurrentImageUrl(firestoreUrl);
            setImageSource('storage');
            return;
          } else if (!firestoreUrl.includes('wikimedia.org') && !firestoreUrl.includes('wikipedia.org')) {
            // External URL - proxy it
            const proxiedUrl = getProxiedImageUrl(firestoreUrl, 400, 500, 'wsrv');
            setCurrentImageUrl(proxiedUrl);
            setImageSource('proxy');
            return;
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Firestore lookup failed for ${name}:`, error);
        }
      }
      
      // Strategy 4: Fallback to initials
      setCurrentImageUrl(null);
      setImageSource('fallback');
    };
    
    loadImage();
  }, [name, imageUrl]);
  
  // Generate a consistent color based on wrestler name (for gradient background)
  const getColorFromName = (wrestlerName) => {
    const colors = [
      'from-red-900 to-red-950',
      'from-blue-900 to-blue-950', 
      'from-purple-900 to-purple-950',
      'from-green-900 to-green-950',
      'from-amber-900 to-amber-950',
      'from-cyan-900 to-cyan-950',
      'from-pink-900 to-pink-950',
      'from-indigo-900 to-indigo-950',
    ];
    let hash = 0;
    for (let i = 0; i < wrestlerName.length; i++) {
      hash = wrestlerName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };
  
  // Final fallback - stylish initials with gradient
  if (!currentImageUrl || imageSource === 'fallback') {
    const gradientColor = getColorFromName(name);
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return (
      <div className={`bg-gradient-to-br ${gradientColor} flex items-center justify-center ${className} relative overflow-hidden`}>
        <User className="text-white/10 w-2/3 h-2/3 absolute" />
        <span className="relative z-10 font-black text-5xl text-white/90 drop-shadow-lg tracking-wider">
          {initials}
        </span>
      </div>
    );
  }
  
  const handleImageError = () => {
    retryCountRef.current += 1;
    
    if (retryCountRef.current > maxRetries) {
      setImageSource('fallback');
      return;
    }
    
    // Try alternative proxy service
    if (imageSource === 'proxy' && imageUrl) {
      const proxyType = currentImageUrl?.includes('wsrv.nl') ? 'images' : 'wsrv';
      const proxied = getProxiedImageUrl(imageUrl, 400, 500, proxyType);
      if (proxied !== currentImageUrl) {
        setCurrentImageUrl(proxied);
        return;
      }
    }
    
    // Give up and use fallback
    setImageSource('fallback');
  };
  
  return (
    <img 
      src={currentImageUrl} 
      alt={name} 
      className={`object-cover ${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`} 
      onError={handleImageError}
      onLoad={() => {
        setIsLoading(false);
        retryCountRef.current = 0; // Reset retry count on successful load
      }}
      referrerPolicy="no-referrer" 
      crossOrigin="anonymous"
      loading="lazy"
      decoding="async"
    />
  );
};

// Event Banner/Poster Component - handles loading event images with fallbacks
const EventBanner = ({ event, className = "w-full h-full object-cover", fallbackClassName }) => {
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    if (!event) return;
    
    setIsLoading(true);
    setHasError(false);
    
    const loadEventImage = async () => {
      try {
        const imageUrl = await getEventImage(event);
        setCurrentImageUrl(imageUrl);
      } catch (error) {
        console.log(`Failed to load event image for ${event.name}:`, error);
        setHasError(true);
        setCurrentImageUrl(`https://picsum.photos/seed/${event.id}/800/400`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEventImage();
  }, [event?.id, event?.name, event?.bannerUrl, event?.posterUrl]);
  
  const handleImageError = () => {
    setHasError(true);
    // Fallback to placeholder
    setCurrentImageUrl(`https://picsum.photos/seed/${event?.id}/800/400`);
  };
  
  if (!event) return null;
  
  return (
    <img 
      src={currentImageUrl || `https://picsum.photos/seed/${event.id}/800/400`}
      alt={`${event.name} poster`}
      className={className}
      onError={handleImageError}
      onLoad={() => setIsLoading(false)}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      loading="lazy"
    />
  );
};

// --- ADMIN PANEL COMPONENT ---

const AdminPanel = ({ events, promotions, db, appId, userProfile }) => {
  // Tab management (now only 3 tabs: events, analytics, users)
  const [adminTab, setAdminTab] = useState('events');
  
  // Existing event editing state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  
  // Modal/View state for Events tab
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showBulkWinnersModal, setShowBulkWinnersModal] = useState(false);
  
  // Event Creation state  
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    date: '',
    venue: '',
    promotionId: 'wwe',
    isPPV: true,
    posterUrl: '',
    bannerUrl: ''
  });
  const [newMatches, setNewMatches] = useState([]);
  
  // Bulk Winners state
  const [bulkEventId, setBulkEventId] = useState('');
  const [bulkWinnersText, setBulkWinnersText] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // User Management state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingUserPoints, setEditingUserPoints] = useState(0);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    displayName: '',
    isAdmin: false
  });
  const [creatingUser, setCreatingUser] = useState(false);
  
  const handleEditEvent = (event) => {
    setEditingEvent({...event});
    setSelectedEvent(event);
    setAdminTab('events');
  };
  
  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    
    try {
      const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', editingEvent.id);
      const updateData = {
        name: editingEvent.name,
        date: editingEvent.date,
        venue: editingEvent.venue,
        matches: editingEvent.matches,
        manuallyEdited: true, // Mark as manually edited to prevent scraper overwrites
        lastEditedBy: userProfile?.displayName || userProfile?.email || 'Admin',
        lastEditedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Add poster/banner URLs if provided
      if (editingEvent.posterUrl) {
        updateData.posterUrl = editingEvent.posterUrl;
      }
      if (editingEvent.bannerUrl) {
        updateData.bannerUrl = editingEvent.bannerUrl;
      }
      
      await updateDoc(eventRef, updateData);
      
      setSaveMessage('✅ Event saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      setEditingEvent(null);
      setSelectedEvent(null);
    } catch (error) {
      setSaveMessage(`❌ Error: ${error.message}`);
      setTimeout(() => setSaveMessage(''), 5000);
    }
  };
  
  const handleSetMatchWinner = (matchIndex, winner) => {
    if (!editingEvent) return;
    const updatedMatches = [...editingEvent.matches];
    updatedMatches[matchIndex] = {
      ...updatedMatches[matchIndex],
      winner: winner
    };
    setEditingEvent({
      ...editingEvent,
      matches: updatedMatches
    });
  };
  
  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId));
      setSaveMessage('✅ Event deleted');
      setTimeout(() => setSaveMessage(''), 3000);
      setSelectedEvent(null);
      setEditingEvent(null);
    } catch (error) {
      setSaveMessage(`❌ Error: ${error.message}`);
    }
  };
  
  // Event Creation Handlers
  const handleCreateEvent = async () => {
    if (!newEvent.name || !newEvent.date) {
      setSaveMessage('❌ Name and date are required');
      return;
    }
    
    try {
      const eventId = newEvent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId);
      
      await setDoc(eventRef, {
        id: eventId,
        name: newEvent.name,
        date: newEvent.date,
        venue: newEvent.venue || 'TBA',
        promotionId: newEvent.promotionId,
        promoId: newEvent.promotionId,
        promotionName: promotions.find(p => p.id === newEvent.promotionId)?.name || '',
        isPPV: newEvent.isPPV,
        posterUrl: newEvent.posterUrl || null,
        bannerUrl: newEvent.bannerUrl || null,
        matches: newMatches,
        manuallyEdited: true,
        createdBy: userProfile?.displayName || userProfile?.email || 'Admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setSaveMessage('✅ Event created successfully!');
      setTimeout(() => {
        setSaveMessage('');
        setCreatingEvent(false);
        setNewEvent({ name: '', date: '', venue: '', promotionId: 'wwe', isPPV: true, posterUrl: '', bannerUrl: '' });
        setNewMatches([]);
      }, 2000);
    } catch (error) {
      setSaveMessage(`❌ Error: ${error.message}`);
    }
  };
  
  const addMatchToNew = () => {
    setNewMatches([...newMatches, { p1: '', p2: '', type: 'Singles Match', title: '' }]);
  };
  
  const updateNewMatch = (index, field, value) => {
    const updated = [...newMatches];
    updated[index] = { ...updated[index], [field]: value };
    setNewMatches(updated);
  };
  
  const removeNewMatch = (index) => {
    setNewMatches(newMatches.filter((_, i) => i !== index));
  };
  
  // Bulk Winners Handlers
  const handleBulkWinners = async () => {
    if (!bulkEventId || !bulkWinnersText) {
      setSaveMessage('❌ Select event and provide winners');
      return;
    }
    
    setBulkProcessing(true);
    
    try {
      const event = events.find(e => e.id === bulkEventId);
      if (!event || !event.matches) {
        setSaveMessage('❌ Event not found or has no matches');
        setBulkProcessing(false);
        return;
      }
      
      // Parse CSV format: "Match 1, Winner Name" or "1, Winner Name"
      const lines = bulkWinnersText.trim().split('\n');
      const updatedMatches = [...event.matches];
      let updatedCount = 0;
      
      for (const line of lines) {
        const [matchNum, winner] = line.split(',').map(s => s.trim());
        const index = parseInt(matchNum) - 1;
        
        if (index >= 0 && index < updatedMatches.length && winner) {
          updatedMatches[index] = { ...updatedMatches[index], winner };
          updatedCount++;
        }
      }
      
      const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', bulkEventId);
      await updateDoc(eventRef, {
        matches: updatedMatches,
        manuallyEdited: true,
        lastEditedBy: userProfile?.displayName || userProfile?.email || 'Admin',
        lastEditedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setSaveMessage(`✅ Updated ${updatedCount} match winner(s)!`);
      setTimeout(() => {
        setSaveMessage('');
        setBulkWinnersText('');
      }, 3000);
    } catch (error) {
      setSaveMessage(`❌ Error: ${error.message}`);
    } finally {
      setBulkProcessing(false);
    }
  };
  
  // Analytics Handlers
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    
    try {
      // Get all users
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      const totalUsers = usersSnap.size;
      
      // Get predictions
      const predicRef = collection(db, 'artifacts', appId, 'public', 'predictions');
      const predicSnap = await getDocs(predicRef);
      const totalPredictions = predicSnap.size;
      
      // Calculate active users (with at least 1 prediction)
      const usersWithPreds = new Set();
      predicSnap.forEach(doc => {
        const userId = doc.id.split('-')[0];
        usersWithPreds.add(userId);
      });
      
      // Get event participation
      const eventParticipation = {};
      predicSnap.forEach(doc => {
        const data = doc.data();
        Object.keys(data || {}).forEach(eventId => {
          eventParticipation[eventId] = (eventParticipation[eventId] || 0) + 1;
        });
      });
      
      const topEvents = Object.entries(eventParticipation)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([eventId, count]) => {
          const event = events.find(e => e.id === eventId);
          return { name: event?.name || eventId, predictions: count };
        });
      
      setAnalyticsData({
        totalUsers,
        activeUsers: usersWithPreds.size,
        totalPredictions,
        avgPerUser: (totalPredictions / totalUsers).toFixed(1),
        topEvents
      });
    } catch (error) {
      console.error('Analytics error:', error);
      setSaveMessage(`❌ Error loading analytics: ${error.message}`);
    } finally {
      setAnalyticsLoading(false);
    }
  };
  
  // User Management Handlers
  const loadUsers = async () => {
    setUsersLoading(true);
    
    try {
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      
      const usersList = [];
      usersSnap.forEach(doc => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort by creation date (newest first)
      usersList.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error('Users error:', error);
      setSaveMessage(`❌ Error loading users: ${error.message}`);
    } finally {
      setUsersLoading(false);
    }
  };
  
  const handleMakeAdmin = async (userId) => {
    if (!confirm('Grant admin privileges to this user?')) return;
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        isAdmin: true,
        updatedAt: serverTimestamp()
      });
      setSaveMessage('✅ Admin privileges granted');
      loadUsers(); // Refresh
    } catch (error) {
      setSaveMessage(`❌ Error: ${error.message}`);
    }
  };
  
  const handleRevokeAdmin = async (userId) => {
    if (!confirm('Revoke admin privileges from this user?')) return;
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        isAdmin: false,
        updatedAt: serverTimestamp()
      });
      setSaveMessage('✅ Admin privileges revoked');
      loadUsers(); // Refresh
    } catch (error) {
      setSaveMessage(`❌ Error: ${error.message}`);
    }
  };
  
  const handleDeleteUser = async (userId, userEmail) => {
    if (!confirm(`⚠️ DELETE USER: ${userEmail}?\n\nThis will:\n• Delete their account\n• Delete all their predictions\n• Delete all their data\n\nThis action CANNOT be undone!`)) return;
    
    try {
      console.log(`🗑️ Starting deletion for user: ${userId}`);
      
      // Delete user document from /users collection
      try {
        await deleteDoc(doc(db, 'users', userId));
        console.log('✅ Deleted from /users collection');
      } catch (error) {
        console.error('⚠️ Error deleting from /users:', error);
      }
      
      // Delete user profile from public data
      try {
        const userProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', userId);
        await deleteDoc(userProfileRef);
        console.log('✅ Deleted user profile');
      } catch (error) {
        console.error('⚠️ Error deleting user profile:', error);
      }
      
      // Delete predictions (all sub-collections)
      try {
        const predictionsRef = collection(db, 'artifacts', appId, 'users', userId, 'predictions');
        const predictionsSnap = await getDocs(predictionsRef);
        console.log(`📊 Found ${predictionsSnap.size} predictions to delete`);
        const deletePromises = predictionsSnap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        console.log('✅ Deleted all predictions');
      } catch (error) {
        console.error('⚠️ Error deleting predictions:', error);
      }
      
      // Delete locked events
      try {
        const lockedEventsRef = collection(db, 'artifacts', appId, 'users', userId, 'lockedEvents');
        const lockedEventsSnap = await getDocs(lockedEventsRef);
        if (lockedEventsSnap.size > 0) {
          const deletePromises = lockedEventsSnap.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
          console.log('✅ Deleted locked events');
        }
      } catch (error) {
        console.error('⚠️ Error deleting locked events:', error);
      }
      
      setSaveMessage('✅ User deleted successfully');
      loadUsers(); // Refresh
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      setSaveMessage(`❌ Error deleting user: ${error.message}`);
    }
  };
  
  const handleClearPredictions = async (userId, userName) => {
    if (!confirm(`Clear ALL predictions for ${userName}?\n\nThis will:\n• Delete all their picks\n• Reset their score to 0\n• Keep their account active\n\nContinue?`)) return;
    
    try {
      // Delete all predictions
      const predictionsRef = collection(db, 'artifacts', appId, 'users', userId, 'predictions');
      const predictionsSnap = await getDocs(predictionsRef);
      const deletePromises = predictionsSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Reset score in user profile
      const userProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', userId);
      await updateDoc(userProfileRef, {
        score: 0,
        updatedAt: serverTimestamp()
      });
      
      setSaveMessage('✅ Predictions cleared successfully');
    } catch (error) {
      setSaveMessage(`❌ Error clearing predictions: ${error.message}`);
    }
  };
  
  const handleSaveUserPoints = async (userId) => {
    try {
      const userProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', userId);
      await updateDoc(userProfileRef, {
        score: parseInt(editingUserPoints) || 0,
        updatedAt: serverTimestamp()
      });
      
      setSaveMessage('✅ Points updated successfully');
      setEditingUserId(null);
      loadUsers(); // Refresh to show updated score
    } catch (error) {
      setSaveMessage(`❌ Error updating points: ${error.message}`);
    }
  };
  
  const handleCreateUser = async () => {
    if (!newUserData.email || !newUserData.password) {
      setSaveMessage('❌ Email and password are required');
      return;
    }
    
    if (newUserData.password.length < 6) {
      setSaveMessage('❌ Password must be at least 6 characters');
      return;
    }
    
    setCreatingUser(true);
    try {
      // Note: We need to create a secondary auth instance to avoid signing out the current admin
      // This is a limitation of Firebase Client SDK - ideally this would use Admin SDK via a Cloud Function
      
      // For now, create the user profile in Firestore with a "pending" flag
      // The user will complete signup themselves
      const userId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Create user profile in Firestore
      const userProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', userId);
      await setDoc(userProfileRef, {
        email: newUserData.email,
        displayName: newUserData.displayName || 'New User',
        score: 0,
        subscribedPromotions: ['wwe', 'aew', 'njpw'], // Default subscriptions
        createdAt: serverTimestamp(),
        pending: true, // Flag indicating user needs to complete signup
        tempPassword: newUserData.password, // Temporary - will be removed on actual signup
        isAdmin: newUserData.isAdmin
      });
      
      // Also create in /users collection for admin access
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        email: newUserData.email,
        displayName: newUserData.displayName || 'New User',
        isAdmin: newUserData.isAdmin,
        createdAt: serverTimestamp(),
        pending: true
      });
      
      setSaveMessage(`✅ User profile created! Email: ${newUserData.email}, Temp Password: ${newUserData.password}. User should sign up with these credentials.`);
      setShowCreateUserModal(false);
      setNewUserData({ email: '', password: '', displayName: '', isAdmin: false });
      loadUsers(); // Refresh user list
    } catch (error) {
      setSaveMessage(`❌ Error creating user: ${error.message}`);
    } finally {
      setCreatingUser(false);
    }
  };
  
  // Load data when tabs change
  useEffect(() => {
    if (adminTab === 'analytics' && !analyticsData) {
      loadAnalytics();
    }
    if (adminTab === 'users' && users.length === 0) {
      loadUsers();
    }
  }, [adminTab]);
  
  // Filter events by date
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const pastEvents = events.filter(e => new Date(e.date) < new Date()).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Filter users by search
  const filteredUsers = users.filter(u => 
    (u.displayName || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );
  
  return (
    <div className="p-6 pb-24 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white flex items-center gap-3 mb-2">
          <Shield className="text-red-500" size={32} />
          Admin Panel
        </h1>
        <p className="text-slate-400">Manage events, matches, users, and analytics</p>
      </div>
      
      {/* Admin Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setAdminTab('events')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
            adminTab === 'events' 
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/50' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          📅 Events
        </button>
        <button
          onClick={() => setAdminTab('analytics')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
            adminTab === 'analytics' 
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/50' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          📊 Analytics
        </button>
        <button
          onClick={() => setAdminTab('users')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
            adminTab === 'users' 
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/50' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          👥 Users
        </button>
      </div>
      
      {saveMessage && (
        <div className="mb-6 p-4 bg-slate-800 border border-slate-700 rounded-lg text-white">
          {saveMessage}
        </div>
      )}
      
      {/* ==================== EVENTS TAB ==================== */}
      {adminTab === 'events' && (
        <>
          {/* Action Buttons */}
          {!editingEvent && !showCreateEventModal && !showBulkWinnersModal && (
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setShowCreateEventModal(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-green-600/30 flex items-center justify-center gap-2"
              >
                <PlusCircle size={20} />
                Create New Event
              </button>
              <button
                onClick={() => setShowBulkWinnersModal(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                <Upload size={20} />
                Bulk Winners
              </button>
            </div>
          )}
          
          {/* Edit Event Form */}
          {editingEvent ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white">Edit Event</h2>
            <button
              onClick={() => { setEditingEvent(null); setSelectedEvent(null); }}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <XIcon className="text-white" size={20} />
            </button>
          </div>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Event Name</label>
              <input
                type="text"
                value={editingEvent.name}
                onChange={(e) => setEditingEvent({...editingEvent, name: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Date</label>
              <input
                type="text"
                value={editingEvent.date}
                onChange={(e) => setEditingEvent({...editingEvent, date: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                placeholder="Jan 4, 2026"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Venue</label>
              <input
                type="text"
                value={editingEvent.venue || ''}
                onChange={(e) => setEditingEvent({...editingEvent, venue: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                placeholder="Tokyo Dome, Tokyo, Japan"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Poster URL <span className="text-slate-500 font-normal text-xs">(optional)</span>
              </label>
              <input
                type="url"
                value={editingEvent.posterUrl || ''}
                onChange={(e) => setEditingEvent({...editingEvent, posterUrl: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
                placeholder="https://upload.wikimedia.org/..."
              />
              <p className="text-xs text-slate-500 mt-1">Event poster image (Wikipedia, official site, etc.)</p>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Banner URL <span className="text-slate-500 font-normal text-xs">(optional)</span>
              </label>
              <input
                type="url"
                value={editingEvent.bannerUrl || ''}
                onChange={(e) => setEditingEvent({...editingEvent, bannerUrl: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
                placeholder="https://..."
              />
              <p className="text-xs text-slate-500 mt-1">Wide banner/header image for the event</p>
            </div>
          </div>
          
          {editingEvent.matches && editingEvent.matches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-black text-white mb-4">Match Winners</h3>
              <div className="space-y-3">
                {editingEvent.matches.map((match, idx) => (
                  <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <div className="text-sm font-bold text-slate-400 mb-2">{match.title || match.type}</div>
                    <div className="text-white mb-3">{match.p1} vs {match.p2}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSetMatchWinner(idx, match.p1)}
                        className={`flex-1 px-4 py-2 rounded-lg font-bold transition-colors ${
                          match.winner === match.p1
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {match.p1}
                      </button>
                      <button
                        onClick={() => handleSetMatchWinner(idx, match.p2)}
                        className={`flex-1 px-4 py-2 rounded-lg font-bold transition-colors ${
                          match.winner === match.p2
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {match.p2}
                      </button>
                      {match.winner && (
                        <button
                          onClick={() => handleSetMatchWinner(idx, null)}
                          className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg font-bold hover:bg-red-600/30 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 mb-4">
            <p className="text-xs text-green-400 flex items-center gap-2">
              <Shield size={14} />
              <span>Saved changes will be protected from scraper overwrites</span>
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleSaveEvent}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Save size={20} />
              Save Changes
            </button>
            <button
              onClick={() => handleDeleteEvent(editingEvent.id)}
              className="px-6 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 size={20} />
              Delete
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white mb-4">Upcoming Events</h2>
            <div className="grid gap-4">
              {upcomingEvents.slice(0, 10).map(event => (
                <div
                  key={event.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{event.name}</h3>
                      <div className="text-sm text-slate-400 mt-1">
                        {event.date} • {event.venue || 'TBA'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {event.matches?.length || 0} matches
                        {event.matches?.some(m => m.winner) && 
                          <span className="ml-2 text-green-400">• Has Results</span>
                        }
                      </div>
                    </div>
                    <button
                      onClick={() => handleEditEvent(event)}
                      className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Edit className="text-white" size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-black text-white mb-4">Past Events</h2>
            <div className="grid gap-4">
              {pastEvents.slice(0, 10).map(event => (
                <div
                  key={event.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{event.name}</h3>
                        {event.manuallyEdited && (
                          <span className="px-2 py-0.5 text-xs font-semibold text-green-400 bg-green-900/30 border border-green-700 rounded">
                            🛡️ PROTECTED
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        {event.date} • {event.venue || 'TBA'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {event.matches?.length || 0} matches
                        {event.matches?.filter(m => m.winner).length > 0 && (
                          <span className="ml-2 text-green-400">
                            • {event.matches.filter(m => m.winner).length}/{event.matches.length} results
                          </span>
                        )}
                        {event.manuallyEdited && event.lastEditedBy && (
                          <span className="ml-2 text-slate-400">
                            • Edited by {event.lastEditedBy}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEditEvent(event)}
                      className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Edit className="text-white" size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Create Event Modal */}
          {showCreateEventModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-white">Create New Event</h2>
                  <button
                    onClick={() => {
                      setShowCreateEventModal(false);
                      setNewEvent({ name: '', date: '', venue: '', promotionId: 'wwe', isPPV: true, posterUrl: '', bannerUrl: '' });
                      setNewMatches([]);
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <XIcon className="text-white" size={20} />
                  </button>
                </div>
                
                {/* Event creation form will go here - keeping existing content */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Event Name *</label>
                    <input
                      type="text"
                      value={newEvent.name}
                      onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      placeholder="Royal Rumble 2026"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-2">Date *</label>
                      <input
                        type="text"
                        value={newEvent.date}
                        onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                        placeholder="Jan 25, 2026"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-2">Venue</label>
                      <input
                        type="text"
                        value={newEvent.venue}
                        onChange={(e) => setNewEvent({...newEvent, venue: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                        placeholder="Lucas Oil Stadium"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-2">Promotion</label>
                      <select
                        value={newEvent.promotionId}
                        onChange={(e) => setNewEvent({...newEvent, promotionId: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      >
                        {promotions.map(promo => (
                          <option key={promo.id} value={promo.id}>{promo.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-2">Event Type</label>
                      <select
                        value={newEvent.isPPV ? 'ppv' : 'weekly'}
                        onChange={(e) => setNewEvent({...newEvent, isPPV: e.target.value === 'ppv'})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      >
                        <option value="ppv">PPV/Premium</option>
                        <option value="weekly">Weekly Show</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Poster URL</label>
                    <input
                      type="url"
                      value={newEvent.posterUrl}
                      onChange={(e) => setNewEvent({...newEvent, posterUrl: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      placeholder="https://example.com/poster.jpg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Banner URL</label>
                    <input
                      type="url"
                      value={newEvent.bannerUrl}
                      onChange={(e) => setNewEvent({...newEvent, bannerUrl: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      placeholder="https://example.com/banner.jpg"
                    />
                  </div>
                </div>
                
                <button
                  onClick={async () => {
                    if (!newEvent.name || !newEvent.date) {
                      setSaveMessage('❌ Event name and date are required');
                      return;
                    }
                    
                    try {
                      const eventId = `${newEvent.promotionId}-${newEvent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().getTime()}`;
                      const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId);
                      
                      await setDoc(eventRef, {
                        id: eventId,
                        name: newEvent.name,
                        date: newEvent.date,
                        venue: newEvent.venue,
                        promotionId: newEvent.promotionId,
                        isPPV: newEvent.isPPV,
                        posterUrl: newEvent.posterUrl || '',
                        bannerUrl: newEvent.bannerUrl || '',
                        matches: [],
                        manuallyEdited: true,
                        createdBy: userProfile?.displayName || userProfile?.email || 'Admin',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                      });
                      
                      setSaveMessage('✅ Event created successfully!');
                      setShowCreateEventModal(false);
                      setNewEvent({ name: '', date: '', venue: '', promotionId: 'wwe', isPPV: true, posterUrl: '', bannerUrl: '' });
                    } catch (error) {
                      setSaveMessage(`❌ Error creating event: ${error.message}`);
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Create Event
                </button>
              </div>
            </div>
          )}
          
          {/* Bulk Winners Modal */}
          {showBulkWinnersModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-white">Bulk Assign Winners</h2>
                  <button
                    onClick={() => {
                      setShowBulkWinnersModal(false);
                      setBulkEventId('');
                      setBulkWinnersText('');
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <XIcon className="text-white" size={20} />
                  </button>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Select Event</label>
                    <select
                      value={bulkEventId}
                      onChange={(e) => setBulkEventId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="">Choose an event...</option>
                      {events.map(event => (
                        <option key={event.id} value={event.id}>
                          {event.name} - {event.date}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">
                      Winners (CSV Format)
                    </label>
                    <p className="text-xs text-slate-400 mb-2">
                      Format: Match Number, Winner Name (one per line)
                    </p>
                    <textarea
                      value={bulkWinnersText}
                      onChange={(e) => setBulkWinnersText(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono text-sm h-64"
                      placeholder="1, Roman Reigns&#10;2, Seth Rollins&#10;3, Cody Rhodes"
                    />
                  </div>
                </div>
                
                <button
                  onClick={async () => {
                    if (!bulkEventId || !bulkWinnersText) {
                      setSaveMessage('❌ Please select an event and enter winners');
                      return;
                    }
                    
                    setBulkProcessing(true);
                    try {
                      const event = events.find(e => e.id === bulkEventId);
                      if (!event) throw new Error('Event not found');
                      
                      const lines = bulkWinnersText.split('\n').filter(l => l.trim());
                      const updatedMatches = [...(event.matches || [])];
                      
                      lines.forEach(line => {
                        const [matchNumStr, winnerName] = line.split(',').map(s => s.trim());
                        const matchNum = parseInt(matchNumStr);
                        
                        if (matchNum > 0 && matchNum <= updatedMatches.length && winnerName) {
                          updatedMatches[matchNum - 1].winner = winnerName;
                        }
                      });
                      
                      const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', bulkEventId);
                      await updateDoc(eventRef, {
                        matches: updatedMatches,
                        manuallyEdited: true,
                        lastEditedBy: userProfile?.displayName || userProfile?.email || 'Admin',
                        lastEditedAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                      });
                      
                      setSaveMessage('✅ Winners assigned successfully!');
                      setShowBulkWinnersModal(false);
                      setBulkEventId('');
                      setBulkWinnersText('');
                    } catch (error) {
                      setSaveMessage(`❌ Error: ${error.message}`);
                    } finally {
                      setBulkProcessing(false);
                    }
                  }}
                  disabled={bulkProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload size={20} />
                  {bulkProcessing ? 'Processing...' : 'Assign Winners'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
        </>
      )}
      
      {/* ==================== ANALYTICS TAB ==================== */}
      {adminTab === 'analytics' && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-red-600" size={32} />
            </div>
          ) : analyticsData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <div className="text-slate-400 text-sm mb-1">Total Users</div>
                  <div className="text-3xl font-black text-white">{analyticsData.totalUsers}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <div className="text-slate-400 text-sm mb-1">Active Users</div>
                  <div className="text-3xl font-black text-green-400">{analyticsData.activeUsers}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {((analyticsData.activeUsers / analyticsData.totalUsers) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <div className="text-slate-400 text-sm mb-1">Total Predictions</div>
                  <div className="text-3xl font-black text-blue-400">{analyticsData.totalPredictions}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <div className="text-slate-400 text-sm mb-1">Avg Per User</div>
                  <div className="text-3xl font-black text-purple-400">{analyticsData.avgPerUser}</div>
                </div>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xl font-black text-white mb-4">Top Events by Predictions</h3>
                <div className="space-y-2">
                  {analyticsData.topEvents.map((event, idx) => (
                    <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-slate-600">{idx + 1}</span>
                        <span className="text-white font-bold">{event.name}</span>
                      </div>
                      <span className="text-red-500 font-black">{event.predictions}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <button
                onClick={loadAnalytics}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Refresh Analytics
              </button>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No analytics data loaded</p>
              <button
                onClick={loadAnalytics}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
              >
                Load Analytics
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Users Tab */}
      {adminTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white">User Management</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                >
                  <UserPlus size={18} />
                  Create User
                </button>
                <button
                  onClick={loadUsers}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
            
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white mb-6"
              placeholder="Search users by name or email..."
            />
            
            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-red-600" size={32} />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center text-slate-400 py-12">No users found</p>
            ) : (
              <div className="space-y-3">
                {filteredUsers.slice(0, 50).map(user => (
                  <div key={user.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-lg">{user.displayName || 'Anonymous'}</span>
                          {user.isAdmin && (
                            <span className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs font-bold rounded border border-red-700">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400">{user.email || 'No email'}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          ID: {user.id.substring(0, 16)}...
                        </div>
                      </div>
                      
                      {/* Points Display/Edit */}
                      <div className="text-right">
                        {editingUserId === user.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={editingUserPoints}
                              onChange={(e) => setEditingUserPoints(e.target.value)}
                              className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                              placeholder="0"
                            />
                            <button
                              onClick={() => handleSaveUserPoints(user.id)}
                              className="p-1.5 bg-green-600 hover:bg-green-700 rounded transition-colors"
                              title="Save"
                            >
                              <CheckCircle size={16} className="text-white" />
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                              title="Cancel"
                            >
                              <XCircle size={16} className="text-white" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingUserId(user.id);
                              setEditingUserPoints(user.score || 0);
                            }}
                            className="text-slate-400 hover:text-white transition-colors"
                            title="Edit Points"
                          >
                            <div className="text-xs text-slate-500">Points</div>
                            <div className="text-2xl font-black text-red-500">{user.score || 0}</div>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {!user.isAdmin ? (
                        <button
                          onClick={() => handleMakeAdmin(user.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          <Shield size={14} />
                          Make Admin
                        </button>
                      ) : user.id !== userProfile.uid && (
                        <button
                          onClick={() => handleRevokeAdmin(user.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          <XCircle size={14} />
                          Revoke Admin
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleClearPredictions(user.id, user.displayName || user.email)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        <FileText size={14} />
                        Clear Predictions
                      </button>
                      
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email || user.displayName)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                        Delete User
                      </button>
                    </div>
                  </div>
                ))}
                {filteredUsers.length > 50 && (
                  <p className="text-center text-slate-500 text-sm py-4">
                    Showing first 50 of {filteredUsers.length} users
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Create User Modal */}
          {showCreateUserModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-white">Create New User</h2>
                  <button
                    onClick={() => {
                      setShowCreateUserModal(false);
                      setNewUserData({ email: '', password: '', displayName: '', isAdmin: false });
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <XIcon className="text-white" size={20} />
                  </button>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Email *</label>
                    <input
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      placeholder="user@example.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Display Name</label>
                    <input
                      type="text"
                      value={newUserData.displayName}
                      onChange={(e) => setNewUserData({...newUserData, displayName: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      placeholder="John Doe"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Temporary Password *</label>
                    <input
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      placeholder="Min 6 characters"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      User will need to sign up with this email/password
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="newUserAdmin"
                      checked={newUserData.isAdmin}
                      onChange={(e) => setNewUserData({...newUserData, isAdmin: e.target.checked})}
                      className="w-4 h-4 bg-slate-800 border-slate-700 rounded"
                    />
                    <label htmlFor="newUserAdmin" className="text-sm text-slate-300">
                      Grant Admin Privileges
                    </label>
                  </div>
                </div>
                
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
                  <p className="text-xs text-yellow-400">
                    ⚠️ <strong>Note:</strong> Due to Firebase limitations, this creates a user profile only. 
                    The user must complete signup themselves using the email and password provided above.
                  </p>
                </div>
                
                <button
                  onClick={handleCreateUser}
                  disabled={creatingUser || !newUserData.email || !newUserData.password}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {creatingUser ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={20} />
                      Create User Profile
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- MAIN APPLICATION ---

export default function RingsidePickemFinal() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  // App State
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [viewState, setViewState] = useState('loading'); // loading, login, onboarding, dashboard
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // For onboarding submission
  const [lockedEvents, setLockedEvents] = useState({}); // Track which events have locked predictions
  const [isLockingEvent, setIsLockingEvent] = useState(false); // Loading state for lock operation
  
  // Account creation/login state
  const [authMode, setAuthMode] = useState('guest'); // 'guest', 'signin', 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // Account management state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [accountError, setAccountError] = useState(null);
  const [accountSuccess, setAccountSuccess] = useState(null);

  // Onboarding State
  const [onboardingPage, setOnboardingPage] = useState(1);
  const [tempName, setTempName] = useState('');
  const [tempSubs, setTempSubs] = useState(['wwe', 'aew', 'njpw']);

  // Data State
  const [leaderboardScope, setLeaderboardScope] = useState('global');
  const [leaderboard, setLeaderboard] = useState([]);
  // CRITICAL: Store predictions keyed by user ID to prevent cross-contamination
  // Structure: { [userId]: { [eventId]: { [matchId]: prediction } } }
  const [predictionsByUser, setPredictionsByUser] = useState({});
  const [eventResults, setEventResults] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState(null);
  const [scrapedEvents, setScrapedEvents] = useState([]); // Events from Firestore scraper
  const [promotionsCache, setPromotionsCache] = useState({}); // Cache for promotion logos
  const [communitySentiment, setCommunitySentiment] = useState({}); // { eventId: { matchId: { p1: 65, p2: 35 } } }
  const [selectedMethod, setSelectedMethod] = useState({}); // { eventId-matchId: 'pinfall' }
  const [predictionsUserId, setPredictionsUserId] = useState(null); // Track which user's predictions we're showing
  const [eventTypeFilter, setEventTypeFilter] = useState('ppv'); // 'ppv', 'weekly', or 'past'
  const [hideEmptyEvents, setHideEmptyEvents] = useState(false); // Hide events with no match cards
  const [customInputText, setCustomInputText] = useState({}); // Track custom input text for rumble matches: { matchId: string }
  
  // Use ref to track current user ID - this won't cause re-renders and is always current
  const currentUserIdRef = useRef(null);
  
  // Track previous user ID to detect changes
  const previousUserIdRef = useRef(null);
  
  // Helper to get current user's predictions
  // CRITICAL: Use currentUserIdRef to ensure we always get the correct user's predictions
  // This prevents stale user state from causing cross-contamination
  const getCurrentUserPredictions = () => {
    const currentUserId = currentUserIdRef.current || user?.uid;
    if (!currentUserId) return {};
    return predictionsByUser[currentUserId] || {};
  };
  
  // Helper to set current user's predictions
  // CRITICAL: Use currentUserIdRef to ensure we always set for the correct user
  // This prevents stale user state from causing cross-contamination
  const setCurrentUserPredictions = (newPredictions) => {
    const currentUserId = currentUserIdRef.current || user?.uid;
    if (!currentUserId) {
      console.error('🔒 Cannot set predictions - no current user ID');
      return;
    }
    setPredictionsByUser(prev => {
      // Final safety check - verify the user ID matches
      if (currentUserIdRef.current !== currentUserId) {
        console.error('🔒 CRITICAL: User ID mismatch in setCurrentUserPredictions!', {
          refUserId: currentUserIdRef.current,
          expectedUserId: currentUserId
        });
        return prev; // Don't update if user changed
      }
      return {
        ...prev,
        [currentUserId]: newPredictions
      };
    });
  };
  
  // Clear ALL user data when user ID changes - MUST happen first
  useEffect(() => {
    if (user?.uid !== previousUserIdRef.current) {
      const previousUserId = previousUserIdRef.current;
      const newUserId = user?.uid;
      
      // CRITICAL: Clear ALL predictionsByUser when user changes to prevent cross-contamination
      // This ensures no data from the previous user can leak to the new user
      setPredictionsByUser(prev => {
        return {}; // Complete reset
      });
      
      setCommunitySentiment({});
      setSelectedMethod({});
      setPredictionsUserId(null);
      currentUserIdRef.current = null; // Also clear the ref
      previousUserIdRef.current = newUserId || null;
    }
  }, [user?.uid]);

  // --- AUTH & INIT ---
  useEffect(() => {
    // Skip auth listener if Firebase failed to initialize
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Clear all user data when auth state changes
      currentUserIdRef.current = null;
      // CRITICAL: Clear predictionsByUser on auth change to prevent cross-contamination
      setPredictionsByUser({});
      setUserProfile(null);
      setCommunitySentiment({});
      setSelectedMethod({});
      setPredictionsUserId(null);
      
      setUser(currentUser);
      
      if (currentUser) {
        currentUserIdRef.current = currentUser.uid;
        setUserId(currentUser.uid);
        setIsConnected(true);
        try {
          const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUser.uid);
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            if (!data.subscriptions) data.subscriptions = [];
            setUserProfile(data);
            setViewState('dashboard');
          } else {
            setViewState('onboarding');
            setOnboardingPage(1); 
            // Pre-fill tempName if displayName was provided during signup or from Google
            if (displayName.trim()) {
              setTempName(displayName.trim());
            } else if (currentUser.displayName) {
              setTempName(currentUser.displayName);
            }
          }
        } catch (e) {
          console.error("Profile check error:", e);
          setViewState('onboarding'); 
        }
      } else {
        setViewState('login');
        setUserId(null);
        setIsConnected(false);
      }
      setAuthLoading(false);
      setIsLoggingIn(false);
    });
    return () => unsubscribe();
  }, []);

  // --- PROMOTIONS CACHE ---  
  // Fetch all promotions once at startup to avoid repeated queries
  useEffect(() => {
    if (!db || !appId) return;
    
    const fetchPromotions = async () => {
      try {
        const promotionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'promotions');
        const promotionsSnap = await getDocs(promotionsRef);
        const cache = {};
        promotionsSnap.forEach(doc => {
          cache[doc.id] = doc.data();
        });
        setPromotionsCache(cache);
        console.log(`✅ Loaded ${Object.keys(cache).length} promotions into cache`);
      } catch (error) {
        console.error('Error fetching promotions:', error);
      }
    };
    
    fetchPromotions();
  }, [db, appId]);

  // --- DATA LISTENER ---
  useEffect(() => {
    if (viewState !== 'dashboard' || !user || !user.uid) {
      // Clear predictions when not in dashboard or no user
      setCommunitySentiment({});
      setSelectedMethod({});
      setPredictionsUserId(null);
      return;
    }

    // CRITICAL: Don't clear predictionsByUser - it's keyed by user ID
    // Just ensure we're tracking the correct user
    setCommunitySentiment({});
    setSelectedMethod({});
    setPredictionsUserId(null);

    const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), (snap) => {
        if(snap.exists()) {
           const data = snap.data();
           // CRITICAL: Defensive coding against undefined arrays
           if (!data.subscriptions) data.subscriptions = []; 
           setUserProfile(data);
        }
    });

    // Set up predictions listener for current user
    const currentUserId = user.uid;
    
    // CRITICAL: Use a ref to track this specific listener's user ID
    // This prevents race conditions where an old listener fires after user change
    const listenerUserIdRef = { current: currentUserId };
    currentUserIdRef.current = currentUserId;
    
    // Use a flag to track if this listener is still valid
    let isListenerValid = true;
    
    const predictionsPath = `artifacts/${appId}/users/${currentUserId}/predictions`;
    
    const unsubPreds = onSnapshot(
      collection(db, 'artifacts', appId, 'users', currentUserId, 'predictions'), 
      (snap) => {
        // CRITICAL: Multiple checks to prevent stale predictions
        // 1. Check if listener is still valid
        if (!isListenerValid) {
          return;
        }
        
        // 2. Check if this listener's user ID still matches the current user
        if (listenerUserIdRef.current !== currentUserId) {
          isListenerValid = false;
          return;
        }
        
        // 3. Check if the global current user ref has changed
        if (currentUserIdRef.current !== currentUserId) {
          isListenerValid = false;
          return;
        }
        
        // CRITICAL: Don't use user object from closure - it might be stale
        // Only use currentUserId which was captured when listener was created
        
        // CRITICAL: Verify the listener path matches what we expect
        // Double-check that currentUserId hasn't changed
        const actualCurrentUserId = currentUserIdRef.current;
        if (actualCurrentUserId !== currentUserId) {
          console.error('🔒 CRITICAL: User ID mismatch in listener!', {
            listenerUserId: currentUserId,
            actualCurrentUserId: actualCurrentUserId,
            timestamp: new Date().toISOString()
          });
          isListenerValid = false;
          return;
        }
        
        // All checks passed - this is a valid update for the current user
        // CRITICAL: Verify each document belongs to this user by checking the path
        // Firestore collection listeners should only return docs from the specified collection,
        // but we'll add extra validation just in case
        const preds = {}; 
        snap.forEach(doc => {
          // Verify the document path contains the correct user ID
          const docPath = doc.ref.path;
          if (!docPath.includes(`/users/${currentUserId}/predictions/`)) {
            console.error('🔒 CRITICAL: Document path does not match expected user!', {
              docPath,
              expectedUserId: currentUserId,
              docId: doc.id
            });
            return; // Skip this document
          }
          preds[doc.id] = doc.data();
        });
        
        // CRITICAL: Use functional update to ensure we only set if user hasn't changed
        setPredictionsUserId((prevUserId) => {
          // Double-check that we're still for the same user
          if (prevUserId !== null && prevUserId !== currentUserId) {
            console.error('🔒 CRITICAL: User changed during prediction load!', {
              prevUserId,
              currentUserId,
              globalRef: currentUserIdRef.current
            });
            return null; // Don't update if user changed
          }
          return currentUserId;
        });
        
        if (Object.keys(preds).length === 0) {
          // Set empty predictions for this user in the keyed structure
          setPredictionsByUser(prev => {
            // Final safety check
            if (currentUserIdRef.current !== currentUserId) {
              console.error('🔒 CRITICAL: User changed during empty prediction set!');
              return prev;
            }
            return {
              ...prev,
              [currentUserId]: {}
            };
          });
        } else {
          // Note: predictionsByUser might be empty here because we're reading it before the state update
          // This is expected - the state will be updated in the setPredictionsByUser call below
          // CRITICAL: Store predictions keyed by user ID - this prevents cross-contamination
          setPredictionsByUser(prev => {
            // Final safety check - only update if user hasn't changed
            if (currentUserIdRef.current !== currentUserId) {
              console.error('🔒 CRITICAL: User changed during prediction set! Not updating.', {
                globalRef: currentUserIdRef.current,
                expectedUserId: currentUserId
              });
              return prev; // Return previous state, don't update
            }
            
            // CRITICAL: Final validation - ensure we're not mixing users
            const previousUserKeys = Object.keys(prev);
            if (previousUserKeys.length > 0 && !previousUserKeys.includes(currentUserId)) {
              console.error('🔒 CRITICAL: Attempting to store predictions while other users exist in state!', {
                currentUserId,
                previousUserKeys,
                eventCount: Object.keys(preds).length
              });
              // Clear all other users' predictions before storing this user's
              return {
                [currentUserId]: preds
              };
            }
            
            // Store predictions under the user's ID
            return {
              ...prev,
              [currentUserId]: preds
            };
          });
        }
      },
      (error) => {
        console.error('Error listening to predictions:', error);
        if (isListenerValid && listenerUserIdRef.current === currentUserId) {
          setPredictionsByUser({});
          setPredictionsUserId(null);
        }
      }
    );
    
    const cleanupPredictions = () => {
      // Invalidate listener immediately
      isListenerValid = false;
      listenerUserIdRef.current = null;
      // Unsubscribe from Firestore
      unsubPreds();
      // CRITICAL: Clear predictionsByUser for this specific user to prevent cross-contamination
      setPredictionsByUser(prev => {
        const updated = { ...prev };
        delete updated[currentUserId];
        return updated;
      });
      setPredictionsUserId(null);
    };
    
    // FIXED: Use 6 segment path for document listener: artifacts/appId/public/data/scores/global
    const unsubResults = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'scores', 'global'), (snap) => {
       if(snap.exists()) setEventResults(snap.data());
    });

    const lbQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), orderBy('totalPoints', 'desc'), limit(50));
    const unsubLb = onSnapshot(lbQuery, (snap) => {
      const lb = [];
      snap.forEach(d => lb.push({
        id: d.id, 
        ...d.data(),
        country: d.data().country || 'USA',
        region: d.data().region || 'NA' 
      }));
      setLeaderboard(lb);
    });
    
    // Listen to locked events for current user
    const unsubLockedEvents = onSnapshot(
      collection(db, 'artifacts', appId, 'users', currentUserId, 'lockedEvents'),
      (snap) => {
        const locked = {};
        snap.forEach(doc => {
          const data = doc.data();
          if (data.locked) {
            locked[data.eventId] = true;
          }
        });
        setLockedEvents(prev => ({
          ...prev,
          ...locked
        }));
      },
      (error) => {
        console.error('Error listening to locked events:', error);
      }
    );

    // Listen to events from Firestore (scraped data)
    // Increased limit to capture all events (no longer limited to 50)
    const eventsQuery = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'events'),
      orderBy('date', 'desc'),
      limit(150)
    );
    const unsubEvents = onSnapshot(eventsQuery, (snap) => {
      const events = [];
      snap.forEach(d => {
        const data = d.data();
        
        // Get promotion logo from cache (FAST - no network call!)
        const promotionLogoUrl = data.promotionId && promotionsCache[data.promotionId] 
          ? promotionsCache[data.promotionId].logoUrl 
          : null;
        
        // Map Firestore data structure to app's expected structure
        events.push({
          id: d.id,
          promoId: data.promotionId === '1' ? 'wwe' : 
                   data.promotionId === '2287' ? 'aew' :
                   data.promotionId === '7' ? 'njpw' :
                   data.promotionId === '5' ? 'tna' :
                   data.promotionId === '122' ? 'roh' : data.promotionId,
          name: data.name,
          date: data.date,
          venue: data.venue || data.location,
          matches: data.matches || [],
          bannerUrl: data.bannerUrl,
          posterUrl: data.posterUrl,
          promotionLogoUrl: promotionLogoUrl,
          // Keep original data for reference
          promotionId: data.promotionId,
          promotionName: data.promotionName
        });
      });
      setScrapedEvents(events);
    });

    return () => {
      // CRITICAL: Clean up in proper order to prevent race conditions
      // 1. Invalidate and unsubscribe from predictions first (most important)
      cleanupPredictions();
      // 2. Then clean up other listeners
      unsubProfile(); 
      unsubResults(); 
      unsubLb(); 
      unsubEvents();
      unsubLockedEvents();
      // 3. Clear all state as final step (except predictionsByUser - it's keyed by user ID)
      setCommunitySentiment({});
      setSelectedMethod({});
      setPredictionsUserId(null);
    };
  }, [viewState, user?.uid]); // CRITICAL: Re-run when user changes to prevent stale data
  
  // Additional safety: Clear predictionsUserId if user changes while in dashboard
  useEffect(() => {
    if (viewState === 'dashboard' && user?.uid && predictionsUserId !== null && predictionsUserId !== user.uid) {
      // Don't clear predictionsByUser - it's keyed by user ID
      setPredictionsUserId(null);
    }
  }, [user?.uid, predictionsUserId, viewState]);

  // Calculate community sentiment when event is selected
  useEffect(() => {
    if (selectedEvent?.id && viewState === 'dashboard') {
      calculateCommunitySentiment(selectedEvent.id);
    }
    // Note: calculateCommunitySentiment is not in deps as it's stable and uses current state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent?.id, viewState]);

  // --- HANDLERS ---

  const handleGuestLogin = async () => {
      // Rate limiting check
      if (!authRateLimiter.isAllowed('guest-login')) {
        const waitTime = Math.ceil(authRateLimiter.getTimeUntilNext('guest-login') / 1000);
        setLoginError(`Too many login attempts. Please wait ${waitTime} seconds.`);
        return;
      }
      
      setIsLoggingIn(true);
      setLoginError(null);
      try {
          // eslint-disable-next-line no-undef
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
             // eslint-disable-next-line no-undef
             await signInWithCustomToken(auth, __initial_auth_token);
          } else {
             await signInAnonymously(auth);
          }
      } catch (error) {
          console.error("Firebase auth error:", error);
          const errorMessage = error.code === 'auth/configuration-not-found' || 
                              error.message?.includes('API key') ||
                              firebaseConfig.apiKey?.includes('...') ||
                              firebaseConfig.appId === "..."
            ? "Firebase not configured. Please set up your .env file with Firebase credentials. See FIREBASE_SETUP.md"
            : error.message || "Connection failed. Please try again.";
          setLoginError(errorMessage);
      } finally {
          setIsLoggingIn(false);
      }
  };

  const handleEmailSignUp = async () => {
    // Rate limiting check
    if (!authRateLimiter.isAllowed('email-signup')) {
      const waitTime = Math.ceil(authRateLimiter.getTimeUntilNext('email-signup') / 1000);
      setLoginError(`Too many signup attempts. Please wait ${waitTime} seconds.`);
      return;
    }
    
    // Input validation
    if (!email.trim() || !password.trim()) {
      setLoginError('Please fill in email and password');
      return;
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
      setLoginError('Please enter a valid email address');
      return;
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setLoginError(passwordValidation.errors[0]);
      return;
    }
    
    if (password !== confirmPassword) {
      setLoginError('Passwords do not match');
      return;
    }
    
    // Sanitize email
    const sanitizedEmail = sanitizeString(email.trim().toLowerCase());

    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
      // Don't create profile here - let the auth listener detect no profile and show onboarding
      // The user will go through onboarding flow where they can set their display name
      // The auth state listener will automatically show onboarding if no profile exists
    } catch (error) {
      console.error("Sign up error:", error);
      let errorMessage = "Failed to create account. ";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Email already in use. Please sign in instead.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password is too weak. Please use a stronger password.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address.";
      } else {
        errorMessage += error.message || "Please try again.";
      }
      setLoginError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailSignIn = async () => {
    // Rate limiting check
    if (!authRateLimiter.isAllowed('email-signin')) {
      const waitTime = Math.ceil(authRateLimiter.getTimeUntilNext('email-signin') / 1000);
      setLoginError(`Too many login attempts. Please wait ${waitTime} seconds.`);
      return;
    }
    
    // Input validation
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter email and password');
      return;
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
      setLoginError('Please enter a valid email address');
      return;
    }
    
    // Sanitize email
    const sanitizedEmail = sanitizeString(email.trim().toLowerCase());

    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, sanitizedEmail, password);
      // User profile will be loaded by the auth state listener
    } catch (error) {
      console.error("Sign in error:", error);
      let errorMessage = "Failed to sign in. ";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email. Please sign up first.";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else {
        errorMessage += error.message || "Please try again.";
      }
      setLoginError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setLoginError('Please enter your email address');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setLoginError('Password reset email sent! Check your inbox.');
    } catch (error) {
      console.error("Password reset error:", error);
      setLoginError(error.message || "Failed to send reset email.");
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    
    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setIsLoggingIn(false);
      setLoginError("Sign-in is taking longer than expected. Please try again.");
    }, 30000); // 30 second timeout
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      clearTimeout(loadingTimeout);
      
      const user = result.user;
      
      if (!user) {
        throw new Error("No user returned from Google sign-in");
      }
      
      // Don't create profile here - let the auth listener detect no profile and show onboarding
      // The auth state listener will automatically show onboarding if no profile exists
      // If user has displayName from Google, it will be pre-filled in onboarding
      
      // The auth state listener will handle navigation
      // Don't clear loading here - let onAuthStateChanged handle it
      // This ensures the UI updates properly when auth state changes
      
    } catch (error) {
      clearTimeout(loadingTimeout);
      console.error("Google sign in error:", error);
      setIsLoggingIn(false);
      
      let errorMessage = "Failed to sign in with Google. ";
      if (error.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        errorMessage = `This domain (${currentDomain}) is not authorized. Please add it to authorized domains in Firebase Console: Authentication > Settings > Authorized domains. For local development, add 'localhost'.`;
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Sign-in popup was closed. Please try again.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "Popup was blocked. Please allow popups for this site.";
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = "An account already exists with this email. Please sign in with your existing method.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Sign-in was cancelled. Please try again.";
      } else {
        errorMessage += error.message || "Please try again.";
      }
      setLoginError(errorMessage);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setAccountError('Please fill in both password fields');
      return;
    }
    if (newPassword.length < 6) {
      setAccountError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAccountError('Passwords do not match');
      return;
    }

    setAccountError(null);
    setAccountSuccess(null);
    try {
      if (user) {
        await updatePassword(user, newPassword);
        setAccountSuccess('Password updated successfully!');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (error) {
      console.error("Change password error:", error);
      let errorMessage = "Failed to update password. ";
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = "Please sign out and sign in again before changing your password.";
      } else {
        errorMessage += error.message || "Please try again.";
      }
      setAccountError(errorMessage);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      setAccountError('Please enter a new email address');
      return;
    }
    if (newEmail === user?.email) {
      setAccountError('This is already your current email');
      return;
    }

    setAccountError(null);
    setAccountSuccess(null);
    try {
      if (user) {
        await updateEmail(user, newEmail);
        // Update email in Firestore profile
        await updateDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid),
          { email: newEmail.trim() }
        );
        setAccountSuccess('Email updated successfully!');
        setNewEmail('');
      }
    } catch (error) {
      console.error("Change email error:", error);
      let errorMessage = "Failed to update email. ";
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = "Please sign out and sign in again before changing your email.";
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already in use by another account.";
      } else {
        errorMessage += error.message || "Please try again.";
      }
      setAccountError(errorMessage);
    }
  };

  const handleUpdateDisplayName = async () => {
    if (!displayName.trim()) {
      setAccountError('Please enter a display name');
      return;
    }

    setAccountError(null);
    setAccountSuccess(null);
    try {
      if (user) {
        await updateProfile(user, { displayName: displayName.trim() });
        // Update display name in Firestore profile
        await updateDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid),
          { displayName: displayName.trim() }
        );
        setAccountSuccess('Display name updated successfully!');
      }
    } catch (error) {
      console.error("Update display name error:", error);
      setAccountError(error.message || "Failed to update display name.");
      }
  };

  const handleLogout = async () => {
      await signOut(auth);
      setUserProfile(null);
      // Clear all user-specific data on logout
      // Don't clear predictionsByUser - it's keyed by user ID
      setCommunitySentiment({});
      setSelectedMethod({});
  };

  const completeOnboarding = async () => {
    if (!tempName.trim() || isSubmitting) return;
    if (!user) return;
    
    // Validate display name
    const nameValidation = validateDisplayName(tempName);
    if (!nameValidation.isValid) {
      setLoginError(nameValidation.errors[0]);
      return;
    }

    // Sanitize display name
    const sanitizedName = sanitizeString(tempName.trim());
    
    setIsSubmitting(true);

    const localProfile = {
      displayName: sanitizedName,
      subscriptions: tempSubs || [], // Safe default
      totalPoints: 0,
      predictionsCorrect: 0,
      predictionsTotal: 0,
      joinedAt: new Date().toISOString(),
      country: 'USA',
      region: 'NA'
    };

    const dbProfile = {
      ...localProfile,
      joinedAt: serverTimestamp()
    };
    
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), dbProfile);
        setUserProfile(localProfile);
        setViewState('dashboard');
    } catch (error) {
        console.error("Save error", error);
        const errorMsg = error.code === 'permission-denied' 
          ? "Firestore permission denied. Please check security rules in Firebase Console."
          : error.message || "Failed to save profile.";
        setLoginError(errorMsg);
        alert(`Error: ${errorMsg}\n\nCheck browser console for details.`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const makePrediction = (eventId, matchId, winner, method = null) => {
    if (!user || !user.uid) {
      console.error('❌ Cannot make prediction: no user logged in');
      return;
    }
    
    // FIXED: Normalize matchId to string for consistency
    const normalizedMatchId = matchId.toString();
    
    // CRITICAL: Multiple validation checks to prevent saving predictions for wrong user
    // 1. Check predictionsUserId matches current user
    if (predictionsUserId !== null && predictionsUserId !== user.uid) {
      console.error('❌ BLOCKING prediction save - predictionsUserId does not match current user!', {
        predictionsUserId,
        currentUserId: user.uid
      });
      return;
    }
    
    // 2. Check currentUserIdRef matches (extra safety)
    if (currentUserIdRef.current !== user.uid) {
      console.error('❌ BLOCKING prediction save - currentUserIdRef does not match current user!', {
        refUserId: currentUserIdRef.current,
        currentUserId: user.uid
      });
      return;
    }
    
    // 3. Final check - verify predictionsUserId is set (means listener is active for this user)
    // Note: predictionsUserId may be null initially, which is acceptable
    
    // CRITICAL: Get current user's predictions from keyed structure
    // Use user.uid directly (it's fresh from the function parameter validation)
    const currentUserPreds = predictionsByUser[user.uid] || {};
    const currentPreds = currentUserPreds[eventId] || {};
    const newPreds = { 
      ...currentPreds, 
      [normalizedMatchId]: method ? { winner, method } : winner
    };
    
    // CRITICAL: Update local state using user-keyed structure
    setCurrentUserPredictions({
      ...currentUserPreds,
      [eventId]: newPreds
    });
    
    // CRITICAL: Always use user.uid from the user object, never from state
    const predictionPath = `artifacts/${appId}/users/${user.uid}/predictions/${eventId}`;
    
    // CRITICAL: Don't save __ownerId or __timestamp to Firestore - they're only for in-memory state
    // newPreds only contains the actual prediction data, so it's safe to save
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'predictions', eventId), newPreds, { merge: true })
      .then(() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ PREDICTION SAVED SUCCESSFULLY:', {
            userId: user.uid,
            eventId,
            matchId: normalizedMatchId
          });
        }
        setTimeout(() => calculateCommunitySentiment(eventId), 1000);
      })
      .catch((error) => {
        console.error('❌ Error saving prediction:', error);
        // On error, revert the optimistic update
        setPredictionsByUser(prev => {
          if (!prev[user.uid]) return prev;
          const reverted = { ...prev };
          if (reverted[user.uid][eventId]) {
            const eventPreds = { ...reverted[user.uid][eventId] };
            delete eventPreds[normalizedMatchId];
            reverted[user.uid] = {
              ...reverted[user.uid],
              [eventId]: eventPreds
            };
          }
          return reverted;
        });
      });
  };

  // Calculate community sentiment (pick percentages) for an event
  // Combines real user picks with simulated community data for a lively feel
  // NOTE: This function can only access the current user's predictions due to Firestore security rules
  // For true community sentiment, we'd need a server-side function or public aggregation
  const calculateCommunitySentiment = async (eventId) => {
    if (!eventId || !user?.uid) return;
    
    // Get event data for match info
    const event = scrapedEvents.find(e => e.id === eventId) || 
                  INITIAL_EVENTS.find(e => e.id === eventId);
    
    if (!event) return;
    
    try {
      // CRITICAL: Only access current user's predictions to avoid permissions errors
      // For now, we'll use simulated data since we can't read other users' predictions
      // In the future, this could be moved to a server-side function or use a public aggregation collection
      
      // Get current user's predictions only
      const currentUserPreds = getCurrentUserPredictions();
      const userPreds = currentUserPreds[eventId] || {};
      
      const matchCounts = {};
      
      // Count predictions from current user only
      Object.keys(userPreds).forEach(matchId => {
        const pred = userPreds[matchId];
        const winner = typeof pred === 'string' ? pred : (pred?.winner || pred);
        
        if (!matchCounts[matchId]) {
          matchCounts[matchId] = { p1: 0, p2: 0 };
        }
        
        const match = event.matches.find(m => m.id.toString() === matchId.toString());
        if (match) {
          if (winner === match.p1) matchCounts[matchId].p1++;
          else if (winner === match.p2) matchCounts[matchId].p2++;
        }
      });
      
      // For now, we'll use simulated data since we can only see current user's predictions
      // This is a limitation of client-side Firestore security rules
      
      // Build sentiment for each match - use simulated data for community feel
      const sentiment = {};
      event.matches.forEach(match => {
        const matchId = match.id.toString();
        const realCounts = matchCounts[matchId];
        const realTotal = realCounts ? (realCounts.p1 + realCounts.p2) : 0;
        
        // Since we can only see current user's predictions, always simulate community data
        // In the future, this could be moved to a server-side function or use a public aggregation collection
        const simulatedP1 = Math.floor(Math.random() * 30) + 35; // 35-65%
        const simulatedP2 = 100 - simulatedP1;
        
        // Always use simulated data since we can't read other users' predictions
        // In the future, this could be moved to a server-side function or use a public aggregation collection
        sentiment[matchId] = {
          p1: simulatedP1,
          p2: simulatedP2,
          total: 100,
          simulated: true
        };
      });
      
      setCommunitySentiment(prev => ({
        ...prev,
        [eventId]: sentiment
      }));
    } catch (error) {
      console.error("Error calculating community sentiment:", error);
      // On error, fall back to pure simulation
      const sentiment = {};
      event.matches.forEach(match => {
        sentiment[match.id.toString()] = generateSimulatedSentiment(match, eventId);
      });
      setCommunitySentiment(prev => ({
        ...prev,
        [eventId]: sentiment
      }));
    }
  };

  const simulateEventResult = (event) => {
    try {
      console.log('🎲 Simulating event:', event.name);
      console.log('📋 Matches to simulate:', event.matches);
      
      if (!event.matches || event.matches.length === 0) {
        console.warn('⚠️ No matches found in event');
        alert('Cannot simulate: This event has no match card yet.');
        return;
      }
      
      const results = {};
      // FIXED: Ensure consistent string keys for match IDs
      event.matches.forEach(m => { 
        const matchId = m.id.toString();
        
        // Handle different match structures
        let winner;
        if (m.p1 && m.p2) {
          // Standard 1v1 or tag match
          winner = Math.random() > 0.5 ? m.p1 : m.p2;
        } else if (m.participants && m.participants.length > 0) {
          // Multi-man match with participants array
          const randomIndex = Math.floor(Math.random() * m.participants.length);
          winner = m.participants[randomIndex].name || m.participants[randomIndex];
        } else {
          console.warn('⚠️ Match has no valid participants:', m);
          winner = 'Unknown';
        }
        
        results[matchId] = winner;
        console.log(`  Match ${matchId}: ${winner} wins`);
      });
      
      setEventResults(prev => ({ ...prev, [event.id]: results }));
      console.log('✅ Results set in state:', results);
      
      if(user) {
        // FIXED: Use 6 segment path for document writing: artifacts/appId/public/data/scores/global
        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'scores', 'global'), { [event.id]: results }, { merge: true })
          .then(() => console.log('✅ Results saved to Firestore'))
          .catch(err => console.error('❌ Error saving results:', err));
        
        let correctCount = 0;
        const currentUserPreds = getCurrentUserPredictions();
        const myPreds = currentUserPreds[event.id] || {};
        event.matches.forEach(m => { 
          // FIXED: Use string key consistently
          const matchId = m.id.toString();
          const pred = myPreds[matchId];
          // Handle both old format (string) and new format (object)
          const predictedWinner = typeof pred === 'string' ? pred : (pred?.winner || pred);
          const actualWinner = results[matchId];
          
          // Use fuzzy matching for wrestler names (handles "Cody" vs "Cody Rhodes")
          if (predictedWinner && actualWinner && wrestlerNamesMatch(predictedWinner, actualWinner)) {
            correctCount++;
          }
        });
        
        console.log(`📊 Correct predictions: ${correctCount}/${event.matches.length}`);
        
        setUserProfile(prev => ({
            ...prev,
            totalPoints: (prev.totalPoints || 0) + (correctCount * 10),
            predictionsCorrect: (prev.predictionsCorrect || 0) + correctCount,
            predictionsTotal: (prev.predictionsTotal || 0) + event.matches.length
        }));

        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
          totalPoints: increment(correctCount * 10),
          predictionsCorrect: increment(correctCount),
          predictionsTotal: increment(event.matches.length)
        }).then(() => console.log('✅ User stats updated'))
          .catch(err => console.error('❌ Error updating user stats:', err));
      }
    } catch (error) {
      console.error('❌ Error simulating event:', error);
      alert(`Failed to simulate event: ${error.message}`);
    }
  };

  const handleToggleSub = (id) => {
    const current = userProfile?.subscriptions || [];
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    setUserProfile(prev => ({...prev, subscriptions: next}));
    if(user) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { subscriptions: next });
  }

  const handleOnboardingToggle = (id) => {
    const current = tempSubs;
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    setTempSubs(next);
  }

  const filteredLeaderboard = useMemo(() => {
    if (!leaderboard.length) return [];
    if (leaderboardScope === 'global') return leaderboard;
    if (leaderboardScope === 'country') return leaderboard.filter(u => u.country === (userProfile?.country || 'USA'));
    if (leaderboardScope === 'region') return leaderboard.filter(u => u.region === (userProfile?.region || 'NA'));
    if (leaderboardScope === 'friends') return leaderboard.filter((u, i) => (userId && u.id === userId) || i % 3 === 0);
    return leaderboard;
  }, [leaderboard, leaderboardScope, userProfile, userId]);

  // Helper function to determine if an event is a weekly show or PPV
  const isWeeklyShow = (eventName) => {
    const weeklyPatterns = [
      /dynamite/i,
      /collision/i,
      /rampage/i,
      /raw/i,
      /smackdown/i,
      /nxt(?!\s*(takeover|stand|deliver|deadline|vengeance|battleground))/i, // NXT but not TakeOver, Stand & Deliver, etc.
      /main\s*event/i,
      /superstars/i,
      /thunder/i,
      /nitro/i,
      /impact(?!\s*(slammiversary|bound|hard|sacrifice|rebellion|against|genesis))/i,
      /dark(?:\s|$)/i, // AEW Dark but not Darkest or similar
      /elevation/i,
      /world\s*tag/i,
      /strong/i, // NJPW Strong
      /road\s*to/i,
    ];
    
    return weeklyPatterns.some(pattern => pattern.test(eventName));
  };

  const myEvents = useMemo(() => {
    // CRITICAL: Safety check for subscriptions array
    const subs = userProfile?.subscriptions || [];
    
    // Merge scraped events with INITIAL_EVENTS
    // Use scraped event data but fall back to INITIAL_EVENTS for matches if scraped has none
    const mergeEvents = () => {
      if (scrapedEvents.length === 0) return INITIAL_EVENTS;
      
      // Create a map of INITIAL_EVENTS by normalized name for matching
      const initialEventsMap = {};
      INITIAL_EVENTS.forEach(ev => {
        const normalizedName = ev.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        initialEventsMap[normalizedName] = ev;
        initialEventsMap[ev.id] = ev;
      });
      
      // Merge scraped events with initial events
      const merged = scrapedEvents.map(scrapedEv => {
        // Try to find matching INITIAL_EVENT
        const normalizedName = scrapedEv.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchingInitial = initialEventsMap[normalizedName] || initialEventsMap[scrapedEv.id];
        
        // If scraped event has no matches but we have hardcoded ones, use those
        if ((!scrapedEv.matches || scrapedEv.matches.length === 0) && matchingInitial?.matches) {
          return { ...scrapedEv, matches: matchingInitial.matches };
        }
        return scrapedEv;
      });
      
      // Also add any INITIAL_EVENTS that aren't in scraped events
      INITIAL_EVENTS.forEach(initialEv => {
        const exists = merged.some(ev => {
          const normalizedScraped = ev.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedInitial = initialEv.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedScraped === normalizedInitial || ev.id === initialEv.id;
        });
        if (!exists) {
          merged.push(initialEv);
        }
      });
      
      return merged;
    };
    
    const eventsToUse = mergeEvents();
    
    // First filter by subscriptions
    const subscribedEvents = eventsToUse.filter(ev => {
      // Match by promoId (wwe, aew, etc.) or by promotionId (1, 2287, etc.)
      return subs.includes(ev.promoId) || 
             (ev.promotionId && subs.some(sub => {
               const promoMap = { 'wwe': '1', 'aew': '2287', 'njpw': '7', 'tna': '5', 'roh': '122' };
               return promoMap[sub] === ev.promotionId;
             }));
    });
    
    // Helper to parse date string
    const parseDate = (dateStr) => {
      if (!dateStr) return new Date(9999, 11, 31); // Put events without dates at the end
      
      // Try DD.MM.YYYY format first
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
      
      // Try "Month DD, YYYY" format (e.g., "Nov 30, 2025")
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      
      return new Date(9999, 11, 31);
    };
    
    // Filter by event type and date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14); // 2 weeks ago
    
    const filteredEvents = subscribedEvents.filter(ev => {
      const isWeekly = isWeeklyShow(ev.name);
      const eventDate = parseDate(ev.date);
      const isPast = eventDate < today;
      const isRecentPast = eventDate >= twoWeeksAgo && eventDate < today;
      
      // Check event type filter
      let passesTypeFilter = false;
      if (eventTypeFilter === 'past') {
        passesTypeFilter = isPast && !isWeekly; // Past PPVs only
      } else if (eventTypeFilter === 'weekly') {
        // Show upcoming weekly shows OR recent past weekly shows (last 2 weeks)
        passesTypeFilter = (!isPast && isWeekly) || (isRecentPast && isWeekly);
      } else {
        passesTypeFilter = !isPast && !isWeekly; // Upcoming PPVs (default)
      }
      
      if (!passesTypeFilter) return false;
      
      // Optionally filter out events with no matches
      if (hideEmptyEvents) {
        const hasMatches = ev.matches && Array.isArray(ev.matches) && ev.matches.length > 0;
        return hasMatches;
      }
      
      return true;
    });
    
    // Sort by date
    // For past events: most recent first (descending)
    // For upcoming events: soonest first (ascending)
    return filteredEvents.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return eventTypeFilter === 'past' ? dateB - dateA : dateA - dateB;
    });
  }, [userProfile, scrapedEvents, eventTypeFilter, hideEmptyEvents]);

  // --- VIEW: FIREBASE ERROR ---
  if (firebaseError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-red-900/20 border border-red-900 rounded-xl p-6 max-w-md">
          <h1 className="text-xl font-bold text-red-500 mb-4 text-center">Firebase Configuration Error</h1>
          <p className="text-slate-300 text-sm mb-4 bg-slate-900 p-3 rounded font-mono">{firebaseError}</p>
          <div className="text-slate-400 text-xs space-y-2">
            <p className="font-bold text-slate-300">To fix this:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Create a <code className="bg-slate-800 px-1 rounded">.env</code> file in your project root</li>
              <li>Add your Firebase credentials:</li>
            </ol>
            <pre className="bg-slate-900 p-3 rounded text-[10px] overflow-x-auto mt-2">
{`VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-app
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc`}</pre>
            <p className="mt-3">After creating/updating the .env file, restart the dev server.</p>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: LOADING ---
  if (authLoading || viewState === 'loading') {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Activity className="animate-spin text-red-600" /></div>;
  }

  // --- VIEW: LOGIN ---
  if (viewState === 'login') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Activity className="animate-spin text-red-600" /></div>}>
      <LoginView
          authMode={authMode}
          setAuthMode={setAuthMode}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          displayName={displayName}
          setDisplayName={setDisplayName}
        loginError={loginError}
          setLoginError={setLoginError}
        isLoggingIn={isLoggingIn}
          handleGuestLogin={handleGuestLogin}
          handleGoogleSignIn={handleGoogleSignIn}
          handleEmailSignIn={handleEmailSignIn}
          handleEmailSignUp={handleEmailSignUp}
          handlePasswordReset={handlePasswordReset}
        />
      </Suspense>
    );
  }

  // --- VIEW: ONBOARDING ---
  if (viewState === 'onboarding') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Activity className="animate-spin text-red-600" /></div>}>
        <OnboardingFlow
        onboardingPage={onboardingPage}
          setOnboardingPage={setOnboardingPage}
        tempName={tempName}
          setTempName={setTempName}
        tempSubs={tempSubs}
          handleOnboardingToggle={handleOnboardingToggle}
          completeOnboarding={completeOnboarding}
        isSubmitting={isSubmitting}
        loginError={loginError}
          PROMOTIONS={PROMOTIONS}
          BrandLogo={BrandLogo}
        />
      </Suspense>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-red-600 selection:text-white pb-20 md:pb-0 animate-fadeIn">
      <nav className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => setActiveTab('home')}>
            <Trophy className="text-red-600 w-5 h-5" />
            <span className="font-black text-lg tracking-tighter italic text-white">RINGSIDE <span className="text-red-600">PICK'EM</span></span>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-slate-800 px-3 py-1 rounded text-xs font-mono font-bold text-white border border-slate-700">{userProfile?.totalPoints || 0} PTS</div>
          </div>
        </div>
      </nav>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 shadow-2xl group">
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-xl font-bold text-white mb-1">Hello, Manager</h2><p className="text-slate-400 text-sm mb-6 font-bold">{userProfile?.displayName}</p></div>
                  <div className="text-right"><div className="text-3xl font-black text-white">{userProfile?.totalPoints}</div><p className="text-red-500 text-[10px] uppercase font-bold tracking-widest">Points</p></div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-800"><div className="text-xl font-black text-white">{userProfile?.predictionsCorrect || 0}</div><div className="text-[10px] uppercase text-slate-400 font-bold">Wins</div></div>
                  <div className="bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-800"><div className="text-xl font-black text-white">{userProfile?.predictionsTotal > 0 ? Math.round((userProfile.predictionsCorrect / userProfile.predictionsTotal) * 100) : 0}%</div><div className="text-[10px] uppercase text-slate-400 font-bold">Accuracy</div></div>
                </div>
              </div>
            </div>
            {/* Event Type Toggle */}
            <div className="space-y-3">
              <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setEventTypeFilter('ppv')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                    eventTypeFilter === 'ppv' 
                      ? 'bg-red-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Trophy size={14} />
                  Live Events
                </button>
                <button 
                  onClick={() => setEventTypeFilter('weekly')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                    eventTypeFilter === 'weekly' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Tv size={14} />
                  Weekly
                </button>
                <button 
                  onClick={() => setEventTypeFilter('past')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                    eventTypeFilter === 'past' 
                      ? 'bg-purple-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock size={14} />
                  Past
                </button>
              </div>
              {/* Hide Empty Events Toggle */}
              <button
                onClick={() => setHideEmptyEvents(!hideEmptyEvents)}
                className="w-full flex items-center justify-between px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 text-xs font-bold hover:bg-slate-800 transition-all"
              >
                <span className="flex items-center gap-2 text-slate-400">
                  <Filter size={14} />
                  Hide events without match cards
                </span>
                <div className={`w-10 h-5 rounded-full transition-all ${hideEmptyEvents ? 'bg-red-600' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-all mt-0.5 ${hideEmptyEvents ? 'ml-5' : 'ml-0.5'}`}></div>
                </div>
              </button>
            </div>
            {myEvents.length === 0 ? (
               <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-dashed border-slate-800"><Filter className="w-12 h-12 text-slate-700 mx-auto mb-3" /><p className="text-slate-500 text-sm mb-4">Feed empty.</p><button onClick={() => setActiveTab('settings')} className="bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-bold">Add Promotions</button></div>
            ) : (
              myEvents.map(event => {
                const promo = PROMOTIONS.find(p => p.id === event.promoId);
                // Check if event is complete: user has been graded (eventResults exists)
                const hasEventResults = eventResults[event.id];
                const hasMatchWinners = event.matches?.some(m => m.winner);
                const isGraded = hasEventResults; // Only graded if user's results have been calculated
                // Check if event has matches
                const hasMatches = event.matches && Array.isArray(event.matches) && event.matches.length > 0;
                return (
                  <div key={event.id} onClick={(e) => { 
                    e.stopPropagation();
                    setSelectedEvent(event); 
                    setActiveTab('event'); 
                  }} className="group relative bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer rounded-2xl overflow-hidden shadow-xl" style={{ height: '200px' }}>
                    <div className="absolute inset-0"><EventBanner event={event} className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950"></div></div>
                    <div className="absolute inset-0 p-5 flex flex-col justify-end">
                      <div className="flex justify-between items-end">
                        <div className="flex-1">
                          <div className="mb-3 flex items-center gap-2 flex-wrap">
                             <div className="w-10 h-10 p-1 bg-slate-950/80 rounded-lg backdrop-blur-sm border border-slate-800"><BrandLogo id={promo.id} /></div>
                             {isGraded && <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"><CheckCircle size={10} /> Graded</div>}
                             {!hasMatches && <div className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"><Clock size={10} /> Coming Soon</div>}
                             {hasMatches && hasMatchWinners && !isGraded && <div className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"><CheckCircle size={10} /> Results Available</div>}
                          </div>                          <h4 className="font-black text-2xl text-white leading-none mb-1 italic uppercase shadow-black drop-shadow-md">{event.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium"><span className="flex items-center gap-1"><Calendar size={10} /> {event.date}</span>{event.venue && event.venue !== 'TBD' && <><span className="w-1 h-1 rounded-full bg-slate-500"></span><span className="flex items-center gap-1"><MapPin size={10} /> {event.venue}</span></>}{(!event.venue || event.venue === 'TBD') && <><span className="w-1 h-1 rounded-full bg-slate-500"></span><span className="flex items-center gap-1 text-slate-500"><MapPin size={10} /> TBA</span></>}</div>
                        </div>
                        <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm group-hover:bg-red-600 transition-colors"><ChevronRight className="text-white" size={20} /></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <Suspense fallback={<LoadingSpinner className="p-8" />}>
            <LeaderboardView
              leaderboardScope={leaderboardScope}
              setLeaderboardScope={setLeaderboardScope}
              filteredLeaderboard={filteredLeaderboard}
              userId={userId}
            />
          </Suspense>
        )}

        {activeTab === 'event' && selectedEvent && selectedEvent.id && (
          <div className="pb-24 animate-slideUp">
            <button onClick={() => setActiveTab('home')} className="mb-4 text-slate-500 hover:text-white flex items-center gap-1 text-xs font-bold uppercase tracking-wider">← Feed</button>
            <div className="mb-6 relative h-48 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
              <EventBanner event={selectedEvent} className="w-full h-full object-cover opacity-50" />
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 -z-10"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-6 w-full text-center"><div className="inline-block w-16 h-16 p-2 bg-slate-950/50 backdrop-blur-md rounded-xl border border-slate-700 mb-2 shadow-lg"><BrandLogo id={selectedEvent.promoId} /></div><h1 className="text-3xl font-black italic uppercase text-white shadow-black drop-shadow-lg">{selectedEvent.name}</h1></div>
               </div>
            <div className="space-y-6">
              {(() => {
                // Debug logging
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔍 Rendering event matches:', {
                    eventId: selectedEvent.id,
                    eventName: selectedEvent.name,
                    hasMatches: !!selectedEvent.matches,
                    isArray: Array.isArray(selectedEvent.matches),
                    length: selectedEvent.matches?.length,
                    firstMatch: selectedEvent.matches?.[0],
                    allMatches: selectedEvent.matches
                  });
                }
                
                if (!selectedEvent.matches) {
                  return (
                    <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                      <p className="text-slate-500 text-sm">No matches available for this event yet.</p>
                      {process.env.NODE_ENV === 'development' && (
                        <p className="text-xs text-slate-600 mt-2">Debug: matches is null/undefined</p>
                      )}
            </div>
                  );
                }
                
                if (!Array.isArray(selectedEvent.matches)) {
                    return (
                    <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                      <p className="text-slate-500 text-sm">No matches available for this event yet.</p>
                      {process.env.NODE_ENV === 'development' && (
                        <p className="text-xs text-slate-600 mt-2">Debug: matches is not an array (type: {typeof selectedEvent.matches})</p>
                      )}
                            </div>
                  );
                }
                
                if (selectedEvent.matches.length === 0) {
                  return (
                    <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                      <p className="text-slate-500 text-sm">No matches available for this event yet.</p>
                      {process.env.NODE_ENV === 'development' && (
                        <p className="text-xs text-slate-600 mt-2">Debug: matches array is empty</p>
                      )}
                      </div>
                    );
                }
                
                // Render matches
                return selectedEvent.matches.map((match) => {
                  if (!match) {
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('⚠️ Null match found in matches array');
                    }
                    return null;
                  }
                // CRITICAL: Only show predictions if they belong to the current user
                // Must be exact match - null means we haven't loaded predictions yet, so don't show any
                // Also check that predictions object has entries for this user (extra safety)
                const currentUserUid = user?.uid;
                
                // CRITICAL: Get predictions from user-keyed structure
                // This ensures we only access the current user's predictions
                const getMyPickData = () => {
                  // CRITICAL: Verify user ID matches before accessing predictions
                  if (!currentUserUid) {
                    return undefined;
                  }
                  
                  if (predictionsUserId !== currentUserUid) {
                    if (process.env.NODE_ENV === 'development') {
                      console.error('🔒 USER ISOLATION VIOLATION: predictionsUserId mismatch!');
                    }
                    return undefined;
                  }
                  
                  if (predictionsUserId === null) {
                    return undefined;
                  }
                  
                  if (currentUserIdRef.current !== currentUserUid) {
                    if (process.env.NODE_ENV === 'development') {
                      console.error('🔒 USER ISOLATION VIOLATION: currentUserIdRef mismatch!');
                    }
                    return undefined;
                  }
                  
                  // All checks passed - get predictions from user-keyed structure
                  // CRITICAL: Access predictionsByUser directly using currentUserUid to avoid stale state
                  // Don't rely on getCurrentUserPredictions() which might use stale user state
                  const matchIdStr = match.id.toString();
                  const userPredictions = predictionsByUser[currentUserUid] || {};
                  const pickData = userPredictions[selectedEvent.id]?.[matchIdStr];
                  
                  // Note: Multiple users in predictionsByUser is expected during user transitions
                  
                  return pickData;
                };
                
                // Debug logging for user isolation testing
                const predictionsBelongToCurrentUser = 
                  predictionsUserId === currentUserUid && 
                  predictionsUserId !== null && 
                  currentUserUid !== null &&
                  currentUserIdRef.current === currentUserUid;
                
                // Validate predictions belong to current user
                if (predictionsUserId !== null && !predictionsBelongToCurrentUser && process.env.NODE_ENV === 'development') {
                  console.error('🔒 BLOCKING predictions display - user mismatch');
                }
                
                // CRITICAL: Use the safe getter function that checks user ID every time
                // FIXED: Use string key consistently
                const matchIdStr = match.id.toString();
                const myPickData = getMyPickData();
                
                // CRITICAL: Final validation - ensure we have a valid user and predictions belong to them
                let myPick, myMethod;
                if (myPickData && (!currentUserUid || predictionsUserId !== currentUserUid)) {
                  if (process.env.NODE_ENV === 'development') {
                    console.error('🔒 CRITICAL: Blocking prediction display - user mismatch detected!');
                  }
                  // Force undefined to prevent showing wrong user's predictions
                  myPick = undefined;
                  myMethod = null;
                } else {
                  // Handle both old format (string) and new format (object)
                  myPick = myPickData ? (typeof myPickData === 'string' ? myPickData : (myPickData?.winner || myPickData)) : undefined;
                  myMethod = myPickData && typeof myPickData === 'object' ? myPickData?.method : null;
                }
                // FIXED: Use string key consistently
                // For past events, check if match has a winner field from scraper
                // Otherwise use eventResults (for simulated/manually entered results)
                const actualWinner = match.winner || eventResults[selectedEvent.id]?.[matchIdStr];
                // Use fuzzy matching to check if prediction is correct (handles "Cody" vs "Cody Rhodes")
                const isCorrect = actualWinner && myPick && wrestlerNamesMatch(myPick, actualWinner);
                const sentiment = communitySentiment[selectedEvent.id]?.[matchIdStr];
                const matchKey = `${selectedEvent.id}-${matchIdStr}`;
                
                return (
                  <div key={match.id} className="relative group">
                    <div className="text-center mb-2"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-800">{match.title}</span></div>
                    
                    {/* Community Sentiment Bar - Tug of War Style */}
                    {!actualWinner && (
                      <div className="mb-4 px-2">
                        {sentiment && sentiment.total > 0 ? (
                          <div className="relative">
                            {/* Header with live indicator */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Community Picks</span>
               </div>
                                {sentiment.simulated && (
                                  <span className="text-[8px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">PROJECTED</span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">{sentiment.total.toLocaleString()} votes</span>
            </div>
            
                            {/* Tug of War Bar */}
                            <div className="relative">
                              {/* Background track */}
                              <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700 shadow-inner relative">
                                {/* Left side (P1) */}
                                <div 
                                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 transition-all duration-700 ease-out"
                                  style={{ width: `${sentiment.p1}%` }}
                                >
                                  {sentiment.p1 >= 55 && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-white drop-shadow-lg">
                                      {sentiment.p1}%
                                    </div>
                                  )}
                                </div>
                                {/* Right side (P2) */}
                                <div 
                                  className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-amber-600 via-amber-500 to-amber-400 transition-all duration-700 ease-out"
                                  style={{ width: `${sentiment.p2}%` }}
                                >
                                  {sentiment.p2 >= 55 && (
                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-white drop-shadow-lg">
                                      {sentiment.p2}%
                                    </div>
                                  )}
                                </div>
                                {/* Center battle point */}
                                <div 
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-slate-600 z-10 transition-all duration-700"
                                  style={{ left: `${sentiment.p1}%` }}
                                ></div>
                              </div>
                              
                              {/* Names and percentages below */}
                              <div className="flex justify-between mt-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400"></div>
                                  <span className={`text-[10px] font-bold ${sentiment.p1 > sentiment.p2 ? 'text-cyan-400' : 'text-slate-500'}`}>
                                    {match.p1.length > 15 ? match.p1.split(' ')[0] : match.p1}
                                  </span>
                                  {sentiment.p1 <= 45 && (
                                    <span className="text-[10px] text-slate-600 font-medium">{sentiment.p1}%</span>
                                  )}
                                  {sentiment.p1 >= 60 && (
                                    <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-bold">🔥 HOT</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {sentiment.p2 >= 60 && (
                                    <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">🔥 HOT</span>
                                  )}
                                  {sentiment.p2 <= 45 && (
                                    <span className="text-[10px] text-slate-600 font-medium">{sentiment.p2}%</span>
                                  )}
                                  <span className={`text-[10px] font-bold ${sentiment.p2 > sentiment.p1 ? 'text-amber-400' : 'text-slate-500'}`}>
                                    {match.p2.length > 15 ? match.p2.split(' ')[0] : match.p2}
                                  </span>
                                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-3 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <Users size={14} className="text-slate-600" />
                              <span className="text-[10px] text-slate-500 font-bold uppercase">Be the first to pick!</span>
                            </div>
                            <span className="text-[9px] text-slate-600">Your pick shapes the community sentiment</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Determine match type for display */}
                    {(() => {
                      const matchTitle = (match.title || match.type || '').toLowerCase();
                      const isRumble = matchTitle.includes('rumble') || matchTitle.includes('battle royal') || matchTitle.includes('gauntlet') || matchTitle.includes('30 men') || matchTitle.includes('30 women');
                      const isTripleThreat = match.p3 || matchTitle.includes('triple threat') || matchTitle.includes('three way') || matchTitle.includes('3-way');
                      const isFatalFourWay = match.p4 || matchTitle.includes('fatal four') || matchTitle.includes('four way') || matchTitle.includes('4-way');
                      const allParticipants = match.participants || (match.p1Members && match.p2Members ? [...match.p1Members, ...match.p2Members] : null);
                      const totalParticipants = allParticipants?.length || ((match.p1Members?.length || 1) + (match.p2Members?.length || 1));
                      const isLargeMultiMan = totalParticipants > 6;
                      
                      // Helper function to check if a wrestler matches the actual winner (with fuzzy matching)
                      const isWinner = (wrestlerName) => actualWinner && wrestlerNamesMatch(wrestlerName, actualWinner);
                      
                      // Rumble/Battle Royal - Text input only
                      if (isRumble) {
                        const customPrediction = customInputText[match.id] || '';
                        
                        return (
                          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
                            <div className="text-center mb-4">
                              <Users className="inline-block text-yellow-500 mb-2" size={32} />
                              <p className="text-xs text-slate-400">
                                Type your prediction for who will win
                              </p>
                            </div>
                            
                            <input
                              type="text"
                              value={customPrediction}
                              onChange={(e) => setCustomInputText({ ...customInputText, [match.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && customPrediction.trim()) {
                                  makePrediction(selectedEvent.id, match.id, customPrediction.trim(), 'last elimination');
                                  setCustomInputText({ ...customInputText, [match.id]: '' });
                                }
                              }}
                              disabled={!!actualWinner || !!lockedEvents[selectedEvent.id]}
                              placeholder="Type wrestler name (e.g. Cody Rhodes)..."
                              className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl text-sm font-bold placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            />
                            
                            <button
                              onClick={() => {
                                if (customPrediction.trim()) {
                                  makePrediction(selectedEvent.id, match.id, customPrediction.trim(), 'last elimination');
                                  setCustomInputText({ ...customInputText, [match.id]: '' });
                                }
                              }}
                              disabled={!customPrediction.trim() || !!actualWinner || !!lockedEvents[selectedEvent.id]}
                              className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Submit Prediction
                  </button>
                            
                            {myPick && (
                              <div className="mt-3 p-3 bg-slate-950/50 rounded-xl border border-red-900/30 text-center">
                                <span className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Your Pick</span>
                                <div className="text-white font-black text-lg uppercase">{myPick}</div>
               </div>
            )}
                            
                            {actualWinner && (
                              <div className="mt-3 p-3 bg-green-900/20 rounded-xl border border-green-900/50 text-center">
                                <span className="text-green-400 font-black uppercase">Winner: {actualWinner}</span>
          </div>
        )}
                          </div>
                        );
                      }
                      
                      // Triple Threat - 3 boxes
                      if (isTripleThreat) {
                        const participants = [
                          { name: match.p1, image: match.p1Image },
                          { name: match.p2, image: match.p2Image },
                          { name: match.p3 || 'TBD', image: match.p3Image }
                        ];
                        return (
                          <div className="grid grid-cols-3 gap-1 h-56">
                            {participants.map((p, idx) => (
                              <div 
                                key={idx}
                                onClick={() => !actualWinner && !lockedEvents[selectedEvent.id] && p.name !== 'TBD' && makePrediction(selectedEvent.id, match.id, p.name, selectedMethod[matchKey] || 'pinfall')} 
                                className={`relative rounded-xl overflow-hidden transition-all duration-300 border ${lockedEvents[selectedEvent.id] ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-slate-600'} ${myPick === p.name ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] z-10' : 'border-slate-800'} ${actualWinner && !isWinner(p.name) ? 'grayscale opacity-50' : ''}`}
                              >
                                <WrestlerImage name={p.name} className="w-full h-full" imageUrl={p.image} />
                                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-8 pb-2 px-1 text-center">
                                  <span className={`block font-black text-xs uppercase leading-tight ${myPick === p.name ? 'text-red-500' : 'text-white'}`}>{p.name}</span>
                                  {myPick === p.name && <span className="text-[7px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full inline-block mt-1">PICK</span>}
            </div>
                                {isWinner(p.name) && <div className="absolute top-1 left-1 bg-green-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase shadow-lg z-20">Winner</div>}
                              </div>
                            ))}
                          </div>
                        );
                      }
                      
                      // Fatal Four Way - 2x2 grid
                      if (isFatalFourWay) {
                        const participants = [
                          { name: match.p1, image: match.p1Image },
                          { name: match.p2, image: match.p2Image },
                          { name: match.p3 || 'TBD', image: match.p3Image },
                          { name: match.p4 || 'TBD', image: match.p4Image }
                        ];
                return (
                          <div className="grid grid-cols-2 gap-1 h-64">
                            {participants.map((p, idx) => (
                              <div 
                                key={idx}
                                onClick={() => !actualWinner && !lockedEvents[selectedEvent.id] && p.name !== 'TBD' && makePrediction(selectedEvent.id, match.id, p.name, selectedMethod[matchKey] || 'pinfall')} 
                                className={`relative rounded-xl overflow-hidden transition-all duration-300 border ${lockedEvents[selectedEvent.id] ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-slate-600'} ${myPick === p.name ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] z-10' : 'border-slate-800'} ${actualWinner && !isWinner(p.name) ? 'grayscale opacity-50' : ''}`}
                              >
                                <WrestlerImage name={p.name} className="w-full h-full" imageUrl={p.image} />
                                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-8 pb-2 px-1 text-center">
                                  <span className={`block font-black text-sm uppercase leading-tight ${myPick === p.name ? 'text-red-500' : 'text-white'}`}>{p.name}</span>
                                  {myPick === p.name && <span className="text-[7px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full inline-block mt-1">PICK</span>}
                                </div>
                                {isWinner(p.name) && <div className="absolute top-1 left-1 bg-green-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase shadow-lg z-20">Winner</div>}
                              </div>
                            ))}
                          </div>
                        );
                      }
                      
                      // Large multi-man team match (WarGames, Blood & Guts, etc) - Cleaner display
                      if (isLargeMultiMan || (match.p1Members?.length > 2 || match.p2Members?.length > 2)) {
                        return (
                          <div className="flex gap-2">
                            {/* Team 1 */}
                            <div 
                              onClick={() => !actualWinner && !lockedEvents[selectedEvent.id] && makePrediction(selectedEvent.id, match.id, match.p1, selectedMethod[matchKey] || 'pinfall')} 
                              className={`flex-1 relative rounded-xl overflow-hidden transition-all duration-300 border-2 ${lockedEvents[selectedEvent.id] ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-slate-500'} ${myPick === match.p1 ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-slate-700'} ${actualWinner && !isWinner(match.p1) ? 'grayscale opacity-50' : ''}`}
                            >
                              <div className="bg-gradient-to-br from-blue-900/50 to-slate-900 p-3">
                                <div className="flex flex-wrap justify-center gap-1 mb-2">
                                  {(match.p1Members || [{ name: match.p1, image: match.p1Image }]).slice(0, 5).map((member, idx) => (
                                    <div key={idx} className="w-10 h-10 rounded-full overflow-hidden border border-slate-600" title={member.name}>
                                      <WrestlerImage name={member.name} className="w-full h-full" imageUrl={member.image} />
                                    </div>
                                  ))}
                                  {match.p1Members?.length > 5 && (
                                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-400">
                                      +{match.p1Members.length - 5}
                                    </div>
                                  )}
                                </div>
                                <div className="text-center">
                                  <span className={`block font-black text-sm uppercase leading-tight ${myPick === match.p1 ? 'text-red-400' : 'text-white'}`}>
                                    {match.p1Members?.length > 1 
                                      ? match.p1Members.map(m => m.name.split(' ').pop()).join(', ')
                                      : match.p1}
                                  </span>
                                  {myPick === match.p1 && <span className="text-[8px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full inline-block mt-1">YOUR PICK</span>}
                                </div>
                              </div>
                              {isWinner(match.p1) && <div className="absolute top-1 left-1 bg-green-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase shadow-lg z-20">Winner</div>}
                            </div>
                            
                            <div className="flex items-center"><span className="text-slate-600 font-black text-sm">VS</span></div>
                            
                            {/* Team 2 */}
                            <div 
                              onClick={() => !actualWinner && !lockedEvents[selectedEvent.id] && makePrediction(selectedEvent.id, match.id, match.p2, selectedMethod[matchKey] || 'pinfall')} 
                              className={`flex-1 relative rounded-xl overflow-hidden transition-all duration-300 border-2 ${lockedEvents[selectedEvent.id] ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-slate-500'} ${myPick === match.p2 ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-slate-700'} ${actualWinner && !isWinner(match.p2) ? 'grayscale opacity-50' : ''}`}
                            >
                              <div className="bg-gradient-to-br from-purple-900/50 to-slate-900 p-3">
                                <div className="flex flex-wrap justify-center gap-1 mb-2">
                                  {(match.p2Members || [{ name: match.p2, image: match.p2Image }]).slice(0, 5).map((member, idx) => (
                                    <div key={idx} className="w-10 h-10 rounded-full overflow-hidden border border-slate-600" title={member.name}>
                                      <WrestlerImage name={member.name} className="w-full h-full" imageUrl={member.image} />
                                    </div>
                                  ))}
                                  {match.p2Members?.length > 5 && (
                                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-400">
                                      +{match.p2Members.length - 5}
                                    </div>
                                  )}
                                </div>
                                <div className="text-center">
                                  <span className={`block font-black text-sm uppercase leading-tight ${myPick === match.p2 ? 'text-red-400' : 'text-white'}`}>
                                    {match.p2Members?.length > 1 
                                      ? match.p2Members.map(m => m.name.split(' ').pop()).join(', ')
                                      : match.p2}
                                  </span>
                                  {myPick === match.p2 && <span className="text-[8px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full inline-block mt-1">YOUR PICK</span>}
                                </div>
                              </div>
                              {isWinner(match.p2) && <div className="absolute top-1 right-1 bg-green-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase shadow-lg z-20">Winner</div>}
                            </div>
                          </div>
                        );
                      }
                      
                      // Default 1v1 or small tag team match
                      return (
                    <div className="flex gap-1 h-64"> 
                          <div onClick={() => !actualWinner && !lockedEvents[selectedEvent.id] && makePrediction(selectedEvent.id, match.id, match.p1, selectedMethod[matchKey] || 'pinfall')} className={`flex-1 relative rounded-l-2xl overflow-hidden transition-all duration-300 border-y border-l ${lockedEvents[selectedEvent.id] ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-slate-600'} ${myPick === match.p1 ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] z-10' : 'border-slate-800'} ${actualWinner && !isWinner(match.p1) ? 'grayscale opacity-50' : ''}`}>
                             {match.p1Members && match.p1Members.length === 2 ? (
                               <div className="w-full h-full grid grid-cols-2 gap-0.5">
                                 {match.p1Members.map((member, idx) => (
                                   <WrestlerImage key={idx} name={member.name} className="w-full h-full" imageUrl={member.image} />
                                 ))}
                               </div>
                             ) : (
                               <WrestlerImage name={match.p1} className="w-full h-full" imageUrl={match.p1Image} />
                             )}
                             <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-3 px-2 text-center">
                               <span className={`block font-black ${match.p1.length > 25 ? 'text-xs' : match.p1.length > 15 ? 'text-sm' : 'text-lg'} uppercase leading-tight ${myPick === match.p1 ? 'text-red-500' : 'text-white'}`}>{match.p1}</span>
                               {myPick === match.p1 && <span className="text-[8px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full inline-block mt-1">YOUR PICK</span>}
                               {sentiment && sentiment.p1 >= 55 && <div className="text-[8px] text-cyan-400 font-bold mt-1 bg-cyan-950/50 px-2 py-0.5 rounded-full inline-block">🔥 {sentiment.p1}% pick</div>}
                             </div>
                             {isWinner(match.p1) && <div className="absolute top-2 left-2 bg-green-500 text-black text-[10px] font-black px-2 py-1 rounded uppercase shadow-lg z-20">Winner</div>}
                      </div>
                      <div className="w-1 bg-slate-900 flex items-center justify-center relative z-20"><div className="absolute bg-slate-950 border border-slate-700 rounded-full w-8 h-8 flex items-center justify-center text-[10px] font-black text-slate-500 italic shadow-xl">VS</div></div>
                          <div onClick={() => !actualWinner && !lockedEvents[selectedEvent.id] && makePrediction(selectedEvent.id, match.id, match.p2, selectedMethod[matchKey] || 'pinfall')} className={`flex-1 relative rounded-r-2xl overflow-hidden transition-all duration-300 border-y border-r ${lockedEvents[selectedEvent.id] ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-slate-600'} ${myPick === match.p2 ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] z-10' : 'border-slate-800'} ${actualWinner && !isWinner(match.p2) ? 'grayscale opacity-50' : ''}`}>
                             {match.p2Members && match.p2Members.length === 2 ? (
                               <div className="w-full h-full grid grid-cols-2 gap-0.5">
                                 {match.p2Members.map((member, idx) => (
                                   <WrestlerImage key={idx} name={member.name} className="w-full h-full" imageUrl={member.image} />
                                 ))}
                      </div>
                             ) : (
                               <WrestlerImage name={match.p2} className="w-full h-full" imageUrl={match.p2Image} />
                             )}
                             <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-3 px-2 text-center">
                               <span className={`block font-black ${match.p2.length > 25 ? 'text-xs' : match.p2.length > 15 ? 'text-sm' : 'text-lg'} uppercase leading-tight ${myPick === match.p2 ? 'text-red-500' : 'text-white'}`}>{match.p2}</span>
                               {myPick === match.p2 && <span className="text-[8px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full inline-block mt-1">YOUR PICK</span>}
                               {sentiment && sentiment.p2 >= 55 && <div className="text-[8px] text-amber-400 font-bold mt-1 bg-amber-950/50 px-2 py-0.5 rounded-full inline-block">🔥 {sentiment.p2}% pick</div>}
                    </div>
                             {isWinner(match.p2) && <div className="absolute top-2 right-2 bg-green-500 text-black text-[10px] font-black px-2 py-1 rounded uppercase shadow-lg z-20">Winner</div>}
                          </div>
                  </div>
                );
                    })()}
                    
                    {/* Method of Victory Selector */}
                    {myPick && !actualWinner && (
                      <div className="mt-3 px-2">
                        <label className="block text-[10px] text-slate-500 font-bold uppercase mb-2">
                          Method of Victory
                          {lockedEvents[selectedEvent.id] && <span className="ml-2 text-green-400">(Locked)</span>}
                        </label>
                        <select
                          value={selectedMethod[matchKey] || myMethod || 'pinfall'}
                          onChange={(e) => {
                            if (!lockedEvents[selectedEvent.id]) {
                              setSelectedMethod(prev => ({ ...prev, [matchKey]: e.target.value }));
                              makePrediction(selectedEvent.id, match.id, myPick, e.target.value);
                            }
                          }}
                          disabled={!!lockedEvents[selectedEvent.id]}
                          className="w-full bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="pinfall">Pinfall</option>
                          <option value="submission">Submission</option>
                          <option value="dq">DQ / Count-out</option>
                          <option value="no-contest">No Contest</option>
                        </select>
                        {myMethod && (
                          <div className="mt-1 text-[9px] text-slate-400">
                            Your pick: <span className="font-bold text-slate-300 capitalize">{myMethod}</span>
            </div>
                        )}
                      </div>
                    )}
                    
                    {actualWinner && myPick && (
                      <div className={`mt-2 text-center text-xs font-bold uppercase tracking-wider p-2 rounded-lg border ${isCorrect ? 'bg-green-900/20 border-green-900 text-green-400' : 'bg-red-900/20 border-red-900 text-red-400'}`}>
                        {isCorrect ? '+10 POINTS' : 'INCORRECT'}
                      </div>
                    )}
                    {actualWinner && !myPick && (
                      <div className="mt-2 text-center text-xs font-bold uppercase tracking-wider p-2 rounded-lg border bg-slate-800/50 border-slate-700 text-slate-500">
                        NO PREDICTION MADE
                      </div>
                    )}
                  </div>
                  );
                });
              })()}
            </div>
            
            {/* Submit/Lock In Button */}
            {!eventResults[selectedEvent.id] && (
              <div className="mt-8 pt-8 border-t border-slate-800">
                {lockedEvents[selectedEvent.id] ? (
                  <div className="w-full py-4 bg-green-900/20 border-2 border-green-700/50 text-green-400 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                    <CheckCircle size={20} />
                    Predictions Locked In
                  </div>
                ) : (
                  <button 
                    onClick={async () => {
                      if (!user || !user.uid || isLockingEvent) return;
                      
                      setIsLockingEvent(true);
                      try {
                        // Mark event as locked in Firestore
                        const lockDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'lockedEvents', selectedEvent.id);
                        await setDoc(lockDoc, {
                          eventId: selectedEvent.id,
                          lockedAt: serverTimestamp(),
                          locked: true
                        }, { merge: true });
                        
                        // Update local state
                        setLockedEvents(prev => ({
                          ...prev,
                          [selectedEvent.id]: true
                        }));
                      } catch (error) {
                        console.error('❌ Error locking event:', error);
                      } finally {
                        setIsLockingEvent(false);
                      }
                    }}
                    disabled={isLockingEvent || !user}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-red-600/50"
                  >
                    {isLockingEvent ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Locking In...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={20} />
                        Lock In Predictions
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            
            {!eventResults[selectedEvent.id] && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <button onClick={() => simulateEventResult(selectedEvent)} className="w-full py-4 border-2 border-dashed border-slate-700 text-slate-500 hover:text-white hover:border-slate-500 rounded-xl font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"><Activity size={18} /> Simulate Event (Demo)</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <Suspense fallback={<LoadingSpinner className="p-8" />}>
            <SettingsPanel
            user={user}
              userProfile={userProfile}
              displayName={displayName}
              setDisplayName={setDisplayName}
              newEmail={newEmail}
              setNewEmail={setNewEmail}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmNewPassword={confirmNewPassword}
              setConfirmNewPassword={setConfirmNewPassword}
              accountError={accountError}
              accountSuccess={accountSuccess}
              handleLogout={handleLogout}
              handleUpdateDisplayName={handleUpdateDisplayName}
              handleChangeEmail={handleChangeEmail}
              handleChangePassword={handleChangePassword}
              handleToggleSub={handleToggleSub}
              setViewState={setViewState}
              setAuthMode={setAuthMode}
              PROMOTIONS={PROMOTIONS}
              BrandLogo={BrandLogo}
            />
          </Suspense>
        )}

        {activeTab === 'admin' && userProfile?.isAdmin && (
          <AdminPanel
            events={scrapedEvents}
            promotions={PROMOTIONS}
            db={db}
            appId={appId}
            userProfile={userProfile}
          />
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-md border-t border-slate-800 pb-safe md:pb-0 z-50">
        <div className={`flex justify-around items-center h-16 max-w-md mx-auto ${userProfile?.isAdmin ? 'max-w-2xl' : ''}`}>
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'home' ? 'text-red-500' : 'text-slate-500'}`}><Calendar size={20} strokeWidth={2.5} /><span className="text-[8px] uppercase font-bold mt-1">Events</span></button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'leaderboard' ? 'text-red-500' : 'text-slate-500'}`}><BarChart3 size={20} strokeWidth={2.5} /><span className="text-[8px] uppercase font-bold mt-1">Rankings</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'settings' ? 'text-red-500' : 'text-slate-500'}`}><Settings size={20} strokeWidth={2.5} /><span className="text-[8px] uppercase font-bold mt-1">Config</span></button>
          {userProfile?.isAdmin && (
            <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'admin' ? 'text-red-500' : 'text-slate-500'}`}><Shield size={20} strokeWidth={2.5} /><span className="text-[8px] uppercase font-bold mt-1">Admin</span></button>
          )}
        </div>
      </div>
       <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
        .animate-slideUp { animation: slideUp 0.4s ease-out forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}