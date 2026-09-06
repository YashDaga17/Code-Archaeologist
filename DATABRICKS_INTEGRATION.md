# 🧱 Databricks Intelligence Layer Deep-Dive Guide

> **Code Archaeologist** leverages **Databricks Foundation Model APIs** (specifically `databricks-meta-llama-3-3-70b-instruct`) as its core intelligence and analysis engine. This document details how Databricks powers intent reconstruction, requirement extraction, assumption detection, and risk scoring.

---

## 1. Architectural Role of Databricks

While Entire provides raw development context and Entire Graph provides deterministic codebase structure, **Databricks is the intelligence layer** that reasons over the relationship between what was promised and what was built.

```
                      ENTIRE CHECKPOINT CONTEXT
                      (Transcripts, Prompts, Diffs)
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABRICKS MODEL SERVING API                     │
│                                                                     │
│   Endpoint: /serving-endpoints/databricks-meta-llama-3-3-70b-instruct│
│   Model:    Meta Llama 3.3 70B Instruct                             │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ 1. Intent Reconstruction (Natural Language Understanding)   │   │
│   │ 2. Requirement Parsing (Identification & Decomposition)     │   │
│   │ 3. Implementation Gap Detection (Promised vs. Delivered)    │   │
│   │ 4. Assumption & Decision Extraction (Engineering Rationale) │   │
│   │ 5. Risk Radar Prioritization (High / Medium / Low Severity) │   │
│   │ 6. Confidence Scoring (Quantitative Uncertainty 0.0 - 1.0)  │   │
│   └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ Structured JSON Findings
                                   ▼
                      ENTIRE GRAPH CODE VERIFICATION
```

---

## 2. Model Serving Configuration

The backend connects to Databricks via standard OpenAI-compatible REST invocations against the Databricks Model Serving endpoint:

```env
# backend/.env
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com/
DATABRICKS_TOKEN=dapi********************************
DATABRICKS_MODEL_ENDPOINT=databricks-meta-llama-3-3-70b-instruct
```

### Live Endpoint Invocation
Requests are dispatched to:
```
POST {DATABRICKS_HOST}/serving-endpoints/{DATABRICKS_MODEL_ENDPOINT}/invocations
Authorization: Bearer {DATABRICKS_TOKEN}
Content-Type: application/json
```
**Request Payload:**
```json
{
  "messages": [
    { "role": "system", "content": "<SYSTEM_ANALYSIS_PROMPT>" },
    { "role": "user", "content": "<CHECKPOINT_METADATA_AND_TRANSCRIPT>" }
  ],
  "max_tokens": 4096,
  "temperature": 0.0
}
```

*Temperature is fixed at `0.0` to ensure maximum analytical determinism and reproducible findings.*

---

## 3. Structured Analysis Prompt & Schema

The Databricks Foundation Model is instructed via a strict system prompt to emit **only valid JSON** conforming to Code Archaeologist's intelligence schema:

```json
{
  "original_intent": "Original high-level goal of development session",
  "intent": "Summarized objective",
  "requirements": [
    {
      "id": "REQ-1",
      "description": "Concrete requirement description",
      "status": "COMPLETED | PARTIAL | MISSING | UNVERIFIED",
      "confidence": 0.95,
      "evidence": "Citation from transcript or files touched"
    }
  ],
  "completed_work": [
    { "description": "file or module", "evidence": "text", "confidence": 0.98 }
  ],
  "partial_work": [
    { "description": "feature", "missing_aspects": "details", "confidence": 0.85 }
  ],
  "unfinished_work": [
    { "description": "deferred requirement", "evidence": "prompt omission", "priority": "HIGH", "confidence": 0.92 }
  ],
  "important_decisions": [
    { "description": "architectural decision", "rationale": "why chosen", "relevant_files": ["..."], "impact": "scope", "confidence": 0.95 }
  ],
  "assumptions": [
    { "description": "unvalidated assumption", "source": "turn X", "risk_level": "HIGH", "confidence": 0.88, "verification_status": "CONTRADICTED" }
  ],
  "risks": [
    { "description": "technical debt or security risk", "severity": "HIGH", "evidence": "text", "confidence": 0.90 }
  ],
  "relevant_files": ["src/app/page.js", "backend/index.js"],
  "recommended_next_steps": [
    { "description": "actionable task", "priority": "HIGH" }
  ]
}
```

---

## 4. Quantitative Confidence Scoring

Every finding produced by the Databricks analysis layer includes a quantitative confidence score ($0.0 - 1.0$) grounded in verifiable context:

| Confidence Range | Meaning | Criteria |
|---|---|---|
| **0.90 - 1.00** | **Explicitly Grounded** | Directly stated in transcript prompts or confirmed by files touched in git metadata. |
| **0.70 - 0.89** | **Strongly Implied** | Inferred from development context and intermediate agent tool executions. |
| **0.50 - 0.69** | **Pattern-Inferred** | Deduced from file naming conventions or architectural dependencies. |
| **Below 0.50** | **Speculative** | Hypothesis with insufficient context; explicitly flagged as speculative. |

---

## 5. Intelligent Fallback Architecture

To guarantee 100% operational uptime during hackathon judging and network interruptions, Code Archaeologist includes a **Deterministic Fallback Engine** in `backend/services/databricksService.js`:

```
                    CHECKPOINT ANALYSIS REQUEST
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
       Databricks Configured?         Databricks Offline /
                 │                    Token Not Set
                 ▼                             │
    Call Foundation Model API                  │
                 │                             │
        ┌────────┴────────┐                    │
        ▼                 ▼                    ▼
     Success            Error       Execute Local Fallback Engine
        │                 │                    │
        │                 └─────────┬──────────┘
        ▼                           ▼
  Emit Databricks Intelligence  Emit Rule-Based Intelligence
  (source: "databricks")        (source: "local-fallback")
```

When offline, the fallback engine:
1. Parses git diffs and `files_touched` to extract baseline completed requirements.
2. Identifies missing test files or omitted components via heuristic pattern matching.
3. Formulates transparent fallback findings labeled `source: "local-fallback"` with reasons provided in the Live Analysis Trace.

---

## 6. Enterprise Lakehouse Scalability

In production enterprise deployments, Code Archaeologist scales across thousands of developers and autonomous agents by integrating into the **Databricks Lakehouse Platform**:

- **Delta Lake**: Ingests streaming checkpoints and transcripts into high-performance ACID Delta tables (`dev_intelligence.checkpoints`, `dev_intelligence.transcripts`).
- **Unity Catalog**: Manages access control, audit logs, and data governance over proprietary development context and agent transcripts.
- **MLflow**: Tracks prompt engineering versions, LLM evaluation metrics, and latency across foundation model serving endpoints.

---

## 7. Hosting on Databricks Apps

Code Archaeologist is fully packaged and ready to run natively on **Databricks Apps** using the included manifests:
- `app.yaml`: Root app configuration for Databricks Apps serverless runtime.
- `databricks.yml`: Databricks Asset Bundle (DAB) declaration.
- `deploy/start.sh`: Unified process orchestrator (Next.js + Express backend).
- `deploy/deploy.sh`: One-command automated CLI deployment script.

👉 **Complete deployment guide**: Refer to [DATABRICKS_APPS_DEPLOYMENT.md](DATABRICKS_APPS_DEPLOYMENT.md) for step-by-step UI and CLI instructions.
