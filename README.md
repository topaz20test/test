<div align="center">
  <img src="public/logo.png" alt="TOPAZ Logo" width="220"/>

  # 🏆 TOPAZ 2.0: Championship Scoring System
  
  [![React](https://img.shields.io/badge/Frontend-React.js-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
  [![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
  [![Tailwind](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
  [![Version](https://img.shields.io/badge/Version-2.0_Premium-FFD700?style=for-the-badge)](https://github.com/gabbyshey334-ux/topaz2.0)

  **"Heritage Since 1972 • Modernized for the Future of Dance"**  
  *The ultimate professional scoring solution for dance competitions, featuring real-time analytics, ability-based groupings, and seasonal medal tracking.*
</div>

---

## 🚀 The TOPAZ Experience

TOPAZ 2.0 isn't just a scoring app—it's a complete competition ecosystem. Designed for speed, accuracy, and visual impact, it handles everything from the first registration to the final Grand Champion award.

### ✨ Key Highlights
- **🎭 Multi-Category Mastery**: Support for 10 distinct categories across Performing Arts and Special Categories.
- **📈 Advanced Analytics**: Real-time ranking with multi-judge average calculations and tie-breaking logic.
- **⭐ Seasonal Medal Program**: Cumulative point tracking (Bronze → Silver → Gold) across multiple events.
- **📄 Pro-Grade Reports**: Instant championship-style PDF score sheets and comprehensive Excel exports.
- **📱 Responsive Excellence**: A stunning UI that looks as good on an iPad at the judge's table as it does on a desktop.

---

## 🗺️ Navigation Map

1. [💎 System Overview](#-system-overview)
2. [⚡ Quick Start Guide](#-quick-start-guide)
3. [🗄️ Database Foundation](#-database-foundation)
4. [🎭 Categories & Variety](#-categories--variety)
5. [🎂 Smart Age Tracking](#-age-tracking--auto-assignment)
6. [🔵 Ability Levels System](#-ability-levels-system)
7. [🥇 Medal Points Program](#-medal-points-program)
8. [🔄 Competition Workflow](#-competition-workflow)
9. [📊 Results & Reports](#-results--reports)
10. [🔧 Technical Reference](#-technical-reference)

---

## 💎 System Overview

TOPAZ 2.0 leverages a high-performance stack to ensure 100% uptime during high-stakes competitions.

### 🛠️ Technology Stack
- **Frontend**: React.js 18+ with high-efficiency hooks (useMemo, useCallback)
- **Backend**: Supabase (PostgreSQL) with Real-time Engine for instant score sync
- **Auth & Storage**: Integrated Supabase Authentication and S3-compatible storage for photos
- **Document Engine**: jsPDF for dynamic championship score sheets & XLSX for data export

---

## ⚡ Quick Start Guide

### 1️⃣ Database Setup
Run these in your Supabase SQL editor:
```sql
-- 1. Base Schema
\i database-schema.sql

-- 2. Modernization Migrations
\i ability-level-migration.sql
\i medal-points-migration.sql
\i scores-notes-migration.sql
\i special-categories-migration.sql
```

### 2️⃣ Environment Config
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3️⃣ Launch the App
```bash
npm install
npm run dev
```

---

## 🎭 Categories & Variety

The system uses a sophisticated two-tier category model to ensure fair and organized competition.

### 🌟 Performing Arts (The Main Stage)
*Eligible for High Score Awards & Overall Grand Champion*
- **Styles**: Tap, Jazz, Ballet, Lyrical/Contemporary, Vocal, Acting, Hip Hop
- **Features**: Full competitive rankings, high-visibility badges.

### 🎭 Special Categories (The Showcase)
*Participation Recognition Focused*
- **Styles**: Production, Student Choreography, Teacher/Student
- **Features**: Distinctive gray-themed results section, "Special Category" badges.

### 🌀 The Five Variety Enhancements
Each category can be enhanced with one of 5 variety levels (A-E):
- **Variety A**: Song & Dance / Character
- **Variety B**: Performance with Props
- **Variety C**: Acrobatic Integration
- **Variety D**: Acro + Prop Combination
- **Variety E**: Floor Work (Hip Hop Specialized)

---

## 🎂 Smart Age Tracking

No more manual division hunting. Enter the age, and TOPAZ does the rest.

- **Auto-Assignment**: "Age 14" → "Teen Division" instantly.
- **Smart Feedback**: `✓ Age 14 → Teen Division (auto-selected)`
- **Manual Control**: Overrides available for special circumstances.
- **Oldest Member Logic**: For groups, division is calculated based on the oldest performer.

---

## 🔵 Ability Levels System

Ensuring a level playing field through three professional experience tiers:

| Level | Experience | Visual Indicator |
| :--- | :--- | :--- |
| **Beginning** | < 2 Years | 🔵 Blue Badge |
| **Intermediate** | 2-4 Years | 🟠 Orange Badge |
| **Advanced** | 5+ Years | 🟣 Purple Badge |

---

## 🥇 Medal Points Program

A prestigious cumulative system that tracks greatness across an entire season.

### 🏆 Achievement Milestones
- **🥉 Bronze**: 25 Points - The first competitive milestone.
- **🥈 Silver**: 35 Points - Recognition of consistent excellence.
- **🥇 Gold**: 50 Points - The pinnacle of competitive achievement.

**How it works**: Organizers award points to 1st place winners with a single click on the Results Page. Levels update automatically based on cumulative database history.

---

## 🔄 Competition Workflow

### 📅 Phase 1: Setup
1. **Initialize DB**: Ensure schema and migrations are active.
2. **Create Event**: Name your competition and set the date.
3. **Populate Entries**: Add dancers with photos, ages, and ability levels.

### 🎭 Phase 2: Live Scoring
1. **Configure Judges**: Set up 1-10 judges for the event, now with **custom judge names**.
2. **Score Interface**: Judges enter marks (0-25) across 4 criteria:
   - 🎯 Technique
   - ✨ Creativity
   - 🎭 Presentation
   - 👗 Appearance
3. **Instant Sync**: Totals (0-100) calculate and save in real-time. Judge names appear on all digital interfaces and printed reports.

### 🏆 Phase 3: The Finale
1. **Review Results**: Use advanced filters to view rankings.
2. **Award Medals**: Execute seasonal point distribution.
3. **Distribute**: Export Excel for the podium and PDF sheets for dancers.

---

## 📊 Results & Reports

### 🏆 Championship-Style Results
The Results Page features a high-impact design:
- **Rank Gradients**: Gold header for 1st, Silver for 2nd, Bronze for 3rd.
- **Judge Breakdown**: Side-by-side comparison of all judge scores.
- **Interactive Cards**: Expandable views for detailed category marks and judge notes.

### 📄 Professional Exporting
- **XLSX Export**: Data-rich spreadsheets for organizers.
- **PDF Score Sheets**: Beautiful, branded printouts for every performer, complete with heritage branding and category icons.

---

## 🔧 Technical Reference

### 📁 Architecture
```
topaz-scoring/
├── src/
│   ├── components/       # Premium UI Elements (Badges, Spinner, Layout)
│   ├── pages/            # Core Views (Setup, Scoring, Results)
│   ├── supabase/         # High-level API Abstractions
│   ├── utils/            # Document Engines (PDF/Excel)
│   └── App.jsx           # Master Routing
├── migrations/           # Version History Scripts
└── database-schema.sql   # The Source of Truth
```

### 📡 Key API Functions
```javascript
// entries.js
createEntry(compId, data)      // Create with ability/medal data
awardMedalPoints(compId, ids)  // Bulk point distribution

// scores.js
createScore(scoreData)         // Precision scoring with notes
getEntryScores(entryId)        // Multi-judge breakdown
```

---

## 📜 Appendix

### ⌨️ Pro Shortcuts
- **Tab**: Cycle through scoring fields.
- **Enter**: Save and next competitor.
- **Cmd+E**: Instant Excel export (Results Page).

### 🎨 Design System
- **Primary Teal**: `#14B8A6`
- **Primary Cyan**: `#06B6D4`
- **Gold Accent**: `#FBBF24`

### 🕰️ Version History
- **v2.0 (2026)**: Special categories, variety levels, age automation, medal points, premium redesign.
- **v1.0 (2024)**: Core scoring, Supabase integration, basic results.

---

<div align="center">
  **TOPAZ 2.0 • Heritage Since 1972**  
  *Crafted for the next generation of performers.*
  
  [Support & Docs](https://topaz2-0.vercel.app/) | [GitHub Repo](https://github.com/gabbyshey334-ux/topaz2.0)
</div>
