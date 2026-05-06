# LA28 Momentum Exchange

> See what's surging before the nation does.

A National Momentum generator for sports featuring at the LA28 Olympic and Paralympic Games. The first prediction engine that treats Olympic and Paralympic sports as equal assets, powered by Gemini search grounding and a transparent 4-factor momentum formula.

Built for the Vibe Code for Gold hackathon — Challenge 3: The Road to LA28 Games Bracket.

---

## What It Does

LA28 is approaching as a home Games for Team USA. There are 59 sports across the Olympic and Paralympic programs. Most fans could name five of them. LA28 Momentum Exchange surfaces real momentum trajectories grounded in cited news and World Championship data, then lets fans lock in their personal predictions for which sports will be top performers.

The app is built around a single thesis: **Paralympic sports are equally important and many are quietly surging while the nation looks elsewhere.** Every page is structured to make that visible.

---

## Key Features

### Home — National Momentum Dashboard
A single composite momentum number representing where Team USA stands across all 59 sports. Live countdown to the LA28 Games. Recent news with cited sources from Gemini search grounding. Olympic vs Paralympic momentum trajectory chart showing 7-day movement.

### Market — All 59 Sports Equally Weighted
Premium FIFA-style sport cards organized by 8 categories (Aquatic, Athletics, Combat, Precision, Team, Individual, Gymnastics, Cycling). Each card shows momentum score, trajectory, real-time community allocation versus data-driven score, and a Gemini-generated narrative. Click any card for full reasoning breakdown across the 4-factor formula.

### Ask the Market — Agentic Q&A
A chat interface where fans ask natural language questions about LA28 sports. Watch Gemini work in real time through a visible reasoning chain: searching news, reading momentum data, cross-referencing trajectory, then synthesizing an answer with cited sources and direct links to relevant sport cards.

### Portfolio — Lock-In Predictions
Up to 10 prediction locks per fan. Browse Market, click lock on sports you believe in, then commit them with a single email confirmation. Each locked prediction generates a FIFA-style collectible card in cream aesthetic. Three rarity tiers (Mythic Gold, Rare Silver, Common Bronze) earned automatically based on where the sport ranks at LA28 in 2028.

---

## The Momentum Formula

Each sport's momentum score is calculated as:
Momentum = 0.4(P) + 0.25(T) + 0.2(M) + 0.15(C)

Where:
- **P (Performance Growth)** — Team USA medal count at the last 2 World Championships vs the 2 before
- **T (Trajectory)** — slope of medal counts across the last 4 cycles
- **M (Media Momentum)** — recent news volume and sentiment for the program
- **C (Competitive Context)** — global depth of the sport, scaled by competitive difficulty

Every component is computed by Gemini using Google Search grounding with cited sources. Click any sport card to see the full breakdown with reasoning per component.

---

## Tech Stack

**Frontend**
- React 18
- Vite
- React Router DOM
- Recharts (data visualization)
- html2canvas (prediction card downloads)

**AI / Data**
- Gemini 2.5 Flash with Google Search grounding
- Real-time momentum calculation per sport
- Agentic reasoning chain for Q&A
- All Gemini outputs cached in Firestore (Gemini API spend stays under $5 across all users)

**Infrastructure**
- Google Cloud Run (deployment)
- Firebase Firestore (caching, predictions storage, real-time community data)
- Apache 2.0 License

---

## Architecture
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│                    (React + Vite frontend)                   │
└──────────────────┬──────────────────┬───────────────────────┘
│                  │
│                  │
┌──────────▼─────────┐  ┌────▼──────────────┐
│   Gemini API       │  │  Firestore        │
│   2.5 Flash        │  │  - momentum/      │
│                    │  │  - narratives/    │
│   + Google Search  │  │  - news/          │
│   Grounding        │  │  - predictions/   │
│                    │  │  - qa-cache/      │
│   • Momentum calc  │  │                   │
│   • News research  │  │  Real-time        │
│   • Agentic chat   │  │  community data   │
│   • Narratives     │  │                   │
└────────────────────┘  └───────────────────┘
│                  ▲
│                  │
└──── Caching ─────┘
          All deployed on Google Cloud Run

