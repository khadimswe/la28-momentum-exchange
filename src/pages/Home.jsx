import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { collection, getDocs } from 'firebase/firestore'
import MomentumTicker from '../components/MomentumTicker.jsx'
import { SPORTS } from '../data/sports.js'
import { db } from '../firebase.js'
import { fetchTopNews } from '../lib/fetchNews.js'
import { useMomentumScores } from '../hooks/useMomentumScores.js'

const PAGE_BG = '#F5F2ED'

function roundMomentum1(n) {
  return Math.round(Number(n) * 10) / 10
}

function formatChartNumber(v) {
  return roundMomentum1(v).toFixed(1)
}

const getNewsAbbreviation = (sportName) => {
  if (!sportName) return 'L28'

  // Strip everything after first opening paren
  const cleanName = sportName.split('(')[0].trim()

  // Special cases for non-sport categorical news
  if (
    cleanName.toLowerCase().includes('multi-sport') ||
    cleanName.toLowerCase().includes('multi sport')
  ) {
    return 'LA28'
  }
  if (cleanName.toLowerCase().includes('general')) {
    return 'LA28'
  }

  // Take first letter of each word, max 3 chars
  const words = cleanName.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function getShortSportLabel(sportName) {
  if (!sportName) return 'LA28 Update'

  const s = String(sportName)
  const hasParens = s.includes('(')
  if (!hasParens) return s

  const beforeParen = s.split('(')[0].trim()
  const lower = beforeParen.toLowerCase()
  const isTooLong = s.length > 30

  if (isTooLong) {
    if (lower.includes('multi-sport') || lower.includes('multi sport')) return 'Multi-sport'
    return 'LA28 Update'
  }

  return beforeParen || 'LA28 Update'
}

function getShortImpactSportText(sportName, impact) {
  const n = Math.abs(Number(impact) || 0)
  const s = String(sportName || '')
  if (s.includes('(')) {
    const beforeParen = s.split('(')[0].trim().toLowerCase()
    if (beforeParen.includes('multi-sport') || beforeParen.includes('multi sport')) {
      return `↑ Pushed multiple sports +${n} momentum`
    }
    return `↑ Pushed LA28 momentum +${n}`
  }
  return `↑ Pushed ${sportName} +${n} momentum`
}

function openUrl(url) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function formatCountdown(target) {
  const now = Date.now()
  let ms = target - now
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  }
  const days = Math.floor(ms / 86400000)
  ms -= days * 86400000
  const hours = Math.floor(ms / 3600000)
  ms -= hours * 3600000
  const minutes = Math.floor(ms / 60000)
  ms -= minutes * 60000
  const seconds = Math.floor(ms / 1000)
  return { days, hours, minutes, seconds }
}

