import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MomentumTicker from '../components/MomentumTicker.jsx'
import SportDetail from '../components/SportDetail.jsx'
import { CATEGORIES, SPORTS } from '../data/sports.js'
import { useMomentumScores } from '../hooks/useMomentumScores.js'
import { calculateCommunityScores } from '../lib/communityScores.js'
import { askMarketQuestion } from '../lib/askMarket.js'
import { getOrGenerateNarrative } from '../lib/narratives.js'

const TREND_COLORS = {
  Surging: '#00A651',
  Rising: '#0066CC',
  Peaking: '#FFB81C',
  Cooling: '#BF0D3E',
}

function labelForCategory(cat) {
  if (cat === 'all') return 'All'
  return cat
    .split('_')
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ')
}

function trendFromMomentum(momentum) {
  if (momentum >= 86) return 'Surging'
  if (momentum >= 78) return 'Rising'
  if (momentum >= 70) return 'Peaking'
  return 'Cooling'
}

function trendStylesFor(trend) {
  return {
    Surging: { '--trend-bg': 'rgba(0, 135, 90, 0.10)', '--trend-fg': '#00603F' },
    Rising: { '--trend-bg': 'rgba(0, 82, 204, 0.10)', '--trend-fg': '#003D99' },
    Peaking: { '--trend-bg': 'rgba(255, 153, 31, 0.12)', '--trend-fg': '#B36A00' },
    Cooling: { '--trend-bg': 'rgba(222, 53, 11, 0.10)', '--trend-fg': '#A02408' },
  }[trend]
}

function IconLockOutline() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function IconLockedCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#00875A" />
      <path
        d="M8 12l2.5 3 5.5-6.5"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function IconLockPending() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="#FF991F" strokeWidth="1.85" strokeLinecap="round" />
      <path
        d="M6 11h12v10a1 1 0 01-1 1H7a1 1 0 01-1-1V11z"
        fill="#FF991F"
        fillOpacity="0.35"
        stroke="#FF991F"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function IconLockMuted() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(107, 91, 63, 0.35)"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

