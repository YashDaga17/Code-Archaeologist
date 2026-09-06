# Code Archaeologist

## One-sentence summary

Code Archaeologist is a checkpoint-native developer intelligence dashboard that reconstructs intent, missing work, decisions, risks, and agent handoffs from Entire checkpoints, then verifies the findings against the actual codebase with Entire Graph.

## Problem, intended user and why it matters

AI-assisted development produces valuable context that normal Git history does not preserve: the original prompt, requirement changes, agent attempts, implicit assumptions, deferred tasks, and why a file was edited. When another developer or AI agent picks up the repository later, they can see what changed but not whether the change matches the original intent.

The intended users are developers, engineering leads, hackathon judges, and autonomous-agent teams who need to review AI-assisted work quickly without trusting a summary blindly. The application matters because it turns agent/session history into an evidence-backed handoff: what was requested, what was built, what still needs attention, and which claims are supported by code.

## Selected Entire track and why Entire is essential

Selected track: checkpoint-native developer workflow using Entire Checkpoints and Entire Graph as core product inputs.

Entire is essential because the product is not a generic repo summarizer. Its workflow starts with real Entire checkpoint and session data, including checkpoint IDs, session IDs, agents, models, files touched, and transcript/explanation context. That data is the source of truth for reconstructing intent and unfinished work.

Entire Graph is the second half of the proof loop. Databricks or the local fallback can infer requirements and risks, but those findings are not treated as facts until Entire Graph searches the codebase and returns matching symbols, files, line numbers, or impact data. Without Entire, Code Archaeologist would lose both the historical context and the deterministic verification layer that make the handoff trustworthy.

## Architecture and main workflow

The application is split into a Next.js frontend and an Express backend:

- `src/app/DashboardClient.js` and related frontend files provide the Mission Control dashboard, checkpoint explorer, pipeline view, graph evidence panel, and handoff display.
- `backend/index.js` exposes the API routes and orchestrates the pipeline.
- `backend/services/entireService.js` wraps `entire checkpoint`, `entire session`, and `entire graph` CLI commands.
- `backend/services/databricksService.js` performs Databricks AI Gateway or Model Serving calls when configured, normalizes findings, generates reports/handoffs, and falls back to deterministic local analysis when Databricks is unavailable.
- `backend/services/security.js` enforces repo path allowlisting, API access controls, redaction, raw checkpoint field stripping, sanitized errors, and Databricks host validation.
- `deploy/start.sh`, `app.yaml`, `databricks.yml`, and `DATABRICKS_APPS_DEPLOYMENT.md` support Databricks Apps deployment.

Main workflow:

1. User opens the dashboard and scans the current repository.
2. Backend loads real checkpoints with `entire checkpoint list --json` and session metadata with `entire session list --json`.
3. User selects a checkpoint.
4. Backend loads checkpoint metadata/explanation/transcript through Entire.
5. The checkpoint context is converted into a structured, privacy-filtered packet.
6. Databricks analyzes the packet when configured; otherwise the local fallback generates deterministic findings.
7. Entire Graph verifies extracted claims with graph search and impact analysis.
8. The app returns requirements, completed work, unfinished work, decisions, assumptions, risks, graph evidence, an intelligence report, and a machine-readable agent handoff JSON.

## Entire Graph findings and verification

Verified locally on 2026-09-06 with Entire enabled on branch `master` and Entire Graph `v0.4.0`.

Commands run:

```bash
entire status
entire checkpoint list --json
entire session list --json
entire graph version
entire graph search --repo . --profile full --query "Code Archaeologist backend analysis pipeline Entire checkpoint Databricks Entire Graph handoff"
entire graph search --repo . --profile full --query "privacy boundary raw prompts transcripts external Databricks model withheld"
entire graph search --repo . --profile full --query "Entire Graph verify claims graph search impact verification states"
entire graph impact --repo . --symbol verifyClaimsWithGraph
```

Findings:

