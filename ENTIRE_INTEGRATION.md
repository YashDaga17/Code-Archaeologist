# 🌐 Entire Platform Deep-Dive Integration Guide

> **Code Archaeologist** utilizes the **Entire CLI (v0.10.5)** and **Entire Graph (v0.4.0)** as its primary source of development history and code verification truth. This document details how Entire's checkpoint architecture, session tracking, and deterministic graph indexing are integrated into the platform.

---

## 1. Architectural Role of Entire

In AI-assisted software development, standard Git commits only store the final snapshot of code. They do not capture:
- The human developer's original prompt and conversational iterations.
- The AI agent's internal reasoning, chain-of-thought, and tool usage.
- What requirements were stated vs. what was postponed.
- What assumptions guided the implementation.

**Entire** captures these dimensions natively by creating **Checkpoints** tied to Git refs and session worktrees. Code Archaeologist ingests this rich context to reconstruct the complete development narrative.

```
┌─────────────────────────────────────────────────────────────┐
│                       ENTIRE PLATFORM                       │
│                                                             │
│   ┌───────────────────────────┐ ┌─────────────────────────┐ │
│   │     Entire Checkpoints    │ │      Entire Graph       │ │
│   │     & Developer Sessions  │ │   (Semantic Code AST)   │ │
│   └─────────────┬─────────────┘ └────────────┬────────────┘ │
└─────────────────┼────────────────────────────┼──────────────┘
                  │ Context Extraction         │ Deterministic Proof
                  ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 CODE ARCHAEOLOGIST ENGINE                   │
│                                                             │
│   • Intent & Requirement Parser                              │
│   • Implementation Gap Detector                             │
│   • 4-State Code Verification Engine                        │
│   • Machine-Readable Agent Handoff Generator                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Checkpoint & Session Ingestion

### Checkpoint Discovery (`entire checkpoint list --json`)
Code Archaeologist queries available checkpoints on the active branch:
```bash
entire checkpoint list --json
```
**JSON Payload Structure:**
```json
[
  {
    "checkpoint_id": "476c9c39e7d3e758c13515c923bc26cc24d0ab00",
    "session_id": "39044f9e-e915-455e-81b5-65a979c90c69",
    "date": "2026-09-06T10:30:41+05:30",
    "message": "We are building Code Archaeologist. Inspect the existing repository..."
  }
]
```

### Session Context Extraction (`entire session list --json`)
To obtain deep metadata regarding the agent and development environment:
```bash
entire session list --json
```
**JSON Payload Structure:**
```json
[
  {
    "session_id": "39044f9e-e915-455e-81b5-65a979c90c69",
    "agent": "Gemini CLI",
    "model": "gemini-3-flash-preview",
    "status": "ended",
    "branch": "master",
    "worktree_path": "/Users/yashdaga/Desktop/dev/Code-Archaeologist",
    "turns": 3,
    "checkpoints": 3,
    "last_prompt": "We are building Code Archaeologist. Inspect the existing repository...",
    "files_touched": [
      "README.md",
      "src/components/layout/Header.js",
      "src/components/layout/PipelineBar.js"
    ]
  }
]
```

### Checkpoint Explanation & Transcripts
The system reads contextual transcripts using:
```bash
entire checkpoint explain <checkpoint-id>
entire checkpoint explain <checkpoint-id> --transcript
```
This reveals the exact dialogue, tool executions, and file edits made during that checkpoint window.

---

## 3. Entire Graph Verification Engine

AI models are prone to hallucinating whether a feature was implemented or where a function is defined. **Entire Graph** provides 100% deterministic code grounding.

Entire Graph operates locally by constructing an Abstract Syntax Tree (AST) knowledge graph of all symbols, types, files, and call-graph relationships.

### Graph Code Search
When the intelligence engine extracts a claim (e.g. *"Implemented Express rate limiter"*), Code Archaeologist searches the graph:
```bash
entire graph search --query "rate limiter" --format json --top-k 3 --repo .
```
**Output Returned by Entire Graph:**
```json
{
  "results": [
    {
      "rank": 1,
      "score": 34.3,
      "file_path": "backend/services/entireService.js",
      "start_line": 41,
      "code_snippet": "..."
    }
  ],
  "stats": {
    "candidates_selected": 3,
    "files_scanned": 32
  }
}
```

### Impact & Call-Graph Analysis
To verify dependencies and component connections:
```bash
entire graph impact --symbol "Dashboard" --format json --repo .
```
**Returned Impact Graph:**
- Identifies the definition in `src/app/page.js:30-508`
- Maps callees: `useEffect`, `useState`, `fetchHealth`
- Maps sibling functions: `loadCheckpoints`, `selectCheckpoint`, `runAnalysis`, `copyHandoff`

---

## 4. The 4-State Verification System

Code Archaeologist evaluates every requirement, completed task, assumption, and unfinished item through a rigorous 4-state verification matrix:

| State | Badge | Criteria | Codebase Action |
|---|---|---|---|
| **VERIFIED** | `VERIFIED` (Green) | Symbol or file confirmed present with high match score ($\ge 15.0$) and valid line number. | Cites file path, start line, and relevance score in handoff. |
| **PARTIALLY_VERIFIED** | `PARTIALLY_VERIFIED` (Amber) | Partial or indirect references detected ($< 15.0$), or component exists without associated unit tests. | Flags partial implementation in matrix with warning. |
| **UNVERIFIED** | `UNVERIFIED` (Grey) | Inconclusive codebase evidence or ambiguous search term. | Marked as requiring human code review. |
| **CONTRADICTED** | `CONTRADICTED` (Red) | Claimed feature, module, or assumption is completely missing from code graph ($0$ matches). | Flags gap in Unfinished Work detector and Risk Radar. |

---

## 5. Provenance & Transparency Principles

1. **No Synthetic Checkpoints**: Real Entire Checkpoints are queried directly from the local `.entire` database and Git trailers.
2. **Visual Real vs. Demo Distinction**: Checkpoints and sessions display clear badges:
   - `REAL ENTIRE`: Ingested live from `entire checkpoint list`.
   - `SAMPLE DEMO`: Curated demo fixtures for testing offline scenarios.
3. **Traceability**: Every item in the generated Agent Handoff JSON includes the source checkpoint ID, repository path, and graph query used to verify it.
