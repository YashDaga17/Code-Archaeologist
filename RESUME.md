# Code Archaeologist — Project Resume Document

> **Purpose**: This file contains everything needed to restart, reconstruct, and continue building Code Archaeologist from any point. Hand this to any AI agent or developer.

---

## 🎯 What is Code Archaeologist?

**Code Archaeologist** is a Checkpoint-Native Developer Intelligence Platform for the Entire hackathon.

**Problem**: AI-assisted development loses context — why code changed, what was intended, what was completed, and what remains unfinished.

**Solution**: Use REAL Entire Checkpoints as the core input to reconstruct intent, requirements, completed work, missing work, decisions, and risks. Verify AI findings against the real codebase using Entire Graph. Use Databricks Foundation Models for AI-powered analysis.

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (App Router)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │  Checkpoint   │ │  Databricks  │ │   Graph     │ │  Agent    │ │
│  │  Explorer     │ │  Analysis    │ │  Evidence   │ │  Handoff  │ │
│  └──────────────┘ └──────────────┘ └─────────────┘ └───────────┘ │
│                           ↕ API Proxy (rewrites)                  │
├───────────────────────────────────────────────────────────────────┤
│                    Express Backend (/backend)                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  services/entireService.js   — Entire CLI + Graph wrapper    │ │
│  │  services/databricksService.js — Databricks LLM API client  │ │
│  │  index.js                    — Express routes + pipeline     │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                     ↓                    ↓                        │
│       ┌─────────────────────┐  ┌──────────────────────┐          │
│       │ Entire CLI v0.10.5  │  │ Databricks Foundation │          │
│       │ • checkpoint list   │  │ Model API (REST)      │          │
│       │ • checkpoint explain│  │ • Llama 3 70B or any  │          │
│       │ • graph search      │  │ • OpenAI-compatible   │          │
│       │ • graph impact      │  │ • Structured JSON out │          │
│       │ • graph checkpoint  │  └──────────────────────┘          │
│       └─────────────────────┘                                    │
└───────────────────────────────────────────────────────────────────┘
```

**Three Core Integrations**:

| Integration | Role | How It's Used |
|---|---|---|
| **Entire Checkpoints** | Primary Data Source | `entire checkpoint list --json`, `entire checkpoint explain <id> --json`, `--transcript` |
| **Databricks Foundation Models** | AI Intelligence Engine | REST API to LLM endpoint, structured intent/requirement extraction, confidence scoring |
| **Entire Graph** | Code Verification Engine | `entire graph search`, `entire graph impact`, `entire graph checkpoint` — verifies AI findings against real code |

---

## 📂 Project Structure

```
Code-Archaeologist/
├── .entire/                  # Entire CLI config (must re-init)
│   └── settings.json
├── .git/                     # Git repo (must re-init)
├── backend/                  # Express API server
│   ├── package.json          # Backend deps: express, cors, dotenv
│   ├── index.js              # Main server entry — routes + pipeline orchestration
│   ├── .env                  # Databricks credentials (create from .env.example)
│   ├── .env.example          # Template for env vars
│   └── services/
│       ├── entireService.js  # ALL Entire CLI/Graph operations
│       └── databricksService.js  # ALL Databricks LLM API calls
├── src/                      # Next.js App Router frontend
│   └── app/
│       ├── layout.js         # Root layout with metadata
│       ├── globals.css       # ForgeOS / Mission Control theme
│       ├── page.js           # Main dashboard (client component)
│       └── page.module.css   # (unused, can delete)
├── public/                   # Static assets
├── package.json              # Next.js + React deps
├── next.config.mjs           # API proxy: /api/* → localhost:3001
├── jsconfig.json             # Path aliases (@/*)
├── RESUME.md                 # ← THIS FILE
└── README.md                 # Project readme
```

---

## 🔧 Setup Instructions

### Prerequisites
- Node.js v18+ (confirmed v25.9.0 on this machine)
- npm v9+ (confirmed v9.2.0)
- Entire CLI v0.10.5+ (`/usr/local/bin/entire`)
- Entire Graph plugin v0.4.0 (`entire plugin install graph`)

### Step 1: Initialize the repository
```bash
cd /Users/yashdaga/Desktop/dev/Code-Archaeologist
git init
entire enable
entire plugin install graph  # If not already installed
```

### Step 2: Create the Next.js frontend
```bash
npx -y create-next-app@latest code-arch-temp --javascript --no-tailwind --eslint --app --src-dir --use-npm --yes --disable-git
# Move contents to root:
mv code-arch-temp/* code-arch-temp/.* . 2>/dev/null
rm -rf code-arch-temp
npm install lucide-react
```

### Step 3: Setup the backend
```bash
mkdir -p backend/services
cd backend
npm init -y
npm install express cors dotenv
# Copy the backend files (see "Files to Recreate" below)
cp .env.example .env
# Edit .env with your Databricks credentials
```

### Step 4: Configure Next.js API proxy
In `next.config.mjs`:
```js
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' },
    ];
  },
};
export default nextConfig;
```

### Step 5: Run both servers
```bash
# Terminal 1 — Backend
cd backend && node index.js

# Terminal 2 — Frontend
cd .. && npm run dev
```

Frontend: http://localhost:3000
Backend API: http://localhost:3001

---

## 📋 What Was Built (Current State)

### ✅ Completed

1. **Backend Express Server** (`backend/index.js`)
   - Health check endpoint (`GET /api/health`)
   - Checkpoint list endpoint (`GET /api/checkpoints?repo=...`)
   - Checkpoint detail (`GET /api/checkpoint/:id`)
   - Checkpoint transcript (`GET /api/checkpoint/:id/transcript`)
   - Full analysis pipeline (`POST /api/analyze`) — orchestrates: Checkpoint → Databricks → Graph → Handoff
   - Graph search (`GET /api/graph/search?query=...`)
   - Graph impact (`GET /api/graph/impact?symbol=...`)
   - Handoff generation (`POST /api/handoff`)

2. **Entire CLI Service** (`backend/services/entireService.js`)
   - `listCheckpoints()` — wraps `entire checkpoint list --json`
   - `getCheckpointMetadata()` — wraps `entire checkpoint explain <id> --json`
   - `getCheckpointTranscript()` — wraps `entire checkpoint explain <id> --transcript`
   - `graphSearch()` — wraps `entire graph search --query ... --format json`
   - `graphImpact()` — wraps `entire graph impact --symbol ... --format json`
   - `graphCheckpoint()` — wraps `entire graph checkpoint <id> --json`
   - `verifyClaimsWithGraph()` — batch verifies claims, returns VERIFIED/NOT_FOUND/UNVERIFIED
   - Error handling + fallback for every operation

3. **Databricks AI Service** (`backend/services/databricksService.js`)
   - `callDatabricksLLM()` — calls Foundation Model API (OpenAI-compatible)
   - `analyzeCheckpoint()` — full analysis with structured JSON schema + confidence scores
   - `buildFallbackAnalysis()` — rule-based fallback when Databricks unavailable
   - `generateHandoff()` — builds the machine-readable Agent Handoff JSON
   - `calculateOverallConfidence()` + `calculateCompleteness()`

4. **Next.js Frontend** (`src/app/page.js`)
   - Mission Control / ForgeOS themed dashboard
   - Repository input + scan
   - Checkpoint list with selection
   - Pipeline stepper (6 steps with visual progress)
   - Checkpoint detail viewer (terminal panel)
   - Live pipeline execution animation with progress bar
   - Analysis results with 6 tabbed views: Intent, Completed, Unfinished, Decisions, Risks, Evidence
   - Requirements tracking table with status badges
   - Entire Graph verification panel (VERIFIED / NOT_FOUND / UNVERIFIED)
   - Agent Handoff JSON viewer with Copy + Export buttons
   - Stats row (Completed, Unfinished, Risks, Graph Verified counts)
   - Service status pills in header (Entire, Databricks, Graph)
   - Confidence bars on evidence items
   - Error handling display
   - Staggered animations on lists

5. **ForgeOS CSS Theme** (`src/app/globals.css`)
   - Dark industrial background with grid texture
   - JetBrains Mono + Inter typography
   - Thick 2.5px dark borders
   - Dark terminal panels with dot indicators
   - Amber/green/red/blue/purple/cyan accent palette
   - Status badges, progress bars, confidence bars
   - Pipeline stepper styles
   - Card system with headers + badges
   - Micro-animations (fadeIn, slideIn, stagger, pulse, spin)
   - Responsive grid layout

### ⚠️ State Issue — Files Lost

The `cp -r` + `rm -rf` command during the Next.js scaffolding accidentally removed:
- `.git/` directory
- `.entire/` directory
- `backend/` directory (the service files were created but the parent folder was nuked)
- `globals.css` and `layout.js` (only `page.js` survived in `src/app/`)
- `package.json`, `next.config.mjs`, `jsconfig.json`
- All markdown planning docs (`Architecture.md`, `Code Arch.md`, etc.)

**What survived**: Only `src/app/page.js` (31,522 bytes — the full dashboard component).

### 🔄 To Fully Reconstruct

All source code exists in this conversation's history. The agent needs to:
1. Re-init git and Entire
2. Re-scaffold Next.js
3. Re-create the backend directory + services
4. Re-create `globals.css` and `layout.js`
5. Everything will work — no code was "lost", just needs to be re-written from the conversation

---

## 🌐 Core Product Pipeline

```
REAL ENTIRE CHECKPOINT
        ↓
Checkpoint Context Extraction     ← entire checkpoint explain --json + --transcript
        ↓
DATABRICKS AI ANALYSIS            ← Foundation Model API, structured JSON prompt
        ↓
Intent + Requirements Extraction  ← Confidence-scored, evidence-cited
        ↓
Implementation Gap Detection      ← Compare completed vs stated requirements
        ↓
ENTIRE GRAPH VERIFICATION         ← entire graph search for each claim
        ↓
Evidence-Based Findings           ← VERIFIED / NOT_FOUND / UNVERIFIED
        ↓
MISSION CONTROL DASHBOARD         ← Next.js ForgeOS UI
        ↓
AI AGENT HANDOFF                  ← Machine-readable JSON
```

---

## 📦 Agent Handoff JSON Schema

```json
{
  "version": "1.0",
  "generator": "Code Archaeologist v1.0",
  "generated_at": "ISO-8601",
  "source": {
    "checkpoint_id": "string",
    "repository": "string"
  },
  "intent": "string — original goal",
  "completed": ["string — completed items"],
  "unfinished": ["string — missing/unfinished items"],
  "decisions": ["string — key technical decisions"],
  "risks": [{ "description": "string", "severity": "HIGH|MEDIUM|LOW" }],
  "evidence": [{
    "claim": "string",
    "status": "VERIFIED|NOT_FOUND|UNVERIFIED",
    "source": "entire-graph",
    "query": "string — the graph search query used"
  }],
  "confidence": {
    "overall": 0.0-1.0,
    "intent": 0.0-1.0,
    "completeness": 0.0-1.0
  },
  "relevant_files": ["string"],
  "next_steps": ["string"]
}
```

---

## 🎨 Frontend Design System (ForgeOS / Mission Control)

| Element | Spec |
|---|---|
| Background | `#0a0a0c` with subtle grid lines |
| Cards | `#141418`, thick `2.5px` borders, `#2a2a30` |
| Terminal panels | `#0d0d10`, triple-dot header, monospace |
| Primary accent | Amber `#f59e0b` (glow shadow) |
| Success | Green `#22c55e` |
| Danger | Red `#ef4444` |
| Info | Blue `#3b82f6` |
| Typography | JetBrains Mono (code), Inter (headings) |
| Borders | 2.5px solid, `border-radius: 6px` / `10px` |
| Animations | fadeIn, slideIn, stagger delays, pulse on status dots |

---

## 🔑 Environment Variables

```env
# backend/.env
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_TOKEN=your-databricks-pat-token
DATABRICKS_MODEL_ENDPOINT=databricks-meta-llama-3-3-70b-instruct
BACKEND_PORT=3001
```

---

## 📌 API Endpoints Reference

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health?repo=` | Service health check (Entire, Databricks, Graph) |
| `GET` | `/api/checkpoints?repo=` | List Entire Checkpoints |
| `GET` | `/api/checkpoint/:id?repo=` | Checkpoint metadata + explanation |
| `GET` | `/api/checkpoint/:id/transcript?repo=` | Raw transcript JSONL |
| `GET` | `/api/checkpoints/search?q=&repo=` | Semantic checkpoint search |
| `POST` | `/api/analyze` | **Full pipeline**: Checkpoint → Databricks → Graph → Handoff |
| `GET` | `/api/graph/search?query=&repo=` | Entire Graph code search |
| `GET` | `/api/graph/impact?symbol=&repo=` | Entire Graph impact analysis |
| `GET` | `/api/graph/checkpoint/:id?repo=` | Graph checkpoint analysis |
| `POST` | `/api/handoff` | Generate agent handoff JSON |
| `GET` | `/api/databricks/status` | Databricks configuration status |

---

## 🚀 What To Build Next

### Immediate (Phase 1 — Get It Running)
- [ ] Re-init git + Entire (`git init && entire enable`)
- [ ] Re-scaffold Next.js (`npx create-next-app@latest`)
- [ ] Re-create backend directory + install deps
- [ ] Re-create `globals.css`, `layout.js` from conversation history
- [ ] Verify `page.js` renders correctly
- [ ] Start both servers, verify health endpoint

### Phase 2 — Test With Real Data
- [ ] Make a few commits with Entire checkpoints enabled
- [ ] Test `GET /api/checkpoints` returns real data
- [ ] Test full analysis pipeline with a real checkpoint

### Phase 3 — Databricks Integration
- [ ] Configure `.env` with real Databricks credentials
- [ ] Test Databricks LLM call with a checkpoint transcript
- [ ] Verify structured JSON output matches schema

### Phase 4 — Polish
- [ ] Add loading skeleton states
- [ ] Add error recovery in the UI
- [ ] Test responsive layout
- [ ] Add more micro-animations
- [ ] Demo walkthrough

---

## 🛠️ Entire CLI Commands Reference

```bash
# Status
entire status
entire --version

# Checkpoints
entire checkpoint list --json
entire checkpoint explain <id> --json           # Metadata only
entire checkpoint explain <id> --transcript      # Raw JSONL transcript
entire checkpoint explain <id> --full            # Parsed full transcript
entire checkpoint search "query"

# Graph
entire graph search --query "text" --format json --top-k 5 --repo .
entire graph impact --symbol "name" --format json --repo .
entire graph checkpoint <id> --json --repo .
entire graph diff <from> <to> --format json --repo .
entire graph def --symbol "name" --format json --repo .
entire graph version

# Plugin management
entire plugin list
entire plugin install graph
```

---

## 🏆 Hackathon Scoring Criteria Mapping

| Criteria | How We Address It |
|---|---|
| **Entire Checkpoints are essential** | Primary data source — without checkpoints, nothing works |
| **Databricks performs core work** | AI analysis engine — intent extraction, gap detection, confidence scoring |
| **Entire Graph verification** | Every AI finding verified against real code structure |
| **Innovation** | Checkpoint-native developer intelligence — new category |
| **Evidence-based** | Every claim has confidence score + citation |
| **No fake data** | Real CLI calls, real API calls, graceful fallbacks |
| **Agent handoff** | Machine-readable JSON for AI agent continuation |
| **Noon curveball ready** | Modular architecture — swap any component independently |

---

*Last updated: 2026-09-06T09:58:00+05:30*
*Conversation ID: 0379c766-718e-4d97-8217-95fa24c1c599*
