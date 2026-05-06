import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { SPORTS } from '../data/sports.js'

function positionMonogram(sportName) {
  const words = String(sportName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '—'
  if (words[0].toLowerCase() === 'para' && words[1]) {
    const rest = words.slice(1).join('')
    const abbr = rest.slice(0, 2).toUpperCase()
    return `PARA · ${abbr}`
  }
  if (words.length >= 2) {
    return `${words[0].slice(0, 2).toUpperCase()} · ${words[1].slice(0, 2).toUpperCase()}`
  }
  return words[0].slice(0, 3).toUpperCase()
}

function ghostMonogramLetters(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words[0].toLowerCase() === 'para' && words[1]) {
    return words[1].slice(0, 2).toUpperCase()
  }
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return words[0].slice(0, 3).toUpperCase()
}

function stackedSportTitle(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length <= 2) return words.join('\n')
  const mid = Math.ceil(words.length / 2)
  return `${words.slice(0, mid).join(' ')}\n${words.slice(mid).join(' ')}`
}

function componentPTMC(scores, sportName) {
  const d = scores?.[sportName]
  const P = Math.round(Number(d?.P) || 0)
  const T = Math.round(Number(d?.T) || 0)
  const M = Math.round(Number(d?.M) || 0)
  const C = Math.round(Number(d?.C) || 0)
  return { P, T, M, C }
}

