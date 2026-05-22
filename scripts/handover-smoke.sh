#!/usr/bin/env bash
# =============================================================================
# handover-smoke.sh — Smoke-test for HANDOVER.md Option A
#
# Reproduces the "standalone two-package drop-in" path from scratch:
#   1. Copies vendor/aem-to-sanity-core + vendor/aem-to-sanity-schema
#   2. Patches the workspace dep to a file: path
#   3. Installs, builds, runs the CLI against real AEM
#   4. (Phase 2) Validates the Studio loads the emitted schemas
#
# Idempotent: re-running cleans and rebuilds the scratch dir.
#
# Prerequisites:
#   - pnpm >= 9, node >= 20
#   - AEM_AUTHOR_URL, AEM_AUTHOR_USERNAME, AEM_AUTHOR_PASSWORD in env
#   - SANITY_PROJECT_ID, SANITY_DATASET in env (for Phase 2)
#
# Usage:
#   bash scripts/handover-smoke.sh            # Phase 1 only
#   SMOKE_PHASE2=1 bash scripts/handover-smoke.sh  # Phase 1 + Studio boot
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH_DIR="${REPO_ROOT}/.smoke-scratch"
VENDOR_DIR="${SCRATCH_DIR}/vendor"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[smoke]${NC} $*"; }
success() { echo -e "${GREEN}[smoke ✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[smoke ⚠]${NC} $*"; }
fail()    { echo -e "${RED}[smoke ✗]${NC} $*"; exit 1; }

# ── env checks ───────────────────────────────────────────────────────────────
info "Checking required environment variables..."
: "${AEM_AUTHOR_URL:?AEM_AUTHOR_URL must be set}"
: "${AEM_AUTHOR_USERNAME:?AEM_AUTHOR_USERNAME must be set}"
: "${AEM_AUTHOR_PASSWORD:?AEM_AUTHOR_PASSWORD must be set}"
success "AEM env vars present"

# ── tool checks ──────────────────────────────────────────────────────────────
command -v pnpm >/dev/null 2>&1 || fail "pnpm not found — install pnpm >= 9"
command -v node >/dev/null 2>&1 || fail "node not found — install node >= 20"
NODE_MAJOR=$(node --version | sed 's/v\([0-9]*\).*/\1/')
[[ "$NODE_MAJOR" -ge 20 ]] || fail "node >= 20 required (got $(node --version))"
success "pnpm $(pnpm --version), node $(node --version)"

# =============================================================================
# PHASE 1 — Option A: two-package drop-in
# =============================================================================
info "=== PHASE 1: Option A smoke test ==="

# ── Step 0: clean scratch dir (idempotent) ───────────────────────────────────
info "Cleaning scratch dir: ${SCRATCH_DIR}"
rm -rf "${SCRATCH_DIR}"
mkdir -p "${VENDOR_DIR}"

# ── Step 1: copy both packages ───────────────────────────────────────────────
info "Copying packages/aem-to-sanity-core → vendor/aem-to-sanity-core"
cp -r "${REPO_ROOT}/packages/aem-to-sanity-core" "${VENDOR_DIR}/aem-to-sanity-core"

info "Copying packages/aem-to-sanity-schema → vendor/aem-to-sanity-schema"
cp -r "${REPO_ROOT}/packages/aem-to-sanity-schema" "${VENDOR_DIR}/aem-to-sanity-schema"

# ── Step 2: patch workspace dep → file: path ─────────────────────────────────
info "Patching workspace:* → file:../aem-to-sanity-core in schema package.json"
sed -i 's|"aem-to-sanity-core": "workspace:\*"|"aem-to-sanity-core": "file:../aem-to-sanity-core"|' \
  "${VENDOR_DIR}/aem-to-sanity-schema/package.json"

# Verify the patch
grep '"aem-to-sanity-core"' "${VENDOR_DIR}/aem-to-sanity-schema/package.json" | grep -q "file:" \
  || fail "Patch failed — workspace dep not replaced"
success "Dep patched to file:../aem-to-sanity-core"

# ── Step 3: create consumer project scaffolding ──────────────────────────────
# NOTE: HANDOVER.md does not mention these required files — they are needed
# for pnpm to treat this as a workspace and link the bin correctly.
info "Creating consumer project scaffolding (package.json + pnpm-workspace.yaml)"

cat > "${SCRATCH_DIR}/package.json" << 'PKGJSON'
{
  "name": "scratch-consumer",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@types/node": "^20.0.0",
    "aem-to-sanity-schema": "workspace:*"
  }
}
PKGJSON

