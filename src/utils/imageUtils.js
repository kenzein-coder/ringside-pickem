/**
 * Shared image utility functions
 * Extracted from App.jsx for reuse across components
 */

// Helper function to use image proxy services
export const getProxiedImageUrl = (originalUrl, width = 400, height = 500, proxyType = 'wsrv') => {
  if (!originalUrl) return null;
  const encoded = encodeURIComponent(originalUrl);
  const proxies = {
    wsrv: `https://wsrv.nl/?url=${encoded}&w=${width}&h=${height}&fit=cover&a=attention`,
    images: `https://images.weserv.nl/?url=${encoded}&w=${width}&h=${height}&fit=cover&a=attention`,
  };
  return proxies[proxyType] || proxies.wsrv;
};

// Promotion logos - hardcoded URLs
export const PROMOTION_LOGOS = {
  wwe: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/WWE_Logo.svg/200px-WWE_Logo.svg.png',
  1: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/WWE_Logo.svg/200px-WWE_Logo.svg.png',
  aew: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/All_Elite_Wrestling_logo.svg/200px-All_Elite_Wrestling_logo.svg.png',
  2287: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/All_Elite_Wrestling_logo.svg/200px-All_Elite_Wrestling_logo.svg.png',
  njpw: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/New_Japan_Pro-Wrestling_logo.svg/200px-New_Japan_Pro-Wrestling_logo.svg.png',
  7: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/New_Japan_Pro-Wrestling_logo.svg/200px-New_Japan_Pro-Wrestling_logo.svg.png',
  tna: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Impact_Wrestling_logo.svg/200px-Impact_Wrestling_logo.svg.png',
  5: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Impact_Wrestling_logo.svg/200px-Impact_Wrestling_logo.svg.png',
  roh: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Ring_of_Honor_logo.svg/200px-Ring_of_Honor_logo.svg.png',
  122: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Ring_of_Honor_logo.svg/200px-Ring_of_Honor_logo.svg.png',
  stardom:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/World_Wonder_Ring_Stardom_logo.svg/200px-World_Wonder_Ring_Stardom_logo.svg.png',
  745: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/World_Wonder_Ring_Stardom_logo.svg/200px-World_Wonder_Ring_Stardom_logo.svg.png',
  cmll: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/CMLL_logo.svg/200px-CMLL_logo.svg.png',
  aaa: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Lucha_Libre_AAA_Worldwide_logo.svg/200px-Lucha_Libre_AAA_Worldwide_logo.svg.png',
  gcw: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Game_Changer_Wrestling_logo.png/200px-Game_Changer_Wrestling_logo.png',
  mlw: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Major_League_Wrestling_logo.svg/200px-Major_League_Wrestling_logo.svg.png',
};

// Check if local image exists
export const checkLocalImage = async path => {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok ? path : null;
  } catch {
    return null;
  }
};
