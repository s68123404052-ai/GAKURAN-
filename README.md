# GAKURAN

GAKURAN Class War Core Engine — ระบบคะแนนและการแข่งขันสำหรับ GAKURAN RP Server

## Features

- Player Registration
- Challenge System
- Match System
- Evidence Submission
- Admin Verification
- Score Calculation
- Win / Loss Tracking
- Win Streak / Losing Streak
- Fail / Rest System
- Rival / Revenge System
- Season System
- History / Statistics
- Daily Rewards
- Event Rewards
- Reward Code System
- Discord Rank / Role Sync
- Student Card
- QR Student Verification
- Web Student Verification
- Pink Discord Embeds

## Rank System

| Score | Rank |
|---:|---|
| 0–99 | UNRANKED |
| 100–199 | ROOKIE |
| 200–299 | STUDENT |
| 300–399 | ELITE STUDENT |
| 400–499 | PREFECT |
| 500–599 | EXECUTIVE |
| 600–699 | VETERAN |
| 700–799 | ELITE |
| 800–899 | MASTER |
| 900–999 | CHAMPION |
| 1000–1099 | GRAND CHAMPION |
| 1100–1199 | OVERLORD |
| 1200–1299 | IMMORTAL |
| 1300–1399 | SUPREME |
| 1400–1499 | ASCENDANT |
| 1500–1599 | EMPEROR |
| 1600–1699 | MYTHIC |
| 1700–1799 | LEGEND |
| 1800–1899 | LEGENDARY |
| 1900–1999 | GOD |
| 2000+ | GODLIKE |

## Student Verification

Students can use `/student` to generate their Student Card.

The Student Card contains:

- Student Name
- Discord ID
- Score
- Class / Rank
- QR Verification

The QR code opens the GAKURAN Web Verification page.

## Discord Commands

Main commands include:

- `/register`
- `/score`
- `/rank`
- `/challenge`
- `/accept`
- `/start`
- `/submit`
- `/verify`
- `/history`
- `/stats`
- `/daily`
- `/event-reward`
- `/redeem-code`
- `/student`
- `/verify-student`
- `/sync-ranks`
- `/decline`

## Technology

- Node.js
- Discord.js
- SQLite
- Express
- QRCode
- @napi-rs/canvas

## Testing

The current release has passed:

- Core Engine Test
- Rank Boundary Test — 41/41
- Database Integrity Test
- JavaScript Syntax Test
- Git Clean Test
- Runtime Service Load Test
- Discord Bot Syntax Test
- Web Verification Syntax Test
- End-to-End Feature Tests

## Project Structure

```text
GAKURAN/
├── src/
│   ├── bot/
│   ├── services/
│   ├── database.js
│   ├── demo.js
│   ├── student-card.js
│   ├── ui-card.js
│   └── web.js
├── data/
├── game_system.db
├── package.json
└── README.md

## Development

Install dependencies: `npm install`

Run the demo: `node src/demo.js`

Run the Discord Bot: `node src/bot/index.js`

Run Web Student Verification: `node src/web.js`

## Release

**GAKURAN Core v1.0**

The core systems have completed testing and are ready for release.

---

Made for the GAKURAN RP Server.