export default function Market({
  addToPending = () => false,
  pendingPredictions = [],
  lockedPredictions = [],
  maxPredictions = 10,
}) {
  const navigate = useNavigate()
  const [confirmSport, setConfirmSport] = useState(null)
  const [addModalEnter, setAddModalEnter] = useState(false)
  const [narratives, setNarratives] = useState({})
  const [activeCategory, setActiveCategory] = useState('all')
  const [communityScores, setCommunityScores] = useState({})
  const [selectedSport, setSelectedSport] = useState(null)
  const [question, setQuestion] = useState('')
  const [submittedQuestion, setSubmittedQuestion] = useState(null)
  const [isReasoning, setIsReasoning] = useState(false)
  const [reasoningSteps, setReasoningSteps] = useState({})
  const [chatAnswer, setChatAnswer] = useState(null)
  const [chatError, setChatError] = useState(null)

  const { scores, loading: loadingScores } = useMomentumScores()

  const lockedNames = useMemo(() => new Set(lockedPredictions.map((p) => p.sport)), [lockedPredictions])

  const totalPredictionsUsed = pendingPredictions.length + lockedPredictions.length

  useEffect(() => {
    if (!confirmSport) {
      setAddModalEnter(false)
      return undefined
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAddModalEnter(true))
    })
    return () => cancelAnimationFrame(id)
  }, [confirmSport])

  useEffect(() => {
    if (!confirmSport) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setConfirmSport(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmSport])

  function lockIconState(sportName) {
    if (lockedNames.has(sportName)) return 'locked'
    if (pendingPredictions.includes(sportName)) return 'pending'
    if (totalPredictionsUsed >= maxPredictions) return 'max'
    return 'available'
  }

  function lockTitle(ls) {
    if (ls === 'locked') return 'Locked'
    if (ls === 'pending') return 'In your pending list'
    if (ls === 'max') return `Max ${maxPredictions} predictions reached`
    return 'Lock prediction'
  }

  const confirmModalMom = useMemo(() => {
    if (!confirmSport) return null
    const raw = Number(scores?.[confirmSport.name]?.momentum)
    const resolved = Number.isNaN(raw) ? Number(confirmSport.momentum) : raw
    const rounded = Math.round(resolved)
    const tr = trendFromMomentum(resolved)
    const color = {
      Surging: '#00875A',
      Rising: '#00875A',
      Peaking: '#FF991F',
      Cooling: '#DE350B',
    }[tr]
    return { rounded, color }
  }, [confirmSport, scores])

  const cancelledRef = useRef(false)
  const narrativesRef = useRef({})
  const highlightTimersRef = useRef([])

  useEffect(() => {
    narrativesRef.current = narratives
  }, [narratives])

  useEffect(() => {
    return () => {
      for (const t of highlightTimersRef.current) clearTimeout(t)
      highlightTimersRef.current = []
    }
  }, [])

  const EXAMPLE_CHIPS = [
    'Is Swimming on track for 2028?',
    'Which Paralympic sports are surging?',
    "What's hottest in Combat sports?",
  ]

  const handleRelatedClick = (sportName) => {
    setActiveCategory('all')
    setTimeout(() => {
      const safe = String(sportName ?? '').replace(/\s+/g, '-')
      const el = document.getElementById(`sport-card-${safe}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('card-highlight')
        const timer = setTimeout(() => el.classList.remove('card-highlight'), 2000)
        highlightTimersRef.current.push(timer)
      }
    }, 100)
  }

  const submitQuestion = async () => {
    const q = String(question ?? '').trim()
    if (!q) return

    setSubmittedQuestion(q)
    setIsReasoning(true)
    setReasoningSteps({})
    setChatAnswer(null)
    setChatError(null)

    try {
      const result = await askMarketQuestion(
        q,
        (update) => {
          setReasoningSteps((prev) => ({ ...prev, [update.step]: update }))
        },
        scores || {},
      )
      setChatAnswer(result)
      setIsReasoning(false)
    } catch (e) {
      setChatError(e?.message || 'Unknown error')
      setIsReasoning(false)
    }
  }

  const filteredSports = useMemo(() => {
    if (activeCategory === 'all') return SPORTS
    return SPORTS.filter((s) => s.category === activeCategory)
  }, [activeCategory])

  const displayedSports = useMemo(() => {
    const scoreFor = (sport) => {
      const raw = scores?.[sport.name]?.momentum
      const n = Number(raw)
      if (!Number.isNaN(n)) return n
      return sport.momentum
    }
    return [...filteredSports].sort((a, b) => scoreFor(b) - scoreFor(a))
  }, [filteredSports, scores])

  useEffect(() => {
    cancelledRef.current = false

    async function loadNarrativesForFilteredSports() {
      for (const sport of filteredSports) {
        if (cancelledRef.current) return

        if (narrativesRef.current[sport.name] !== undefined) continue

        try {
          const narrative = await getOrGenerateNarrative(sport)

          if (cancelledRef.current) return

          if (narrativesRef.current[sport.name] !== undefined) continue

          setNarratives((prev) => {
            if (prev[sport.name] !== undefined) return prev
            return { ...prev, [sport.name]: narrative }
          })
        } catch (e) {
          console.error('Narrative error for', sport.name, e)
          if (cancelledRef.current) return
          setNarratives((prev) => {
            if (prev[sport.name] !== undefined) return prev
            return { ...prev, [sport.name]: 'Analysis unavailable.' }
          })
        }
      }
    }

    void loadNarrativesForFilteredSports()

    return () => {
      cancelledRef.current = true
    }
  }, [filteredSports])

  useEffect(() => {
    let cancelled = false
    void calculateCommunityScores()
      .then((scores) => {
        if (cancelled) return
        setCommunityScores(scores)
      })
      .catch((e) => {
        console.error('Community scores load error:', e)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <style>{`
        .header.header--market {
          padding: 12px 32px;
          padding-left: 32px;
        }

        .header.header--market h1 {
          font-size: 18px;
        }

        @keyframes market-live-pulse {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0.4;
          }
        }

        @keyframes market-active-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.06);
            opacity: 1;
          }
        }

        .card-highlight {
          animation: highlight-pulse 2s ease-out;
        }

        @keyframes highlight-pulse {
          0% {
            box-shadow: 0 0 0 4px rgba(191,13,62,0.4);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(191,13,62,0);
          }
        }

        .market-ask-section {
          background: #FBF8F1;
          border: 0.5px solid #E8DFCC;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 1px 2px rgba(50,40,20,0.04), 0 8px 24px rgba(50,40,20,0.06);
          margin-bottom: 20px;
        }

        .market-live-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #6B5B3F;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .market-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #00875A;
          animation: market-live-pulse 1.5s infinite alternate;
          flex-shrink: 0;
        }

        .market-ask-title {
          margin: 0 0 4px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #0A1628;
          line-height: 1.1;
        }

        .market-ask-subtitle {
          margin: 0 0 18px;
          font-size: 13px;
          color: #6B5B3F;
          line-height: 1.45;
        }

        .market-ask-input-row {
          display: flex;
          gap: 10px;
          margin-bottom: 14px;
        }

        .market-ask-input {
          flex: 1;
          background: #fff;
          border: 0.5px solid #E8DFCC;
          border-radius: 10px;
          padding: 14px 18px;
          font-size: 14px;
          color: #0A1628;
          font-family: inherit;
          outline: none;
        }

        .market-ask-input:focus {
          border-color: #BF0D3E;
          box-shadow: 0 0 0 3px rgba(191,13,62,0.08);
        }

        .market-ask-btn {
          background: #0A1628;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 0 22px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
        }

        .market-ask-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .market-ask-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .market-ask-try-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #6B5B3F;
          font-weight: 700;
          margin-right: 2px;
        }

        .market-ask-chip {
          background: #fff;
          border: 0.5px solid #E8DFCC;
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 12px;
          color: #0A1628;
          cursor: pointer;
          font-family: inherit;
          transition: border-color 160ms ease, color 160ms ease;
        }

        .market-ask-chip:hover {
          border-color: #BF0D3E;
          color: #BF0D3E;
        }

        .market-reason-question {
          background: rgba(191,13,62,0.06);
          border-left: 3px solid #BF0D3E;
          padding: 12px 16px;
          border-radius: 0 8px 8px 0;
          margin-bottom: 18px;
          font-size: 14px;
          color: #0A1628;
          font-weight: 500;
        }

        .market-reason-step {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 12px;
        }

        .market-reason-icon {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .market-reason-icon--check {
          background: rgba(0,135,90,0.12);
          color: #00603F;
        }

        .market-reason-icon--active {
          background: rgba(191,13,62,0.12);
          color: #BF0D3E;
          animation: market-active-pulse 1.2s ease-in-out infinite;
        }

        .market-reason-title {
          font-size: 13px;
          font-weight: 600;
          color: #0A1628;
          margin: 0;
          line-height: 1.25;
        }

        .market-reason-detail {
          font-size: 12px;
          color: #6B5B3F;
          margin: 2px 0 0;
          line-height: 1.35;
        }

        .market-reason-detail--active {
          font-style: italic;
        }

        .market-answer-block {
          background: #fff;
          border: 0.5px solid #E8DFCC;
          border-radius: 10px;
          padding: 18px 20px;
          margin-top: 16px;
        }

        .market-answer-block--error {
          background: rgba(191,13,62,0.04);
          border-left: 3px solid #BF0D3E;
        }

        .market-answer-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #6B5B3F;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .market-answer-text {
          font-size: 14px;
          color: #0A1628;
          line-height: 1.6;
          margin: 0;
        }

        .market-answer-cites {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .market-answer-cite {
          font-size: 10px;
          color: #BF0D3E;
          background: rgba(191,13,62,0.06);
          padding: 3px 8px;
          border-radius: 12px;
          border: 0.5px solid rgba(191,13,62,0.2);
          font-weight: 600;
        }

        .market-answer-related {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .market-answer-related-btn {
          background: #0A1628;
          color: #fff;
          padding: 6px 12px;
          border-radius: 6px;
          border: none;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }

        .market-page .card-grid {
          gap: 1.1rem;
        }

        .market-card {
          position: relative;
          background: #FBF8F1;
          border: 0.5px solid #E8DFCC;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(50,40,20,0.04), 0 8px 24px rgba(50,40,20,0.06);
          overflow: hidden;
          cursor: pointer;
          transition: transform 280ms ease, box-shadow 280ms ease;
        }

        .market-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 10px rgba(50,40,20,0.06), 0 18px 46px rgba(50,40,20,0.12);
        }

        .market-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%);
          left: -100%;
          transition: left 800ms ease-out;
        }

        .market-card:hover::before {
          left: 100%;
        }

        .market-card-accent {
          height: 4px;
          width: 100%;
        }

        .market-card-accent--olympic {
          background: linear-gradient(90deg, #0A1628 0%, #1B2B4B 50%, #0A1628 100%);
        }

        .market-card-accent--paralympic {
          background: linear-gradient(90deg, #BF0D3E 0%, #8B0A2E 50%, #BF0D3E 100%);
        }

        .market-card-body {
          position: relative;
          z-index: 1;
          padding: 20px 22px 18px;
          display: flex;
          flex-direction: column;
        }

        .market-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .market-sport-name {
          margin: 0;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #0A1628;
          line-height: 1.05;
          letter-spacing: -0.01em;
          max-width: 15ch;
          white-space: normal;
        }

        .market-type-pill {
          flex-shrink: 0;
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 3px;
          border: 0.5px solid rgba(10,22,40,0.25);
          font-weight: 700;
          background: rgba(10,22,40,0.06);
          color: #0A1628;
          line-height: 1.2;
        }

        .market-type-pill--paralympic {
          background: rgba(191,13,62,0.08);
          color: #8B0A2E;
          border-color: rgba(191,13,62,0.3);
        }

        .market-stat-block {
          text-align: center;
          padding: 10px 0 14px;
          margin: 14px -22px 0;
          border-top: 0.5px solid #E8DFCC;
          border-bottom: 0.5px solid #E8DFCC;
          background: linear-gradient(180deg, rgba(251,248,241,0.7) 0%, rgba(239,232,213,0.35) 100%);
        }

        .market-stat-label {
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6B5B3F;
          font-weight: 700;
        }

        .market-stat-number {
          margin-top: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 56px;
          font-weight: 800;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }

        .market-stat-suffix {
          margin-top: 2px;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6B5B3F;
          font-weight: 700;
        }

        .market-trend-row {
          display: flex;
          justify-content: center;
          margin: -8px 0 14px;
        }

        .market-trend-pill {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 12px;
          background: var(--trend-pill-bg);
          color: var(--trend-pill-fg);
          line-height: 1.2;
        }

        .market-narrative {
          margin: 0 0 14px;
          font-size: 12px;
          font-style: italic;
          color: #6B5B3F;
          line-height: 1.55;
          text-align: center;
          min-height: 36px;
        }

        .market-narrative--loading {
          opacity: 0.65;
        }

        .market-compare {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 2px;
        }

        .market-compare-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .market-compare-label {
          width: 90px;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6B5B3F;
          font-weight: 600;
          margin: 0;
          flex-shrink: 0;
        }

        .market-compare-track {
          flex: 1;
          height: 5px;
          background: #EFE8D5;
          border-radius: 3px;
          overflow: hidden;
        }

        .market-compare-fill {
          height: 100%;
          border-radius: 3px;
          max-width: 100%;
        }

        .market-compare-fill--prediction {
          background: #BF0D3E;
        }

        .market-compare-fill--data {
          background: #0A1628;
        }

        .market-compare-value {
          width: 28px;
          font-size: 11px;
          font-weight: 700;
          text-align: right;
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
        }

        .market-compare-value--prediction {
          color: #BF0D3E;
        }

        .market-compare-value--data {
          color: #0A1628;
        }

        .market-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          padding-right: 44px;
          border-top: 0.5px solid #E8DFCC;
          margin-top: 4px;
          gap: 10px;
        }

        .market-card-footer-left {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6B5B3F;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .market-card-footer-right {
          font-size: 18px;
          font-weight: 700;
          color: #BF0D3E;
          line-height: 1;
          flex-shrink: 0;
        }

        .sport-card--detail {
          cursor: pointer;
          position: relative;
        }

        .market-lock-btn {
          position: absolute;
          bottom: 12px;
          right: 12px;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          padding: 0;
          border: none;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          transition: color 160ms ease, transform 140ms ease, background 160ms ease;
        }

        .market-lock-btn--active {
          color: #6b5b3f;
        }

        .market-lock-btn--active:hover {
          color: #bf0d3e;
          background: rgba(191, 13, 62, 0.06);
        }

        .market-lock-btn--active:active {
          transform: scale(0.95);
        }

        .market-lock-btn--pending {
          color: #ff991f;
          cursor: default;
        }

        .market-lock-btn--locked {
          color: #00875a;
          cursor: default;
        }

        .market-lock-btn--max {
          color: rgba(107, 91, 63, 0.35);
          cursor: not-allowed;
        }

        .market-lock-btn--pending:hover,
        .market-lock-btn--locked:hover,
        .market-lock-btn--max:hover {
          background: transparent;
          transform: none;
          filter: none;
        }

        .market-lock-btn:focus-visible {
          outline: 2px solid #bf0d3e;
          outline-offset: 2px;
        }

        .market-add-overlay {
          position: fixed;
          inset: 0;
          z-index: 120;
          background: rgba(20, 14, 5, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          opacity: 0;
          transition: opacity 200ms ease;
        }

        .market-add-overlay--open {
          opacity: 1;
        }

        .market-add-modal {
          width: 100%;
          max-width: 460px;
          background: #fbf8f1;
          border-radius: 12px;
          border: 0.5px solid #e8dfcc;
          padding: 32px;
          box-shadow: 0 28px 64px rgba(0, 0, 0, 0.22), 0 12px 24px rgba(50, 40, 20, 0.08);
          transform: scale(0.95);
          opacity: 0;
          transition: transform 200ms ease, opacity 200ms ease;
        }

        .market-add-overlay--open .market-add-modal {
          transform: scale(1);
          opacity: 1;
        }

        .market-add-label {
          margin: 0 0 12px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6b5b3f;
        }

        .market-add-summary {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 16px;
          margin-bottom: 18px;
          border-radius: 8px;
          border: 0.5px solid #e8dfcc;
          background: rgba(251, 248, 241, 0.85);
          box-shadow: inset 0 1px 2px rgba(50, 40, 20, 0.04);
        }

        .market-add-summary-l {
          flex: 1;
          min-width: 0;
        }

        .market-add-summary-name {
          margin: 0;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #0a1628;
          line-height: 1.15;
        }

        .market-add-summary-pill {
          display: inline-block;
          margin-top: 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 4px 8px;
          border-radius: 4px;
          border: 0.5px solid rgba(61, 46, 20, 0.2);
          color: #3d2e14;
          background: rgba(255, 255, 255, 0.55);
        }

        .market-add-summary-score {
          flex-shrink: 0;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }

        .market-add-q {
          margin: 0 0 12px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #0a1628;
        }

        .market-add-body {
          margin: 0 0 20px;
          font-size: 14px;
          line-height: 1.55;
          color: #3d4757;
        }

        .market-add-remind {
          margin: 0 0 22px;
          font-size: 12px;
          font-style: italic;
          color: #6b5b3f;
          line-height: 1.45;
        }

        .market-add-actions {
          display: flex;
          gap: 12px;
        }

        .market-add-actions button {
          flex: 1;
          padding: 14px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
        }

        .market-add-cancel {
          background: #fbf8f1;
          color: #0a1628;
          border: 0.5px solid #e8dfcc;
        }

        .market-add-cancel:hover {
          border-color: rgba(10, 22, 40, 0.35);
        }

        .market-add-submit {
          background: #0a1628;
          color: #fff;
          border: none;
        }

        .market-add-submit:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .market-add-submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          filter: none;
        }

        .market-scores-loading {
          margin: 0 0 1.1rem;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6B5B3F;
          opacity: 0.95;
        }
      `}</style>

      <MomentumTicker />

      <header className="header header--market">
        <div className="header-inner">
          <h1>Sports Market</h1>
          <div className="title-accent" aria-hidden="true" />
          <p className="subtitle">
            Track the momentum of every Team USA sport heading into the 2028 Games
          </p>
        </div>
      </header>

      <main className="main market-page">
        {loadingScores && (
          <div className="market-scores-loading">Loading momentum scores…</div>
        )}

        <section className="market-ask-section" aria-label="Ask the Market">
          <div className="market-live-row">
            <span className="market-live-dot" aria-hidden="true" />
            <span>Powered by Gemini · Search grounded</span>
          </div>

          <h2 className="market-ask-title">Ask the Market</h2>
          <p className="market-ask-subtitle">
            Get insights about LA28 sports backed by real Team USA data and recent news.
          </p>

          <form
            className="market-ask-input-row"
            onSubmit={(e) => {
              e.preventDefault()
              submitQuestion()
            }}
          >
            <input
              className="market-ask-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What momentum trends do you see in Paralympic sports?"
              aria-label="Ask the Market question"
            />
            <button className="market-ask-btn" type="submit" disabled={!String(question).trim()}>
              Ask →
            </button>
          </form>

          <div className="market-ask-chips" aria-label="Example questions">
            <span className="market-ask-try-label">Try:</span>
            {EXAMPLE_CHIPS.map((txt) => (
              <button
                key={txt}
                type="button"
                className="market-ask-chip"
                onClick={() => setQuestion(txt)}
              >
                {txt}
              </button>
            ))}
          </div>
        </section>

        {submittedQuestion != null && (
          <section className="market-ask-section" aria-label="Ask the Market reasoning">
            <div className="market-reason-question">{submittedQuestion}</div>

            {reasoningSteps?.[1] != null && (
              <div className="market-reason-step">
                <span
                  className={`market-reason-icon ${
                    reasoningSteps[1].status === 'complete'
                      ? 'market-reason-icon--check'
                      : 'market-reason-icon--active'
                  }`}
                  aria-hidden="true"
                >
                  {reasoningSteps[1].status === 'complete' ? '✓' : '⏵'}
                </span>
                <div>
                  <p className="market-reason-title">Searching recent news</p>
                  <p
                    className={`market-reason-detail${
                      reasoningSteps[1].status === 'active' ? ' market-reason-detail--active' : ''
                    }`}
                  >
                    {reasoningSteps[1].detail}
                  </p>
                </div>
              </div>
            )}

            {reasoningSteps?.[2] != null && (
              <div className="market-reason-step">
                <span
                  className={`market-reason-icon ${
                    reasoningSteps[2].status === 'complete'
                      ? 'market-reason-icon--check'
                      : 'market-reason-icon--active'
                  }`}
                  aria-hidden="true"
                >
                  {reasoningSteps[2].status === 'complete' ? '✓' : '⏵'}
                </span>
                <div>
                  <p className="market-reason-title">Reading momentum data</p>
                  <p
                    className={`market-reason-detail${
                      reasoningSteps[2].status === 'active' ? ' market-reason-detail--active' : ''
                    }`}
                  >
                    {reasoningSteps[2].detail}
                  </p>
                </div>
              </div>
            )}

            {reasoningSteps?.[3] != null && (
              <div className="market-reason-step">
                <span
                  className={`market-reason-icon ${
                    reasoningSteps[3].status === 'complete'
                      ? 'market-reason-icon--check'
                      : 'market-reason-icon--active'
                  }`}
                  aria-hidden="true"
                >
                  {reasoningSteps[3].status === 'complete' ? '✓' : '⏵'}
                </span>
                <div>
                  <p className="market-reason-title">Cross-referencing data</p>
                  <p
                    className={`market-reason-detail${
                      reasoningSteps[3].status === 'active' ? ' market-reason-detail--active' : ''
                    }`}
                  >
                    {reasoningSteps[3].detail}
                  </p>
                </div>
              </div>
            )}

            {!isReasoning && (chatAnswer != null || chatError != null) && (
              <div
                className={`market-answer-block${
                  chatError != null ? ' market-answer-block--error' : ''
                }`}
                aria-label="Synthesized answer"
              >
                <div className="market-answer-label">Synthesized answer</div>
                <p className="market-answer-text">
                  {chatError != null
                    ? 'Something went wrong while researching this question. Please try again or rephrase.'
                    : chatAnswer.answer}
                </p>

                {chatError == null && Array.isArray(chatAnswer?.sources) && chatAnswer.sources.length > 0 && (
                  <div className="market-answer-cites" aria-label="Citations">
                    {chatAnswer.sources.map((s) => {
                      const url = s?.url
                      let host = ''
                      try {
                        host = url ? new URL(url).hostname : ''
                      } catch {
                        host = ''
                      }
                      const label = host || s?.title || 'source'
                      return (
                        <span key={url || label} className="market-answer-cite">
                          {label}
                        </span>
                      )
                    })}
                  </div>
                )}

                {chatError == null &&
                  Array.isArray(chatAnswer?.relatedSports) &&
                  chatAnswer.relatedSports.length > 0 && (
                    <div className="market-answer-related" aria-label="Related actions">
                      {chatAnswer.relatedSports.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="market-answer-related-btn"
                          onClick={() => handleRelatedClick(name)}
                        >
                          ↓ See {name} card
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </section>
        )}

        <div className="category-tabs" role="tablist" aria-label="Sport categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={`category-tab${activeCategory === cat ? ' category-tab--active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {labelForCategory(cat)}
            </button>
          ))}
        </div>

        <div className="card-grid">
          {displayedSports.map((sport) => {
            const ls = lockIconState(sport.name)
            const score = Number(scores?.[sport.name]?.momentum)
            const resolvedScore = Number.isNaN(score) ? sport.momentum : score
            const roundedResolvedScore = Math.round(resolvedScore)
            const communityScore = Math.round(communityScores[sport.name] ?? 0)
            const trend = trendFromMomentum(resolvedScore)
            const momentumColor = {
              Surging: '#00875A',
              Rising: '#00875A',
              Peaking: '#FF991F',
              Cooling: '#DE350B',
            }[trend]

            const trendMeta = {
              Surging: { bg: 'rgba(0,135,90,0.12)', fg: '#00603F', arrow: '↑' },
              Rising: { bg: 'rgba(0,82,204,0.12)', fg: '#003D99', arrow: '↑' },
              Peaking: { bg: 'rgba(255,153,31,0.12)', fg: '#B36A00', arrow: '→' },
              Cooling: { bg: 'rgba(222,53,11,0.12)', fg: '#A02408', arrow: '↓' },
            }[trend]

            return (
              <article
                key={sport.name}
                id={`sport-card-${sport.name.replace(/\s+/g, '-')}`}
                className="market-card sport-card--detail"
                style={{
                  '--trend-pill-bg': trendMeta.bg,
                  '--trend-pill-fg': trendMeta.fg,
                }}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSport(sport)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedSport(sport)
                  }
                }}
              >
                <div
                  className={`market-card-accent ${
                    sport.type === 'Paralympic'
                      ? 'market-card-accent--paralympic'
                      : 'market-card-accent--olympic'
                  }`}
                  aria-hidden="true"
                />

                <div className="market-card-body">
                  <div className="market-card-header">
                    <h2 className="market-sport-name">{sport.name}</h2>
                    <span
                      className={`market-type-pill ${
                        sport.type === 'Paralympic' ? 'market-type-pill--paralympic' : ''
                      }`}
                    >
                      {sport.type}
                    </span>
                  </div>

                  <div className="market-stat-block">
                    <div className="market-stat-label">MOMENTUM</div>
                    <div className="market-stat-number" style={{ color: momentumColor }}>
                      {roundedResolvedScore}
                    </div>
                    <div className="market-stat-suffix">/ 100</div>
                  </div>

                  <div className="market-trend-row">
                    <span className="market-trend-pill">
                      {trendMeta.arrow} {trend}
                    </span>
                  </div>

                  <p
                    className={`market-narrative${
                      narratives[sport.name] === undefined ? ' market-narrative--loading' : ''
                    }`}
                  >
                    {narratives[sport.name] === undefined ? 'Analyzing…' : narratives[sport.name]}
                  </p>

                  <div className="market-compare" aria-label="Prediction versus data">
                    <div className="market-compare-row">
                      <p className="market-compare-label">YOUR PREDICTION</p>
                      <div className="market-compare-track" aria-hidden="true">
                        <div
                          className="market-compare-fill market-compare-fill--prediction"
                          style={{ width: `${communityScore}%` }}
                        />
                      </div>
                      <span className="market-compare-value market-compare-value--prediction">
                        {communityScore}
                      </span>
                    </div>

                    <div className="market-compare-row">
                      <p className="market-compare-label">THE DATA</p>
                      <div className="market-compare-track" aria-hidden="true">
                        <div
                          className="market-compare-fill market-compare-fill--data"
                          style={{ width: `${roundedResolvedScore}%` }}
                        />
                      </div>
                      <span className="market-compare-value market-compare-value--data">
                        {roundedResolvedScore}
                      </span>
                    </div>
                  </div>

                  <div className="market-card-footer" aria-hidden="true">
                    <div className="market-card-footer-left">TAP TO REVEAL REASONING</div>
                    <div className="market-card-footer-right">›</div>
                  </div>
                </div>

                <button
                  type="button"
                  className={`market-lock-btn market-lock-btn--${ls}`}
                  title={lockTitle(ls)}
                  aria-label={`${lockTitle(ls)}: ${sport.name}`}
                  disabled={ls !== 'available'}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    if (ls !== 'available') return
                    setConfirmSport(sport)
                  }}
                >
                  {ls === 'locked' ? (
                    <IconLockedCheck />
                  ) : ls === 'pending' ? (
                    <IconLockPending />
                  ) : ls === 'max' ? (
                    <IconLockMuted />
                  ) : (
                    <IconLockOutline />
                  )}
                </button>
              </article>
            )
          })}
        </div>
      </main>

      {confirmSport != null && confirmModalMom != null && (
        <div
          className={`market-add-overlay${addModalEnter ? ' market-add-overlay--open' : ''}`}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmSport(null)
          }}
        >
          <div
            className="market-add-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-add-heading"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="market-add-label">ADD PREDICTION</p>
            <div className="market-add-summary">
              <div className="market-add-summary-l">
                <h2 id="market-add-heading" className="market-add-summary-name">
                  {confirmSport.name}
                </h2>
                <span className="market-add-summary-pill">{confirmSport.type}</span>
              </div>
              <div className="market-add-summary-score" style={{ color: confirmModalMom.color }}>
                {confirmModalMom.rounded}
              </div>
            </div>
            <p className="market-add-q">Are you sure?</p>
            <p className="market-add-body">
              By adding this, you&apos;re saying: I believe {confirmSport.name} will be a top performer at
              LA28. You can lock it in permanently from your Portfolio.
            </p>
            <p className="market-add-remind">
              Predictions are permanent once locked. Conviction matters. ({totalPredictionsUsed} of{' '}
              {maxPredictions} predictions used)
            </p>
            <div className="market-add-actions">
              <button type="button" className="market-add-cancel" onClick={() => setConfirmSport(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="market-add-submit"
                disabled={totalPredictionsUsed >= maxPredictions}
                onClick={(e) => {
                  e.preventDefault()
                  if (!confirmSport || totalPredictionsUsed >= maxPredictions) return
                  const ok = addToPending(confirmSport.name)
                  if (!ok) return
                  setConfirmSport(null)
                  window.setTimeout(() => navigate('/portfolio'), 600)
                }}
              >
                {totalPredictionsUsed >= maxPredictions ? 'Max predictions reached' : 'Add to Predictions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSport != null && (
        <SportDetail
          sport={selectedSport}
          momentumData={scores?.[selectedSport.name] ?? null}
          communityScore={Math.round(communityScores[selectedSport.name] ?? 0)}
          onClose={() => setSelectedSport(null)}
        />
      )}
    </>
  )
}
