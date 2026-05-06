import { useMemo } from 'react'
import { SPORTS } from '../data/sports.js'
import { useMomentumScores } from '../hooks/useMomentumScores.js'

/** Stable visual placeholder in [-5, 5] for ticker movement */
function placeholderDelta(sportName) {
  let h = 0
  for (let i = 0; i < sportName.length; i += 1) {
    h = (Math.imul(31, h) + sportName.charCodeAt(i)) | 0
  }
  const t = (Math.abs(h) % 10000) / 10000
  return -5 + t * 10
}

export default function MomentumTicker() {
  const { scores } = useMomentumScores()

  const tickerRows = useMemo(
    () =>
      SPORTS.map((sport) => ({
        key: sport.name,
        name: sport.name,
        delta: placeholderDelta(sport.name),
      })),
    [scores],
  )

  const renderDot = () => (
    <span className="momentum-ticker-dot" aria-hidden="true">
      ·
    </span>
  )

  function renderSegment(segId) {
    return (
      <span className="momentum-ticker-segment">
        {tickerRows.map((s, idx) => {
          const isPositive = s.delta >= 0
          const deltaText = `${isPositive ? '+' : ''}${s.delta.toFixed(1)}`

          return (
            <span key={`${segId}-${s.key}`} className="momentum-ticker-item-wrap">
              <span className="momentum-ticker-item">
                <span className="momentum-ticker-name">{s.name}</span>{' '}
                <span className="momentum-ticker-delta">{deltaText}</span>{' '}
                <span
                  className={
                    isPositive ? 'momentum-ticker-arrow--up' : 'momentum-ticker-arrow--down'
                  }
                  aria-hidden="true"
                >
                  {isPositive ? '↑' : '↓'}
                </span>
              </span>
              {idx < tickerRows.length - 1 ? renderDot() : null}
            </span>
          )
        })}
        {renderDot()}
      </span>
    )
  }

  return (
    <>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .momentum-ticker {
          width: 100%;
          height: 40px;
          background: #0A1628;
          color: #fff;
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
        }

        .momentum-ticker-label {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          display: flex;
          align-items: center;
          padding: 0 12px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #BF0D3E;
          background: linear-gradient(90deg, #0A1628 0%, #0A1628 70%, rgba(10, 22, 40, 0) 100%);
          z-index: 2;
          pointer-events: none;
          white-space: nowrap;
        }

        .momentum-ticker-marquee {
          flex: 1;
          min-width: 0;
          height: 100%;
          overflow: hidden;
          position: relative;
        }

        .momentum-ticker-row {
          display: inline-flex;
          align-items: center;
          flex-wrap: nowrap;
          white-space: nowrap;
          height: 100%;
          animation: ticker-scroll 180s linear infinite;
          will-change: transform;
          padding-left: 148px;
        }

        .momentum-ticker-segment {
          display: inline-flex;
          align-items: center;
          flex-wrap: nowrap;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .momentum-ticker-item-wrap {
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
        }

        .momentum-ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 14px;
          font-size: 13px;
          color: #fff;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .momentum-ticker-name {
          white-space: nowrap;
        }

        .momentum-ticker-delta {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          opacity: 0.95;
          white-space: nowrap;
        }

        .momentum-ticker-arrow--up {
          color: #00A651;
          font-size: 12px;
          line-height: 1;
          flex-shrink: 0;
        }

        .momentum-ticker-arrow--down {
          color: #BF0D3E;
          font-size: 12px;
          line-height: 1;
          flex-shrink: 0;
        }

        .momentum-ticker-dot {
          opacity: 0.4;
          flex-shrink: 0;
          font-size: 13px;
          line-height: 1;
          padding: 0 4px;
        }
      `}</style>

      <div className="momentum-ticker" aria-label="Live momentum ticker">
        <div className="momentum-ticker-label">LIVE MOMENTUM</div>
        <div className="momentum-ticker-marquee">
          <div className="momentum-ticker-row" aria-hidden="true">
            {renderSegment('a')}
            {renderSegment('b')}
          </div>
        </div>
      </div>
    </>
  )
}