function formatPredictionDate(raw) {
  if (raw == null) return '—'
  try {
    if (typeof raw.toDate === 'function') {
      return raw.toDate().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    }
  } catch {
    /* ignore */
  }
  if (raw instanceof Date) {
    return raw.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return '—'
}

function isValidEmail(email) {
  const s = String(email || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function momentumForPendingName(scores, sportName) {
  const raw = scores?.[sportName]?.momentum
  const n = Number(raw)
  if (!Number.isNaN(n)) return Math.round(n)
  const meta = SPORTS.find((s) => s.name === sportName)
  return Math.round(Number(meta?.momentum) || 0)
}

const FifaPredictionCard = forwardRef(function FifaPredictionCard(
  {
    sportName,
    sportType,
    momentumDisplay,
    footerDate,
    scores,
    scoresLoading,
    variant = 'default',
    width = 320,
    visible = true,
    landed = true,
    staggerMs = 0,
    pendingStamp = true,
    staticEntrance = false,
    hidePendingHeader = false,
  },
  ref,
) {
  const ptmc = componentPTMC(scores, sportName)
  const variantMeta = {
    default: { score: '#b8860b', stamp: '#b8860b' },
    mythic: { score: '#c9a227', stamp: '#c9a227' },
    rare: { score: '#8a9aa8', stamp: '#6b7280' },
    common: { score: '#a67c52', stamp: '#8b6914' },
  }[variant]

  const hPx = Math.round(width * (480 / 320))

  const enterClass = staticEntrance
    ? ' pred-card-wrap--static'
    : visible
      ? ` pred-card-wrap--visible${staggerMs ? ' pred-card-wrap--stagger' : ''}`
      : ''

  return (
    <div
      ref={ref}
      className={`pred-card-wrap${enterClass}`}
      style={{
        width,
        height: hPx,
        '--stagger-delay': staggerMs ? `${staggerMs}ms` : '0ms',
        '--tier-score': variantMeta.score,
        '--tier-stamp': variantMeta.stamp,
      }}
    >
      <div className={`pred-card-foil${landed ? ' pred-card-foil--on' : ''}`} aria-hidden="true" />
      {pendingStamp && (
        <div className="pred-card-stamp-label" aria-hidden="true">
          PENDING
        </div>
      )}
      <div className="pred-card-inner">
        <div className="pred-card-top">
          <div className="pred-card-score">{momentumDisplay}</div>
          <div className="pred-card-pending-wrap">
            {!hidePendingHeader ? <div className="pred-card-pending">★ PENDING</div> : null}
            <div className="pred-card-mono">{positionMonogram(sportName)}</div>
          </div>
        </div>
        <div className="pred-card-divider" />
        <div className="pred-card-center">
          <span className="pred-card-ghost" aria-hidden="true">
            {ghostMonogramLetters(sportName)}
          </span>
          <div className="pred-card-sport-name">{stackedSportTitle(sportName)}</div>
          <div className="pred-card-accent-line" />
          <div className="pred-card-meta">{sportType === 'Paralympic' ? 'Paralympic · LA28' : 'Olympic · LA28'}</div>
        </div>
        <div className="pred-stats-grid">
          <div>
            <div className="pred-stat-key">PER</div>
            <div className="pred-stat-val">{scoresLoading ? '—' : ptmc.P}</div>
          </div>
          <div>
            <div className="pred-stat-key">TRJ</div>
            <div className="pred-stat-val">{scoresLoading ? '—' : ptmc.T}</div>
          </div>
          <div>
            <div className="pred-stat-key">MED</div>
            <div className="pred-stat-val">{scoresLoading ? '—' : ptmc.M}</div>
          </div>
          <div>
            <div className="pred-stat-key">CTX</div>
            <div className="pred-stat-val">{scoresLoading ? '—' : ptmc.C}</div>
          </div>
        </div>
        <div className="pred-card-footer">
          <span className="pred-card-foot-l">PREDICTION LOCKED</span>
          <span className="pred-card-foot-r">{footerDate}</span>
        </div>
      </div>
    </div>
  )
})

function TierExampleCard({ row, width = 240, className = '' }) {
  const h = Math.round(width * (480 / 320))
  return (
    <div
      className={`tier-ex ${row.tierClass}${className ? ` ${className}` : ''}`}
      style={{ width, height: h }}
    >
      <div className="tier-ex-foil" aria-hidden="true" />
      <div className={`tier-ex-corner tier-ex-corner--${row.key}`} aria-hidden="true">
        {row.key === 'mythic' ? '★' : row.key === 'rare' ? '◆' : '○'}
      </div>
      <div className="tier-ex-inner">
        <div className="tier-ex-head">
          <div className="tier-ex-score">{row.score}</div>
          <div className="tier-ex-head-r">
            <div className="tier-ex-tier-mark">{row.tierMark}</div>
            <div className="tier-ex-example">EXAMPLE</div>
          </div>
        </div>
        <div className="tier-ex-rule" />
        <div className="tier-ex-mid">
          <span className="tier-ex-watermark" aria-hidden="true">
            {row.ghost}
          </span>
          <div className="tier-ex-sport">{row.sportTitle}</div>
          <div className="tier-ex-accent-bar" />
          <div className="tier-ex-meta">{row.meta}</div>
        </div>
        <div className="tier-ex-stats">
          <div className="tier-ex-stat">
            <span className="tier-ex-sk">PER</span>
            <span className="tier-ex-sv">{row.statP}</span>
          </div>
          <div className="tier-ex-stat">
            <span className="tier-ex-sk">TRJ</span>
            <span className="tier-ex-sv">{row.statT}</span>
          </div>
          <div className="tier-ex-stat">
            <span className="tier-ex-sk">MED</span>
            <span className="tier-ex-sv">{row.statM}</span>
          </div>
          <div className="tier-ex-stat">
            <span className="tier-ex-sk">CTX</span>
            <span className="tier-ex-sv">{row.statC}</span>
          </div>
        </div>
        <div className="tier-ex-foot">
          <span className="tier-ex-foot-l">Card you could earn</span>
          <span className="tier-ex-foot-r">JULY 2028</span>
        </div>
      </div>
    </div>
  )
}

const TIER_SHOWCASE_ROWS = [
  {
    key: 'mythic',
    tierClass: 'tier-ex--mythic',
    score: 92,
    tierMark: '★ Mythic',
    ghost: 'T5',
    sportTitle: (
      <>
        TOP 5
        <br />
        FINISH
      </>
    ),
    meta: 'PARALYMPIC OR OLYMPIC · LA28',
    statP: 95,
    statT: 90,
    statM: 90,
    statC: 95,
    blurb: 'Your sport finished top 5 of LA28 momentum. Earned through bold conviction.',
  },
  {
    key: 'rare',
    tierClass: 'tier-ex--rare',
    score: 84,
    tierMark: '◆ Rare',
    ghost: 'T10',
    sportTitle: (
      <>
        TOP 10
        <br />
        FINISH
      </>
    ),
    meta: 'PARALYMPIC OR OLYMPIC · LA28',
    statP: 88,
    statT: 78,
    statM: 85,
    statC: 85,
    blurb: 'Your sport finished top 10. Strong instinct paid off.',
  },
  {
    key: 'common',
    tierClass: 'tier-ex--common',
    score: 72,
    tierMark: '○ Common',
    ghost: '20',
    sportTitle: (
      <>
        TOP 20
        <br />
        FINISH
      </>
    ),
    meta: 'PARALYMPIC OR OLYMPIC · LA28',
    statP: 75,
    statT: 68,
    statM: 70,
    statC: 75,
    blurb: 'Your sport finished top 20. Solid prediction.',
  },
]

const TIER_MODAL_COPY = {
  mythic:
    'Awarded when your locked sport finishes in the top 5 of LA28 momentum. Reserved for predictions that proved bold conviction.',
  rare: 'Awarded when your locked sport finishes top 10. Strong instinct that paid off.',
  common: 'Awarded when your locked sport finishes top 20. Solid prediction.',
}

export default function Portfolio({
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
  maxPredictions = 10,
}) {
  void showToast
  void setUserEmail
  const navigate = useNavigate()
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [confirmPermanent, setConfirmPermanent] = useState(false)
  const [modalError, setModalError] = useState(null)
  const [enlarged, setEnlarged] = useState(null)
  const [enlargedLanded, setEnlargedLanded] = useState(false)
  const [tierModalRow, setTierModalRow] = useState(null)

  const modalCaptureRef = useRef(null)

  const sortedLocked = useMemo(() => {
    if (!highlightLockedNames?.length) return lockedPredictions
    const set = new Set(highlightLockedNames)
    const hi = []
    const rest = []
    for (const p of lockedPredictions) {
      if (set.has(p.sport)) hi.push(p)
      else rest.push(p)
    }
    hi.sort((a, b) => highlightLockedNames.indexOf(a.sport) - highlightLockedNames.indexOf(b.sport))
    return [...hi, ...rest]
  }, [lockedPredictions, highlightLockedNames])

  useEffect(() => {
    if (!enlarged) {
      setEnlargedLanded(false)
      return undefined
    }
    const t = setTimeout(() => setEnlargedLanded(true), 400)
    return () => clearTimeout(t)
  }, [enlarged])

  useEffect(() => {
    if (!tierModalRow) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setTierModalRow(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tierModalRow])

  const savedEmailForLock = useCallback(() => {
    const fromProp = userEmail?.trim() || ''
    let fromLs = ''
    try {
      fromLs = localStorage.getItem('la28_user_email')?.trim() || ''
    } catch {
      /* ignore */
    }
    return fromProp || fromLs
  }, [userEmail])

  const handleCommitLock = useCallback(async () => {
    if (pendingPredictions.length === 0) return
    const raw = savedEmailForLock()
    if (raw && isValidEmail(raw)) {
      await lockAllPending(raw)
      return
    }
    setEmailInput('')
    setConfirmPermanent(false)
    setModalError(null)
    setEmailModalOpen(true)
  }, [pendingPredictions, savedEmailForLock, lockAllPending])

  const submitEmailModal = useCallback(async () => {
    setModalError(null)
    const trimmed = emailInput.trim()
    if (!isValidEmail(trimmed)) {
      setModalError('Please enter a valid email address.')
      return
    }
    if (!confirmPermanent) {
      setModalError('Please confirm that you understand your predictions are permanent.')
      return
    }
    const ok = await lockAllPending(trimmed)
    if (ok) {
      setEmailModalOpen(false)
      setConfirmPermanent(false)
    }
  }, [emailInput, confirmPermanent, lockAllPending])

  const canSubmitEmailModal = isValidEmail(emailInput.trim()) && confirmPermanent

  const downloadEnlarged = useCallback(async () => {
    if (!modalCaptureRef.current || !enlarged) return
    try {
      const canvas = await html2canvas(modalCaptureRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      })
      const url = canvas.toDataURL('image/png')
      const safeName = enlarged.sport.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
      const dateStr = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `la28-prediction-${safeName}-${dateStr}.png`
      a.click()
    } catch (e) {
      console.error('html2canvas error:', e)
    }
  }, [enlarged])

  const totalPredictionsUsed = pendingPredictions.length + lockedPredictions.length

  return (
    <>
      <style>{`
        @keyframes pred-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pred-card-enter {
          from {
            opacity: 0;
            transform: scale(0.5) rotate(-8deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes pred-card-stagger-enter {
          from {
            opacity: 0;
            transform: translate3d(0, 28px, 0) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes pred-foil-sweep {
          0%,
          82% {
            transform: translateX(-130%) skewX(-12deg);
            opacity: 0;
          }
          88% {
            opacity: 0.5;
          }
          94% {
            transform: translateX(130%) skewX(-12deg);
            opacity: 0.15;
          }
          100% {
            opacity: 0;
          }
        }
        .pred-page {
          font-family: 'Barlow', 'DM Sans', system-ui, sans-serif;
          background: #f5f2ed;
          min-height: calc(100vh - 52px);
          padding-bottom: 56px;
        }
        .pred-inner-wide {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 20px 48px;
        }
        .pp-counter-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          padding: 16px 20px;
          margin-bottom: 24px;
          border-radius: 12px;
          border: 0.5px solid #e8dfcc;
          background: #fbf8f1;
          box-shadow: 0 1px 2px rgba(50, 40, 20, 0.04), 0 10px 28px rgba(50, 40, 20, 0.06);
        }
        .pp-counter-label {
          margin: 0;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6b5b3f;
        }
        .pp-counter-mid {
          flex: 1 1 auto;
          text-align: center;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 32px;
          font-weight: 700;
          color: #0a1628;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .pp-counter-track {
          width: 100px;
          height: 4px;
          border-radius: 2px;
          background: #efe8d5;
          overflow: hidden;
          flex-shrink: 0;
        }
        .pp-counter-fill {
          height: 100%;
          border-radius: 2px;
          background: #0a1628;
          transition: width 200ms ease, background 200ms ease;
        }
        .pp-counter-fill--max {
          background: #8b0a2e;
        }
        .pp-counter-max-note {
          margin: 10px 0 0;
          font-size: 12px;
          font-style: italic;
          color: #8b0a2e;
          line-height: 1.45;
          max-width: 640px;
        }
        .pp-no-pending {
          margin: 20px 0 0;
          font-size: 15px;
          line-height: 1.55;
          color: #5c6570;
        }
        .pp-kicker {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6b5b3f;
        }
        .pp-sub {
          margin: 10px 0 0;
          font-size: 15px;
          line-height: 1.55;
          color: #5c6570;
        }
        .pp-empty {
          margin-top: 20px;
          padding: 28px;
          border-radius: 12px;
          border: 0.5px solid #e8dfcc;
          background: #fbf8f1;
          box-shadow: 0 1px 2px rgba(50, 40, 20, 0.04), 0 12px 32px rgba(50, 40, 20, 0.07);
          max-width: 520px;
        }
        .pp-empty p {
          margin: 0 0 18px;
          font-size: 15px;
          line-height: 1.65;
          color: #3d432e;
        }
        .pp-btn-market {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 20px;
          border-radius: 10px;
          background: #0a1628;
          color: #fff !important;
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          border: none;
          cursor: pointer;
        }
        .pp-btn-market:hover {
          filter: brightness(1.06);
        }
        .pp-rl-section {
          margin-top: 22px;
          background: #fbf8f1;
          border: 0.5px solid #e8dfcc;
          border-radius: 14px;
          padding: 28px;
          box-shadow: 0 1px 2px rgba(50, 40, 20, 0.04), 0 8px 24px rgba(50, 40, 20, 0.06);
        }
        .pp-rl-head {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px 20px;
        }
        .pp-rl-kicker {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6b5b3f;
        }
        .pp-rl-count {
          font-size: 11px;
          font-weight: 500;
          color: #6b5b3f;
        }
        .pp-rl-title {
          margin: 14px 0 0;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #0a1628;
          line-height: 1.2;
        }
        .pp-rl-expl {
          margin: 12px 0 0;
          font-size: 13px;
          color: #3d4757;
          line-height: 1.6;
          max-width: 640px;
        }
        .pp-rl-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 560px) {
          .pp-rl-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 960px) {
          .pp-rl-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .pp-rl-card {
          background: #f5efe0;
          border: 0.5px solid #e8dfcc;
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          min-height: 56px;
        }
        .pp-rl-card-left {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          min-width: 0;
        }
        .pp-rl-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #0a1628;
          line-height: 1.15;
          margin: 0;
          word-break: break-word;
        }
        .pp-rl-pill {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 4px;
        }
        .pp-rl-pill--oly {
          background: rgba(10, 22, 40, 0.08);
          color: #0a1628;
        }
        .pp-rl-pill--para {
          background: rgba(191, 13, 62, 0.1);
          color: #8b0a2e;
        }
        .pp-rl-card-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .pp-rl-score {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }
        .pp-rl-score--oly {
          color: #0a1628;
        }
        .pp-rl-score--para {
          color: #bf0d3e;
        }
        .pp-rl-remove {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #6b7280;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          flex-shrink: 0;
        }
        .pp-rl-remove:hover {
          color: #bf0d3e;
          background: rgba(191, 13, 62, 0.06);
        }
        .pp-rl-celebrate {
          width: 100%;
          margin: 0;
          padding: 4px 0 0;
          font-size: 12px;
          font-style: italic;
          color: #8b0a2e;
          text-align: center;
        }
        .pp-rl-actions {
          margin-top: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }
        .pp-rl-actions-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          width: 100%;
        }
        .pp-rl-actions-row .pp-rl-btn {
          flex: 1 1 180px;
        }
        .pp-rl-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 28px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
          font-family: inherit;
          cursor: pointer;
          text-align: center;
          transition: filter 150ms ease, box-shadow 150ms ease;
        }
        .pp-rl-btn-cream {
          border: 0.5px solid #e8dfcc;
          background: #fbf8f1;
          color: #0a1628;
        }
        .pp-rl-btn-cream:hover {
          filter: brightness(0.99);
          border-color: rgba(10, 22, 40, 0.25);
        }
        .pp-rl-btn-red {
          border: none;
          background: #8b0a2e;
          color: #fff;
          box-shadow: 0 4px 14px rgba(139, 10, 46, 0.28);
          transition: background 200ms ease, box-shadow 200ms ease;
        }
        .pp-rl-btn-red:hover {
          background: #6b0822;
        }
        .pp-rl-btn-full {
          width: 100%;
        }
        .pp-section-gap {
          margin-top: 48px;
        }
        .pp-locked-grid {
          margin-top: 22px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          justify-items: stretch;
        }
        @media (min-width: 700px) {
          .pp-locked-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 960px) {
          .pp-locked-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (min-width: 1120px) {
          .pp-locked-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (min-width: 1320px) {
          .pp-locked-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
        }
        .pp-card-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          width: 100%;
          padding: 0;
          border: none;
          background: transparent;
        }
        .pp-card-box:focus-visible {
          outline: 2px solid #bf0d3e;
          outline-offset: 6px;
          border-radius: 12px;
        }
        .pp-tier-showcase {
          margin-top: 22px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        @media (min-width: 860px) {
          .pp-tier-showcase {
            flex-direction: row;
            justify-content: center;
            align-items: flex-start;
            gap: 24px;
          }
        }
        .pp-tier-show-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 260px;
        }
        .pp-tier-show-blurb {
          margin: 14px 0 0;
          font-size: 14px;
          line-height: 1.5;
          color: #5c6570;
          text-align: center;
        }
        .pp-tier-note {
          margin: 22px auto 0;
          text-align: center;
          font-size: 13px;
          font-style: italic;
          color: #5c6570;
          max-width: 520px;
        }
        .pred-overlay {
          position: fixed;
          inset: 0;
          background: rgba(20, 14, 5, 0.65);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .pred-modal {
          width: 100%;
          max-width: 480px;
          background: #fbf8f1;
          border-radius: 12px;
          padding: 32px;
          border: 0.5px solid #e8dfcc;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
        }
        .pred-modal-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6b5b3f;
          margin: 0 0 10px;
        }
        .pred-modal-head {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #0a1628;
          margin: 0 0 12px;
          line-height: 1.15;
        }
        .pred-modal-sub {
          font-size: 14px;
          color: #5c6570;
          line-height: 1.5;
          margin: 0 0 20px;
        }
        .pred-email-input {
          width: 100%;
          padding: 14px 18px;
          font-size: 14px;
          border: 0.5px solid #e8dfcc;
          border-radius: 8px;
          margin-bottom: 12px;
          box-sizing: border-box;
        }
        .pred-modal-checkbox {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 0 0 18px;
          font-size: 13px;
          line-height: 1.45;
          color: #3d4757;
          cursor: pointer;
        }
        .pred-modal-checkbox input {
          margin-top: 3px;
          width: 15px;
          height: 15px;
          accent-color: #8b0a2e;
          flex-shrink: 0;
        }
        .pred-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .pred-btn-cancel {
          padding: 12px 20px;
          font-weight: 600;
          font-size: 14px;
          border-radius: 8px;
          border: 1.5px solid #0a1628;
          background: transparent;
          color: #0a1628;
          cursor: pointer;
          font-family: inherit;
        }
        .pred-btn-commit {
          padding: 12px 20px;
          font-weight: 700;
          font-size: 14px;
          border-radius: 8px;
          border: none;
          background: #8b0a2e;
          color: #fff;
          cursor: pointer;
          font-family: inherit;
          transition: background 200ms ease;
        }
        .pred-btn-commit:hover:not(:disabled) {
          background: #6b0822;
        }
        .pred-btn-commit:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .pred-modal-wide {
          max-width: 420px;
        }
        .pred-modal-actions-full {
          margin-top: 8px;
        }
        .pred-err {
          color: #bf0d3e;
          font-size: 13px;
          margin: 0 0 12px;
        }
        /* FIFA card chrome */
        .pred-card-wrap {
          border-radius: 16px;
          position: relative;
          flex-shrink: 0;
          background:
            radial-gradient(circle at 30% 10%, rgba(245, 238, 220, 0.6) 0%, transparent 50%),
            linear-gradient(135deg, #f8f1dc 0%, #fbf8f1 50%, #f0e5c2 100%);
          border: 1.5px solid rgba(180, 160, 100, 0.4);
          box-shadow:
            0 24px 60px rgba(50, 40, 20, 0.2),
            0 4px 16px rgba(50, 40, 20, 0.1);
          overflow: hidden;
          opacity: 0;
          transform: scale(0.5) rotate(-8deg);
        }
        .pred-card-wrap--visible {
          animation: pred-card-enter 800ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          animation-delay: var(--stagger-delay, 0ms);
        }
        .pred-card-wrap--stagger.pred-card-wrap--visible {
          animation: pred-card-stagger-enter 720ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: var(--stagger-delay, 0ms);
        }
        .pred-card-foil {
          pointer-events: none;
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 16px;
          opacity: 0;
        }
        .pred-card-foil--on::after {
          content: '';
          position: absolute;
          inset: -40% -40%;
          background: linear-gradient(
            105deg,
            transparent 40%,
            rgba(255, 255, 255, 0.65) 50%,
            transparent 60%
          );
          animation: pred-foil-sweep 5s ease-in-out infinite;
        }
        .pred-card-foil--on {
          opacity: 1;
        }
        .pred-card-stamp-label {
          position: absolute;
          bottom: 14px;
          right: 14px;
          z-index: 6;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.28em;
          color: rgba(139, 90, 20, 0.55);
          border: 1px dashed rgba(184, 134, 11, 0.45);
          padding: 8px 6px;
          transform: rotate(-12deg);
          background: rgba(251, 248, 241, 0.5);
          pointer-events: none;
        }
        .pred-card-inner {
          position: relative;
          z-index: 2;
          padding: clamp(14px, 3vw, 22px);
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .pred-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        .pred-card-score {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(42px, 12vw, 64px);
          font-weight: 700;
          line-height: 0.95;
          color: var(--tier-score, #b8860b);
          text-shadow: 0 0 28px rgba(184, 134, 11, 0.35);
        }
        .pred-card-pending-wrap {
          text-align: right;
          flex-shrink: 0;
        }
        .pred-card-pending {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--tier-stamp, #b8860b);
        }
        .pred-card-mono {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #6b5b3f;
          margin-top: 6px;
        }
        .pred-card-divider {
          height: 2px;
          margin: 12px 0 10px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(184, 134, 11, 0.45),
            transparent
          );
        }
        .pred-card-center {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          min-height: 0;
        }
        .pred-card-ghost {
          position: absolute;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(120px, 28vw, 220px);
          font-weight: 700;
          line-height: 1;
          color: #0a1628;
          opacity: 0.04;
          pointer-events: none;
          user-select: none;
        }
        .pred-card-sport-name {
          position: relative;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(20px, 5vw, 28px);
          font-weight: 700;
          color: #0a1628;
          line-height: 1.15;
          white-space: pre-line;
        }
        .pred-card-accent-line {
          width: 48px;
          height: 3px;
          background: linear-gradient(90deg, #bf0d3e, #b8860b);
          margin: 12px auto;
          border-radius: 2px;
        }
        .pred-card-meta {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #6b5b3f;
        }
        .pred-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 12px;
          margin-top: 12px;
        }
        .pred-stat-key {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #8b7355;
        }
        .pred-stat-val {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(13px, 3.5vw, 16px);
          font-weight: 700;
          color: #0a1628;
        }
        .pred-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: auto;
          padding-top: 10px;
        }
        .pred-card-foot-l {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: #8b7355;
        }
        .pred-card-foot-r {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          color: #5c6570;
        }
        .pred-card-wrap.pred-card-wrap--static {
          opacity: 1;
          transform: none;
        }
        /* Tier aspiration showcase cards (display-only) */
        .tier-ex {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow:
            0 18px 44px rgba(50, 40, 20, 0.18),
            0 4px 12px rgba(50, 40, 20, 0.09);
        }
        .tier-ex-foil {
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: inherit;
          overflow: hidden;
          z-index: 3;
          opacity: 1;
        }
        .tier-ex-foil::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 38%,
            rgba(255, 255, 255, 0.72) 50%,
            transparent 62%
          );
          transform: translateX(-100%) skewX(-10deg);
          animation: tier-ex-foil 5s linear infinite;
        }
        @keyframes tier-ex-foil {
          0% {
            transform: translateX(-100%) skewX(-10deg);
          }
          100% {
            transform: translateX(100%) skewX(-10deg);
          }
        }
        .tier-ex--mythic {
          background: linear-gradient(145deg, #fff9ec 0%, #f4e4bc 48%, #e8cf85 100%);
          border: 1.5px solid rgba(201, 162, 39, 0.75);
          --tier-ex-score: #b8860b;
          --tier-ex-tier: #9a7209;
          --tier-ex-accent: linear-gradient(90deg, #bf0d3e, #c9a227);
        }
        .tier-ex--rare {
          background: linear-gradient(145deg, #fbfcfe 0%, #e8ecf2 50%, #cfd9e3 100%);
          border: 1.5px solid rgba(140, 156, 172, 0.85);
          --tier-ex-score: #7d8fa3;
          --tier-ex-tier: #5c6b7a;
          --tier-ex-accent: linear-gradient(90deg, #0a1628, #94a3b8);
        }
        .tier-ex--common {
          background: linear-gradient(145deg, #fdfaf5 0%, #eddcc5 52%, #d4b896 100%);
          border: 1.5px solid rgba(166, 124, 82, 0.78);
          --tier-ex-score: #a67c52;
          --tier-ex-tier: #7d5a38;
          --tier-ex-accent: linear-gradient(90deg, #bf0d3e, #a67c52);
        }
        .tier-ex-corner {
          position: absolute;
          bottom: 12px;
          right: 12px;
          z-index: 5;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          transform: rotate(-8deg);
          box-shadow: 0 2px 10px rgba(50, 40, 20, 0.18);
        }
        .tier-ex-corner--mythic {
          background: linear-gradient(135deg, #e8c547 0%, #b8860b 100%);
        }
        .tier-ex-corner--rare {
          background: linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%);
        }
        .tier-ex-corner--common {
          background: linear-gradient(135deg, #d4b896 0%, #8b6914 100%);
        }
        .tier-ex-inner {
          position: relative;
          z-index: 2;
          padding: 16px 14px;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .tier-ex-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        .tier-ex-score {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 52px;
          font-weight: 700;
          line-height: 0.92;
          color: var(--tier-ex-score);
          text-shadow: 0 0 22px rgba(184, 134, 11, 0.22);
        }
        .tier-ex-head-r {
          text-align: right;
          flex-shrink: 0;
        }
        .tier-ex-tier-mark {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--tier-ex-tier);
        }
        .tier-ex-example {
          margin-top: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.24em;
          color: #6b5b3f;
        }
        .tier-ex-rule {
          height: 2px;
          margin: 10px 0 10px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(107, 91, 63, 0.35),
            transparent
          );
        }
        .tier-ex-mid {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          min-height: 0;
        }
        .tier-ex-watermark {
          position: absolute;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 96px;
          font-weight: 700;
          color: #0a1628;
          opacity: 0.035;
          line-height: 1;
          pointer-events: none;
        }
        .tier-ex-sport {
          position: relative;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #0a1628;
          line-height: 1.12;
        }
        .tier-ex-accent-bar {
          width: 44px;
          height: 3px;
          margin: 10px auto;
          border-radius: 2px;
          background: var(--tier-ex-accent);
        }
        .tier-ex-meta {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #6b5b3f;
          line-height: 1.35;
          max-width: 200px;
        }
        .tier-ex-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 10px;
          margin-top: 10px;
        }
        .tier-ex-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .tier-ex-sk {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #8b7355;
        }
        .tier-ex-sv {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #0a1628;
        }
        .tier-ex-foot {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: auto;
          padding-top: 12px;
        }
        .tier-ex-foot-l {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #8b7355;
          max-width: 110px;
          line-height: 1.3;
        }
        .tier-ex-foot-r {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          font-weight: 700;
          color: #5c6570;
        }
        .tier-ex-hit {
          display: block;
          margin: 0 auto;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: 16px;
          transition: transform 180ms ease, box-shadow 180ms ease;
        }
        .tier-ex-hit:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 44px rgba(50, 40, 20, 0.12);
        }
        .tier-ex-hit:focus-visible {
          outline: 2px solid #bf0d3e;
          outline-offset: 4px;
        }
        .tier-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 110;
          background: rgba(20, 14, 5, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px 16px;
          overflow-y: auto;
        }
        .tier-modal-sheet {
          width: 100%;
          max-width: 520px;
          margin: auto;
          animation: tier-modal-zoom 300ms ease forwards;
        }
        @keyframes tier-modal-zoom {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .tier-modal-card-slot {
          display: flex;
          justify-content: center;
        }
        .tier-modal-blurb {
          margin: 20px 0 0;
          font-size: 15px;
          line-height: 1.55;
          color: #3d432e;
          text-align: center;
          font-weight: 500;
        }
      `}</style>

      <div className="pred-page portfolio-page-new">
        <div className="pred-inner-wide">
          <section aria-label="Pending predictions">
            <div className="pp-counter-card">
              <div>
                <p className="pp-counter-label">PREDICTIONS USED</p>
              </div>
              <div className="pp-counter-mid">
                {totalPredictionsUsed} / {maxPredictions}
              </div>
              <div className="pp-counter-track" aria-hidden="true">
                <div
                  className={`pp-counter-fill${
                    totalPredictionsUsed >= maxPredictions ? ' pp-counter-fill--max' : ''
                  }`}
                  style={{
                    width: `${Math.min(100, (totalPredictionsUsed / maxPredictions) * 100)}%`,
                  }}
                />
              </div>
            </div>
            {totalPredictionsUsed >= maxPredictions ? (
              <p className="pp-counter-max-note">
                You&apos;ve used all {maxPredictions} predictions. Remove from pending to swap, but locked
                predictions are permanent.
              </p>
            ) : null}

            {pendingPredictions.length === 0 && lockedPredictions.length === 0 ? (
              <div className="pp-empty">
                <p>
                  Browse Market to find sports you believe in. Lock up to {maxPredictions} predictions for
                  LA28. Each one becomes a card you can earn in 2028.
                </p>
                <Link to="/market" className="pp-btn-market">
                  Go to Market
                </Link>
              </div>
            ) : pendingPredictions.length === 0 ? (
              <>
                <p className="pp-no-pending">
                  No predictions in your queue. Browse Market to add more before locking in permanently.
                </p>
                <Link to="/market" className="pp-btn-market">
                  Go to Market
                </Link>
              </>
            ) : (
              <div className="pp-rl-section">
                <div className="pp-rl-head">
                  <span className="pp-rl-kicker">READY TO LOCK</span>
                  <span className="pp-rl-count">
                    {pendingPredictions.length} of {maxPredictions} selected
                  </span>
                </div>
                <h2 className="pp-rl-title">Your conviction picks for LA28</h2>
                <p className="pp-rl-expl">
                  Each sport you lock represents a personal prediction: I believe this will be a top
                  performer at LA28. You can lock up to {maxPredictions}. Predictions are permanent.
                </p>

                <div className="pp-rl-grid">
                  {pendingPredictions.map((name) => {
                    const meta = SPORTS.find((s) => s.name === name)
                    const mom = momentumForPendingName(scores, name)
                    const isPara = meta?.type === 'Paralympic'
                    return (
                      <div key={name} className="pp-rl-card">
                        <div className="pp-rl-card-left">
                          <p className="pp-rl-name">{name}</p>
                          <span
                            className={`pp-rl-pill ${
                              isPara ? 'pp-rl-pill--para' : 'pp-rl-pill--oly'
                            }`}
                          >
                            {meta?.type ?? 'Olympic'}
                          </span>
                        </div>
                        <div className="pp-rl-card-right">
                          <span
                            className={`pp-rl-score ${
                              isPara ? 'pp-rl-score--para' : 'pp-rl-score--oly'
                            }`}
                          >
                            {mom}
                          </span>
                          <button
                            type="button"
                            className="pp-rl-remove"
                            aria-label={`Remove ${name}`}
                            onClick={() => removeFromPending(name)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="pp-rl-actions">
                  {pendingPredictions.length >= maxPredictions ? (
                    <>
                      <p className="pp-rl-celebrate">
                        You&apos;ve used all {maxPredictions} picks. Time to commit.
                      </p>
                      <button
                        type="button"
                        className="pp-rl-btn pp-rl-btn-red pp-rl-btn-full"
                        onClick={() => void handleCommitLock()}
                      >
                        Lock In All {maxPredictions} Predictions
                      </button>
                    </>
                  ) : (
                    <div className="pp-rl-actions-row">
                      <button
                        type="button"
                        className="pp-rl-btn pp-rl-btn-cream"
                        onClick={() => navigate('/market')}
                      >
                        Save for later
                      </button>
                      <button
                        type="button"
                        className="pp-rl-btn pp-rl-btn-red"
                        onClick={() => void handleCommitLock()}
                      >
                        Lock these {pendingPredictions.length} predictions
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {lockedPredictions.length > 0 && (
            <section className="pp-section-gap" aria-label="Locked predictions">
              <h2 className="pp-kicker">YOUR LOCKED PREDICTIONS</h2>
              <p className="pp-sub">Awaiting LA28 verification — July 14, 2028</p>

              <div className="pp-locked-grid">
                {sortedLocked.map((pred) => {
                  const hiIdx = highlightLockedNames.indexOf(pred.sport)
                  const staggerMs = hiIdx >= 0 ? hiIdx * 140 : 0
                  const isHi = hiIdx >= 0 && highlightLockedNames.length > 0
                  const dateStr = formatPredictionDate(pred.lockedAt)

                  return (
                    <button
                      type="button"
                      key={pred.sport}
                      className="pp-card-box"
                      onClick={() =>
                        setEnlarged({
                          sport: pred.sport,
                          type: pred.type ?? 'Olympic',
                          momentum: pred.momentumAtLock,
                          lockedAtLabel: dateStr,
                        })
                      }
                    >
                      <FifaPredictionCard
                        sportName={pred.sport}
                        sportType={pred.type ?? 'Olympic'}
                        momentumDisplay={Math.round(Number(pred.momentumAtLock) || 0)}
                        footerDate={dateStr}
                        scores={scores}
                        scoresLoading={scoresLoading}
                        variant="default"
                        width={220}
                        visible
                        landed
                        staggerMs={isHi ? staggerMs : 0}
                        staticEntrance={!isHi}
                        pendingStamp={false}
                      />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <section className="pp-section-gap" aria-label="Tier aspirations">
            <h2 className="pp-kicker">EARN ONE OF THESE IN 2028</h2>
            <p className="pp-sub">
              When LA28 ends, every locked prediction grades automatically based on where the sport
              finished:
            </p>

            <div className="pp-tier-showcase">
              {TIER_SHOWCASE_ROWS.map((row) => (
                <div key={row.key} className="pp-tier-show-col">
                  <button
                    type="button"
                    className="tier-ex-hit"
                    aria-label={`View ${row.tierMark} example larger`}
                    onClick={() => setTierModalRow(row)}
                  >
                    <TierExampleCard row={row} />
                  </button>
                  <p className="pp-tier-show-blurb">{row.blurb}</p>
                </div>
              ))}
            </div>

            <p className="pp-tier-note">
              You can lock up to {maxPredictions} predictions total. Choose carefully — locked predictions
              are permanent. Conviction over coverage.
            </p>
          </section>
        </div>
      </div>

      {tierModalRow ? (
        <div
          className="tier-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${tierModalRow.tierMark} tier`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTierModalRow(null)
          }}
        >
          <div className="tier-modal-sheet" onMouseDown={(e) => e.stopPropagation()}>
            <div className="tier-modal-card-slot">
              <TierExampleCard row={tierModalRow} width={480} />
            </div>
            <p className="tier-modal-blurb">{TIER_MODAL_COPY[tierModalRow.key]}</p>
          </div>
        </div>
      ) : null}

      {emailModalOpen && (
        <div
          className="pred-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lock-email-heading"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmPermanent(false)
              setEmailModalOpen(false)
            }
          }}
        >
          <div className="pred-modal">
            <p className="pred-modal-title">ONE LAST STEP</p>
            <h2 id="lock-email-heading" className="pred-modal-head">
              Enter your email to lock in.
            </h2>
            <p className="pred-modal-sub">
              We&apos;ll do our best to email you in July 2028 with your final LA28 scorecard. We never
              share your email.
            </p>
            <input
              type="email"
              className="pred-email-input"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            <label className="pred-modal-checkbox">
              <input
                type="checkbox"
                checked={confirmPermanent}
                onChange={(e) => setConfirmPermanent(e.target.checked)}
              />
              <span>
                I understand my predictions are permanent and I cannot edit them after locking.
              </span>
            </label>
            {modalError ? <p className="pred-err">{modalError}</p> : null}
            <div className="pred-modal-actions">
              <button
                type="button"
                className="pred-btn-cancel"
                onClick={() => {
                  setModalError(null)
                  setConfirmPermanent(false)
                  setEmailModalOpen(false)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pred-btn-commit"
                disabled={!canSubmitEmailModal}
                onClick={() => void submitEmailModal()}
              >
                Lock In Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {enlarged != null && (
        <div
          className="pred-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enlarged-card-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEnlarged(null)
          }}
        >
          <div className="pred-modal pred-modal-wide">
            <p className="pred-modal-title" id="enlarged-card-title">
              YOUR CARD
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
              <FifaPredictionCard
                ref={modalCaptureRef}
                sportName={enlarged.sport}
                sportType={enlarged.type}
                momentumDisplay={enlarged.momentum}
                footerDate={enlarged.lockedAtLabel}
                scores={scores}
                scoresLoading={scoresLoading}
                variant="default"
                width={320}
                visible
                landed={enlargedLanded}
                staticEntrance={false}
                pendingStamp={false}
              />
            </div>
            <div className="pred-modal-actions pred-modal-actions-full">
              <button type="button" className="pred-btn-cancel" onClick={() => setEnlarged(null)}>
                Close
              </button>
              <button type="button" className="pred-btn-commit" onClick={() => void downloadEnlarged()}>
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