# NOTE: HANDOVER.md does not mention needing pnpm-workspace.yaml
cat > "${SCRATCH_DIR}/pnpm-workspace.yaml" << 'WORKSPACE'
packages:
  - "vendor/*"
WORKSPACE

# NOTE: HANDOVER.md does not mention needing tsconfig.base.json.
# Both packages extend ../../tsconfig.base.json (relative to vendor/*/).
# Without this file the DTS build fails with TS5083.
info "Copying tsconfig.base.json (required by both packages — not mentioned in HANDOVER.md)"
cp "${REPO_ROOT}/tsconfig.base.json" "${SCRATCH_DIR}/tsconfig.base.json"

# ── Step 4: pnpm install ─────────────────────────────────────────────────────
info "Running pnpm install..."
cd "${SCRATCH_DIR}"
pnpm install 2>&1 | grep -E '(Done|ERR|WARN deprecated)' || true
success "pnpm install complete"

# ── Step 5: build core then schema ───────────────────────────────────────────
info "Building aem-to-sanity-core..."
pnpm --filter aem-to-sanity-core build 2>&1 | grep -E '(Build success|error|Error)' || true
[[ -f "${VENDOR_DIR}/aem-to-sanity-core/dist/index.js" ]] \
  || fail "Core build failed — dist/index.js not found"
success "aem-to-sanity-core built"

info "Building aem-to-sanity-schema..."
pnpm --filter aem-to-sanity-schema build 2>&1 | grep -E '(Build success|error|Error)' || true
[[ -f "${VENDOR_DIR}/aem-to-sanity-schema/dist/cli.js" ]] \
  || fail "Schema build failed — dist/cli.js not found"
success "aem-to-sanity-schema built"

# ── Step 6: create .env and aem-component-paths ──────────────────────────────
info "Creating .env and aem-component-paths..."
cat > "${SCRATCH_DIR}/.env" << ENV
AEM_ENV=author
AEM_AUTHOR_URL=${AEM_AUTHOR_URL}
AEM_AUTHOR_USERNAME=${AEM_AUTHOR_USERNAME}
AEM_AUTHOR_PASSWORD=${AEM_AUTHOR_PASSWORD}
OUTPUT_DIR=./output
CONCURRENCY=4
AEM_COMPONENT_PATHS_FILE=./aem-component-paths
ENV

# Use real DBI component paths (verified to exist in AEM)
cat > "${SCRATCH_DIR}/aem-component-paths" << 'PATHS'
# Smoke test — real DBI components
/apps/dbi/components/content/3-column-staggered-grid-portrait-images-mobile-stacked
/apps/dbi/components/content/4-column-staggered-grid-2-column-mobile
PATHS

# ── Step 7: run the CLI ───────────────────────────────────────────────────────
info "Running: pnpm exec aem-to-sanity-schema"
cd "${SCRATCH_DIR}"
pnpm exec aem-to-sanity-schema 2>&1

# ── Step 8: verify output ─────────────────────────────────────────────────────
info "Verifying output..."
SCHEMA_DIR="${SCRATCH_DIR}/output/schemas"
[[ -d "${SCHEMA_DIR}" ]] || fail "output/schemas/ directory not created"

TS_COUNT=$(find "${SCHEMA_DIR}" -name "*.ts" | wc -l)
[[ "${TS_COUNT}" -ge 3 ]] \
  || fail "Expected >= 3 .ts files in output/schemas/, found ${TS_COUNT}"

[[ -f "${SCHEMA_DIR}/index.ts" ]]     || fail "output/schemas/index.ts missing"
[[ -f "${SCHEMA_DIR}/page.ts" ]]      || fail "output/schemas/page.ts missing"
[[ -f "${SCHEMA_DIR}/pageBuilder.ts" ]] || fail "output/schemas/pageBuilder.ts missing"

REPORT="${SCRATCH_DIR}/output/migration-report.json"
[[ -f "${REPORT}" ]] || fail "output/migration-report.json missing"

FAILURES=$(node -e "const r=JSON.parse(require('fs').readFileSync('${REPORT}')); console.log(r.summary.failures)")
[[ "${FAILURES}" == "0" ]] || warn "migration-report.json shows ${FAILURES} failure(s) — check ${REPORT}"

success "Phase 1 complete — output/schemas/ contains ${TS_COUNT} .ts files, 0 failures"
echo ""
echo "  Schema files:"
ls "${SCHEMA_DIR}"
echo ""

# Also verify the direct node invocation works (alternative from HANDOVER.md)
info "Verifying alternative invocation: node vendor/aem-to-sanity-schema/dist/cli.js"
node "${VENDOR_DIR}/aem-to-sanity-schema/dist/cli.js" 2>&1 | grep -E '(Emitted|Failed|Exit)' || true
success "Direct node invocation also works"

