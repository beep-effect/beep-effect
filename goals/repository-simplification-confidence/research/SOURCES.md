# Repository Simplification and Confidence — Sources & Provenance

- **Source exploration:** none — this goal was authored directly from the
  operator's approved execution brief
  ([`BRIEF-2026-10-09.md`](./BRIEF-2026-10-09.md), decision date 2026-10-09).
  The brief's interview research is the starting corpus; facts are refreshed
  against the implementation head in
  [`baseline-2026-10-09.md`](./baseline-2026-10-09.md).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| Operator brief | Repository Simplification and Confidence — Execution Brief | this repository (operator scratch file) | `research/BRIEF-2026-10-09.md` | Program contract | Adopted verbatim as the source of SPEC.md |
| 2026-10-09 read-only sweeps | Sweeps at `e62411d63f` | this repository | `research/sweeps/2026-10-09/README.md` (10 repository sweeps and 9 gap follow-ups tracked; workstation sweeps kept as private operational receipts) | Head-dependent facts (SPEC "Sweep-derived constraints", PLAN "Sweep sequencing facts" and "Lane inputs") | Adopted as head-dependent evidence at `e62411d63f` |
| Panel acceptance probes | Workstream F panel acceptance | this repository | `research/panel-acceptance-2026-10-09.md` | Panel model and effort acceptance | Adopted as head-dependent evidence at `e62411d63f` |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| None | N/A | N/A | No upstream code is ported by this packet. |

## 3. External research sources

Upstream contracts underlying the selected Docker MCP approach (workstream F).
Verify installed-version behavior before any configuration change.

| Source | URL | Used for |
|--------|-----|----------|
| Docker MCP profiles | https://docs.docker.com/ai/mcp-catalog-and-toolkit/profiles/ | Small explicit profiles and tool allowlists first |
| Docker dynamic MCP | https://docs.docker.com/ai/mcp-catalog-and-toolkit/dynamic-mcp/ | Dynamic discovery, allowed only after bounded compatibility and workflow validation |
| Docker MCP gateway v0.44.1 contract | https://github.com/docker/mcp-gateway/blob/v0.44.1/docs/mcp-gateway.md | Installed gateway version 0.44.1 behavior and the profile/feature compatibility discrepancy |

## 4. In-repo capability references

Reproduced from the brief's "Verified source index". The pointers were checked
by the brief against `aa9ce19cff22aa7809987410c8d609064622e56f`; on
2026-10-09 every path in the table and every named symbol was re-resolved at
the implementation head `e62411d63f` (`test -e <path>`; `grep -q <symbol>
<file>`), with no missing path or symbol. Symbols are more durable than line
numbers. The CLI command root in the table is
`packages/tooling/tool/cli/src/commands/`.

