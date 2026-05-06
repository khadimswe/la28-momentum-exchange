import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'
import { SPORTS } from '../data/sports.js'

export async function calculateCommunityScores() {
  const snapshot = await getDocs(collection(db, 'portfolios'))

  const totalsBySport = {}
  let totalPoints = 0

  snapshot.forEach((docSnap) => {
    const data = docSnap.data()
    const allocations = data?.allocations ?? {}

    for (const [sportName, rawValue] of Object.entries(allocations)) {
      const value = Number(rawValue) || 0
      totalsBySport[sportName] = (totalsBySport[sportName] ?? 0) + value
      totalPoints += value
    }
  })

  const scores = {}
  for (const s of SPORTS) {
    const sportTotal = totalsBySport[s.name] ?? 0
    scores[s.name] = totalPoints > 0 ? (sportTotal / totalPoints) * 100 : 0
  }

  return scores
}
