import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { SPORTS } from '../data/sports.js'
import { db } from '../firebase.js'
import { sanitizeComplianceText } from './complianceSanitize.js'

const NEWS_TTL_MS = 6 * 60 * 60 * 1000

function cacheIsFresh(generatedAt) {
  if (!generatedAt || typeof generatedAt.toMillis !== 'function') return false
  return Date.now() - generatedAt.toMillis() < NEWS_TTL_MS
}

function parseJsonFromModelText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty model text')
  }
  const t = text.trim()
  const fenced = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  for (const candidate of [t, fenced]) {
    try {
      return JSON.parse(candidate)
    } catch {
      /* try next */
    }
  }
  const match = t.match(/\[[\s\S]*\]/)
  if (match) return JSON.parse(match[0])
  throw new Error('Could not parse JSON array from model response')
}

function normalizeStory(raw) {
  return {
    sport: typeof raw?.sport === 'string' ? raw.sport : '',
    type: raw?.type === 'Paralympic' ? 'Paralympic' : 'Olympic',
    headline: typeof raw?.headline === 'string' ? raw.headline : '',
    description: typeof raw?.description === 'string' ? raw.description : '',
    source: typeof raw?.source === 'string' ? raw.source : '',
    url: typeof raw?.url === 'string' ? raw.url : null,
    impact: Number(raw?.impact) || 0,
    timeAgo: typeof raw?.timeAgo === 'string' ? raw.timeAgo : '',
  }
}

/** Firestore rejects undefined; use null optional fields and defaults elsewhere */
function cleanNewsStory(item) {
  const n = Number(item?.impact ?? 0)
  return {
    sport: item?.sport || '',
    type: item?.type || 'Olympic',
    headline: sanitizeComplianceText(item?.headline || ''),
    description: sanitizeComplianceText(item?.description || ''),
    source: item?.source || '',
    url: item?.url || null,
    impact: Number.isFinite(n) ? n : 0,
    timeAgo: item?.timeAgo || 'recently',
  }
}

function cleanNewsStories(stories) {
  if (!Array.isArray(stories)) return []
  return stories.map((item) => cleanNewsStory(item))
}

