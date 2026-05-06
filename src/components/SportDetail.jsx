import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

function labelForCategory(cat) {
  if (!cat) return ''
  return cat
    .split('_')
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ')
}

function trendColorForScore(score) {
  if (score >= 86) return '#00A651' // Surging
  if (score >= 78) return '#0066CC' // Rising
  if (score >= 70) return '#FFB81C' // Peaking
  return '#BF0D3E' // Cooling
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export default function SportDetail({ sport, momentumData, onClose }) {
  const [entered, setEntered] = useState(false)

  const groupLabel = labelForCategory(sport?.category)

  const score = useMemo(() => {
    const n = Number(momentumData?.momentum)
    if (!Number.isNaN(n)) return n
    return Number(sport?.momentum ?? 0) || 0
  }, [momentumData, sport])

  const P = Number(momentumData?.P)
  const T = Number(momentumData?.T)
  const M = Number(momentumData?.M)
  const C = Number(momentumData?.C)

  const parts = useMemo(() => {
    const safe = (n) => (Number.isNaN(n) ? null : Math.max(0, Math.min(100, n)))
    return [
      { key: 'P', name: 'Performance Growth', value: safe(P), weight: 0.4 },
      { key: 'T', name: 'Trajectory', value: safe(T), weight: 0.25 },
      { key: 'M', name: 'Media Momentum', value: safe(M), weight: 0.2 },
      { key: 'C', name: 'Competitive Context', value: safe(C), weight: 0.15 },
    ]
  }, [P, T, M, C])

  const formulaLine = useMemo(() => {
    const fmt = (n) => (typeof n === 'number' ? n.toFixed(1) : '—')
    const pv = parts.find((p) => p.key === 'P')?.value
    const tv = parts.find((p) => p.key === 'T')?.value
    const mv = parts.find((p) => p.key === 'M')?.value
    const cv = parts.find((p) => p.key === 'C')?.value
    const computed =
      (pv == null ? 0 : 0.4 * pv) +
      (tv == null ? 0 : 0.25 * tv) +
      (mv == null ? 0 : 0.2 * mv) +
      (cv == null ? 0 : 0.15 * cv)
    return `0.4(${fmt(pv)}) + 0.25(${fmt(tv)}) + 0.2(${fmt(mv)}) + 0.15(${fmt(cv)}) = ${computed.toFixed(
      1,
    )}`
  }, [parts])

  const sources = Array.isArray(momentumData?.sources) ? momentumData.sources : []
  const reasoning = momentumData?.reasoning && typeof momentumData.reasoning === 'object'
    ? momentumData.reasoning
    : null

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!sport) return null

  const trendColor = trendColorForScore(score)

  const modal = (
    <>
      <style>{`
        .sport-detail-overlay {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(20, 14, 5, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          opacity: 0;
          transition: opacity 200ms ease;
        }
        .sport-detail-overlay--visible {
          opacity: 1;
        }
        .sport-detail-panel {
          width: 100%;
          max-width: 720px;
          max-height: 85vh;
          overflow: auto;
          background: #FBF8F1;
          border-radius: 12px;
          border: 0.5px solid #E8DFCC;
          box-shadow: 0 1px 2px rgba(50, 40, 20, 0.04), 0 16px 48px rgba(20, 14, 5, 0.18);
          padding: 36px 40px;
          position: relative;
          color: #0A1628;
        }
        .sport-detail-close {
          position: absolute;
          top: 16px;
          right: 20px;
          border: none;
          background: transparent;
          font-size: 28px;
          line-height: 1;
          color: #0A1628;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .sport-detail-close:hover { opacity: 0.75; }
        .sport-detail-close:focus-visible {
          outline: 2px solid #BF0D3E;
          outline-offset: 2px;
        }
        .sport-detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding-right: 48px;
          margin-bottom: 20px;
        }
        .sport-detail-title {
          margin: 0 0 10px;
          font-family: 'Barlow Condensed', 'DM Sans', system-ui, sans-serif;
          font-size: 32px;
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: #0A1628;
        }
        .sport-detail-group {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6B5B3F;
          text-align: right;
          max-width: 180px;
        }
        .sport-detail-section-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6B5B3F;
          margin: 0 0 10px;
        }
        .sport-detail-score-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin: 6px 0 18px;
        }
        .sport-detail-score {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 56px;
          font-weight: 700;
          line-height: 1;
        }
        .sport-detail-score-sub {
          font-size: 13px;
          color: #5c6570;
          font-weight: 600;
        }
        .sport-detail-breakdown {
          margin-top: 8px;
          margin-bottom: 18px;
        }
        .sport-detail-comp-row {
          display: grid;
          grid-template-columns: 170px 1fr 44px;
          gap: 12px;
          align-items: center;
          padding: 9px 0;
          border-bottom: 0.5px solid rgba(232, 223, 204, 0.9);
        }
        .sport-detail-comp-row:last-child {
          border-bottom: none;
        }
        .sport-detail-comp-name {
          font-size: 12px;
          font-weight: 600;
          color: #0A1628;
        }
        .sport-detail-comp-track {
          height: 10px;
          border-radius: 6px;
          background: rgba(61, 46, 20, 0.08);
          overflow: hidden;
        }
        .sport-detail-comp-fill {
          height: 100%;
          border-radius: 6px;
          background: rgba(10, 22, 40, 0.85);
        }
        .sport-detail-comp-value {
          text-align: right;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #0A1628;
        }
        .sport-detail-formula {
          margin-top: 10px;
          font-size: 12px;
          color: #6B5B3F;
          font-variant-numeric: tabular-nums;
        }
        .sport-detail-reasoning-block {
          padding: 14px 0;
          border-bottom: 0.5px solid rgba(232, 223, 204, 0.9);
        }
        .sport-detail-reasoning-block:last-child {
          border-bottom: none;
        }
        .sport-detail-reasoning-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6B5B3F;
          margin: 0 0 6px;
        }
        .sport-detail-reasoning-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.65;
          color: #0A1628;
        }
        .sport-detail-sources {
          margin: 0;
          padding-left: 18px;
        }
        .sport-detail-sources li {
          margin: 8px 0;
          font-size: 13px;
          color: #0A1628;
        }
        .sport-detail-source-link {
          color: #0A1628;
          text-decoration: none;
          border-bottom: 1px solid rgba(191, 13, 62, 0.25);
        }
        .sport-detail-source-link:hover {
          color: #BF0D3E;
          border-bottom-color: rgba(191, 13, 62, 0.55);
        }
        .sport-detail-source-domain {
          color: #6B5B3F;
          margin-left: 8px;
          font-size: 11px;
        }
      `}</style>
      <div
        className={`sport-detail-overlay${entered ? ' sport-detail-overlay--visible' : ''}`}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className="sport-detail-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sport-detail-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="sport-detail-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>

          <div className="sport-detail-header">
            <div>
              <h2 id="sport-detail-title" className="sport-detail-title">
                {sport.name}
              </h2>
              <span className="games-badge">{sport.type}</span>
            </div>
            <div className="sport-detail-group">{groupLabel}</div>
          </div>

          <section aria-labelledby="sport-detail-score-heading">
            <h3 id="sport-detail-score-heading" className="sport-detail-section-label">
              Momentum score
            </h3>
            <div className="sport-detail-score-row">
              <div className="sport-detail-score" style={{ color: trendColor }}>
                {Math.round(score)}
              </div>
              <div className="sport-detail-score-sub">/ 100</div>
            </div>
          </section>

          <section className="sport-detail-breakdown" aria-labelledby="sport-detail-breakdown-heading">
            <h3 id="sport-detail-breakdown-heading" className="sport-detail-section-label">
              How this score is calculated
            </h3>
            {parts.map((p) => (
              <div key={p.key} className="sport-detail-comp-row">
                <div className="sport-detail-comp-name">
                  {p.name} ({p.key})
                </div>
                <div className="sport-detail-comp-track">
                  <div
                    className="sport-detail-comp-fill"
                    style={{ width: `${p.value == null ? 0 : p.value}%` }}
                  />
                </div>
                <div className="sport-detail-comp-value">
                  {p.value == null ? '—' : Math.round(p.value)}
                </div>
              </div>
            ))}
            <div className="sport-detail-formula">{formulaLine}</div>
          </section>

          <section aria-labelledby="sport-detail-reasoning-heading">
            <h3 id="sport-detail-reasoning-heading" className="sport-detail-section-label">
              Reasoning with sources
            </h3>
            {reasoning ? (
              <>
                <div className="sport-detail-reasoning-block">
                  <p className="sport-detail-reasoning-label">Performance</p>
                  <p className="sport-detail-reasoning-text">
                    {reasoning.performance || '—'}
                  </p>
                </div>
                <div className="sport-detail-reasoning-block">
                  <p className="sport-detail-reasoning-label">Trajectory</p>
                  <p className="sport-detail-reasoning-text">
                    {reasoning.trajectory || '—'}
                  </p>
                </div>
                <div className="sport-detail-reasoning-block">
                  <p className="sport-detail-reasoning-label">Media</p>
                  <p className="sport-detail-reasoning-text">
                    {reasoning.media || '—'}
                  </p>
                </div>
                <div className="sport-detail-reasoning-block">
                  <p className="sport-detail-reasoning-label">Context</p>
                  <p className="sport-detail-reasoning-text">
                    {reasoning.context || '—'}
                  </p>
                </div>
              </>
            ) : (
              <p className="sport-detail-reasoning-text">
                No cached reasoning available for this sport yet.
              </p>
            )}
          </section>

          <section style={{ marginTop: 18 }} aria-labelledby="sport-detail-sources-heading">
            <h3 id="sport-detail-sources-heading" className="sport-detail-section-label">
              Data sources
            </h3>
            {sources.length > 0 ? (
              <ol className="sport-detail-sources">
                {sources.map((s, idx) => {
                  const uri = s?.uri
                  const title = s?.title || uri || `Source ${idx + 1}`
                  if (!uri) {
                    return <li key={idx}>{title}</li>
                  }
                  return (
                    <li key={uri + idx}>
                      <a
                        className="sport-detail-source-link"
                        href={uri}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {title}
                      </a>
                      <span className="sport-detail-source-domain">
                        {hostFromUrl(uri)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="sport-detail-reasoning-text">No source citations cached yet.</p>
            )}
          </section>
        </div>
      </div>
    </>
  )

  return createPortal(modal, document.body)
}
