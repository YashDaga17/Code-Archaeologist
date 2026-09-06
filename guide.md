# Code Archaeologist Databricks Apps Hosting Guide

## Immediate diagnosis

The deployment logs show:

```text
App built successfully
Backend API is healthy and operational
Launching Next.js Production Server on 0.0.0.0:8000
deploy/start.sh: line 94: npx: command not found
app exited unexpectedly
```

That means the build is fine and the backend is fine. The crash happens during frontend startup because the Databricks Apps runtime is running an older `deploy/start.sh` that still calls `npx`.

The fixed startup script does not call `npx`. It starts Next.js through the project-local binary:

```bash
./node_modules/.bin/next start -p "$DATABRICKS_APP_PORT" -H 0.0.0.0
```

with a fallback to:

```bash
node ./node_modules/next/dist/bin/next start -p "$DATABRICKS_APP_PORT" -H 0.0.0.0
```

What you are missing is a source refresh step: Databricks Apps is still deploying a stale copy of `master` or an older Databricks Git Folder revision.

## Required source version

From the local repository, verify the fixed startup script:

```bash
git checkout master
git pull --ff-only origin master
rg -n "npx" deploy/start.sh
```

Expected result:

```text
# no output
```

Also verify the script contains the startup marker:

```bash
rg -n "Startup script revision|run_next|Next.js CLI" deploy/start.sh
```

Expected result includes:

```text
Startup script revision: databricks-apps-no-npx-v2
run_next
Next.js CLI
```

## Commit and push the hosting files

Databricks Apps is deploying from GitHub `master`, so local changes do not matter until they are committed and pushed.

Use a targeted commit:

```bash
git status --short
git add deploy/start.sh app.yaml deploy/deploy.sh DATABRICKS_APPS_DEPLOYMENT.md guide.md
git commit -m "fix: stabilize databricks apps hosting"
git push origin master
```

Confirm GitHub `master` points at the commit you expect:

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/master
```

The two SHAs should match.

## Databricks Apps configuration

Use this App configuration:

```yaml
command:
  - "bash"
  - "deploy/start.sh"

env:
  - name: NODE_ENV
    value: "production"
  - name: BACKEND_PORT
    value: "3001"
  - name: BACKEND_BIND_HOST
    value: "127.0.0.1"
  - name: DATABRICKS_MODEL_ENDPOINT
    value: "system.ai.llama-4-maverick"
  - name: DATABRICKS_API_MODE
    value: "auto"
  - name: CODE_ARCHAEOLOGIST_ALLOW_EXTERNAL_PROMPT_CONTEXT
    value: "false"
  - name: NEXT_TELEMETRY_DISABLED
    value: "1"
```

Do not set `HOST=0.0.0.0` for the backend. The backend should stay on `127.0.0.1`; only Next.js should bind to `0.0.0.0:$DATABRICKS_APP_PORT`.

Do not set `CODE_ARCHAEOLOGIST_REQUIRE_API_AUTH=true` unless the frontend is also updated to send `CODE_ARCHAEOLOGIST_API_TOKEN`. Databricks Apps already puts the app behind Databricks workspace access; the internal backend is loopback-only.

## Databricks permissions

If the header says Databricks is connected, the host/token path is at least configured. To make the full model call work, the app service principal or PAT must have permission to query the model endpoint.

Grant the app service principal access to:

```text
system.ai.llama-4-maverick
```

Required permission name depends on the workspace UI, commonly `CAN_USE`, `CAN_QUERY`, or equivalent serving endpoint access.

If storing directly into Unity Catalog later, also grant:

```text
USE CATALOG
USE SCHEMA
MODIFY
```

on the target catalog/schema/table.

## Redeploy from Databricks UI

1. Open Databricks Workspace.
2. Go to the Git Folder or source attached to the App.
3. Confirm the selected branch is `master`.
4. Pull the latest revision from GitHub.
5. Open Compute > Apps.
6. Select `code-archaeologist`.
7. Redeploy.

If the UI still deploys the old script, remove and re-add the App source or create a fresh App using the GitHub repository URL and branch `master`.

## Expected healthy logs

A healthy deployment should show:

```text
Running build script next build
Build completed successfully
Starting app with command: [bash deploy/start.sh]
Startup script revision: databricks-apps-no-npx-v2
Next.js CLI: ./node_modules/.bin/next
Backend API is healthy and operational
Launching Next.js Production Server on 0.0.0.0:8000
Next.js 16.3.4
Ready
CODE ARCHAELOGIST is now LIVE on Databricks Apps
```

The healthy logs must not show:

```text
npx: command not found
```

If they still show that line, Databricks is not running the pushed `master` source.

## Local preflight before redeploy

Run:

```bash
bash -n deploy/start.sh
bash -n deploy/deploy.sh
npm run build
cd backend
npm test
cd ..
node scripts/security-check.mjs
```

Optional local Databricks Apps simulation:

```bash
DATABRICKS_APP_PORT=8999 BACKEND_PORT=3901 BACKEND_BIND_HOST=127.0.0.1 bash deploy/start.sh
```

Then verify:

```bash
curl -sf http://127.0.0.1:8999/
curl -sf http://127.0.0.1:8999/api/health
curl -sf http://127.0.0.1:8999/api/checkpoints
```

Stop the simulation with `Ctrl-C`.

## If the app starts but API calls fail

Check the browser/network response:

- `403 Origin is not allowed`: set `CODE_ARCHAEOLOGIST_ALLOWED_ORIGINS` to the Databricks App URL, then redeploy.
- `Databricks: Fallback`: the model endpoint is not configured or permission is missing. Check `DATABRICKS_MODEL_ENDPOINT` and service principal/PAT permissions.
- `Entire CLI unavailable`: the Databricks Apps runtime does not include the Entire CLI/plugin. Use demo checkpoints for the UI path, or install/package Entire in the runtime image before relying on live checkpoint ingestion.
- `Graph offline`: the Entire Graph plugin is not installed or not available in the app runtime.

## Final deployment checklist

- `master` contains the fixed `deploy/start.sh`.
- Databricks Git Folder is on `master` and pulled to the newest commit.
- App command is `bash deploy/start.sh`.
- Backend binds to `127.0.0.1:3001`.
- Next.js binds to `0.0.0.0:$DATABRICKS_APP_PORT`.
- Logs show `Startup script revision: databricks-apps-no-npx-v2`.
- Logs do not show `npx: command not found`.
- `/api/health` shows `status: operational`.
- The dashboard loads and can list checkpoints or demo checkpoints.
