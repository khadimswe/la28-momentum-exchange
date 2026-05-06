import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import Navbar from './components/Navbar.jsx'
import Toast from './components/Toast.jsx'
import Home from './pages/Home.jsx'
import Market from './pages/Market.jsx'
import Portfolio from './pages/Portfolio.jsx'
import { SPORTS } from './data/sports.js'
import { db } from './firebase.js'
import { useMomentumScores } from './hooks/useMomentumScores.js'

function emailHashFrom(email) {
  const trimmed = String(email).toLowerCase().trim()
  let h = trimmed.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!h) h = `user-${Date.now()}`
  return h.slice(0, 800)
}

const MAX_PREDICTIONS = 10

function App() {
  const { scores, loading: scoresLoading } = useMomentumScores()
  const [pendingPredictions, setPendingPredictions] = useState([])
  const [lockedPredictions, setLockedPredictions] = useState([])
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('la28_user_email') || null)
  const [toast, setToast] = useState(null)
  const [highlightLockedNames, setHighlightLockedNames] = useState([])

  const showToast = useCallback((message) => {
    setToast(message)
    setTimeout(() => setToast(null), 2000)
  }, [])

  useEffect(() => {
    if (!userEmail) {
      setLockedPredictions([])
      return
    }
    const hash = emailHashFrom(userEmail)
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'predictions', hash))
        if (cancelled) return
        if (snap.exists()) {
          const data = snap.data()
          setLockedPredictions(Array.isArray(data.predictions) ? data.predictions : [])
        } else {
          setLockedPredictions([])
        }
      } catch (e) {
        console.error('Failed to load predictions:', e)
        if (!cancelled) setLockedPredictions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userEmail])

  useEffect(() => {
    if (highlightLockedNames.length === 0) return undefined
    const t = setTimeout(() => setHighlightLockedNames([]), 2600)
    return () => clearTimeout(t)
  }, [highlightLockedNames])

  const addToPending = useCallback(
    (sportName) => {
      const totalCommitted = pendingPredictions.length + lockedPredictions.length

      if (totalCommitted >= MAX_PREDICTIONS) {
        showToast(`You've reached the ${MAX_PREDICTIONS} prediction max. Manage from Portfolio.`)
        return false
      }

      if (lockedPredictions.some((p) => p.sport === sportName)) {
        showToast(`${sportName} is already locked.`)
        return false
      }

      if (pendingPredictions.includes(sportName)) {
        showToast(`${sportName} is already pending.`)
        return false
      }

      setPendingPredictions((prev) => [...prev, sportName])
      showToast(`${sportName} added to your predictions`)
      return true
    },
    [lockedPredictions, pendingPredictions, showToast],
  )

  const removeFromPending = useCallback((sportName) => {
    setPendingPredictions((prev) => prev.filter((n) => n !== sportName))
  }, [])

  const lockAllPending = useCallback(
    async (emailRaw) => {
      const normalized = String(emailRaw).toLowerCase().trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        showToast('Please enter a valid email address.')
        return false
      }
      const namesSnapshot = [...pendingPredictions]
      if (namesSnapshot.length === 0) return false

      const hash = emailHashFrom(normalized)
      try {
        const ref = doc(db, 'predictions', hash)
        const snap = await getDoc(ref)
        const existingPreds =
          snap.exists() && Array.isArray(snap.data().predictions) ? snap.data().predictions : []
        const bySport = new Map(existingPreds.map((p) => [p.sport, p]))

        const now = Timestamp.now()
        for (const name of namesSnapshot) {
          if (bySport.has(name)) continue
          const sportMeta = SPORTS.find((s) => s.name === name)
          const rawMom = scores?.[name]?.momentum
          const n = Number(rawMom)
          const momentumAtLock = Number.isFinite(n)
            ? Math.round(n)
            : Math.round(Number(sportMeta?.momentum) || 0)
          bySport.set(name, {
            sport: name,
            lockedAt: now,
            momentumAtLock,
            type: sportMeta?.type ?? 'Olympic',
            status: 'pending',
          })
        }

        const merged = Array.from(bySport.values())
        await setDoc(
          ref,
          {
            email: normalized,
            predictions: merged,
            lastUpdated: serverTimestamp(),
          },
          { merge: true },
        )

        localStorage.setItem('la28_user_email', normalized)
        setUserEmail(normalized)
        setHighlightLockedNames(namesSnapshot)
        setPendingPredictions([])
        setLockedPredictions(merged)
        showToast("✓ Locked in. We'll email you July 2028.")
        return true
      } catch (e) {
        console.error('Predictions save error:', e)
        showToast('Could not save predictions. Try again.')
        return false
      }
    },
    [pendingPredictions, scores, showToast],
  )

  const marketProps = {
    addToPending,
    pendingPredictions,
    lockedPredictions,
    maxPredictions: MAX_PREDICTIONS,
  }

  const portfolioProps = {
    pendingPredictions,
    removeFromPending,
    lockedPredictions,
    lockAllPending,
    showToast,
    userEmail,
    setUserEmail,
    scores,
    scoresLoading,
    highlightLockedNames,
    maxPredictions: MAX_PREDICTIONS,
  }

  return (
    <>
      <style>{`
        :root {
          --navy: #0A1628;
          --page-bg: #F5F2ED;
          --accent-red: #BF0D3E;
          --muted: #5c6570;
          --card-cream: #FBF8F1;
          --card-border: #E8DFCC;
          --section-taupe: #6B5B3F;
          --games-text: #3D2E14;
        }

        * {
          box-sizing: border-box;
        }

        .momentum-app {
          min-height: 100vh;
          background: var(--page-bg);
          font-family: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: var(--navy);
        }

        .app-navbar {
          position: sticky;
          top: 0;
          z-index: 50;
          background: var(--card-cream);
          border-bottom: 0.5px solid var(--card-border);
          box-shadow: 0 1px 2px rgba(50, 40, 20, 0.04), 0 8px 24px rgba(50, 40, 20, 0.06);
        }

        .app-navbar-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.75rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .app-navbar-brand {
          font-size: 1rem;
          font-weight: 700;
          color: var(--navy);
          text-decoration: none;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        .app-navbar-brand:hover {
          color: var(--navy);
          opacity: 0.85;
        }

        .app-navbar-brand:focus-visible {
          outline: 2px solid var(--accent-red);
          outline-offset: 3px;
          border-radius: 4px;
        }

        .app-navbar-links {
          display: flex;
          align-items: center;
          gap: 0.25rem 1.25rem;
        }

        .app-navbar-link {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--muted);
          text-decoration: none;
          padding: 0.35rem 0.1rem;
          border-bottom: 2px solid transparent;
          transition: color 0.15s ease, border-color 0.15s ease;
        }

        .app-navbar-link:hover {
          color: var(--navy);
        }

        .app-navbar-link:focus-visible {
          outline: 2px solid var(--accent-red);
          outline-offset: 2px;
          border-radius: 4px;
        }

        .app-navbar-link--active {
          color: var(--navy);
          border-bottom-color: var(--accent-red);
        }

        .header {
          background: var(--navy);
          color: #fff;
          padding: 1.75rem 1.5rem 2rem;
          padding-left: 48px;
          text-align: left;
        }

        .header-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        .header h1 {
          margin: 0;
          font-size: clamp(1.35rem, 4vw, 1.75rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.2;
          color: #ffffff;
        }

        .title-accent {
          width: 3rem;
          height: 3px;
          background: var(--accent-red);
          margin-top: 0.65rem;
          border-radius: 1px;
        }

        .subtitle {
          margin: 0.85rem 0 0;
          font-size: clamp(0.9rem, 2.2vw, 1rem);
          font-weight: 400;
          opacity: 0.92;
          max-width: 36rem;
          line-height: 1.45;
        }

        .main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.5rem 1.5rem 2.5rem;
        }

        .card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.25rem;
        }

        .category-tabs {
          display: flex;
          flex-wrap: nowrap;
          gap: 0.5rem;
          overflow-x: auto;
          padding: 0.15rem 0 0.35rem;
          margin: 0 0 1.1rem;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
        }

        .category-tab {
          flex: 0 0 auto;
          border: 0.5px solid var(--card-border);
          background: var(--card-cream);
          color: var(--muted);
          font-family: inherit;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0.45rem 0.75rem;
          border-radius: 999px;
          cursor: pointer;
          transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease,
            box-shadow 0.15s ease;
          box-shadow: 0 1px 2px rgba(50, 40, 20, 0.04);
        }

        .category-tab:hover {
          color: var(--navy);
          border-color: rgba(191, 13, 62, 0.35);
        }

        .category-tab--active {
          color: var(--accent-red);
          border-color: rgba(191, 13, 62, 0.55);
          background: rgba(191, 13, 62, 0.06);
          box-shadow: 0 1px 2px rgba(50, 40, 20, 0.04), 0 6px 16px rgba(50, 40, 20, 0.08);
        }

        .sport-card {
          background: var(--card-cream);
          border-radius: 10px;
          border: 0.5px solid var(--card-border);
          box-shadow: 0 1px 2px rgba(50, 40, 20, 0.04), 0 8px 24px rgba(50, 40, 20, 0.06),
            inset 4px 0 0 0 var(--card-border, #ccc);
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          transition: box-shadow 240ms cubic-bezier(0.4, 0, 0.2, 1),
            transform 240ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .sport-card-undervalued-badge {
          align-self: flex-start;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #c2410c;
          background: rgba(251, 146, 60, 0.18);
          border: 1px solid rgba(234, 88, 12, 0.35);
          padding: 0.22rem 0.45rem;
          border-radius: 4px;
          line-height: 1;
        }

        .sport-momentum-compare {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          width: 100%;
        }

        .pulse-bar-label {
          margin: 0 0 0.22rem;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .pulse-bar-line {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .pulse-bar-track {
          flex: 1;
          min-width: 0;
          height: 6px;
          background: rgba(61, 46, 20, 0.08);
          border-radius: 3px;
          overflow: hidden;
        }

        .pulse-bar-fill {
          height: 100%;
          border-radius: 3px;
          max-width: 100%;
        }

        .pulse-bar-fill--community {
          background: #bf0d3e;
        }

        .pulse-bar-fill--gemini {
          background: #0a1628;
        }

        .pulse-bar-pct {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 700;
          min-width: 2rem;
          text-align: right;
        }

        .pulse-bar-pct--community {
          color: #bf0d3e;
        }

        .pulse-bar-pct--gemini {
          color: #0a1628;
        }

        .sport-card:hover {
          box-shadow: 0 4px 8px rgba(50, 40, 20, 0.06), 0 16px 40px rgba(50, 40, 20, 0.1),
            inset 4px 0 0 0 var(--card-border, #ccc);
          transform: translateY(-3px);
        }

        .card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .sport-name {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--navy);
          letter-spacing: -0.01em;
          line-height: 1.25;
        }

        .games-badge {
          flex-shrink: 0;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 0.28rem 0.5rem;
          border-radius: 4px;
          border: 1px solid rgba(61, 46, 20, 0.18);
          background: rgba(251, 248, 241, 0.55);
          color: var(--games-text);
        }

        .score-row {
          display: flex;
          align-items: baseline;
          gap: 0.35rem;
        }

        .score-value {
          font-size: 2.25rem;
          font-weight: 800;
          color: var(--accent-red);
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .score-suffix {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--accent-red);
          opacity: 0.85;
        }

        .trend-badge {
          display: inline-block;
          align-self: flex-start;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.35rem 0.55rem;
          border-radius: 4px;
          background: var(--trend-bg);
          color: var(--trend-fg);
        }

        .narrative {
          margin: 0;
          font-size: 0.8125rem;
          line-height: 1.5;
          color: var(--muted);
        }

        @keyframes narrative-pulse {
          0%,
          100% {
            opacity: 0.42;
          }
          50% {
            opacity: 1;
          }
        }

        .narrative--loading {
          animation: narrative-pulse 1.15s ease-in-out infinite;
        }

        @media (min-width: 640px) {
          .card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 900px) {
          .card-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>

      <BrowserRouter>
        <div className="momentum-app">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/market" element={<Market {...marketProps} />} />
            <Route path="/portfolio" element={<Portfolio {...portfolioProps} />} />
          </Routes>
          <Toast message={toast} />
        </div>
      </BrowserRouter>
    </>
  )
}

export default App
