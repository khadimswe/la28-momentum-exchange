import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { SPORTS } from '../data/sports.js'
import { db } from '../firebase.js'
import { sanitizeComplianceText } from './complianceSanitize.js'
import { getCachedMomentum } from './computeMomentum.js'

/**
 * Load cached narrative or generate with Gemini using real momentum from Firestore when available.
 */
export async function getOrGenerateNarrative(sport) {
  try {
    const docRef = doc(db, 'narratives', sport.name)
    const cached = await getDoc(docRef)

    if (cached.exists() && cached.data()?.narrative) {
      return sanitizeComplianceText(String(cached.data().narrative)) || cached.data().narrative
    }

    const momentumDoc = await getCachedMomentum(sport.name)
    const rawM = momentumDoc?.momentum
    const momentumNum =
      typeof rawM === 'number' && !Number.isNaN(rawM)
        ? rawM
        : Number(sport.momentum) || 0

    await new Promise((resolve) => setTimeout(resolve, 500))

    const key = import.meta.env.VITE_GEMINI_API_KEY
    const realMomentum = Math.round(momentumNum)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a Team USA sports analyst. Generate a one-sentence momentum narrative for ${sport.name} (${sport.type}) heading into LA28.

CRITICAL TERMINOLOGY RULES (NON-NEGOTIABLE):
- Use official sport names ONLY. NEVER use NGB (National Governing Body) names. 
  Examples of FORBIDDEN: "USA Badminton", "USA Swimming", "US Track & Field", "USA Wrestling"
  Examples of CORRECT: "badminton program", "swimming program", "Team USA badminton"
- Use "Athletics" (NEVER "Track & Field"). The sport is called Athletics.
- For LA28: use "LA28 Games" or "LA28 Olympic and Paralympic Games"
- For other Games: use "Olympic Games [City] [Year]" format (e.g. "Olympic Games Paris 2024", NOT just "2024 Olympics" or "Paris 2024")
- For Winter Games: "Olympic Winter Games [City] [Year]" (e.g. "Olympic Winter Games Beijing 2022")
- NEVER use "former Olympian" or "past Olympian" — once an Olympian/Paralympian, always one
- Reference medals and placements (1st, 2nd, 3rd) only
- NEVER reference finish times, scores, distances, or measurement values  
- Use Team USA / US-scope only
- Do not name specific athletes by name
- Use conditional phrasing throughout

CRITICAL RULES:
- Team USA / US-scope only.
- Reference medals and placements only. NEVER finish times, scores, or measurements.
- Do NOT name specific athletes.
- Use conditional phrasing like 'could suggest' or 'may indicate'.
- Under 25 words.

Real momentum score (from analytical formula): ${realMomentum}/100

Generate the narrative based on this real score, not a generic statement.`,
                },
              ],
            },
          ],
        }),
      },
    )

    const data = await response.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Analysis unavailable.'
    const narrative =
      rawText === 'Analysis unavailable.'
        ? rawText
        : sanitizeComplianceText(String(rawText).trim()) || 'Analysis unavailable.'

    if (narrative !== 'Analysis unavailable.') {
      await setDoc(docRef, {
        narrative,
        generatedAt: serverTimestamp(),
      })
    }

    return narrative
  } catch (e) {
    console.error('Narrative error for', sport.name, e)
    return 'Analysis unavailable.'
  }
}

/** Regenerate narratives for all sports (call after clearing the narratives collection). */
export async function regenerateAllNarratives() {
  const total = SPORTS.length
  for (let i = 0; i < total; i += 1) {
    const sport = SPORTS[i]
    console.log(`[narratives ${i + 1}/${total}] ${sport.name} (${sport.type})`)
    await getOrGenerateNarrative(sport)
    await new Promise((r) => setTimeout(r, 500))
  }
  console.log('[narratives] regenerateAllNarratives finished')
}
