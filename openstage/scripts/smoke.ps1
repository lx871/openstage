Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
Write-Host "== typecheck ==" -ForegroundColor Cyan
pnpm exec tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }
Write-Host "== test ==" -ForegroundColor Cyan
pnpm exec vitest run
if ($LASTEXITCODE -ne 0) { throw "test failed" }
Write-Host "== compat-check ==" -ForegroundColor Cyan
pnpm exec tsx tools/compat-check/src/index.ts tests/fixtures/linwan.json | Out-Null
if ($LASTEXITCODE -ne 0) { throw "compat-check failed" }
Write-Host "== cli trace ==" -ForegroundColor Cyan
pnpm exec tsx tools/cli/src/index.ts trace tests/fixtures/linwan.json --turn 1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "cli trace failed" }
Write-Host "== cli branch ==" -ForegroundColor Cyan
pnpm exec tsx tools/cli/src/index.ts branch tests/fixtures/linwan.json | Out-Null
if ($LASTEXITCODE -ne 0) { throw "cli branch failed" }
Write-Host "smoke: OK" -ForegroundColor Green