async function fetchTopNewsFromGemini() {
  const sportList = SPORTS.map((s) => s.name).join(', ')
  const prompt = `You MUST use Google Search to find recent articles. Search results should be from the last 30 days.

Search the web for the 2 most recent and significant TEAM USA news stories from the last 7 days that affect momentum heading into the LA28 Games. Include both Olympic and Paralympic sports if possible.

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

EXCLUSION RULES (CRITICAL):
- DO NOT surface news primarily about corporate sponsorships, partnerships, financial deals, or banking arrangements with Team USA, USOPC, or LA28
- DO NOT mention specific corporate brand names (JPMorgan, Nike, Coca-Cola, Visa, etc.) in headlines or descriptions
- Focus instead on:
  * Athletic program developments
  * Qualifying events and trials
  * Federation news (NGB certifications, governance changes)
  * Sport debut/inclusion announcements
  * Training and program milestones
  * Roster and competition results (medals/placements only)
- The story should be about Team USA's competitive trajectory, not commercial relationships

CRITICAL RULES:
- Team USA / US-scope only. Do not surface international athlete stories.
- Reference medals and placements only. NEVER reference specific finish times, scores, or measurement values.
- Do NOT name specific athletes. Use program-level language ("Team USA Para Athletics", "Wheelchair Rugby program").
- Stories should focus on programs, federations, qualifications, milestones — not individual athlete performances.

For each story, return:
- The sport name (must match a sport from this list: ${sportList})
- The sport type (Olympic or Paralympic)
- A paraphrased headline focusing on the program-level story (do not name athletes)
- A 2-line description under 25 words (no athlete names, no finish times)
- The source publication name
- An estimated momentum impact (1-10 positive, or negative for cooling)
- How long ago published

DO NOT include URLs in your response. Sources will be added separately from search grounding.

Return ONLY a JSON array:
[
  {
    "sport": "Sport Name",
    "type": "Olympic" or "Paralympic",
    "headline": "string",
    "description": "string",
    "source": "publication name",
    "impact": number,
    "timeAgo": "string"
  }
]

Use conditional phrasing.`

  const key = import.meta.env.VITE_GEMINI_API_KEY
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.7,
        },
      }),
    },
  )

  const data = await response.json()
  console.log('=== NEWS DEBUG ===')
  console.log('Full response:', JSON.stringify(data, null, 2))
  if (!response.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data)
    throw new Error(`Gemini API error: ${msg}`)
  }

  const candidate = data.candidates[0]
  console.log('Candidate:', candidate)
  console.log('Grounding metadata:', candidate?.groundingMetadata)
  console.log('Grounding chunks:', candidate?.groundingMetadata?.groundingChunks)
  const groundingChunks = candidate.groundingMetadata?.groundingChunks || []

  const sourceUrls = groundingChunks
    .filter((chunk) => chunk.web?.uri)
    .map((chunk) => ({
      url: chunk.web.uri,
      title: chunk.web.title || '',
    }))
  console.log('Extracted source URLs:', sourceUrls)

  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  const parsed = parseJsonFromModelText(text)
  if (!Array.isArray(parsed)) {
    throw new Error('Gemini returned non-array news payload')
  }

  // Try to match each news item to a source URL by source name
  // Otherwise use grounding URLs in order
  parsed.forEach((item, index) => {
    const itemSource = String(item?.source || '').toLowerCase().trim()
    const matchByName = itemSource
      ? sourceUrls.find((s) => {
          const t = String(s.title || '').toLowerCase().trim()
          return (
            (t && t.includes(itemSource)) ||
            (itemSource && t && itemSource.includes(t.slice(0, 10)))
          )
        })
      : null

    if (matchByName) {
      item.url = matchByName.url
    } else if (sourceUrls[index]) {
      item.url = sourceUrls[index].url
    } else {
      item.url = null
    }
  })

  console.log(
    'News with URLs:',
    parsed.map((p) => ({ source: p?.source, url: p?.url })),
  )

  const corporateKeywords = [
    'jpmorgan',
    'jp morgan',
    'chase bank',
    'nike',
    'coca-cola',
    'coke',
    'visa',
    'mastercard',
    'samsung',
    'panasonic',
    'toyota',
    'p&g',
    'procter',
    'airbnb',
    'omega',
    'allianz',
    'intel',
    'atos',
    'bridgestone',
    'deloitte',
    'ufc',
    'wwe',
    'red bull',
    'monster energy',
    'gatorade',
    'powerade',
  ]

  const filteredNews = parsed.filter((item) => {
    const fullText = `${item?.headline || ''} ${item?.description || ''} ${item?.source || ''}`.toLowerCase()
    return !corporateKeywords.some((keyword) => fullText.includes(keyword))
  })

  let chosen = filteredNews
  if (filteredNews.length < 2) {
    console.warn('Too many news items filtered for corporate content. Using safe fallback.')
    const fallbackA = SPORTS.find((s) => s.name === 'Athletics') || SPORTS[0]
    const fallbackB =
      SPORTS.find((s) => s.name === 'Swimming') ||
      SPORTS.find((s) => s.name !== fallbackA?.name) ||
      SPORTS[0]
    chosen = [
      {
        sport: fallbackA?.name || 'Athletics',
        type: fallbackA?.type || 'Olympic',
        headline: 'Team USA program signals steady preparation heading into LA28 Games',
        description: 'Recent program milestones could suggest building momentum; results may indicate improving competitive readiness.',
        source: 'Team USA update',
        impact: 2,
        timeAgo: 'recently',
        url: null,
      },
      {
        sport: fallbackB?.name || 'Swimming',
        type: fallbackB?.type || 'Olympic',
        headline: 'Team USA pathway milestones may indicate rising LA28 momentum',
        description: 'Trial and qualification indicators could suggest strengthening depth; placements may indicate positive trajectory.',
        source: 'Team USA update',
        impact: 2,
        timeAgo: 'recently',
        url: null,
      },
    ]
  }

  return chosen.map(normalizeStory).filter((s) => s.sport && s.headline)
}

export async function fetchTopNews(options = {}) {
  const force = options.force === true
  const docRef = doc(db, 'news', 'top-stories')

  if (!force) {
    const cached = await getDoc(docRef)
    if (cached.exists()) {
      const d = cached.data()
      if (cacheIsFresh(d.generatedAt) && Array.isArray(d.stories)) {
        return cleanNewsStories(d.stories)
      }
    }
  }

  const stories = await fetchTopNewsFromGemini()
  const cleanedNews = cleanNewsStories(stories)
  await setDoc(docRef, {
    stories: cleanedNews,
    generatedAt: serverTimestamp(),
  })
  return cleanedNews
}

