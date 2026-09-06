#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# CODE ARCHAEOLOGIST — Automated Databricks Apps Deployer
# ═══════════════════════════════════════════════════════════════
set -e

APP_NAME="code-archaeologist"
if [ -z "${DATABRICKS_HOST:-}" ]; then
  echo "Error: set DATABRICKS_HOST to your Databricks workspace URL before deploying."
  exit 1
fi
WORKSPACE_HOST="${DATABRICKS_HOST}"
MASKED_WORKSPACE_HOST="$(printf '%s' "${WORKSPACE_HOST}" | sed -E 's#^(https?://)([^./]+).*#\1\2...#')"

echo ""
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║                                                            ║"
echo "  ║   ⛏  DEPLOYING CODE ARCHAEOLOGIST TO DATABRICKS APPS       ║"
echo "  ║   Target Workspace: ${MASKED_WORKSPACE_HOST} ║"
echo "  ║                                                            ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Check Databricks CLI
if ! command -v databricks &> /dev/null; then
  echo "❌ Error: Databricks CLI is not installed on this machine."
  echo ""
  echo "To install the Databricks CLI:"
  echo "  • macOS (Homebrew):  brew install databricks/tap/databricks"
  echo "  • Linux / macOS curl: curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh"
  echo "  • Windows:           winget install Databricks.DatabricksCLI"
  echo ""
  echo "Alternatively, you can deploy in 2 clicks via the Databricks Workspace UI:"
  echo "  1. Open your configured Databricks workspace"
  echo "  2. Go to Compute > Apps > 'Create App'"
  echo "  3. Select your Git folder and click 'Deploy'"
  echo "  (See DATABRICKS_APPS_DEPLOYMENT.md for complete step-by-step UI instructions)"
  exit 1
fi

echo "✓ Databricks CLI found: $(databricks version)"

# 2. Check Authentication
echo "➤ Checking Databricks authentication..."
if ! databricks auth describe &> /dev/null; then
  echo "⚠ Not authenticated. Initiating Databricks login for configured workspace..."
  databricks auth login --host "${WORKSPACE_HOST}"
fi

# 3. Compile Production Next.js Bundle
echo "➤ Building production frontend bundle..."
npm run build

# 4. Check if app already exists in Databricks Apps
echo "➤ Checking if App '${APP_NAME}' exists in workspace..."
if ! databricks apps get "${APP_NAME}" &> /dev/null; then
  echo "➤ Creating new Databricks App '${APP_NAME}'..."
  databricks apps create "${APP_NAME}" --description "Code Archaeologist — AI Development Intelligence Command Center"
else
  echo "✓ App '${APP_NAME}' already registered."
fi

# 5. Sync source code & deploy
echo "➤ Syncing source code and deploying App '${APP_NAME}'..."
databricks apps deploy "${APP_NAME}" --source-code-path .

# 6. Retrieve app status and URL
echo ""
echo "➤ Fetching deployment status..."
databricks apps get "${APP_NAME}"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎉 Deployment initiated! Your app will be live shortly."
echo "View the deployed app from the Databricks Apps page for ${APP_NAME}."
echo "═══════════════════════════════════════════════════════════════"