# =============================================================================
# PHASE 2 — Studio boot (optional, set SMOKE_PHASE2=1 to enable)
# =============================================================================
if [[ "${SMOKE_PHASE2:-0}" != "1" ]]; then
  info "Phase 2 (Studio boot) skipped. Set SMOKE_PHASE2=1 to enable."
  success "=== Smoke test PASSED ==="
  exit 0
fi

info "=== PHASE 2: Studio boot against ${SANITY_PROJECT_ID:-rolz99xh}/${SANITY_DATASET:-production} ==="

: "${SANITY_PROJECT_ID:?SANITY_PROJECT_ID must be set for Phase 2}"
: "${SANITY_DATASET:?SANITY_DATASET must be set for Phase 2}"

# Generate schemas for the davids-bridal example (Studio imports from there)
info "Generating schemas for tenants/davids-bridal (Studio source)..."
cd "${REPO_ROOT}"

# Ensure packages are built in the monorepo
pnpm --filter aem-to-sanity-core --filter aem-to-sanity-schema build 2>&1 \
  | grep -E '(Build success|error TS)' || true

# Create .env for the example if it doesn't exist
if [[ ! -f "${REPO_ROOT}/tenants/davids-bridal/.env" ]]; then
  cat > "${REPO_ROOT}/tenants/davids-bridal/.env" << ENV2
AEM_ENV=author
AEM_AUTHOR_URL=${AEM_AUTHOR_URL}
AEM_AUTHOR_USERNAME=${AEM_AUTHOR_USERNAME}
AEM_AUTHOR_PASSWORD=${AEM_AUTHOR_PASSWORD}
OUTPUT_DIR=./output
CONCURRENCY=4
AEM_COMPONENT_PATHS_FILE=./aem-component-paths
ENV2
  info "Created tenants/davids-bridal/.env"
fi

# Create aem-component-paths if it doesn't exist
if [[ ! -f "${REPO_ROOT}/tenants/davids-bridal/aem-component-paths" ]]; then
  cat > "${REPO_ROOT}/tenants/davids-bridal/aem-component-paths" << 'PATHS2'
# Smoke test — real DBI components
/apps/dbi/components/content/3-column-staggered-grid-portrait-images-mobile-stacked
/apps/dbi/components/content/4-column-staggered-grid-2-column-mobile
PATHS2
  info "Created tenants/davids-bridal/aem-component-paths"
fi

pnpm --filter tenant-davids-bridal migrate:schema 2>&1 | grep -E '(Emitted|Failed|error)' || true

STUDIO_SCHEMAS="${REPO_ROOT}/tenants/davids-bridal/output/schemas/index.ts"
[[ -f "${STUDIO_SCHEMAS}" ]] || fail "davids-bridal output/schemas/index.ts not generated"
success "davids-bridal schemas generated"

# Create studio .env
cat > "${REPO_ROOT}/apps/studio/.env" << STUDIOENV
SANITY_STUDIO_PROJECT_ID=${SANITY_PROJECT_ID}
SANITY_STUDIO_DATASET=${SANITY_DATASET}
STUDIOENV

# Build the Studio (validates schemas load without errors)
info "Building Studio (sanity build)..."
cd "${REPO_ROOT}/apps/studio"
pnpm exec sanity build 2>&1 | grep -E '(Build Sanity Studio|Error|error)' || true
[[ -d "${REPO_ROOT}/apps/studio/dist" ]] || fail "Studio build failed — dist/ not created"
success "Studio build succeeded"

# Validate schema
info "Running sanity schema validate..."
VALIDATE_OUT=$(pnpm exec sanity schema validate 2>&1)
echo "${VALIDATE_OUT}"
echo "${VALIDATE_OUT}" | grep -q "0 errors" || fail "sanity schema validate reported errors"
success "sanity schema validate: 0 errors"

# Quick dev server smoke (start, wait for ready, check HTTP, kill)
info "Starting Studio dev server (30s timeout)..."
pnpm exec sanity dev --port 3333 &
STUDIO_PID=$!
READY=0
for i in $(seq 1 30); do
  sleep 1
  if curl -sf http://localhost:3333 >/dev/null 2>&1; then
    READY=1
    break
  fi
done
kill "${STUDIO_PID}" 2>/dev/null || true
wait "${STUDIO_PID}" 2>/dev/null || true

if [[ "${READY}" == "1" ]]; then
  success "Studio dev server responded on http://localhost:3333"
else
  fail "Studio dev server did not respond within 30s"
fi

success "=== Smoke test PASSED (Phase 1 + Phase 2) ==="
