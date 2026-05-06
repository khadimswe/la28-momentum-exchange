/**
 * Gemini search-grounded momentum scores with Firestore caching (collection `momentum`).
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { SPORTS } from '../data/sports.js'
import { db } from '../firebase.js'
import { sanitizeComplianceText } from './complianceSanitize.js'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function buildPrompt(sportName, sportType) {
  return `You are analyzing TEAM USA momentum for ${sportName} (${sportType}) heading into the LA28 Games.

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
- Use ONLY Team USA data. US-scope only. Do not reference international athletes or results.
- Reference medals and placements (1st, 2nd, 3rd) only.
- NEVER reference specific finish times, scores, distances, or measurement values.
- Do NOT name specific athletes by name. Reference programs and teams generically.

Use this momentum formula:
Momentum = 0.4(P) + 0.25(T) + 0.2(M) + 0.15(C)

Search the web for recent Team USA data only and compute each component on a 0-100 scale:

P (Performance Growth): Compare Team USA medal counts at the last 2 World Championships versus the 2 before that. Score the percentage growth. Medals only, no times.

T (Trajectory): Calculate the slope of Team USA medal counts across the last 4 World Championships. Steeper positive slope means higher score.

M (Media Momentum): Analyze recent Team USA news article volume and sentiment about ${sportName}. Higher positive sentiment and article growth means higher score.

C (Competitive Context): How globally competitive is ${sportName}? Score based on number of medaling countries and depth of competition. Harder competition means higher meaningfulness score.

Return ONLY a JSON object:
{
  "P": number 0-100,
  "T": number 0-100,
  "M": number 0-100,
  "C": number 0-100,
  "momentum": calculated number from formula,
  "reasoning": {
    "performance": "1-2 sentence explanation referencing only Team USA medals and placements, no times or athlete names",
    "trajectory": "1-2 sentence explanation, same restrictions",
    "media": "1-2 sentence explanation about Team USA program coverage, no athlete names",
    "context": "1-2 sentence explanation about competitive depth"
  }
}

Use conditional phrasing like 'could suggest' and 'may indicate' throughout. Never guarantee results.`
}

function parseJsonFromModelText(text) {
  if (!text) throw new Error('Empty response from model')

  let cleaned = String(text).trim()

  // Strip markdown code fences in any form
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '')

  // Find JSON object boundaries
  const objStart = cleaned.indexOf('{')
  const objEnd = cleaned.lastIndexOf('}')

  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    cleaned = cleaned.substring(objStart, objEnd + 1)
  }

  // Try parsing as-is
  try {
    return JSON.parse(cleaned)
  } catch {
    // Attempt to fix common issues
    const attempt2 = cleaned
      .replace(/,\s*}/g, '}') // trailing commas before }
      .replace(/,\s*\]/g, ']') // trailing commas before ]
      .replace(/[\n\r\t]/g, ' ') // newlines inside strings break JSON
      .replace(/\s+/g, ' ') // collapse whitespace

    try {
      return JSON.parse(attempt2)
    } catch {
      // Final attempt: extract just the keys we need with regex
      const result = {}
      const pMatch = attempt2.match(/"P"\s*:\s*([\d.]+)/)
      const tMatch = attempt2.match(/"T"\s*:\s*([\d.]+)/)
      const mMatch = attempt2.match(/"M"\s*:\s*([\d.]+)/)
      const cMatch = attempt2.match(/"C"\s*:\s*([\d.]+)/)

      if (pMatch && tMatch && mMatch && cMatch) {
        result.P = parseFloat(pMatch[1])
        result.T = parseFloat(tMatch[1])
        result.M = parseFloat(mMatch[1])
        result.C = parseFloat(cMatch[1])
        result.momentum = momentumFromComponents(result.P, result.T, result.M, result.C)
        result.reasoning = {
          performance: 'Reasoning unavailable due to parse error.',
          trajectory: 'Reasoning unavailable due to parse error.',
          media: 'Reasoning unavailable due to parse error.',
          context: 'Reasoning unavailable due to parse error.',
        }
        return result
      }

      throw new Error('Could not parse JSON from model response')
    }
  }
}

function momentumFromComponents(P, T, M, C) {
  return 0.4 * P + 0.25 * T + 0.2 * M + 0.15 * C
}

function normalizeSources(groundingMetadata) {
  const chunks = groundingMetadata?.groundingChunks
  if (!Array.isArray(chunks)) return []
  return chunks.map((chunk) => ({
    uri: chunk.web?.uri ?? null,
    title: chunk.web?.title ?? null,
  }))
}

function coercePayload(raw) {
  const P = Number(raw.P)
  const T = Number(raw.T)
  const M = Number(raw.M)
  const C = Number(raw.C)
  if ([P, T, M, C].some((n) => Number.isNaN(n))) {
    throw new Error('Invalid P/T/M/C in parsed JSON')
  }
  const computed = momentumFromComponents(P, T, M, C)
  const momentum =
    typeof raw.momentum === 'number' && !Number.isNaN(raw.momentum)
      ? raw.momentum
      : computed
  return {
    P,
    T,
    M,
    C,
    momentum,
    reasoning:
      raw.reasoning && typeof raw.reasoning === 'object'
        ? raw.reasoning
        : {
            performance: '',
            trajectory: '',
            media: '',
            context: '',
          },
  }
}

function momentumDocToResult(data) {
  if (!data || typeof data !== 'object') return null
  const P = Number(data.P)
  const T = Number(data.T)
  const M = Number(data.M)
  const C = Number(data.C)
  const momentum = Number(data.momentum)
  if ([P, T, M, C, momentum].some((n) => Number.isNaN(n))) {
    return null
  }
  const r =
    data.reasoning && typeof data.reasoning === 'object'
      ? data.reasoning
      : { performance: '', trajectory: '', media: '', context: '' }
  return {
    P,
    T,
    M,
    C,
    momentum,
    reasoning: {
      performance: sanitizeComplianceText(String(r.performance ?? '')),
      trajectory: sanitizeComplianceText(String(r.trajectory ?? '')),
      media: sanitizeComplianceText(String(r.media ?? '')),
      context: sanitizeComplianceText(String(r.context ?? '')),
    },
    sources: Array.isArray(data.sources) ? data.sources : [],
  }
}

function cacheIsFresh(generatedAt) {
  if (!generatedAt || typeof generatedAt.toMillis !== 'function') {
    return false
  }
  return Date.now() - generatedAt.toMillis() < CACHE_TTL_MS
}

async function fetchMomentumFromGemini(sportName, sportType) {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  const prompt = buildPrompt(sportName, sportType)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data)
    throw new Error(`Gemini API error: ${msg}`)
  }

  const candidate = data.candidates?.[0]
  if (!candidate) {
    throw new Error(
      `No response candidate: ${JSON.stringify(data.promptFeedback ?? data)}`,
    )
  }
  const text =
    candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''

  const groundingMetadata = candidate?.groundingMetadata ?? null
  const sources = normalizeSources(groundingMetadata)

  const raw = parseJsonFromModelText(text)
  const normalized = coercePayload(raw)

  const reasoning = {
    performance: sanitizeComplianceText(normalized.reasoning.performance),
    trajectory: sanitizeComplianceText(normalized.reasoning.trajectory),
    media: sanitizeComplianceText(normalized.reasoning.media),
    context: sanitizeComplianceText(normalized.reasoning.context),
  }

  return {
    P: normalized.P,
    T: normalized.T,
    M: normalized.M,
    C: normalized.C,
    momentum: normalized.momentum,
    reasoning,
    sources,
  }
}

export async function getCachedMomentum(sportName) {
  const docRef = doc(db, 'momentum', sportName)
  const snap = await getDoc(docRef)
  if (!snap.exists()) {
    return null
  }
  return momentumDocToResult(snap.data())
}

export async function computeSportMomentum(sportName, sportType) {
  const docRef = doc(db, 'momentum', sportName)

  const cached = await getDoc(docRef)
  if (cached.exists()) {
    const d = cached.data()
    if (cacheIsFresh(d.generatedAt)) {
      const fromCache = momentumDocToResult(d)
      if (fromCache) {
        return fromCache
      }
    }
  }

  const result = await fetchMomentumFromGemini(sportName, sportType)

  await setDoc(docRef, {
    ...result,
    sportType,
    generatedAt: serverTimestamp(),
  })

  return result
}

export async function computeAllMomentum() {
  console.log(`Starting momentum generation for ${SPORTS.length} sports`)
  const failures = []

  for (let i = 0; i < SPORTS.length; i++) {
    const sport = SPORTS[i]
    console.log(`[Momentum ${i + 1}/${SPORTS.length}] ${sport.name} (${sport.type})`)

    try {
      const result = await computeSportMomentum(sport.name, sport.type)
      console.log(`  ✓ score: ${result.momentum?.toFixed(1) || '?'}`)
    } catch (e) {
      console.error(`  ✗ FAILED:`, e?.message || String(e))
      failures.push({ sport: sport.name, error: e?.message || String(e) })
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log('═══════════════════════════════')
  console.log(
    `Momentum generation complete: ${SPORTS.length - failures.length}/${SPORTS.length} succeeded`,
  )

  if (failures.length > 0) {
    console.log('\nFailures:')
    failures.forEach((f) => console.log(`  - ${f.sport}: ${f.error}`))
    console.log('\nClick "Retry Failed Sports" to regenerate just these.')
  }

  return failures
}