- Entire status: repository is Entire-enabled on branch `master`; active agents include Codex, Gemini CLI, and Claude Code in local history.
- Local checkpoint discovery returned real checkpoint references. The checkpoint remote was unavailable during this verification, so this submission lists local Entire checkpoint IDs instead of claiming public checkpoint URLs.
- Graph found the synchronous analysis route at `backend/index.js:383` and the pipeline sequence at `backend/index.js:392` through `backend/index.js:413`: checkpoint extraction, Databricks analysis, Entire Graph verification, and handoff/report generation.
- Graph found async pipeline orchestration in `executePipelineAsync` at `backend/index.js:304`.
- Graph found checkpoint ingestion in `listCheckpoints` at `backend/services/entireService.js:273`.
- Graph found the Graph wrappers in `graphSearch` and `graphImpact` at `backend/services/entireService.js:507` and `backend/services/entireService.js:520`.
- Graph found 4-state verification in `verifyClaimsWithGraph` at `backend/services/entireService.js:595`; impact analysis reported 2 direct callers and 5 callees for that function.
- Graph found handoff generation in `generateHandoff` at `backend/services/databricksService.js:792`.
- Graph found privacy-boundary logic in `buildStructuredCheckpointContext` at `backend/services/databricksService.js:193` and the default withheld transcript envelope at `backend/services/databricksService.js:182`.
- Graph found client/output stripping of raw checkpoint fields in `stripRawCheckpointFields` at `backend/services/security.js:104`.
- Graph found Databricks host validation in `normalizeDatabricksHost` at `backend/services/security.js:282`.

Verification limitation: Entire Graph reported degraded semantic completeness for `src/app/DashboardClient.js` in this snapshot because of JavaScript parse diagnostics in that frontend file. Backend pipeline, privacy, Databricks, and graph-verification symbols were still resolved and verified.

## Noon Curveball: what changed and how we adapted

The adaptation was to harden the project for sensitive checkpoint data and Databricks credential safety while preserving the original Entire/Databricks/Graph workflow.

Changes made for the curveball:

- Raw prompts, raw transcripts, and raw checkpoint message fields are not sent to external model services by default.
- `CODE_ARCHAEOLOGIST_ALLOW_EXTERNAL_PROMPT_CONTEXT=true` is required before redacted prompt/transcript excerpts can be included in Databricks model input.
- API responses strip raw checkpoint fields and redact secrets before returning data to clients.
- Databricks host validation rejects embedded credentials, non-HTTPS hosts by default, and private/localhost targets unless explicitly allowed for development.
- Backend API access is loopback-first. Remote access requires a configured API token.
- Repository paths supplied through the API must resolve inside configured allowed roots.
- Local lakehouse-ready JSONL records are redacted and raw checkpoint fields are withheld before storage.

This kept the product architecture intact: Entire remains the source of checkpoint truth, Databricks remains the optional intelligence layer, Entire Graph still verifies claims locally, and privacy boundaries now apply before data leaves the backend.

## Checkpoint links and what each checkpoint proves

The local checkpoint remote could not be reached during verification, so these are local Entire references. After running the app, the corresponding API route is `/api/checkpoint/<checkpoint_id>`. From the CLI, use `entire checkpoint explain <checkpoint_id>` for the source checkpoint details.

| Checkpoint reference | Local/API access | What it proves |
|---|---|---|
| `4f3dd14c6189eb3bd69927ddd66151b45ca8187d` | `/api/checkpoint/4f3dd14c6189eb3bd69927ddd66151b45ca8187d` | Security review and hardening work for API access, privacy boundaries, Databricks credential handling, redaction, and tests. |
| `0a3f9b22a4ff2ecd2130de1907a6d2012397cbfd` | `/api/checkpoint/0a3f9b22a4ff2ecd2130de1907a6d2012397cbfd` | Carry-forward checkpoint preserving uncommitted session files during the final hardening flow. |
| `01M1TYKDCPXQQA4XY6Z35T176V` | `/api/checkpoint/01M1TYKDCPXQQA4XY6Z35T176V` | Databricks app deployment work and submission/runtime packaging. |
| `01M1TXZF4G0576AS9H8C135W19` | `/api/checkpoint/01M1TXZF4G0576AS9H8C135W19` | Databricks Apps hosting services and deployment configuration. |
| `01M1TKD2E97T4F5PHJKWZR70GQ` | `/api/checkpoint/01M1TKD2E97T4F5PHJKWZR70GQ` | Core documentation, Entire integration, Databricks integration, and verified architecture baseline. |

The repository also includes two clearly marked sample demo checkpoints, `cp-7f8a92-auth` and `cp-3e1b09-graph-ui`, for offline judging and UI demonstration. They are marked as demo data in the backend and should not be treated as real Entire proof.

## Setup, run and test instructions

Prerequisites:

- Node.js 18 or newer
- npm
- Entire CLI
- Entire Graph plugin
- Optional Databricks workspace with permission to query the selected AI Gateway or Model Serving endpoint

Local setup:

