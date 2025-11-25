/**
 * Application constants
 * Centralized constants for better maintainability
 */

export const VIEW_STATES = {
  LOADING: 'loading',
  LOGIN: 'login',
  ONBOARDING: 'onboarding',
  DASHBOARD: 'dashboard',
};

export const EVENT_TYPES = {
  PPV: 'ppv',
  WEEKLY: 'weekly',
  PAST: 'past',
};

export const LEADERBOARD_SCOPES = {
  GLOBAL: 'global',
  COUNTRY: 'country',
  REGION: 'region',
  FRIENDS: 'friends',
};

export const AUTH_MODES = {
  GUEST: 'guest',
  SIGNIN: 'signin',
  SIGNUP: 'signup',
};

export const PROMOTIONS = [
  { id: 'wwe', name: 'WWE', border: 'border-red-600' },
  { id: 'aew', name: 'AEW', border: 'border-blue-500' },
  { id: 'njpw', name: 'NJPW', border: 'border-red-500' },
  { id: 'tna', name: 'TNA', border: 'border-blue-600' },
  { id: 'roh', name: 'ROH', border: 'border-red-700' },
  { id: 'stardom', name: 'Stardom', border: 'border-pink-500' },
  { id: 'cmll', name: 'CMLL', border: 'border-blue-400' },
  { id: 'aaa', name: 'AAA', border: 'border-yellow-500' },
  { id: 'gcw', name: 'GCW', border: 'border-orange-500' },
  { id: 'mlw', name: 'MLW', border: 'border-purple-500' },
];
