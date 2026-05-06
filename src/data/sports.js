/** Deterministic pseudo-random integer in [0, max) from a string seed */
function hashToInt(seed, max) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % max
}

function momentumForSport({ name, type }) {
  if (type === 'Paralympic') {
    return 80 + hashToInt(`${name}|para`, 13) // 80–92 inclusive
  }
  return 60 + hashToInt(`${name}|oly`, 26) // 60–85 inclusive
}

export const CATEGORIES = [
  'all',
  'aquatic',
  'athletics',
  'combat',
  'precision',
  'team',
  'individual',
  'gymnastics',
  'cycling',
]

// 59 official LA28 sports (36 Olympic + 23 Paralympic).
// Momentum scores are placeholders (will be replaced later).
const RAW_SPORTS = [
  // Olympic (36)
  { name: 'Swimming', type: 'Olympic', category: 'aquatic' },
  { name: 'Artistic Swimming', type: 'Olympic', category: 'aquatic' },
  { name: 'Diving', type: 'Olympic', category: 'aquatic' },
  { name: 'Marathon Swimming', type: 'Olympic', category: 'aquatic' },
  { name: 'Water Polo', type: 'Olympic', category: 'aquatic' },

  { name: 'Athletics', type: 'Olympic', category: 'athletics' },

  { name: 'Archery', type: 'Olympic', category: 'precision' },
  { name: 'Shooting', type: 'Olympic', category: 'precision' },
  { name: 'Golf', type: 'Olympic', category: 'precision' },

  { name: 'Boxing', type: 'Olympic', category: 'combat' },
  { name: 'Fencing', type: 'Olympic', category: 'combat' },
  { name: 'Judo', type: 'Olympic', category: 'combat' },
  { name: 'Taekwondo', type: 'Olympic', category: 'combat' },
  { name: 'Wrestling', type: 'Olympic', category: 'combat' },

  { name: 'Artistic Gymnastics', type: 'Olympic', category: 'gymnastics' },
  { name: 'Rhythmic Gymnastics', type: 'Olympic', category: 'gymnastics' },
  { name: 'Trampoline', type: 'Olympic', category: 'gymnastics' },

  { name: 'Cycling BMX', type: 'Olympic', category: 'cycling' },
  { name: 'Cycling Mountain Bike', type: 'Olympic', category: 'cycling' },
  { name: 'Cycling Road', type: 'Olympic', category: 'cycling' },
  { name: 'Cycling Track', type: 'Olympic', category: 'cycling' },

  { name: 'Baseball', type: 'Olympic', category: 'team' },
  { name: 'Basketball', type: 'Olympic', category: 'team' },
  { name: '3x3 Basketball', type: 'Olympic', category: 'team' },
  { name: 'Beach Volleyball', type: 'Olympic', category: 'team' },
  { name: 'Cricket', type: 'Olympic', category: 'team' },
  { name: 'Field Hockey', type: 'Olympic', category: 'team' },
  { name: 'Flag Football', type: 'Olympic', category: 'team' },
  { name: 'Soccer', type: 'Olympic', category: 'team' },

  { name: 'Badminton', type: 'Olympic', category: 'individual' },
  { name: 'Canoe Slalom', type: 'Olympic', category: 'individual' },
  { name: 'Canoe Sprint', type: 'Olympic', category: 'individual' },
  { name: 'Equestrian', type: 'Olympic', category: 'individual' },
  { name: 'Modern Pentathlon', type: 'Olympic', category: 'individual' },
  { name: 'Rowing', type: 'Olympic', category: 'individual' },
  { name: 'Sailing', type: 'Olympic', category: 'individual' },

  // Paralympic (23)
  { name: 'Para Swimming', type: 'Paralympic', category: 'aquatic' },
  { name: 'Para Athletics', type: 'Paralympic', category: 'athletics' },
  { name: 'Para Archery', type: 'Paralympic', category: 'precision' },
  { name: 'Boccia', type: 'Paralympic', category: 'precision' },
  { name: 'Shooting Para Sport', type: 'Paralympic', category: 'precision' },
  { name: 'Para Judo', type: 'Paralympic', category: 'combat' },
  { name: 'Para Taekwondo', type: 'Paralympic', category: 'combat' },
  { name: 'Wheelchair Fencing', type: 'Paralympic', category: 'combat' },
  { name: 'Blind Football', type: 'Paralympic', category: 'team' },
  { name: 'Goalball', type: 'Paralympic', category: 'team' },
  { name: 'Sitting Volleyball', type: 'Paralympic', category: 'team' },
  { name: 'Wheelchair Basketball', type: 'Paralympic', category: 'team' },
  { name: 'Wheelchair Rugby', type: 'Paralympic', category: 'team' },
  { name: 'Para Cycling', type: 'Paralympic', category: 'cycling' },
  { name: 'Para Badminton', type: 'Paralympic', category: 'individual' },
  { name: 'Para Canoe', type: 'Paralympic', category: 'individual' },
  { name: 'Para Climbing', type: 'Paralympic', category: 'individual' },
  { name: 'Para Equestrian', type: 'Paralympic', category: 'individual' },
  { name: 'Para Powerlifting', type: 'Paralympic', category: 'individual' },
  { name: 'Para Rowing', type: 'Paralympic', category: 'individual' },
  { name: 'Para Table Tennis', type: 'Paralympic', category: 'individual' },
  { name: 'Para Triathlon', type: 'Paralympic', category: 'individual' },
  { name: 'Wheelchair Tennis', type: 'Paralympic', category: 'individual' },
]

export const SPORTS = RAW_SPORTS.map((s) => ({
  ...s,
  momentum: momentumForSport(s),
  // Populated client-side from Firestore aggregates (see Market.jsx)
  communityScore: 0,
}))
