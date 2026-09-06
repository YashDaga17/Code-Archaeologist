<div align="center">

```
  ██████╗ ██████╗ ██████╗ ███████╗     █████╗ ██████╗  ██████╗██╗  ██╗ █████╗ ███████╗ ██████╗ ██╗      ██████╗  ██████╗ ██╗███████╗████████╗
 ██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔══██╗██╔══██╗██╔════╝██║  ██║██╔══██╗██╔════╝██╔═══██╗██║     ██╔═══██╗██╔════╝ ██║██╔════╝╚══██╔══╝
 ██║     ██║   ██║██║  ██║█████╗      ███████║██████╔╝██║     ███████║███████║█████╗  ██║   ██║██║     ██║   ██║██║  ███╗██║███████╗   ██║   
 ██║     ██║   ██║██║  ██║██╔══╝      ██╔══██║██╔══██╗██║     ██╔══██║██╔══██║██╔══╝  ██║   ██║██║     ██║   ██║██║   ██║██║╚════██║   ██║   
 ╚██████╗╚██████╔╝██████╔╝███████╗    ██║  ██║██║  ██║╚██████╗██║  ██║██║  ██║███████╗╚██████╔╝███████╗╚██████╔╝╚██████╔╝██║███████║   ██║   
  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝╚══════╝   ╚═╝   
```

### **Checkpoint-Native Developer Intelligence Command Center**
*Reconstruct Intent · Detect Missing Requirements · Verify Codebase Reality · Generate AI Agent Handoffs*

