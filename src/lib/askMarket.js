import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { sanitizeComplianceText } from './complianceSanitize.js'

const QA_TTL_MS = 12 * 60 * 60 * 1000

function cacheIsFresh(generatedAt) {
  if (!generatedAt || typeof generatedAt.toMillis !== 'function') return false
  return Date.now() - generatedAt.toMillis() < QA_TTL_MS
}

function hashQuestion(question) {
  return String(question ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 100)
}

function safeModelText(candidate) {
  const text = candidate?.content?.parts?.map((p) => p?.text ?? '').join('') ?? ''
  return String(text || '').trim()
}

function extractGroundedSources(candidate) {
  const chunks = candidate?.groundingMetadata?.groundingChunks
  if (!Array.isArray(chunks)) return []
  const unique = []
  const seen = new Set()
  for (const c of chunks) {
    const uri = c?.web?.uri
    if (!uri || typeof uri !== 'string') continue
    if (seen.has(uri)) continue
    seen.add(uri)
    unique.push({
      url: uri,
      title: c?.web?.title || new URL(uri).hostname,
    })
    if (unique.length >= 5) break
  }
  return unique
}

function parseAnswerAndRelated(fullText) {
  const full = String(fullText ?? '').trim()
  const relatedMatch = full.match(/RELATED:\s*(.+)/i)
  const relatedSports = relatedMatch
    ? relatedMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : []
  const answer = full.replace(/RELATED:.*$/im, '').trim()
  return { answer, relatedSports }
}

/**
 * Ask the Market with (1) grounded web search, (2) cached momentum context, (3) synthesis.
 * Streams step updates via `onStepUpdate({ step, status, detail })`.
 */
export async function askMarketQuestion(question, onStepUpdate, momentumScores) {
  const q = String(question ?? '').trim()
  if (!q) throw new Error('Question is required')

  const docId = hashQuestion(q)
  const cacheRef = doc(db, 'qa-cache', docId)

  // Cache check (12h)
  const cachedSnap = await getDoc(cacheRef)
    if (cachedSnap.exists()) {
      const d = cachedSnap.data()
      if (cacheIsFresh(d?.generatedAt) && d?.answer && Array.isArray(d?.sources)) {
        const cachedResult = {
          answer: sanitizeComplianceText(String(d.answer)),
          sources: d.sources,
          relatedSports: Array.isArray(d.relatedSports) ? d.relatedSports : [],
        }

      onStepUpdate?.({ step: 1, status: 'complete', detail: `Found ${cachedResult.sources.length} sources in the last 30 days` })
      onStepUpdate?.({ step: 2, status: 'complete', detail: `Analyzed ${Object.keys(momentumScores || {}).length} sport momentum scores` })
      onStepUpdate?.({ step: 3, status: 'complete', detail: 'Synthesis complete' })
      return cachedResult
    }
  }

  // Step 1: Search recent news with Gemini grounding
  onStepUpdate?.({ step: 1, status: 'active', detail: 'Searching the web...' })

  const searchKey = import.meta.env.VITE_GEMINI_API_KEY
  const newsPrompt = `CRITICAL TERMINOLOGY RULES (NON-NEGOTIABLE):
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

Search the web for recent Team USA news related to this question: "${q}". Return a brief summary of 3-5 relevant articles found. Focus on momentum-affecting stories.`

  const newsResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${searchKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: newsPrompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
  )

  const newsData = await newsResponse.json()
  if (!newsResponse.ok) {
    const msg = newsData?.error?.message ?? JSON.stringify(newsData)
    throw new Error(`Gemini API error: ${msg}`)
  }

  const newsCandidate = newsData?.candidates?.[0]
  const newsContext = safeModelText(newsCandidate)
  const newsSources = extractGroundedSources(newsCandidate)

  onStepUpdate?.({
    step: 1,
    status: 'complete',
    detail: `Found ${newsSources.length} sources in the last 30 days`,
  })

  // Step 2: Read momentum data from cached scores
  onStepUpdate?.({ step: 2, status: 'active', detail: 'Reading cached momentum scores...' })

  const ms = momentumScores && typeof momentumScores === 'object' ? momentumScores : {}
  const momentumContext = Object.entries(ms)
    .map(([name, data]) => {
      const m = Math.round(Number(data?.momentum) || 0)
      const P = Math.round(Number(data?.P) || 0)
      const T = Math.round(Number(data?.T) || 0)
      const M = Math.round(Number(data?.M) || 0)
      const C = Math.round(Number(data?.C) || 0)
      return `${name}: ${m}/100 (P:${P} T:${T} M:${M} C:${C})`
    })
    .join('\n')

  await new Promise((r) => setTimeout(r, 600))

  onStepUpdate?.({
    step: 2,
    status: 'complete',
    detail: `Analyzed ${Object.keys(ms).length} sport momentum scores`,
  })

  // Step 3: Synthesize answer
  onStepUpdate?.({ step: 3, status: 'active', detail: 'Cross-referencing data and news...' })

  const synthPrompt = `You are a Team USA sports analyst answering a fan question about LA28 momentum.

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
- Use conditional phrasing throughout.

Question: "${q}"

Recent news context: ${newsContext}

Cached momentum data for all 59 LA28 sports (composite score out of 100, with P=Performance Growth, T=Trajectory, M=Media Momentum, C=Competitive Context):
${momentumContext}

Provide a clear, conversational answer in 2-3 sentences. Use conditional phrasing like "could suggest" and "may indicate". Reference specific sport names from the momentum data. Never guarantee results.

After your answer, on a new line, list the 1-3 most relevant sport names from the data (exact names) prefixed with "RELATED:" comma-separated.

Example format:
Para Climbing could suggest a strong LA28 trajectory based on its 93/100 momentum and recent breakthrough results. The data may indicate the nation is significantly underweighting this sport given the trajectory signal.
RELATED: Para Climbing, Para Athletics`

  const synthResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${searchKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: synthPrompt }] }],
      }),
    },
  )

  const synthData = await synthResponse.json()
  if (!synthResponse.ok) {
    const msg = synthData?.error?.message ?? JSON.stringify(synthData)
    throw new Error(`Gemini API error: ${msg}`)
  }

  const synthCandidate = synthData?.candidates?.[0]
  const fullAnswer = safeModelText(synthCandidate)
  if (!fullAnswer) throw new Error('Gemini returned an empty answer')

  const parsed = parseAnswerAndRelated(fullAnswer)
  if (!parsed.answer) throw new Error('Gemini returned a malformed answer')

  onStepUpdate?.({ step: 3, status: 'complete', detail: 'Synthesis complete' })

  const result = {
    answer: sanitizeComplianceText(parsed.answer),
    sources: newsSources,
    relatedSports: parsed.relatedSports,
  }

  await setDoc(cacheRef, { ...result, generatedAt: serverTimestamp() })

  return result
}