export default function Home() {
  const navigate = useNavigate()
  const [portfolioCount, setPortfolioCount] = useState(null)
  const [tick, setTick] = useState(0)
  const [topNews, setTopNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [liveNational, setLiveNational] = useState(0)
  const [liveNationalDir, setLiveNationalDir] = useState(0)

  const { scores } = useMomentumScores()

  const olympicSports = useMemo(() => SPORTS.filter((s) => s.type === 'Olympic'), [])
  const paralympicSports = useMemo(() => SPORTS.filter((s) => s.type === 'Paralympic'), [])

  const scoreFor = useMemo(() => {
    return (sport) => {
      const raw = scores?.[sport.name]?.momentum
      const n = Number(raw)
      if (!Number.isNaN(n)) return n
      return sport.momentum
    }
  }, [scores])

  const avgOlympic = useMemo(() => {
    if (olympicSports.length === 0) return 0
    return olympicSports.reduce((a, s) => a + scoreFor(s), 0) / olympicSports.length
  }, [olympicSports, scoreFor])

  const avgParalympic = useMemo(() => {
    if (paralympicSports.length === 0) return 0
    return paralympicSports.reduce((a, s) => a + scoreFor(s), 0) / paralympicSports.length
  }, [paralympicSports, scoreFor])

  const momentumGap = avgParalympic - avgOlympic

  const nationalMomentum = useMemo(() => {
    if (SPORTS.length === 0) return 0
    return SPORTS.reduce((a, s) => a + scoreFor(s), 0) / SPORTS.length
  }, [scoreFor])

  const topFour = useMemo(
    () => [...SPORTS].sort((a, b) => scoreFor(b) - scoreFor(a)).slice(0, 4),
    [scoreFor],
  )

  const topBottomMomentumAvg = useMemo(() => {
    const vals = SPORTS.map((s) => scoreFor(s)).sort((a, b) => b - a)
    if (vals.length === 0) return { top10: 0, bottom10: 0 }
    const top = vals.slice(0, 10)
    const bot = vals.slice(-10)
    return {
      top10: top.reduce((a, v) => a + v, 0) / top.length,
      bottom10: bot.reduce((a, v) => a + v, 0) / bot.length,
    }
  }, [scoreFor])

  const la28Open = useMemo(() => new Date(2028, 6, 14, 0, 0, 0, 0), [])
  const countdown = useMemo(() => formatCountdown(la28Open.getTime()), [la28Open, tick])

  const topSport = useMemo(() => {
    return [...SPORTS].sort((a, b) => scoreFor(b) - scoreFor(a))[0] ?? null
  }, [scoreFor])

  const hasTopNews = Array.isArray(topNews) && topNews.length > 0

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    void getDocs(collection(db, 'portfolios'))
      .then((snap) => {
        if (!cancelled) setPortfolioCount(snap.size)
      })
      .catch(() => {
        if (!cancelled) setPortfolioCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setLiveNational(nationalMomentum)
    setLiveNationalDir(0)
  }, [nationalMomentum])

  useEffect(() => {
    const id = setInterval(() => {
      setLiveNational((prev) => {
        const delta = (Math.random() - 0.5) * 0.1 // -0.05 to +0.05
        setLiveNationalDir(delta === 0 ? 0 : delta > 0 ? 1 : -1)
        return prev + delta
      })
    }, 3000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    setNewsLoading(true)
    void fetchTopNews()
      .then((stories) => {
        if (cancelled) return
        setTopNews(Array.isArray(stories) ? stories.slice(0, 2) : [])
      })
      .catch((e) => {
        console.error('Failed to load top news:', e)
        if (!cancelled) setTopNews([])
      })
      .finally(() => {
        if (!cancelled) setNewsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const chartData = useMemo(() => {
    const olympicAvg = Number.isFinite(avgOlympic) ? avgOlympic : 0
    const paralympicAvg = Number.isFinite(avgParalympic) ? avgParalympic : 0

    return [
      { day: 'MON', Olympic: roundMomentum1(olympicAvg - 4.2), Paralympic: roundMomentum1(paralympicAvg - 6.8) },
      { day: 'TUE', Olympic: roundMomentum1(olympicAvg - 3.8), Paralympic: roundMomentum1(paralympicAvg - 5.2) },
      { day: 'WED', Olympic: roundMomentum1(olympicAvg - 2.9), Paralympic: roundMomentum1(paralympicAvg - 3.4) },
      { day: 'THU', Olympic: roundMomentum1(olympicAvg - 1.4), Paralympic: roundMomentum1(paralympicAvg - 2.1) },
      { day: 'FRI', Olympic: roundMomentum1(olympicAvg - 0.8), Paralympic: roundMomentum1(paralympicAvg - 0.9) },
      { day: 'SAT', Olympic: roundMomentum1(olympicAvg + 0.3), Paralympic: roundMomentum1(paralympicAvg + 0.4) },
      { day: 'TODAY', Olympic: roundMomentum1(olympicAvg), Paralympic: roundMomentum1(paralympicAvg) },
    ]
  }, [avgOlympic, avgParalympic])

  const secsStr = String(countdown.seconds).padStart(2, '0')

  return (
    <>
      <MomentumTicker />
      <style>{`
        @keyframes home-fire-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes home-break-dot {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .home-page {
          font-family: 'Barlow', 'DM Sans', system-ui, sans-serif;
          background: ${PAGE_BG};
          min-height: calc(100vh - 52px);
        }
        .home-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 32px 40px;
        }
        .home-section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #6b5b3f;
          margin: 0 0 12px;
        }
        .home-news-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 700px) {
          .home-news-grid {
            grid-template-columns: 1fr;
          }
        }
        .home-news-card {
          display: flex;
          gap: 12px;
          background: #fbf8f1;
          border: 0.5px solid #e8dfcc;
          border-radius: 10px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(50, 40, 20, 0.04);
          position: relative;
        }
        .home-news-card--skeleton {
          background: linear-gradient(90deg, #FBF8F1 0%, #F5EFE0 50%, #FBF8F1 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          overflow: hidden;
        }
        .home-news-skeleton-text {
          font-size: 12px;
          font-weight: 500;
          color: rgba(10, 22, 40, 0.45);
          margin-top: 8px;
        }
        .home-breaking-badge {
          position: absolute;
          top: 10px;
          right: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #BF0D3E;
          font-weight: 700;
          background: rgba(251, 248, 241, 0.85);
          border: 0.5px solid rgba(191, 13, 62, 0.25);
          padding: 4px 8px;
          border-radius: 999px;
        }
        .home-breaking-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #BF0D3E;
          animation: home-break-dot 1.1s ease-in-out infinite;
        }
        .home-news-card--clickable {
          cursor: pointer;
          transition: transform 200ms ease, box-shadow 200ms ease;
        }
        .home-news-card--clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(50, 40, 20, 0.08);
        }
        .home-news-ext {
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 14px;
          color: #6B5B3F;
          opacity: 0.9;
          transition: color 200ms ease;
        }
        .home-news-card--clickable:hover .home-news-ext {
          color: #BF0D3E;
        }
        .home-news-skel-line {
          height: 10px;
          border-radius: 6px;
          background: rgba(61, 46, 20, 0.10);
        }
        .home-news-skel-line--title {
          height: 12px;
          background: rgba(10, 22, 40, 0.10);
        }
        .home-news-thumb {
          flex-shrink: 0;
          width: 80px;
          height: 80px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.02em;
        }
        .home-news-thumb--para {
          background: linear-gradient(135deg, #BF0D3E 0%, #0A1628 100%);
        }
        .home-news-thumb--oly {
          background: linear-gradient(135deg, #0A1628 0%, #1B2B4B 50%, #BF0D3E 100%);
        }
        .home-news-body {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .home-news-source {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #bf0d3e;
        }
        .home-news-title {
          margin: 0;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.35;
          color: #0a1628;
        }
        .home-news-impact {
          font-size: 11px;
          font-weight: 500;
          color: #00875a;
        }
        .home-countdown-card {
          margin-top: 20px;
          width: 100%;
          background: #FBF8F1;
          border: 0.5px solid #E8DFCC;
          border-radius: 10px;
          padding: 24px 32px;
          text-align: center;
        }
        .home-countdown-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #6B5B3F;
          margin: 0 0 12px;
        }
        .home-countdown-big {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 64px;
          font-weight: 700;
          color: #0A1628;
          line-height: 1;
          margin: 0;
        }
        .home-countdown-sub {
          margin-top: 10px;
          font-size: 11px;
          color: #5c6570;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .home-live-sec-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #BF0D3E;
          display: inline-block;
          animation: home-break-dot 1s ease-in-out infinite;
          margin-left: 6px;
        }

        .home-national {
          margin-top: 20px;
          width: 100%;
          background: #fbf8f1;
          border: 0.5px solid #e8dfcc;
          border-radius: 10px;
          padding: 18px 20px;
        }
        .home-national-top {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }
        .home-national-left {
          min-width: 0;
        }
        .home-national-big {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 56px;
          font-weight: 700;
          line-height: 1;
          color: #0a1628;
          margin: 4px 0 6px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .home-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          display: inline-block;
          animation: home-break-dot 1.3s ease-in-out infinite;
        }
        .home-live-dot--up { background: #00875A; }
        .home-live-dot--down { background: #BF0D3E; }
        .home-live-dot--flat { background: rgba(92, 101, 112, 0.55); }
        .home-national-delta {
          font-size: 13px;
          color: #00875a;
          font-weight: 500;
        }
        .home-national-breakdown {
          font-size: 11px;
          color: #71717a;
          font-weight: 500;
          margin-top: 8px;
          line-height: 1.4;
        }
        .home-national-context {
          margin-top: 6px;
          font-size: 12px;
          color: #5c6570;
          font-style: italic;
          font-weight: 400;
          line-height: 1.45;
          max-width: 36rem;
        }
        .home-chart-wrap {
          margin-top: 16px;
          width: 100%;
          height: 200px;
        }
        .home-chart-wrap .recharts-responsive-container {
          width: 100% !important;
          height: 100% !important;
        }
        .home-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 20px;
        }
        @media (max-width: 900px) {
          .home-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .home-stat-card {
          background: #fbf8f1;
          border: 0.5px solid #e8dfcc;
          border-radius: 8px;
          padding: 10px 12px;
        }
        .home-stat-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6b5b3f;
          margin: 0 0 6px;
        }
        .home-stat-value {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #0a1628;
          line-height: 1.15;
        }
        .home-stat-value--green {
          color: #00875a;
        }
        .home-stat-sub {
          font-size: 10px;
          font-weight: 500;
          color: #6b5b3f;
          margin-top: 4px;
        }
        .home-surging-card {
          margin-top: 20px;
          background: #fbf8f1;
          border: 0.5px solid #e8dfcc;
          border-radius: 10px;
          padding: 14px 16px;
        }
        .home-surging-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 0.5px solid #efe8d5;
          cursor: pointer;
        }
        .home-surging-row:last-child {
          border-bottom: none;
        }
        .home-surging-row:hover {
          background: rgba(10, 22, 40, 0.03);
          margin: 0 -8px;
          padding-left: 8px;
          padding-right: 8px;
          border-radius: 6px;
        }
        .home-surging-rank {
          width: 16px;
          flex-shrink: 0;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #bf0d3e;
        }
        .home-surging-pill {
          flex-shrink: 0;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 3px;
        }
        .home-surging-pill--para {
          background: rgba(191, 13, 62, 0.1);
          color: #8b0a2e;
        }
        .home-surging-pill--oly {
          background: rgba(10, 22, 40, 0.08);
          color: #0a1628;
        }
        .home-surging-name {
          flex: 1;
          min-width: 0;
          font-size: 12px;
          font-weight: 500;
          color: #0a1628;
        }
        .home-surging-score {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #00875a;
          flex-shrink: 0;
        }
      `}</style>

      <div className="home-page">
        <div className="home-container">
          <section aria-labelledby="home-progress-heading">
            <h2 id="home-progress-heading" className="home-section-label">
              Latest exciting progress
            </h2>
            <div className="home-news-grid">
              {newsLoading &&
                !hasTopNews &&
                [0, 1].map((i) => (
                  <article
                    key={i}
                    className="home-news-card home-news-card--skeleton"
                    aria-label="Loading momentum news"
                  >
                    <div className="home-news-thumb home-news-thumb--oly">--</div>
                    <div className="home-news-body">
                      <div className="home-news-skel-line" style={{ width: '45%' }} />
                      <div className="home-news-skel-line home-news-skel-line--title" />
                      <div className="home-news-skel-line home-news-skel-line--title" style={{ width: '78%' }} />
                      <div className="home-news-skel-line" style={{ width: '58%' }} />
                      <div className="home-news-skeleton-text">Loading momentum news...</div>
                    </div>
                  </article>
                ))}

              {hasTopNews &&
                topNews.slice(0, 2).map((item, idx) => {
                  const clickable = Boolean(item.url)
                  const cardClass = clickable
                    ? 'home-news-card home-news-card--clickable'
                    : 'home-news-card'
                  const key = `${item.sport}-${item.url ?? item.headline}`
                  const abbr = getNewsAbbreviation(item.sport)
                  const fontSize = abbr.length > 3 ? '16px' : '24px'
                  const shortSportLabel = getShortSportLabel(item.sport)

                  return (
                    <article
                      key={key}
                      className={cardClass}
                      role={clickable ? 'link' : undefined}
                      aria-label={clickable ? 'Open article in new tab' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? () => openUrl(item.url) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openUrl(item.url)
                              }
                            }
                          : undefined
                      }
                    >
                      {idx === 0 && (
                        <span
                          className="home-breaking-badge"
                          aria-label="Breaking"
                          style={clickable ? { right: 34 } : undefined}
                        >
                          <span className="home-breaking-dot" aria-hidden="true" />
                          BREAKING
                        </span>
                      )}
                      {clickable ? (
                        <span className="home-news-ext" aria-hidden="true">
                          ↗
                        </span>
                      ) : null}
                      <div
                        className={`home-news-thumb ${
                          item.type === 'Paralympic'
                            ? 'home-news-thumb--para'
                            : 'home-news-thumb--oly'
                        }`}
                        aria-hidden="true"
                        style={{ fontSize }}
                      >
                        {abbr}
                      </div>
                      <div className="home-news-body">
                        <span className="home-news-source">
                          {item.source} · {item.timeAgo}
                        </span>
                        <p className="home-news-title">{item.headline}</p>
                        <p
                          className="home-news-title"
                          style={{ marginTop: -2, color: '#5c6570' }}
                        >
                          {item.description}
                        </p>
                        <span className="home-news-impact">
                          {item.sport?.includes('(')
                            ? getShortImpactSportText(item.sport, item.impact)
                            : `↑ Pushed ${shortSportLabel} +${Math.abs(Number(item.impact) || 0)} momentum`}
                        </span>
                      </div>
                    </article>
                  )
                })}
            </div>
          </section>

          <section className="home-countdown-card" aria-label="LA28 Opening Ceremony countdown">
            <div className="home-countdown-title">LA28 OPENING CEREMONY</div>
            <div className="home-countdown-big">
              {countdown.days} DAYS · {countdown.hours} HRS · {countdown.minutes} MIN · {secsStr} SEC
            </div>
            <div className="home-countdown-sub">
              DAYS · HRS · MIN · SEC
              <span className="home-live-sec-dot" aria-hidden="true" />
            </div>
          </section>

          <section className="home-national" aria-labelledby="home-national-heading">
            <div className="home-national-top">
              <div className="home-national-left">
                <h2 id="home-national-heading" className="home-section-label" style={{ marginBottom: 8 }}>
                  National momentum
                </h2>
                <div className="home-national-big">
                  {liveNational.toFixed(2)}
                  <span
                    className={`home-live-dot ${
                      liveNationalDir > 0
                        ? 'home-live-dot--up'
                        : liveNationalDir < 0
                          ? 'home-live-dot--down'
                          : 'home-live-dot--flat'
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div className="home-national-delta">↑ +2.3 this week · Updated live</div>
                <p className="home-national-breakdown">
                  Top 10 sports averaging {topBottomMomentumAvg.top10.toFixed(1)} · Bottom 10 averaging{' '}
                  {topBottomMomentumAvg.bottom10.toFixed(1)}
                </p>
                <p className="home-national-context">
                  Driven by surging Paralympic programs and LA28 debut sports
                </p>
              </div>
            </div>
            <div
              style={{
                width: '100%',
                height: '200px',
                minHeight: '200px',
                position: 'relative',
                flex: '1 1 auto',
              }}
              aria-label="Olympic vs Paralympic weekly momentum comparison"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="olympicGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0A1628" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#0A1628" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="paralympicGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#BF0D3E" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#BF0D3E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#E8DFCC" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{
                      fontSize: 10,
                      fill: '#6B5B3F',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}
                    axisLine={{ stroke: '#E8DFCC' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6B5B3F' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['dataMin - 5', 'dataMax + 5']}
                    tickFormatter={formatChartNumber}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      typeof value === 'number'
                        ? [formatChartNumber(value), name]
                        : [value, name]
                    }
                    contentStyle={{
                      background: '#FBF8F1',
                      border: '0.5px solid #E8DFCC',
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '8px 12px',
                    }}
                    labelStyle={{ color: '#0A1628', fontWeight: 600 }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', color: '#3D4757', paddingBottom: '8px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Olympic"
                    name="Olympic"
                    stroke="#0A1628"
                    strokeWidth={2.5}
                    fill="url(#olympicGradient)"
                    dot={false}
                    activeDot={{ r: 5, stroke: '#0A1628', strokeWidth: 2, fill: '#FBF8F1' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Paralympic"
                    name="Paralympic"
                    stroke="#BF0D3E"
                    strokeWidth={2.5}
                    fill="url(#paralympicGradient)"
                    dot={false}
                    activeDot={{ r: 5, stroke: '#BF0D3E', strokeWidth: 2, fill: '#FBF8F1' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section aria-label="Key statistics">
            <div className="home-stats-grid">
              <div className="home-stat-card">
                <p className="home-stat-label">Avg Olympic</p>
                <div className="home-stat-value">{avgOlympic.toFixed(1)}</div>
                <div className="home-stat-sub">36 sports tracked</div>
              </div>
              <div className="home-stat-card">
                <p className="home-stat-label">Avg Paralympic</p>
                <div className="home-stat-value">{avgParalympic.toFixed(1)}</div>
                <div className="home-stat-sub">23 sports tracked</div>
              </div>
              <div className="home-stat-card">
                <p className="home-stat-label">Momentum gap</p>
                <div className="home-stat-value home-stat-value--green">
                  {momentumGap >= 0 ? '+' : ''}
                  {momentumGap.toFixed(1)}
                </div>
                <div className="home-stat-sub">Paralympic lead</div>
              </div>
              <div className="home-stat-card">
                <p className="home-stat-label">Total predictions</p>
                <div className="home-stat-value">
                  {portfolioCount == null ? '—' : portfolioCount.toLocaleString()}
                </div>
                <div className="home-stat-sub">portfolios live</div>
              </div>
            </div>
          </section>

          <section style={{ marginTop: 24 }} aria-labelledby="home-surging-heading">
            <h2 id="home-surging-heading" className="home-section-label">
              Top surging right now
            </h2>
            <div className="home-surging-card">
              {topFour.map((s, i) => (
                <div
                  key={s.name}
                  className="home-surging-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/market')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate('/market')
                    }
                  }}
                >
                  <span className="home-surging-rank">{i + 1}</span>
                  <span
                    className={`home-surging-pill ${
                      s.type === 'Paralympic' ? 'home-surging-pill--para' : 'home-surging-pill--oly'
                    }`}
                  >
                    {s.type}
                  </span>
                  <span className="home-surging-name">{s.name}</span>
                  <span className="home-surging-score">↑ {Math.round(scoreFor(s))}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </>
  )
}
