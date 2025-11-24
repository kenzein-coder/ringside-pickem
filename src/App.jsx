import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
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
  serverTimestamp,
  increment,
  limit,
  getDoc,
  getDocs
} from 'firebase/firestore';
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
  Loader2
} from 'lucide-react';

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
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('...') || firebaseConfig.apiKey.length < 20) {
  console.error('❌ Invalid Firebase API Key. Please check your .env file.');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const googleProvider = new GoogleAuthProvider();
// Configure Google provider to always show account selection
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// --- ASSETS ---
const WRESTLER_IMAGES = {
  'Cody Rhodes': 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Cody_Rhodes_-_WM_XL_-_2024_%28cropped%29.jpg',
  'The Rock': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Dwayne_%22The_Rock%22_Johnson_Visits_the_Pentagon_%2841%29_%28cropped%29.jpg',
  'CM Punk': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/CM_Punk_AEW_First_Dance_2021_%28cropped%29.jpg',
  'Seth Rollins': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Seth_Rollins_2018.jpg',
  'Will Ospreay': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Will_Ospreay_at_Bound_for_Glory.jpg',
  'Kenny Omega': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Kenny_Omega_2019_Show_1.jpg',
  'Tetsuya Naito': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Naito_Tetsuya_2022.jpg',
  'Zack Sabre Jr.': 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Zack_Sabre_Jr_2018.jpg',
  'Mercedes Moné': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Sasha_Banks_2016.jpg',
  'Jamie Hayter': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Jamie_Hayter_2022.jpg',
  'Nic Nemeth': 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Dolph_Ziggler_2017.jpg',
  'Josh Alexander': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Josh_Alexander_Impact_Wrestling.jpg',
  'Bloodline 2.0': 'https://upload.wikimedia.org/wikipedia/commons/7/7e/The_Usos_2014.jpg', 
  'Original Bloodline': 'https://upload.wikimedia.org/wikipedia/commons/9/95/Roman_Reigns_and_Paul_Heyman_2022.jpg',
  'House of Black': 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Malakai_Black_AEW.jpg',
  'The Acclaimed': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/The_Acclaimed_2022.jpg',
  'Yota Tsuji': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Yota_Tsuji.jpg',
  'Shota Umino': 'https://upload.wikimedia.org/wikipedia/commons/2/23/Shota_Umino.jpg',
  'Hiromu Takahashi': 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Hiromu_Takahashi_2019.jpg',
  'El Desperado': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/El_Desperado_2022.jpg',
  'Jordynne Grace': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Jordynne_Grace_2022.jpg',
  'Masha Slamovich': 'https://upload.wikimedia.org/wikipedia/commons/6/65/Masha_Slamovich_2022.jpg',
  'Mark Briscoe': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Mark_Briscoe_2022.jpg',
  'Eddie Kingston': 'https://upload.wikimedia.org/wikipedia/commons/3/34/Eddie_Kingston_2019.jpg',
  'Athena': 'https://upload.wikimedia.org/wikipedia/commons/8/82/Ember_Moon_Axxess_2018.jpg',
  'Billie Starkz': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Billie_Starkz.jpg'
};

const EVENT_BACKGROUNDS = {
  'wwe-survivor-2025': 'https://images.unsplash.com/photo-1514525253440-b393452e3383?q=80&w=800&auto=format&fit=crop',
  'aew-worlds-end-2025': 'https://images.unsplash.com/photo-1574602321946-e27ef6933432?q=80&w=800&auto=format&fit=crop', 
  'njpw-wk20': 'https://images.unsplash.com/photo-1533577116850-9cc66cad8a9b?q=80&w=800&auto=format&fit=crop', 
  'tna-hardto-2026': 'https://images.unsplash.com/photo-1511250503134-894f5c67634a?q=80&w=800&auto=format&fit=crop',
  'roh-final-battle-2025': 'https://images.unsplash.com/photo-1599582319422-d7b77ce17332?q=80&w=800&auto=format&fit=crop'
};

const LOGO_URLS = {
  wwe: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/WWE_Logo_2014.png/600px-WWE_Logo_2014.png',
  aew: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/All_Elite_Wrestling_logo.svg/600px-All_Elite_Wrestling_logo.svg.png',
  njpw: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7e/NJPW_Lion_Mark.svg/600px-NJPW_Lion_Mark.svg.png',
  tna: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/TNA_Wrestling_2024_Logo.png/600px-TNA_Wrestling_2024_Logo.png',
  roh: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Ring_of_Honor_2022_logo.svg/600px-Ring_of_Honor_2022_logo.svg.png',
  stardom: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/World_Wonder_Ring_Stardom_logo.png',
  cmll: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Consejo_Mundial_de_Lucha_Libre_logo.svg/600px-Consejo_Mundial_de_Lucha_Libre_logo.svg.png',
  aaa: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Lucha_Libre_AAA_Worldwide_logo.svg/600px-Lucha_Libre_AAA_Worldwide_logo.svg.png',
  gcw: 'https://upload.wikimedia.org/wikipedia/commons/0/05/GCW_Logo_2022.png',
  mlw: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Major_League_Wrestling_logo.svg/600px-Major_League_Wrestling_logo.svg.png'
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

const INITIAL_EVENTS = [
  {
    id: 'wwe-survivor-2025', promoId: 'wwe', name: 'Survivor Series', date: 'Nov 30, 2025', venue: 'Chicago, IL',
    matches: [
      { id: 1, p1: 'Cody Rhodes', p2: 'The Rock', title: 'Undisputed WWE Championship' },
      { id: 2, p1: 'CM Punk', p2: 'Seth Rollins', title: 'Hell in a Cell' },
      { id: 3, p1: 'Bloodline 2.0', p2: 'Original Bloodline', title: 'WarGames Match' }
    ]
  },
  {
    id: 'aew-worlds-end-2025', promoId: 'aew', name: 'Worlds End', date: 'Dec 28, 2025', venue: 'Orlando, FL',
    matches: [
      { id: 1, p1: 'Will Ospreay', p2: 'Kenny Omega', title: 'AEW World Championship' },
      { id: 2, p1: 'Mercedes Moné', p2: 'Jamie Hayter', title: 'TBS Championship' },
      { id: 3, p1: 'House of Black', p2: 'The Acclaimed', title: 'Trios Championship' }
    ]
  },
  {
    id: 'njpw-wk20', promoId: 'njpw', name: 'Wrestle Kingdom 20', date: 'Jan 4, 2026', venue: 'Tokyo Dome',
    matches: [
      { id: 1, p1: 'Tetsuya Naito', p2: 'Zack Sabre Jr.', title: 'IWGP World Heavyweight' },
      { id: 2, p1: 'Yota Tsuji', p2: 'Shota Umino', title: 'Special Singles Match' },
      { id: 3, p1: 'Hiromu Takahashi', p2: 'El Desperado', title: 'IWGP Junior Heavyweight' }
    ]
  },
  {
    id: 'tna-hardto-2026', promoId: 'tna', name: 'Hard To Kill 2026', date: 'Jan 13, 2026', venue: 'Las Vegas, NV',
    matches: [
      { id: 1, p1: 'Nic Nemeth', p2: 'Josh Alexander', title: 'TNA World Championship' },
      { id: 2, p1: 'Jordynne Grace', p2: 'Masha Slamovich', title: 'Knockouts Championship' }
    ]
  },
  {
    id: 'roh-final-battle-2025', promoId: 'roh', name: 'Final Battle', date: 'Dec 15, 2025', venue: 'New York, NY',
    matches: [
      { id: 1, p1: 'Mark Briscoe', p2: 'Eddie Kingston', title: 'ROH World Championship' },
      { id: 2, p1: 'Athena', p2: 'Billie Starkz', title: 'ROH Women\'s World TV Title' }
    ]
  }
];

// --- HELPER COMPONENTS ---

const BrandLogo = ({ id, className = "w-full h-full object-contain", logoUrl }) => {
  const [error, setError] = useState(false);
  // Prioritize hardcoded LOGO_URLS over scraped logoUrl (Cagematch.net may have CORS issues)
  // Only use scraped logoUrl if it's not from Cagematch.net
  const url = (logoUrl && !logoUrl.includes('cagematch.net')) ? logoUrl : (LOGO_URLS[id] || logoUrl);
  useEffect(() => { setError(false); }, [id, logoUrl]);
  if (error || !url) return <div className={`w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 font-black text-[10px] uppercase border border-slate-700 rounded tracking-tighter`}>{id.substring(0, 4)}</div>;
  return <img src={url} alt={id} className={className} onError={() => setError(true)} referrerPolicy="no-referrer" loading="lazy" />;
};

const WrestlerImage = ({ name, className, imageUrl }) => {
  const [error, setError] = useState(false);
  // Use scraped imageUrl if available, otherwise fall back to hardcoded WRESTLER_IMAGES
  // Note: Cagematch.net images may have CORS issues, so we prioritize hardcoded images
  const url = imageUrl && !imageUrl.includes('cagematch.net') ? imageUrl : (WRESTLER_IMAGES[name] || imageUrl);
  useEffect(() => { setError(false); }, [name, imageUrl]);
  if (error || !url) {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return (
      <div className={`bg-slate-800 flex items-center justify-center ${className} relative overflow-hidden`}>
        <User className="text-slate-700 w-1/2 h-1/2 absolute opacity-50" />
        <span className="relative z-10 font-black text-4xl text-slate-600">{initials}</span>
      </div>
    );
  }
  return <img src={url} alt={name} className={`object-cover ${className}`} onError={() => setError(true)} referrerPolicy="no-referrer" loading="lazy" />;
};

const Toggle = ({ enabled, onClick }) => (
  <div onClick={onClick} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ${enabled ? 'bg-red-600' : 'bg-slate-700'}`}>
    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
  </div>
);

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
  const [predictions, setPredictions] = useState({});
  const [eventResults, setEventResults] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState(null);
  const [scrapedEvents, setScrapedEvents] = useState([]); // Events from Firestore scraper
  const [communitySentiment, setCommunitySentiment] = useState({}); // { eventId: { matchId: { p1: 65, p2: 35 } } }
  const [selectedMethod, setSelectedMethod] = useState({}); // { eventId-matchId: 'pinfall' }

  // --- AUTH & INIT ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        setUserId(currentUser.uid);
        setIsConnected(true);
        try {
          const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUser.uid);
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            // CRITICAL: Ensure safe data structure immediately
            const data = profileSnap.data();
            if (!data.subscriptions) data.subscriptions = []; // Safe default
            setUserProfile(data);
            setViewState('dashboard');
          } else {
            setViewState('onboarding');
            setOnboardingPage(1); 
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

  // --- DATA LISTENER ---
  useEffect(() => {
    if (viewState !== 'dashboard' || !user) return;

    const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), (snap) => {
        if(snap.exists()) {
           const data = snap.data();
           // CRITICAL: Defensive coding against undefined arrays
           if (!data.subscriptions) data.subscriptions = []; 
           setUserProfile(data);
        }
    });

    const unsubPreds = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'predictions'), (snap) => {
      const preds = {}; snap.forEach(doc => { preds[doc.id] = doc.data(); }); setPredictions(preds);
    });
    
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

    // Listen to events from Firestore (scraped data)
    const eventsQuery = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'events'),
      orderBy('date', 'desc'),
      limit(50)
    );
    const unsubEvents = onSnapshot(eventsQuery, async (snap) => {
      const events = [];
      for (const d of snap.docs) {
        const data = d.data();
        // Fetch promotion logo if promotionId is available
        let promotionLogoUrl = null;
        if (data.promotionId) {
          try {
            const promoDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'promotions', data.promotionId));
            if (promoDoc.exists()) {
              promotionLogoUrl = promoDoc.data().logoUrl;
            }
          } catch (e) {
            // Silently fail if promotion not found
          }
        }
        
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
      }
      setScrapedEvents(events);
    });

    return () => {
      unsubProfile(); unsubPreds(); unsubResults(); unsubLb(); unsubEvents();
    };
  }, [viewState, user]);

  // Calculate community sentiment when event is selected
  useEffect(() => {
    if (selectedEvent?.id && viewState === 'dashboard') {
      calculateCommunitySentiment(selectedEvent.id);
    }
  }, [selectedEvent?.id, viewState]);

  // --- HANDLERS ---

  const handleGuestLogin = async () => {
      setIsLoggingIn(true);
      setLoginError(null);
      try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
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
    if (!email.trim() || !password.trim() || !displayName.trim()) {
      setLoginError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setLoginError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setLoginError('Passwords do not match');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: displayName.trim() });
      
      // Create user profile in Firestore
      const profile = {
        displayName: displayName.trim(),
        email: email.trim(),
        subscriptions: ['wwe', 'aew', 'njpw'],
        totalPoints: 0,
        predictionsCorrect: 0,
        predictionsTotal: 0,
        joinedAt: serverTimestamp(),
        country: 'USA',
        region: 'NA'
      };
      
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'users', userCredential.user.uid),
        profile
      );
      
      setUserProfile({ ...profile, joinedAt: new Date().toISOString() });
      setViewState('dashboard');
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
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter email and password');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
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
      
      // Check if user profile exists, if not create one
      const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        // Create new user profile for Google sign-in
        const profile = {
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          subscriptions: ['wwe', 'aew', 'njpw'],
          totalPoints: 0,
          predictionsCorrect: 0,
          predictionsTotal: 0,
          joinedAt: serverTimestamp(),
          country: 'USA',
          region: 'NA',
          provider: 'google'
        };
        
        await setDoc(profileRef, profile);
        setUserProfile({ ...profile, joinedAt: new Date().toISOString() });
      } else {
        // Update email if it's not in the profile
        const existingData = profileSnap.data();
        if (!existingData.email && user.email) {
          await updateDoc(profileRef, { email: user.email });
        }
        // Load existing profile
        setUserProfile(existingData);
      }
      
      // The auth state listener will handle navigation
      // Don't clear loading here - let onAuthStateChanged handle it
      // This ensures the UI updates properly when auth state changes
      
    } catch (error) {
      clearTimeout(loadingTimeout);
      console.error("Google sign in error:", error);
      setIsLoggingIn(false);
      
      let errorMessage = "Failed to sign in with Google. ";
      if (error.code === 'auth/popup-closed-by-user') {
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
  };

  const completeOnboarding = async () => {
    if (!tempName.trim() || isSubmitting) return;
    if (!user) return;
    
    setIsSubmitting(true);

    const localProfile = {
      displayName: tempName,
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
    const currentPreds = predictions[eventId] || {};
    // Support both old format (string) and new format (object with winner and method)
    const newPreds = { 
      ...currentPreds, 
      [matchId]: method ? {
        winner: winner,
        method: method
      } : winner // Backward compatible: if no method, store as string
    };
    setPredictions(prev => ({ ...prev, [eventId]: newPreds }));
    if(user) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'predictions', eventId), newPreds, { merge: true });
      // Recalculate community sentiment after making a prediction
      setTimeout(() => calculateCommunitySentiment(eventId), 1000);
    }
  };

  // Calculate community sentiment (pick percentages) for an event
  const calculateCommunitySentiment = async (eventId) => {
    if (!eventId) return;
    
    try {
      // Get all user predictions for this event
      // Users are stored at: artifacts/{appId}/public/data/users/{userId}
      // Predictions are stored at: artifacts/{appId}/users/{userId}/predictions/{eventId}
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      const matchCounts = {};
      
      const promises = [];
      usersSnapshot.forEach(userDoc => {
        // Predictions path: artifacts/{appId}/users/{userId}/predictions/{eventId}
        const userPredictionsRef = doc(db, 'artifacts', appId, 'users', userDoc.id, 'predictions', eventId);
        promises.push(getDoc(userPredictionsRef));
      });
      
      const predDocs = await Promise.all(promises);
      
      // Get event data for match info
      const event = scrapedEvents.find(e => e.id === eventId) || 
                    INITIAL_EVENTS.find(e => e.id === eventId);
      
      if (!event) {
        return;
      }
      
      predDocs.forEach(predDoc => {
        if (predDoc.exists()) {
          const preds = predDoc.data();
          Object.keys(preds).forEach(matchId => {
            const pred = preds[matchId];
            // Handle both old format (string) and new format (object)
            const winner = typeof pred === 'string' ? pred : (pred?.winner || pred);
            
            if (!matchCounts[matchId]) {
              matchCounts[matchId] = { p1: 0, p2: 0 };
            }
            
            // Get match info to determine p1 vs p2
            const match = event.matches.find(m => m.id.toString() === matchId.toString());
            if (match) {
              if (winner === match.p1) {
                matchCounts[matchId].p1++;
              } else if (winner === match.p2) {
                matchCounts[matchId].p2++;
              }
            }
          });
        }
      });
      
      // Calculate percentages
      const sentiment = {};
      Object.keys(matchCounts).forEach(matchId => {
        const counts = matchCounts[matchId];
        const total = counts.p1 + counts.p2;
        if (total > 0) {
          sentiment[matchId] = {
            p1: Math.round((counts.p1 / total) * 100),
            p2: Math.round((counts.p2 / total) * 100),
            total: total
          };
        }
      });
      
      setCommunitySentiment(prev => ({
        ...prev,
        [eventId]: sentiment
      }));
    } catch (error) {
      console.error("Error calculating community sentiment:", error);
    }
  };

  const simulateEventResult = (event) => {
    const results = {};
    event.matches.forEach(m => { results[m.id] = Math.random() > 0.5 ? m.p1 : m.p2; });
    setEventResults(prev => ({ ...prev, [event.id]: results }));
    
    if(user) {
      // FIXED: Use 6 segment path for document writing: artifacts/appId/public/data/scores/global
      setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'scores', 'global'), { [event.id]: results }, { merge: true });
      
      let correctCount = 0;
      const myPreds = predictions[event.id] || {};
      event.matches.forEach(m => { 
        const pred = myPreds[m.id];
        // Handle both old format (string) and new format (object)
        const predictedWinner = typeof pred === 'string' ? pred : (pred?.winner || pred);
        if (predictedWinner === results[m.id]) correctCount++; 
      });
      
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
      });
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

  const myEvents = useMemo(() => {
    // CRITICAL: Safety check for subscriptions array
    const subs = userProfile?.subscriptions || [];
    
    // Use scraped events from Firestore if available, otherwise fall back to INITIAL_EVENTS
    const eventsToUse = scrapedEvents.length > 0 ? scrapedEvents : INITIAL_EVENTS;
    
    return eventsToUse.filter(ev => {
      // Match by promoId (wwe, aew, etc.) or by promotionId (1, 2287, etc.)
      return subs.includes(ev.promoId) || 
             (ev.promotionId && subs.some(sub => {
               const promoMap = { 'wwe': '1', 'aew': '2287', 'njpw': '7', 'tna': '5', 'roh': '122' };
               return promoMap[sub] === ev.promotionId;
             }));
    });
  }, [userProfile, scrapedEvents]);

  // --- VIEW: LOADING ---
  if (authLoading || viewState === 'loading') {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Activity className="animate-spin text-red-600" /></div>;
  }

  // --- VIEW: LOGIN ---
  if (viewState === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col p-6 animate-fadeIn relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-2/3 bg-gradient-to-b from-red-900/20 to-slate-950 z-0"></div>
         <div className="relative z-10 flex flex-col h-full max-w-md mx-auto w-full">
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 mb-8">
                <div className="w-24 h-24 bg-red-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-900/50 mb-4 transform -rotate-3">
                   <Trophy className="text-white w-12 h-12" />
                </div>
                <div>
                   <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">PRO<span className="text-red-600">PICK'EM</span></h1>
                   <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed">Predict winners. Climb ranks. Become a legend.</p>
                </div>
            </div>
            
            {/* Auth Mode Tabs */}
            <div className="flex gap-2 mb-6 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => { setAuthMode('guest'); setLoginError(null); }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                  authMode === 'guest' 
                    ? 'bg-red-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Guest
              </button>
              <button
                onClick={() => { setAuthMode('signin'); setLoginError(null); }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                  authMode === 'signin' 
                    ? 'bg-red-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setLoginError(null); }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                  authMode === 'signup' 
                    ? 'bg-red-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            <div className="space-y-4 mb-8">
               {loginError && (
                 <div className={`p-3 rounded-lg text-xs text-center border ${
                   loginError.includes('sent') || loginError.includes('Check')
                     ? 'bg-green-900/30 text-green-400 border-green-900/50'
                     : 'bg-red-900/30 text-red-400 border-red-900/50'
                 }`}>
                   {loginError}
                 </div>
               )}

               {/* Guest Login */}
               {authMode === 'guest' && (
                 <>
                   <button 
                     onClick={handleGuestLogin}
                     disabled={isLoggingIn}
                     className="w-full bg-white hover:bg-slate-200 text-slate-900 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-xl disabled:opacity-50"
                   >
                      {isLoggingIn ? <Loader2 className="animate-spin" /> : <Shield size={20} />}
                      {isLoggingIn ? "Connecting..." : "Continue as Guest"}
                   </button>
                   
                   <div className="flex items-center gap-3 my-4">
                     <div className="flex-1 h-px bg-slate-800"></div>
                     <span className="text-xs text-slate-500 uppercase font-bold">Or</span>
                     <div className="flex-1 h-px bg-slate-800"></div>
                   </div>
                   
                   <button
                     onClick={handleGoogleSignIn}
                     disabled={isLoggingIn}
                     className="w-full bg-white hover:bg-slate-100 text-slate-900 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50 border border-slate-300"
                   >
                     {isLoggingIn ? (
                       <Loader2 className="animate-spin" />
                     ) : (
                       <>
                         <svg className="w-5 h-5" viewBox="0 0 24 24">
                           <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                           <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                           <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                           <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                         </svg>
                         Continue with Google
                       </>
                     )}
                   </button>
                 </>
               )}

               {/* Sign In Form */}
               {authMode === 'signin' && (
                 <div className="space-y-4">
                   <div>
                     <input
                       type="email"
                       placeholder="Email"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                       disabled={isLoggingIn}
                     />
                   </div>
                   <div>
                     <input
                       type="password"
                       placeholder="Password"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       onKeyPress={(e) => e.key === 'Enter' && handleEmailSignIn()}
                       className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                       disabled={isLoggingIn}
                     />
                   </div>
                   <button
                     onClick={handleEmailSignIn}
                     disabled={isLoggingIn}
                     className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                   >
                     {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Sign In'}
                   </button>
                   <button
                     onClick={handlePasswordReset}
                     className="w-full text-slate-400 hover:text-white text-sm font-medium"
                   >
                     Forgot password?
                   </button>
                   
                   <div className="flex items-center gap-3 my-4">
                     <div className="flex-1 h-px bg-slate-800"></div>
                     <span className="text-xs text-slate-500 uppercase font-bold">Or</span>
                     <div className="flex-1 h-px bg-slate-800"></div>
                   </div>
                   
                   <button
                     onClick={handleGoogleSignIn}
                     disabled={isLoggingIn}
                     className="w-full bg-white hover:bg-slate-100 text-slate-900 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50 border border-slate-300"
                   >
                     {isLoggingIn ? (
                       <Loader2 className="animate-spin" />
                     ) : (
                       <>
                         <svg className="w-5 h-5" viewBox="0 0 24 24">
                           <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                           <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                           <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                           <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                         </svg>
                         Sign in with Google
                       </>
                     )}
                   </button>
                 </div>
               )}

               {/* Sign Up Form */}
               {authMode === 'signup' && (
                 <div className="space-y-4">
                   <div>
                     <input
                       type="text"
                       placeholder="Display Name"
                       value={displayName}
                       onChange={(e) => setDisplayName(e.target.value)}
                       className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                       disabled={isLoggingIn}
                     />
                   </div>
                   <div>
                     <input
                       type="email"
                       placeholder="Email"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                       disabled={isLoggingIn}
                     />
                   </div>
                   <div>
                     <input
                       type="password"
                       placeholder="Password (min. 6 characters)"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                       disabled={isLoggingIn}
                     />
                   </div>
                   <div>
                     <input
                       type="password"
                       placeholder="Confirm Password"
                       value={confirmPassword}
                       onChange={(e) => setConfirmPassword(e.target.value)}
                       onKeyPress={(e) => e.key === 'Enter' && handleEmailSignUp()}
                       className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                       disabled={isLoggingIn}
                     />
                   </div>
                   <button
                     onClick={handleEmailSignUp}
                     disabled={isLoggingIn}
                     className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                   >
                     {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Create Account'}
                   </button>
                   
                   <div className="flex items-center gap-3 my-4">
                     <div className="flex-1 h-px bg-slate-800"></div>
                     <span className="text-xs text-slate-500 uppercase font-bold">Or</span>
                     <div className="flex-1 h-px bg-slate-800"></div>
                   </div>
                   
                   <button
                     onClick={handleGoogleSignIn}
                     disabled={isLoggingIn}
                     className="w-full bg-white hover:bg-slate-100 text-slate-900 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50 border border-slate-300"
                   >
                     {isLoggingIn ? (
                       <Loader2 className="animate-spin" />
                     ) : (
                       <>
                         <svg className="w-5 h-5" viewBox="0 0 24 24">
                           <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                           <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                           <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                           <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                         </svg>
                         Sign up with Google
                       </>
                     )}
                   </button>
                 </div>
               )}
            </div>
         </div>
      </div>
    );
  }

  // --- VIEW: ONBOARDING ---
  if (viewState === 'onboarding') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col p-6 animate-fadeIn">
         {onboardingPage === 1 && (
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-fadeIn">
               <h1 className="text-2xl font-black text-white italic uppercase mb-2">Who are you?</h1>
               <p className="text-slate-400 mb-6 text-sm">Choose a display name for the leaderboards.</p>
               <input 
                  type="text" 
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-bold mb-4 focus:border-red-600 outline-none"
                  placeholder="Manager Name"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
               />
               <button 
                 onClick={() => tempName.trim() && setOnboardingPage(2)}
                 disabled={!tempName.trim()}
                 className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${tempName.trim() ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}
               >
                 Next Step <ArrowRight size={18} />
               </button>
            </div>
         )}

         {onboardingPage === 2 && (
            <div className="flex-1 flex flex-col max-w-md mx-auto w-full h-full animate-fadeIn">
               <div className="mb-6">
                 <button onClick={() => setOnboardingPage(1)} className="text-slate-500 hover:text-white text-xs font-bold uppercase mb-4">← Back</button>
                 <h1 className="text-2xl font-black text-white italic uppercase mb-2">Your Territory</h1>
                 <p className="text-slate-400 text-sm">Select promotions to follow.</p>
                 {loginError && (
                   <div className="mt-4 bg-red-900/30 text-red-400 p-3 rounded-lg text-xs border border-red-900/50">
                     {loginError}
                   </div>
                 )}
               </div>
               <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 scrollbar-hide">
                  {PROMOTIONS.map(p => {
                     const isSelected = tempSubs.includes(p.id);
                     return (
                       <div key={p.id} onClick={() => handleOnboardingToggle(p.id)} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-slate-900 border-red-500/50 ring-1 ring-red-500/20' : 'bg-slate-900/50 border-slate-800 opacity-60'}`}>
                          <div className={`w-10 h-10 p-1 rounded-lg border bg-slate-800 ${p.border}`}><BrandLogo id={p.id} /></div>
                          <span className="flex-1 font-bold text-white">{p.name}</span>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-red-600 border-red-600 text-white' : 'border-slate-600'}`}>{isSelected && <CheckCircle size={12} />}</div>
                       </div>
                     );
                  })}
               </div>
               <button 
                 onClick={completeOnboarding} 
                 disabled={tempSubs.length === 0 || isSubmitting}
                 className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${tempSubs.length > 0 ? 'bg-white text-black hover:bg-slate-200 shadow-xl' : 'bg-slate-800 text-slate-500'}`}
               >
                 {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles size={18} className="text-red-600" />}
                 {isSubmitting ? "Starting..." : "Start Career"}
               </button>
            </div>
         )}
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-red-600 selection:text-white pb-20 md:pb-0 animate-fadeIn">
      <nav className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => setActiveTab('home')}>
            <Trophy className="text-red-600 w-5 h-5" />
            <span className="font-black text-lg tracking-tighter italic text-white">PRO<span className="text-red-600">PICK'EM</span></span>
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
            <div className="flex items-center justify-between px-1"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Calendar size={12} /> Upcoming PPVs</h3></div>
            {myEvents.length === 0 ? (
               <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-dashed border-slate-800"><Filter className="w-12 h-12 text-slate-700 mx-auto mb-3" /><p className="text-slate-500 text-sm mb-4">Feed empty.</p><button onClick={() => setActiveTab('settings')} className="bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-bold">Add Promotions</button></div>
            ) : (
              myEvents.map(event => {
                const promo = PROMOTIONS.find(p => p.id === event.promoId);
                // Use scraped bannerUrl/posterUrl if available, otherwise fall back to hardcoded EVENT_BACKGROUNDS
                const bgImage = event.bannerUrl || event.posterUrl || EVENT_BACKGROUNDS[event.id] || EVENT_BACKGROUNDS['wwe-survivor-2025'];
                const isGraded = eventResults[event.id];
                return (
                  <div key={event.id} onClick={() => { setSelectedEvent(event); setActiveTab('event'); }} className="group relative bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer rounded-2xl overflow-hidden shadow-xl" style={{ height: '200px' }}>
                    <div className="absolute inset-0"><img src={bgImage} alt="poster" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-500 group-hover:scale-105" referrerPolicy="no-referrer" onError={(e) => { e.target.src = EVENT_BACKGROUNDS['wwe-survivor-2025']; }} /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div></div>
                    <div className="absolute inset-0 p-5 flex flex-col justify-end">
                      <div className="flex justify-between items-end">
                        <div className="flex-1">
                          <div className="mb-3 flex items-center gap-2">
                             <div className="w-10 h-10 p-1 bg-slate-950/80 rounded-lg backdrop-blur-sm border border-slate-800"><BrandLogo id={promo.id} /></div>
                             {isGraded && <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"><CheckCircle size={10} /> Complete</div>}
                          </div>
                          <h4 className="font-black text-2xl text-white leading-none mb-1 italic uppercase shadow-black drop-shadow-md">{event.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium"><span className="flex items-center gap-1"><Calendar size={10} /> {event.date}</span><span className="w-1 h-1 rounded-full bg-slate-500"></span><span className="flex items-center gap-1"><MapPin size={10} /> {event.venue}</span></div>
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
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center">
               <Trophy className="mx-auto text-yellow-500 mb-2 w-8 h-8 drop-shadow-lg" />
               <h2 className="text-2xl font-black text-white mb-4">Rankings</h2>
               <div className="flex p-1 bg-slate-950 rounded-lg border border-slate-800">
                  {['global', 'country', 'region', 'friends'].map(scope => (
                    <button key={scope} onClick={() => setLeaderboardScope(scope)} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${leaderboardScope === scope ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`}>{scope}</button>
                  ))}
               </div>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
               <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between text-[10px] font-bold uppercase text-slate-500 tracking-wider"><span>Manager</span><span>Score</span></div>
               <div className="divide-y divide-slate-800">
                  {filteredLeaderboard.map((player, idx) => {
                    const isMe = player.id === userId;
                    return (
                      <div key={player.id} className={`p-4 flex items-center justify-between transition-colors ${isMe ? 'bg-red-900/10' : 'hover:bg-slate-800/50'}`}>
                         <div className="flex items-center gap-4">
                            <div className={`font-black font-mono text-sm w-8 text-center ${idx === 0 ? 'text-yellow-400 text-lg' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-orange-400' : 'text-slate-600'}`}>{idx + 1}</div>
                            <div className="flex flex-col">
                               <div className="flex items-center gap-2"><span className={`font-bold text-sm ${isMe ? 'text-red-500' : 'text-white'}`}>{player.displayName}</span>{isMe && <span className="text-[8px] font-bold bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">YOU</span>}</div>
                               <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">{leaderboardScope !== 'global' && <span className="flex items-center gap-1"><Flag size={8} /> {player.country || 'USA'}</span>}<span>{player.predictionsCorrect} Wins</span></div>
                            </div>
                         </div>
                         <div className="font-mono font-black text-white">{player.totalPoints}</div>
                      </div>
                    );
                  })}
               </div>
            </div>
            
            {leaderboardScope === 'friends' && (
               <div className="text-center">
                  <button className="text-xs font-bold text-slate-500 hover:text-white flex items-center justify-center gap-2 mx-auto">
                     <UserPlus size={14} /> Invite Friends
                  </button>
               </div>
            )}
          </div>
        )}

        {activeTab === 'event' && selectedEvent && (
          <div className="pb-24 animate-slideUp">
            <button onClick={() => setActiveTab('home')} className="mb-4 text-slate-500 hover:text-white flex items-center gap-1 text-xs font-bold uppercase tracking-wider">← Feed</button>
            <div className="mb-6 relative h-48 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
              <img src={selectedEvent.bannerUrl || selectedEvent.posterUrl || EVENT_BACKGROUNDS[selectedEvent.id] || EVENT_BACKGROUNDS['wwe-survivor-2025']} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" onError={(e) => { e.target.src = EVENT_BACKGROUNDS['wwe-survivor-2025']; }} />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-6 w-full text-center"><div className="inline-block w-16 h-16 p-2 bg-slate-950/50 backdrop-blur-md rounded-xl border border-slate-700 mb-2 shadow-lg"><BrandLogo id={selectedEvent.promoId} /></div><h1 className="text-3xl font-black italic uppercase text-white shadow-black drop-shadow-lg">{selectedEvent.name}</h1></div>
            </div>
            <div className="space-y-6">
              {selectedEvent.matches.map((match) => {
                const myPickData = predictions[selectedEvent.id]?.[match.id];
                // Handle both old format (string) and new format (object)
                const myPick = typeof myPickData === 'string' ? myPickData : (myPickData?.winner || myPickData);
                const myMethod = typeof myPickData === 'object' ? myPickData?.method : null;
                const actualWinner = eventResults[selectedEvent.id]?.[match.id];
                const isCorrect = actualWinner && myPick === actualWinner;
                const sentiment = communitySentiment[selectedEvent.id]?.[match.id];
                const matchKey = `${selectedEvent.id}-${match.id}`;
                
                return (
                  <div key={match.id} className="relative group">
                    <div className="text-center mb-2"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-800">{match.title}</span></div>
                    
                    {/* Community Sentiment Bar */}
                    {!actualWinner && (
                      <div className="mb-3 px-2">
                        {sentiment && sentiment.total > 0 ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] text-slate-500 font-bold uppercase">Community Pick %</span>
                              <span className="text-[9px] text-slate-600">({sentiment.total} picks)</span>
                            </div>
                            <div className="flex h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-blue-600 transition-all duration-500" 
                                style={{ width: `${sentiment.p1}%` }}
                                title={`${sentiment.p1}% picked ${match.p1}`}
                              ></div>
                              <div 
                                className="bg-purple-600 transition-all duration-500" 
                                style={{ width: `${sentiment.p2}%` }}
                                title={`${sentiment.p2}% picked ${match.p2}`}
                              ></div>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                              <span>{sentiment.p1}% {match.p1.split(' ')[0]}</span>
                              <span>{sentiment.p2}% {match.p2.split(' ')[0]}</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <span className="text-[9px] text-slate-600 font-medium">No community picks yet - be the first!</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-1 h-64"> 
                      <div onClick={() => !actualWinner && makePrediction(selectedEvent.id, match.id, match.p1, selectedMethod[matchKey] || 'pinfall')} className={`flex-1 relative rounded-l-2xl overflow-hidden cursor-pointer transition-all duration-300 border-y border-l ${myPick === match.p1 ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] z-10' : 'border-slate-800 hover:border-slate-600'} ${actualWinner && actualWinner !== match.p1 ? 'grayscale opacity-50' : ''}`}>
                         <WrestlerImage name={match.p1} className="w-full h-full" imageUrl={match.p1Image} />
                         <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-3 px-2 text-center">
                           <span className={`block font-black text-lg uppercase leading-none ${myPick === match.p1 ? 'text-red-500' : 'text-white'}`}>{match.p1}</span>
                           {myPick === match.p1 && <span className="text-[8px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full inline-block mt-1">YOUR PICK</span>}
                           {sentiment && sentiment.p1 > 50 && <div className="text-[8px] text-blue-400 font-bold mt-1">🔥 {sentiment.p1}% FAVORITE</div>}
                         </div>
                         {actualWinner === match.p1 && <div className="absolute top-2 left-2 bg-green-500 text-black text-[10px] font-black px-2 py-1 rounded uppercase shadow-lg z-20">Winner</div>}
                      </div>
                      <div className="w-1 bg-slate-900 flex items-center justify-center relative z-20"><div className="absolute bg-slate-950 border border-slate-700 rounded-full w-8 h-8 flex items-center justify-center text-[10px] font-black text-slate-500 italic shadow-xl">VS</div></div>
                      <div onClick={() => !actualWinner && makePrediction(selectedEvent.id, match.id, match.p2, selectedMethod[matchKey] || 'pinfall')} className={`flex-1 relative rounded-r-2xl overflow-hidden cursor-pointer transition-all duration-300 border-y border-r ${myPick === match.p2 ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] z-10' : 'border-slate-800 hover:border-slate-600'} ${actualWinner && actualWinner !== match.p2 ? 'grayscale opacity-50' : ''}`}>
                         <WrestlerImage name={match.p2} className="w-full h-full" imageUrl={match.p2Image} />
                         <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-3 px-2 text-center">
                           <span className={`block font-black text-lg uppercase leading-none ${myPick === match.p2 ? 'text-red-500' : 'text-white'}`}>{match.p2}</span>
                           {myPick === match.p2 && <span className="text-[8px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full inline-block mt-1">YOUR PICK</span>}
                           {sentiment && sentiment.p2 > 50 && <div className="text-[8px] text-purple-400 font-bold mt-1">🔥 {sentiment.p2}% FAVORITE</div>}
                         </div>
                         {actualWinner === match.p2 && <div className="absolute top-2 right-2 bg-green-500 text-black text-[10px] font-black px-2 py-1 rounded uppercase shadow-lg z-20">Winner</div>}
                      </div>
                    </div>
                    
                    {/* Method of Victory Selector */}
                    {myPick && !actualWinner && (
                      <div className="mt-3 px-2">
                        <label className="block text-[10px] text-slate-500 font-bold uppercase mb-2">Method of Victory</label>
                        <select
                          value={selectedMethod[matchKey] || myMethod || 'pinfall'}
                          onChange={(e) => {
                            setSelectedMethod(prev => ({ ...prev, [matchKey]: e.target.value }));
                            makePrediction(selectedEvent.id, match.id, myPick, e.target.value);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
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
                    
                    {actualWinner && (
                      <div className={`mt-2 text-center text-xs font-bold uppercase tracking-wider p-2 rounded-lg border ${isCorrect ? 'bg-green-900/20 border-green-900 text-green-400' : 'bg-red-900/20 border-red-900 text-red-400'}`}>
                        {isCorrect ? '+10 POINTS' : 'INCORRECT'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!eventResults[selectedEvent.id] && (
              <div className="mt-12 pt-8 border-t border-slate-800">
                <button onClick={() => simulateEventResult(selectedEvent)} className="w-full py-4 border-2 border-dashed border-slate-700 text-slate-500 hover:text-white hover:border-slate-500 rounded-xl font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"><Activity size={18} /> Simulate Event (Demo)</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="space-y-6 animate-fadeIn pb-24">
              <h2 className="text-2xl font-black text-white">Settings</h2>
              
              {/* Account Info */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                 <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Account</h3>
                 <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <div>
                       <div className="font-bold text-white">{userProfile?.displayName || user?.displayName || 'Guest User'}</div>
                       <div className="text-xs text-slate-500">
                         {user?.email || 'Anonymous account'}
                       </div>
                       <div className="text-xs text-slate-600">ID: {user?.uid?.substring(0,8)}...</div>
                     </div>
                     <button onClick={handleLogout} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                       <LogOut size={14} /> Sign Out
                     </button>
                   </div>
                   
                   {accountError && (
                     <div className="bg-red-900/30 text-red-400 p-3 rounded-lg text-xs border border-red-900/50">
                       {accountError}
                     </div>
                   )}
                   
                   {accountSuccess && (
                     <div className="bg-green-900/30 text-green-400 p-3 rounded-lg text-xs border border-green-900/50">
                       {accountSuccess}
                     </div>
                   )}
                 </div>
              </div>

              {/* Update Display Name */}
              {user && !user.isAnonymous && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Display Name</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Display Name"
                      value={displayName || userProfile?.displayName || user?.displayName || ''}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    />
                    <button
                      onClick={handleUpdateDisplayName}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      Update Display Name
                    </button>
                  </div>
                </div>
              )}

              {/* Change Email */}
              {user && !user.isAnonymous && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Change Email</h3>
                  <div className="space-y-3">
                    <div className="text-xs text-slate-500 mb-2">Current: {user.email}</div>
                    <input
                      type="email"
                      placeholder="New Email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    />
                    <button
                      onClick={handleChangeEmail}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      Update Email
                    </button>
                  </div>
                </div>
              )}

              {/* Change Password */}
              {user && !user.isAnonymous && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Change Password</h3>
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleChangePassword()}
                      className="w-full bg-slate-950/50 border border-slate-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    />
                    <button
                      onClick={handleChangePassword}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              )}

              {/* Guest Account Upgrade Notice */}
              {user && user.isAnonymous && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Upgrade to Account</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Create an account to save your predictions and settings permanently.
                  </p>
                  <button
                    onClick={() => {
                      handleLogout();
                      setViewState('login');
                      setAuthMode('signup');
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                  >
                    Create Account
                  </button>
                </div>
              )}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                 <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Promotions</h3>
                 <div className="space-y-3">
                    {PROMOTIONS.map(p => (
                       <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/50">
                          <div className="flex items-center gap-3"><div className="w-10 h-10 p-1 bg-slate-900 rounded border border-slate-800"><BrandLogo id={p.id} /></div><span className="font-bold">{p.name}</span></div>
                          <Toggle enabled={(userProfile?.subscriptions||[]).includes(p.id)} onClick={() => handleToggleSub(p.id)} />
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-md border-t border-slate-800 pb-safe md:pb-0 z-50">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'home' ? 'text-red-500' : 'text-slate-500'}`}><Calendar size={20} strokeWidth={2.5} /><span className="text-[8px] uppercase font-bold mt-1">Events</span></button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'leaderboard' ? 'text-red-500' : 'text-slate-500'}`}><BarChart3 size={20} strokeWidth={2.5} /><span className="text-[8px] uppercase font-bold mt-1">Rankings</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'settings' ? 'text-red-500' : 'text-slate-500'}`}><Settings size={20} strokeWidth={2.5} /><span className="text-[8px] uppercase font-bold mt-1">Config</span></button>
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