```bash
git clone https://github.com/YashDaga17/Code-Archaeologist.git
cd Code-Archaeologist
entire enable

npm install

cd backend
npm install
cp .env.example .env
```

Configure `backend/.env` as needed:

```env
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com/
DATABRICKS_TOKEN=
DATABRICKS_CLIENT_ID=
DATABRICKS_CLIENT_SECRET=
DATABRICKS_MODEL_ENDPOINT=system.ai.llama-4-maverick
BACKEND_PORT=3001
BACKEND_BIND_HOST=127.0.0.1
CODE_ARCHAEOLOGIST_API_TOKEN=
CODE_ARCHAEOLOGIST_ALLOW_EXTERNAL_PROMPT_CONTEXT=false
```

Run locally:

```bash
# Terminal 1
cd backend
npm start

# Terminal 2
cd ..
npm run dev
```

Open `http://localhost:3000`.

Databricks Apps local simulation:

```bash
DATABRICKS_APP_PORT=8000 BACKEND_PORT=3001 npm run start:databricks
```

Verification commands:

```bash
cd backend
npm test

cd ..
npm run build
npm run lint
node scripts/security-check.mjs
npm audit --json
cd backend
npm audit --json
```

Entire verification commands:

```bash
entire status
entire checkpoint list --json
entire session list --json
entire graph version
entire graph search --repo . --profile full --query "Entire Graph verify claims graph search impact verification states"
entire graph impact --repo . --symbol verifyClaimsWithGraph
```

## Databricks use, data sources and limitations (if applicable)

Databricks use:

- The backend supports Databricks AI Gateway chat completions for `system.ai.*` models and classic Model Serving invocations for custom endpoints.
- Default model endpoint is `system.ai.llama-4-maverick`; older docs also mention `databricks-meta-llama-3-3-70b-instruct` as a supported serving endpoint.
- Authentication supports a Databricks PAT through `DATABRICKS_TOKEN` or Databricks Apps service-principal OAuth through `DATABRICKS_CLIENT_ID`, `DATABRICKS_CLIENT_SECRET`, and `DATABRICKS_HOST`.
- The model is used to produce structured JSON findings: intent, requirements, completed work, partial work, unfinished work, decisions, assumptions, risks, relevant files, and recommended next steps.
- The local storage path `backend/data/lakehouse/checkpoints_delta.jsonl` acts as a lakehouse-ready audit log for checkpoint analysis records.

Data sources:

- Entire checkpoint list, checkpoint explanation, checkpoint transcript, session list, and current session metadata.
- Entire Graph local AST/code graph search and impact results.
- Repository files touched by checkpoints.
- Databricks model output when credentials and endpoint permissions are configured.
- Local fallback analysis when Databricks is unavailable.

Privacy and limitations:

- Raw prompts and raw transcripts are withheld from Databricks by default.
- Enabling `CODE_ARCHAEOLOGIST_ALLOW_EXTERNAL_PROMPT_CONTEXT=true` allows only redacted excerpts to be sent.
- The current local verification did not use live Databricks credentials, so live Databricks inference was verified by source review and configuration paths, not by a remote model call in this run.
- The JSONL lakehouse file is a local, lakehouse-ready audit format in this repository. Direct Unity Catalog Delta table writes require deployment-specific Databricks configuration and permissions.
- Databricks output is treated as analysis, not truth; Entire Graph verification remains required for implementation claims.

## Known limitations and next steps

- Public checkpoint links were not verified because the Entire checkpoint remote was unavailable during this run; local checkpoint IDs and commands are provided instead.
- `src/app/DashboardClient.js` produced Entire Graph parse diagnostics in this snapshot, reducing semantic completeness for that frontend file.
- Remote/multi-user deployments should configure `CODE_ARCHAEOLOGIST_API_TOKEN`, allowed origins, and allowed repo roots explicitly.
- The async job store is in memory; production multi-instance deployment should use a durable queue/store.
- No request rate limiter is currently implemented beyond JSON body size limits; production deployments should add gateway or backend rate limiting.
- Databricks retry/backoff for high-concurrency gateway throttling should be expanded.
- Unity Catalog Delta persistence is documented and deployment-ready but still requires workspace-specific permissions and wiring beyond the local JSONL audit file.
- Browser end-to-end tests would strengthen confidence in the full dashboard workflow.
- Future work: live checkpoint notifications, richer graph diff views, durable job history, and tighter UI handling for very large transcripts and checkpoint histories.