| Topic | Repository-relative evidence | What it establishes |
|---|---|---|
| Vitest aliases | `vitest.shared.ts`; CLI `TsconfigSync/TsconfigSync.plan.ts`, `planRootVitestAliasSync`; `Quality/Quality.command.ts`, `collectGeneratedVitestAliasDiagnostics` | Generator, consumer, and root-tsconfig parity check. |
| Identity lint profile | CLI `Cache/Cache.profile.ts`, `renderCacheIdentityLintProfile`, `verifyCacheIdentityLintProfile`, `writeCacheIdentityLintProfile`; `Cache/Cache.command.ts`; `Cache/Cache.runtime.ts`; `Cache/Cache.pilot.ts`; `Cache/Cache.census.ts` | `beep cache profile --write` owns the deterministic projection; runtime/pilot check freshness and use `BIOME_CONFIG_PATH`. Generation is not cache qualification. |
| Compiler provenance | `tools/tsgo-shim/tsgo.js`; `tools/tsgo-shim/package.json`; root `package.json`; `docs/runbooks/typescript-toolchain.md` | Direct installed Effect compiler execution and the prepare unpatch/prune/repatch contract. |
| Semgrep | `.semgrep/first-party.yml`; CLI `Quality/Quality.command.ts`; `.github/workflows/check.yml` | First-party scan uses `--error` and has active hosted wiring. |
| Typos | `_typos.toml`; root `package.json`; CLI `Quality/Tasks.ts`; `Lint/Lint.command.ts` | Live spelling task and configuration-sensitive quality integration. |
| Shadcn | `.oxlintrc.shadcn.json`; root `package.json`; CLI `Quality/Tasks.ts`; `Ci/CiLane.ts`; `docs/runbooks/design-system-lint.md` | Dedicated strict scope uses `--disable-nested-config --deny-warnings`. Hosted context was declared non-required at this baseline; do not confuse strict lint behavior with branch-protection status. |
| Harness ledger | CLI `HarnessLedger/HarnessLedger.service.ts`, `HarnessLedger.command.ts`, `HarnessLedger.schemas.ts`, `internal/Fingerprint.ts`, `internal/PruneWindow.ts` | Supported writer, append-only rows, decision chains, fingerprint validity, and exclusion of mixed-regime sessions from pruning windows. |
| Goal completion | CLI `Goals/Doctor.ts`, `isMergeSubject`, `citedBy`, `citedAnywhere`, `activeAfterMergeAdvisories`, `completionGateAdvisories`; `Goals/Goals.schemas.ts`, `GoalCompletionGate` | Existing subject heuristics, exemptions, and schema home for typed completion evidence. |
| Standards scans | `standards/schema-first.inventory.jsonc`; `standards/effect-vitest.inventory.jsonc`; `standards/jsdoc-documentation.inventory.jsonc`; `standards/jsdoc-documentation.inventory.md`; `standards/fallow.pilot.inventory.jsonc` | Concrete inventory entry points; refresh through owners and preserve reviewed exceptions/catalogs. |
| CI script callers | `.github/workflows/check.yml`; `.github/workflows/heavy.yml`; `.github/workflows/storybook.yml`; `.github/workflows/release-desktop.yml`; `.github/actions/setup-monorepo-ci/action.yml` | Classification, environment, resource, and pre-runtime apt contracts requiring coordinated caller updates. |
| Remaining script callers | `.changeset/config.json`; root `package.json`; CLI `Quality/Quality.command.ts`; `Quality/internal/CoverageScope.ts`; `Quality/internal/PackageVerify.ts` | Changelog callback, knowledge rewrite, prepare pruning, ONNX regression, and root-script quality ownership. Account for the documented root-input verification gap. |
| Documentation ownership | `docs/README.md`; `research/README.md`; `standards/memory-architecture/04-decision-log.md` | Authored versus generated/private/immutable records and superseded memory guidance. |

Canonical authorities (brief section 7) are listed in `../SPEC.md` "Source
Hierarchy".

## 5. Cross-links & provenance

| Link | Relationship |
|------|--------------|
| [`BRIEF-2026-10-09.md`](./BRIEF-2026-10-09.md) | The approved brief; primary source. |
| [`baseline-2026-10-09.md`](./baseline-2026-10-09.md) | Stage 1 receipts at the implementation head. |
| [`knip-findings-2026-10-09.md`](./knip-findings-2026-10-09.md) | Knip known-finding transfer list. |
| [`sweeps/2026-10-09/README.md`](./sweeps/2026-10-09/README.md) | Read-only sweeps at `e62411d63f`; source of the SPEC sweep-derived constraints and PLAN sweep sequencing facts. |
| [`panel-acceptance-2026-10-09.md`](./panel-acceptance-2026-10-09.md) | Workstream F panel acceptance probes. |
| [`../../effect-vitest-canon/`](../../effect-vitest-canon/) | Paused goal; resumed and integrated by lane V (explicitly authorized). |
| [`../../../explorations/build-pipeline-simplification/`](../../../explorations/build-pipeline-simplification/) | Separately owned exploration; preserved; owns the bundler and SchemaCompiler questions. |
| [`../../time-to-certainty/`](../../time-to-certainty/) | TTC proof reuse stays paused; this program does not change its semantics. |
| [`../../fallow-quality-enforcement/`](../../fallow-quality-enforcement/) | Fallow detection that remains after Knip retirement. |
| [`../../quality-gate-ratchets/`](../../quality-gate-ratchets/) | Ratchet and baseline conventions for detector and coverage gates. |
| [`../../orchestrator-handoff/`](../../orchestrator-handoff/) | Orchestrator role, register, and merge gate this program coordinates through. |

The fleet orchestrator's files and agents' private memory files are
operational context, not sources: decisions recorded here cite the brief, the
repository, or a dated receipt.
