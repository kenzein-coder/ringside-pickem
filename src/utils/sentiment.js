/**
 * Community sentiment simulation: deterministic “crowd” percentages per match.
 */

const POPULARITY_SCORES = {
  'Cody Rhodes': 95, 'Roman Reigns': 90, 'The Rock': 95, 'John Cena': 92,
  'CM Punk': 88, 'Seth Rollins': 85, 'Rhea Ripley': 88, 'Becky Lynch': 87,
  'Randy Orton': 82, 'Kevin Owens': 80, 'Sami Zayn': 85, 'Drew McIntyre': 78,
  'Kenny Omega': 88, 'MJF': 75, 'Jon Moxley': 82, 'Will Ospreay': 90,
  'Hangman Adam Page': 80, 'Orange Cassidy': 85, 'Sting': 92, 'Darby Allin': 82,
  'Chris Jericho': 78, 'Mercedes Moné': 80, 'Jamie Hayter': 78, 'Toni Storm': 82,
  'Kazuchika Okada': 88, 'Hiroshi Tanahashi': 90, 'Tetsuya Naito': 85,
  'Zack Sabre Jr.': 75, 'Shingo Takagi': 80, 'Hiromu Takahashi': 82,
  'Nic Nemeth': 80, 'Josh Alexander': 78, 'Jordynne Grace': 82, 'Moose': 72,
  'OG Bloodline': 88, 'Original Bloodline': 88, 'Team Rhea': 85, 'The Young Bucks': 70,
  'FTR': 80, 'The Acclaimed': 82, 'House of Black': 72, 'Death Riders': 70,
  'The Elite': 75, 'New Bloodline': 65, 'Team Liv': 72, 'Bloodline 2.0': 65,
  'The Undertaker': 95, 'Triple H': 85, 'Shawn Michaels': 92, 'Stone Cold Steve Austin': 95,
  'Hulk Hogan': 80, 'Ric Flair': 88,
};

export function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(Math.sin(hash) * 10000) % 1;
}

export function getPopularityScore(name) {
  if (!name) return 60;
  if (POPULARITY_SCORES[name]) return POPULARITY_SCORES[name];
  for (const [wrestler, score] of Object.entries(POPULARITY_SCORES)) {
    if (name.toLowerCase().includes(wrestler.toLowerCase()) ||
        wrestler.toLowerCase().includes(name.toLowerCase())) {
      return score;
    }
  }
  return 50 + Math.floor(seededRandom(name) * 30);
}

export function generateSimulatedSentiment(match, eventId) {
  const p1Score = getPopularityScore(match.p1);
  const p2Score = getPopularityScore(match.p2);
  const totalScore = p1Score + p2Score;
  let p1Base = (p1Score / totalScore) * 100;
  const variance = seededRandom(`${eventId}-${match.id}`) * 12 - 6;
  p1Base = Math.min(85, Math.max(15, p1Base + variance));
  const p1Pct = Math.round(p1Base);
  const p2Pct = 100 - p1Pct;
  const isMainEvent = match.id === 1 || (match.title?.toLowerCase().includes('championship'));
  const baseTotal = isMainEvent ? 800 : 300;
  const totalVariance = Math.floor(seededRandom(`total-${eventId}-${match.id}`) * baseTotal);
  const total = baseTotal + totalVariance;
  return { p1: p1Pct, p2: p2Pct, total, simulated: true };
}
