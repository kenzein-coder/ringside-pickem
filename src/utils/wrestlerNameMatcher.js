/**
 * Wrestler Name Matching Utilities
 * Handles fuzzy matching for wrestler names to account for variations
 * e.g., "Cody" vs "Cody Rhodes", "Rock" vs "The Rock"
 */

/**
 * Normalize a wrestler name for comparison
 * - Lowercase
 * - Remove punctuation
 * - Remove common prefixes (The, etc)
 * - Trim whitespace
 */
export function normalizeWrestlerName(name) {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove punctuation
    .replace(/[.,;:!?'"()]/g, '')
    // Remove common prefixes
    .replace(/^the\s+/i, '')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract key parts of a wrestler name (first name, last name, nickname)
 */
export function extractNameParts(name) {
  const normalized = normalizeWrestlerName(name);
  const parts = normalized.split(' ');
  
  return {
    full: normalized,
    first: parts[0] || '',
    last: parts[parts.length - 1] || '',
    parts: parts
  };
}

/**
 * Check if two wrestler names match (with fuzzy logic)
 * Returns true if they're considered the same wrestler
 */
export function wrestlerNamesMatch(name1, name2) {
  if (!name1 || !name2) return false;
  
  const norm1 = normalizeWrestlerName(name1);
  const norm2 = normalizeWrestlerName(name2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  const parts1 = extractNameParts(name1);
  const parts2 = extractNameParts(name2);
  
  // If one is a substring of the other (e.g., "Cody" is in "Cody Rhodes")
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  // Check if they share both first and last name
  if (parts1.first && parts2.first && parts1.last && parts2.last) {
    if (parts1.first === parts2.first && parts1.last === parts2.last) {
      return true;
    }
  }
  
  // Check if one is just the first name and matches
  if (parts1.parts.length === 1 && parts1.first === parts2.first) return true;
  if (parts2.parts.length === 1 && parts2.first === parts1.first) return true;
  
  // Check if one is just the last name and matches
  if (parts1.parts.length === 1 && parts1.last === parts2.last) return true;
  if (parts2.parts.length === 1 && parts2.last === parts1.last) return true;
  
  return false;
}

/**
 * Find matching predictions for a given winner name
 * Returns array of prediction strings that should count as correct
 */
export function findMatchingPredictions(winnerName, allPredictions) {
  const normalized = normalizeWrestlerName(winnerName);
  const matches = [];
  
  for (const prediction of allPredictions) {
    if (wrestlerNamesMatch(prediction, winnerName)) {
      matches.push(prediction);
    }
  }
  
  return matches;
}

/**
 * Calculate similarity score between two names (0-1)
 * Higher score = more similar
 */
export function calculateNameSimilarity(name1, name2) {
  const norm1 = normalizeWrestlerName(name1);
  const norm2 = normalizeWrestlerName(name2);
  
  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0;
  
  // Check substring match
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.8;
  }
  
  const parts1 = extractNameParts(name1);
  const parts2 = extractNameParts(name2);
  
  // Same first name
  if (parts1.first === parts2.first) {
    // Same last name too
    if (parts1.last === parts2.last) return 0.9;
    // Just first name
    return 0.6;
  }
  
  // Same last name only
  if (parts1.last === parts2.last && parts1.last.length > 2) {
    return 0.5;
  }
  
  // Levenshtein distance for very close matches
  const distance = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  const similarity = 1 - (distance / maxLen);
  
  return similarity > 0.7 ? similarity : 0;
}

/**
 * Calculate Levenshtein distance between two strings
 * (minimum number of edits needed to transform one into the other)
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Test the matcher with common variations
 */
export function testWrestlerMatcher() {
  const tests = [
    ['Cody Rhodes', 'Cody', true],
    ['Cody Rhodes', 'cody rhodes', true],
    ['Cody Rhodes', 'Rhodes', true],
    ['CM Punk', 'C.M. Punk', true],
    ['CM Punk', 'Punk', true],
    ['The Rock', 'Rock', true],
    ['John Cena', 'Cena', true],
    ['John Cena', 'John', true],
    ['Seth Rollins', 'Seth Freakin Rollins', true],
    ['Roman Reigns', 'Reigns', true],
    ['Roman Reigns', 'John Cena', false],
  ];
  
  console.log('🧪 Testing Wrestler Name Matcher:');
  tests.forEach(([name1, name2, expected]) => {
    const result = wrestlerNamesMatch(name1, name2);
    const pass = result === expected ? '✅' : '❌';
    console.log(`${pass} "${name1}" vs "${name2}" => ${result} (expected ${expected})`);
  });
}