[![Entire CLI](https://img.shields.io/badge/Entire_CLI-v0.10.5-00e5ff?style=for-the-badge&logo=terminal)](https://entire.io)
[![Entire Graph](https://img.shields.io/badge/Entire_Graph-v0.4.0-00ff88?style=for-the-badge&logo=git)](https://entire.io)
[![Databricks](https://img.shields.io/badge/Databricks-Llama_4_Maverick-FF3621?style=for-the-badge&logo=databricks)](https://databricks.com)
[![Databricks Apps](https://img.shields.io/badge/Databricks_Apps-Ready-FF3621?style=for-the-badge&logo=databricks)](DATABRICKS_APPS_DEPLOYMENT.md)
[![Next.js](https://img.shields.io/badge/Next.js-v16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-amber?style=for-the-badge)](LICENSE)

---

</div>

## 📌 Executive Summary

Modern software engineering is increasingly driven by autonomous AI coding agents (Claude Code, Gemini CLI, Codex, Antigravity). While version control systems record **what** code changed in a repository, they discard **why** it changed, **what requirements** were agreed upon, **what technical decisions and assumptions** were made, and **what unfinished work remains**.

**Code Archaeologist** solves this critical context-loss problem. Built natively around **Entire Checkpoints**, **Databricks Foundation Models**, and **Entire Graph**, Code Archaeologist analyzes development sessions to:

1. 🎯 **Reconstruct Original Intent**: Extract developer prompts, requirements, and turns.
2. 🔍 **Identify Implementation Gaps**: Detect requirements discussed in context but omitted from code.
3. 🔬 **Verify Against Codebase Reality**: Ground every AI claim in deterministic **Entire Graph** symbols, lines, and impact graphs.
4. ⚡ **Detect Unvalidated Assumptions**: Flag unverified technical assumptions before they cause production regressions.
5. 🤝 **Generate Machine-Readable Agent Handoffs**: Produce structured JSON handoffs allowing any developer or subsequent AI agent to resume work with 100% historical fidelity.

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               NEXT.JS MISSION CONTROL                                  │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────────────┐ │
│ │  Checkpoint Explorer │ │  Entire Sessions     │ │  Development Timeline            │ │
│ │  (Real vs Demo tags) │ │  (Agent/Model/Turns) │ │  (Chronological evolution)       │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────────────────┘ │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────────────┐ │
│ │  Intent Matrix       │ │  Unfinished Detector │ │  Decision & Assumption Radar     │ │
│ │  (Confidence scored) │ │  (Gap analysis)      │ │  (4-state verification)          │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────┐ ┌──────────────────────────────────┐ │
│ │  Entire Graph Evidence Panel (Line Citations) │ │  Section 6 Agent Handoff JSON    │ │
│ └───────────────────────────────────────────────┘ └──────────────────────────────────┘ │
│                                  ↕ API Proxy /api/*                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                          EXPRESS ORCHESTRATION BACKEND (3001)                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  services/entireService.js       — Checkpoint, Session, & Graph CLI Integration  │  │
│  │  services/databricksService.js   — Databricks Foundation Model REST Client       │  │
│  │  index.js                        — Synchronous & Asynchronous Pipeline Router    │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                    ↓                                            ↓                      │
│   ┌────────────────────────────────┐           ┌─────────────────────────────────────┐ │
│   │       ENTIRE PLATFORM          │           │       DATABRICKS LAKEHOUSE          │ │
│   │  • entire checkpoint list      │           │  • Serving Endpoint (REST)          │ │
│   │  • entire checkpoint explain   │           │  • Meta Llama 3.3 70B Instruct      │ │
│   │  • entire session list/current │           │  • Structured JSON Synthesis        │ │
│   │  • entire graph search         │           │  • Intent & Requirement Extraction  │ │
│   │  • entire graph impact/def     │           │  • Assumption & Risk Classification │ │
│   └────────────────────────────────┘           └─────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ The Three Core Integrations

| Technology | Architectural Role | Concrete Implementation |
|---|---|---|
| **Entire Checkpoints** | **Primary Context Ingestion** | Reads session transcripts, agent prompts, model metadata, files touched, and turn logs via `entire checkpoint list --json` and `entire session list --json`. |
| **Databricks AI** | **Intelligence & Synthesis Engine** | High-throughput REST invocations to `databricks-meta-llama-3-3-70b-instruct`, performing structured intent extraction, confidence scoring, and gap detection. |
| **Entire Graph** | **Deterministic Verification Layer** | Queries local AST code graph using `entire graph search` and `entire graph impact` to verify or contradict claims with exact file paths, line numbers, and caller/callee relations. |

> 📚 **Deep Dive Documentation**:
> - [Entire Platform Integration Guide](ENTIRE_INTEGRATION.md)
> - [Databricks Foundation Model Integration Guide](DATABRICKS_INTEGRATION.md)

---

## 🌟 Key Platform Capabilities

### 1. Mission Control Dashboard (Product Spec §5.1)
High-density industrial HUD displaying real-time metrics:
- Repository name & active branch
- Total checkpoints on branch & tracked agent sessions
- Requirements breakdown: `Completed` (Green) / `Partial` (Amber) / `Missing` (Red)
- Entire Graph verification ratio (`Verified` / `Total Claims`)
- Active risks count and service statuses (`Entire CLI`, `Entire Graph`, `Databricks`)

### 2. Checkpoint & Session Explorer (§4.1, §4.2, §5.2)
Browse and filter real Entire checkpoints and developer sessions:
- Displays Checkpoint ID, Session ID, Agent (e.g., `Gemini CLI`, `Claude Code`), Model (`gemini-3-flash-preview`, `claude-3-7-sonnet`), turns count, and files touched.
- Distinguishes **`REAL ENTIRE`** checkpoints from **`SAMPLE DEMO`** fixtures with color-coded badges.

### 3. Intent vs. Implementation Matrix (§5.4)
Side-by-side comparison of promised requirements against observed codebase changes:
- Evaluates requirement status: `COMPLETED`, `PARTIAL`, `MISSING`, or `UNVERIFIED`.
- Displays visual confidence score bars ($0\% - 100\%$).
- Cites exact code files and line numbers verified by Entire Graph.

### 4. Unfinished Requirement Detector (§5.5)
Automatically flags requirements that were discussed or planned in developer sessions but omitted from implementation:
- Displays priority severity (`HIGH`, `MEDIUM`, `LOW`).
- Provides reasoning explaining why the requirement was deemed incomplete.

### 5. Decision & Assumption Tracker (§5.6, §5.7)
- **Decision Tracker**: Surfaces architectural trade-offs made during agent execution with rationale, affected files, and impact.
- **Assumption Detector**: Identifies implicit, unvalidated assumptions made by agents or developers, mapped to 4 verification states.

### 6. 4-State Entire Graph Verification (§4.4, §5.9)
Grounds every claim in actual codebase structure with 4 verification states:
- <span style="color:#22c55e">**VERIFIED**</span>: Confirmed present in code with high match score, file path, and start line.
- <span style="color:#f59e0b">**PARTIALLY_VERIFIED**</span>: Indirect reference or partial match in related components.
- <span style="color:#94a3b8">**UNVERIFIED**</span>: Inconclusive codebase evidence.
- <span style="color:#ef4444">**CONTRADICTED**</span>: Explicitly absent or contradicts claimed implementation.
- Evaluates component callers and callees via `entire graph impact`.

### 7. Development Timeline (§5.3)
Interactive visual chronological timeline tracing the evolution of the repository across checkpoints, agent turns, and prompt iterations.

### 8. Machine-Readable Agent Handoff (§6)
Exports standardized JSON handoffs formatted strictly to the Product Specification:
```json
{
  "project": "Code Archaeologist",
  "checkpoint_id": "476c9c39e7d3e758c13515c923bc26cc24d0ab00",
  "original_intent": "Build Code Archaeologist",
  "completed_work": [
    "README.md",
    "src/components/layout/Header.js",
    "src/components/layout/PipelineBar.js"
  ],
  "unfinished_work": [
    "Comprehensive integration test suite covering edge cases",
    "Theme switcher toggle in navigation bar"
  ],
  "important_decisions": [
    "Targeted modifications across 4 component(s)"
  ],
  "assumptions": [
    "Assumed modified files satisfy runtime dependencies without additional packages"
  ],
  "risks": [
    "Absence of dedicated unit/e2e test files leaves regressions unverified [Severity: HIGH]"
  ],
  "relevant_files": [
    "README.md",
    "src/components/layout/Header.js"
  ],
  "verified_evidence": [
    {
      "claim": "README.md",
      "status": "VERIFIED",
      "source": "entire-graph",
      "query": "README.md",
      "matches": [
        { "file": "README.md", "line": 1, "score": 28.5 }
      ]
    }
  ],
  "recommended_next_steps": [
    "Write unit tests for recently modified files",
    "Verify call graph relationships using Entire Graph impact analysis"
  ]
}
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (tested on Node v25.9)
- **Entire CLI**: v0.10.5+ installed (`brew install entireio/tap/entire` or binary)
- **Entire Graph Plugin**: `entire plugin install graph`
- **Databricks Account**: Workspace URL and Personal Access Token (optional; system includes automatic deterministic fallback engine)

### 1. Clone & Initialize
```bash
git clone https://github.com/YashDaga17/Code-Archaeologist.git
cd Code-Archaeologist

# Enable Entire in repository
entire enable
```

### 2. Configure Backend Environment
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env`:
```env
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com/
DATABRICKS_TOKEN=dapi_your_token_here
DATABRICKS_MODEL_ENDPOINT=databricks-meta-llama-3-3-70b-instruct
BACKEND_PORT=3001
```

### 3. Install Dependencies & Launch
```bash
# Terminal 1 — Start Express Backend
cd backend
npm install
node index.js

# Terminal 2 — Start Next.js Frontend
cd ..
npm install
npm run dev
```

Visit **http://localhost:3000** to access the Mission Control Command Center.
Or run both in Databricks Apps container mode locally:
```bash
npm run start:databricks
```

---

## 🚀 Hosting on Databricks Apps

Code Archaeologist is fully packaged for production hosting on **Databricks Apps**:

### Option A: 2-Click Web Deployment (No CLI Required)
1. In your Databricks Workspace, import this repository into **Workspace > Git Folders**.
2. Navigate to **Compute > Apps** and click **Create App**.
3. Select your Git folder, set environment variables (`DATABRICKS_MODEL_ENDPOINT=system.ai.llama-4-maverick`), and click **Deploy**!

### Option B: Automated CLI Deployment
```bash
# Automated CLI deployment with DABs
npm run deploy:databricks
```

👉 **Complete Step-by-Step Guide**: Read [DATABRICKS_APPS_DEPLOYMENT.md](DATABRICKS_APPS_DEPLOYMENT.md) for full instructions on Service Principal permissions, secret scopes, and Unity Catalog Delta table auditing.

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health?repo=` | Returns health status, repository name, branch, and service states |
| `GET` | `/api/checkpoints?repo=` | Returns real Entire checkpoints merged with session metadata |
| `GET` | `/api/checkpoint/:id?repo=` | Returns checkpoint metadata and explanation |
| `GET` | `/api/checkpoint/:id/transcript` | Returns raw session transcript JSONL / text |
| `GET` | `/api/sessions?repo=` | Returns tracked Entire sessions (`entire session list --json`) |
| `GET` | `/api/session/current?repo=` | Returns current active development session |
| `GET` | `/api/timeline?repo=` | Returns chronological timeline of checkpoints & sessions |
| `POST` | `/api/analyze` | Executes synchronous pipeline: Checkpoint → Databricks → Graph → Handoff |
| `POST` | `/api/jobs/analyze` | Queues asynchronous analysis job returning `{ jobId }` |
| `GET` | `/api/jobs/:id` | Polls asynchronous job status, progress, and live trace logs |
| `GET` | `/api/graph/search?query=` | Executes deterministic code search via Entire Graph |
| `GET` | `/api/graph/impact?symbol=` | Queries callers, callees, and dependencies via Entire Graph |
| `POST` | `/api/handoff` | Generates standardized Section 6 agent handoff JSON |

---

## 🧪 Verification & Testing

Verify system integrity with automated commands:
```bash
# 1. Test Syntax of Backend
node -c backend/index.js && node -c backend/services/entireService.js && node -c backend/services/databricksService.js

# 2. Test Production Build of Next.js
npm run build

# 3. Test Entire CLI Status & Graph
entire status
entire graph version

# 4. Test Databricks Foundation Model Live Endpoint
curl -s http://localhost:3001/api/health | jq .services.databricks
```

---

## 🏆 Hackathon Alignment

- ✅ **Entire Checkpoints are an essential input**: Rather than treating checkpoints as static logs, Code Archaeologist uses checkpoint context as the foundation for intent reconstruction and requirement extraction.
- ✅ **Databricks performs core intelligence**: Databricks Foundation Models (Llama 3.3 70B) power structured JSON synthesis, assumption extraction, and risk radar prioritization.
- ✅ **Entire Graph grounds AI findings**: Every claim is verified against codebase reality to prevent LLM hallucinations.
- ✅ **No fake data**: Seamlessly parses real Entire CLI sessions, real checkpoints, and live Databricks endpoints with transparent provenance badges.

---

<div align="center">
  <sub>Built with precision for the Entire Hackathon · Designed with ForgeOS Industrial Aesthetics</sub>
</div>
