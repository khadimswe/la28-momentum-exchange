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
  const prompt = `Search the web for 2 RECENT real news articles from the last 14 days about Team USA Olympic or Paralympic sports preparation for LA28 Games.

REQUIRED COMPLIANCE RULES (must follow):
- Use Team USA / US-scope only
- DO NOT mention finish times, scores, distances, or measurement values
- DO NOT include corporate sponsorship or banking news (no Nike, JPMorgan, Visa, etc.)
- Use proper Games terminology: "LA28 Games", "Olympic Games Paris 2024", "Olympic Winter Games Beijing 2022"
- Never use "former Olympian" or "past Olympian"
- Use official sport names (Athletics not Track and Field, Swimming not USA Swimming)

ALLOWED CONTENT:
- Real news about LA28 preparation
- Federation announcements and program updates
- Trial results, championship outcomes (medals/placements only)
- Sport debuts at LA28
- Roster announcements at the team or program level
- Even if winter Olympic news comes up, you can include it IF it ties to broader Team USA athletic momentum and isn't focused on individual athletes

ATHLETE REFERENCES:
- You CAN reference athletes generically when the news genuinely covers it (e.g. "an Olympian on the roster")
- You CAN mention "Olympic medalist" or "world championship medalist" if the article does
- AVOID identifying specific people through unique descriptors (e.g. "the only American to win 5 Olympic medals in Para Swimming")
- Strip athlete names if they appear

For each story return:
- sport: name of the sport
- type: "Olympic" or "Paralympic"
- headline: the actual headline (paraphrased to remove any athlete names)
- description: 2-line summary under 30 words
- source: real publication name (Reuters, AP, USA Today, ESPN, Team USA, Olympics.com, Paralympic.org, etc.)
- impact: number 1-10 positive, or negative
- timeAgo: relative time

Return ONLY a JSON array. Make these REAL articles you find via search grounding.`

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

  // Just filter corporate sponsorship news
  const corporateKeywords = [
    'jpmorgan',
    'jp morgan',
    'chase bank',
    'nike sponsorship',
    'coca-cola',
    'visa partnership',
    'mastercard',
    'samsung',
    'panasonic',
    'toyota partnership',
    'sponsorship deal',
    'official sponsor',
    'official bank',
  ]

  const filteredNews = parsed.filter((item) => {
    const fullText = `${item?.headline || ''} ${item?.description || ''}`.toLowerCase()
    return !corporateKeywords.some((keyword) => fullText.includes(keyword))
  })

  // Strip any athlete names that snuck through with regex (common "Name Lastname" patterns)
  const stripNames = (text) => {
    if (!text) return text
    return String(text)
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+'s\b/g, "the athlete's")
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+ won\b/g, 'the athlete won')
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+ secured\b/g, 'the athlete secured')
  }

  filteredNews.forEach((item) => {
    item.headline = stripNames(item?.headline)
    item.description = stripNames(item?.description)
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
      // PRODUCTION: always use cached news, never refetch from Gemini
      if (Array.isArray(d.stories) && d.stories.length > 0) {
        return cleanNewsStories(d.stories)
      }
    }
  }

  console.log('No cached news found, falling back to Gemini fetch')
  const stories = await fetchTopNewsFromGemini()
  const cleanedNews = cleanNewsStories(stories)
  await setDoc(docRef, {
    stories: cleanedNews,
    generatedAt: serverTimestamp(),
  })
  return cleanedNews
}