**Data flow:**
1. First user triggers Gemini momentum calculation for a sport
2. Result cached in Firestore with sources and 4-component breakdown
3. All future visitors read from cache — zero additional API spend
4. Predictions stored per-email in Firestore for 2028 verification

**API budget protection:**
- Heavy Firestore caching reduces Gemini calls 99% after initial generation
- Sequential generation with 2-second delays prevents rate limit hits
- Search grounding only triggered for first generation and Q&A queries

---

## Compliance

This project follows all data and content rules for the contest:

- US-scope only — Team USA data exclusively
- No specific finish times or measurement values
- Medals and placements (1st, 2nd, 3rd) only
- No athlete names referenced
- No corporate brand promotion in UI
- Official sport names used (Athletics, not USA Track & Field)
- LA28 Games terminology preserved
- Gemini prompts include hard-coded compliance rules
- Post-generation regex filter as second compliance layer
- No NIL multimedia (gradient bubbles instead of athlete photos)

All AI tools used are Google Cloud services (Gemini API). No competing LLMs.

---

## Running Locally

```bash
git clone https://github.com/khadimswe/la28-momentum-exchange.git
cd la28-momentum-exchange
npm install

# Create .env file with:
# VITE_GEMINI_API_KEY=your_gemini_key_here
# VITE_FIREBASE_API_KEY=your_firebase_key_here
# VITE_FIREBASE_AUTH_DOMAIN=your_firebase_domain
# VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
# VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage
# VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
# VITE_FIREBASE_APP_ID=your_app_id

npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Project Structure
la28-momentum-exchange/
├── src/
│   ├── pages/
│   │   ├── Home.jsx              # National Momentum dashboard
│   │   ├── Market.jsx            # 59-sport market with agentic chat
│   │   └── Portfolio.jsx         # Prediction lock-in flow
│   ├── components/
│   │   ├── Navbar.jsx            # Sticky navigation
│   │   ├── MomentumTicker.jsx    # Live momentum scroll
│   │   ├── SportDetail.jsx       # Card detail modal
│   │   └── Toast.jsx             # Notification system
│   ├── lib/
│   │   ├── computeMomentum.js    # Gemini momentum formula
│   │   ├── fetchNews.js          # Gemini news search
│   │   └── askMarket.js          # Agentic chat reasoning
│   ├── hooks/
│   │   └── useMomentumScores.js  # Firestore live data
│   ├── data/
│   │   └── sports.js             # 59 LA28 sports (36 Olympic + 23 Paralympic)
│   ├── firebase.js               # Firebase config
│   ├── App.jsx                   # Main router and global state
│   └── main.jsx                  # Entry point
├── public/
├── .env                          # Environment variables (gitignored)
├── package.json
├── vite.config.js
├── LICENSE                       # Apache 2.0
└── README.md

---

## Findings

Building with real Gemini search grounding revealed several patterns:

- The momentum formula consistently scored Paralympic sports higher than expected — Para Climbing (93), Para Table Tennis (90), Para Badminton (88) all ranked in the top 10. This validates the thesis that Paralympic momentum is undervalued by mainstream attention.

- Community allocation data (when seeded) showed users allocating 70% of their predictions to Olympic sports despite Paralympic sports having higher data scores. The gap between America's Bet and What The Data Shows averaged 25-40 points for high-momentum Paralympic sports.

- Search grounding cost per sport was approximately $0.035, totaling under $3 to generate momentum scores for all 59 sports. Caching reduces ongoing operational cost to nearly zero.

- Trajectory scoring revealed a pattern: LA28 debut sports (Flag Football, Cricket, Lacrosse) and Paralympic sports with newer global federations score highest because their growth slopes are steepest.

---

## License

Licensed under the Apache License 2.0. See [LICENSE](./LICENSE) file for details.

---

Built with conviction. Lock in your LA28 predictions before the nation catches on.