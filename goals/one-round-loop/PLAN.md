# One-Round Loop Plan

Execution plan for [SPEC.md](./SPEC.md). Run phases in order — P0 gates
everything because the dogfood rule (SPEC §DoD.2) requires
`beep ci local` to exist before any other packet PR ships. Track
resumable state in [ops/progress.json](./ops/progress.json).

## Status

Status: `in_progress` — P0 started 2026-07-07. Packet-authoring PR
[#319](https://github.com/beep-effect/beep-effect/pull/319) green in one
CI round. P0 ships as two PRs: PR A (lane CLI `beep ci lane`/`beep ci
local` + temporary D9 shadow workflow, check.yml untouched) proves
same-SHA parity; PR B (check.yml thinning, orl-003) lands only after
the recorded proof in `history/p0-parity-evidence.md`.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 CI-lane inversion | pending | The beep CLI owns every CI lane; local replay is faithful. | New `beep ci lane <id>` + `beep ci local` subcommands beside `append-turbo-summary` in `packages/tooling/tool/cli/src/commands/Ci/`, with lane definitions expressed as `GithubCheckLaneSpec`-style steps reusing `QualityTaskStep` + `runQualityTaskStreamingStepGroup` / `runStepGroup` (Quality/Tasks.ts:163/897/991). FIRST deliverable: the lane-by-lane parity table classifying every lane cli-runnable / workflow-gated / ci-native (D2; the early "5-lane delta" is a floor — pre-push also differs in shape, and Security has sub-gates). Every cli-runnable/workflow-gated lane body (knip, jsdoc-ratchet, commitlint, fallow, codegen, desktop-IPC, sast, nix) dispatches `bun run beep ci lane <id>` with GitHub-context orchestration staying in YAML as flags (`--base`, `--mode`, `--affected`); ci-native jobs (secrets/gitleaks image, security/dependency-review, OSV action) keep their workflow bodies, documented in --list. `beep ci local` runs the locally-runnable battery with `--lanes`, `--fast` (skips coverage, test-integration, nix), `--affected`; closes the 5-lane verify delta (Coverage Regression, Codegen Drift, Commitlint, Desktop IPC locally; dependency-review documented CI-only). Required-check names unchanged (fence 2) or ruleset 10240248 updated same-change. Parity proof per D9 (same-SHA shadow workflow, run IDs recorded) + Verification Matrix rows 1–3; the thinning task blocks on BOTH orl-001 and orl-002. bin-main quality-verb fast path (bin-main.ts:184-202) extended to `ci`. |
| P1 Property-law lane | pending | Seed-dependent law failures die on the PR that introduces them. | An env-max property-options helper lands in `@beep/test-utils` (pattern: `assertSchemaArbitraryDecodesToSelf`'s `?? 50` in test-kit/test-utils/src/Schema.ts) reading `BEEP_FC_NUM_RUNS`, `effective = max(env, inline ?? default)`; `fc.configureGlobal` floor added in vitest.setup.ts for options-less asserts; a ts-morph codemod (ops/codemods/, golden-diff tested, following the crispening codemod harness) migrates all inline `numRuns:` sites (live 2026-07-07: 287 lines / 161 files; regenerate the inventory at execution time) INCLUDING it.prop/test.prop fastCheck params (e.g. drivers/pacer); a DEDICATED turbo task declares `BEEP_FC_NUM_RUNS` in `env` (own cache key; passThroughEnv would let low-run cached results satisfy the lane); new CI lane runs affected packages at 400 with a frozen context name (non-required at introduction; required flip at P4 per D3); nightly workflow (schedule + workflow_dispatch, issues:write) runs all suites at 1000+ and opens/updates ONE tracking issue (label property-laws-nightly), verified by manual dispatch; seeded-failure fixture proof passes (Verification Matrix rows 4–6). |
| P2 Medium tier | pending | The four medium DX items. | (a) Coverage baseline v2: `CoveragePackageBaseline` gains covered/total counts per metric (counts already decoded at CoverageRegression.ts:103, discarded at :223), `schema_version: 2`, baseline regenerated via `coverage:baseline:write`, failure renderer reports denominator deltas, missing-package path auto-adds on write (resolves @beep/pacer). (b) cwd-independence: a lightweight sync root-walk + `process.chdir()` in bin.ts BEFORE the bin-main import (findRepoRoot semantics; worktree-safe), stashing `BEEP_INVOCATION_CWD` defensively (audit found no consumer today); a `beep` shim (the CLI already declares bin: beep-cli) ships WITH or AFTER the chdir, never before — a shim alone exposes the ~8 cwd==root command files harder. (c) `beep quality regen-generated`: one command regenerates every generated standards file with a --write path (jsdoc inventory jsonc+md, schema-catalog, fallow.boundaries, coverage/knip/jsdoc-totals/fallow-dead-code baselines, schema-first + dual-arity inventories — preserving hand-curated exception entries; effect-laws allowlist EXCLUDED, hand-maintained/validate-only); merge-conflict recipe documented (checkout --ours on generated paths → regen → continue); optional bootstrap writing the local merge-driver config. (d) `SchemaUtils.withNormalizedCheck(normalizer, options)` in packages/foundation/modeling/schema/src/SchemaUtils/ (new file + alphabetized barrel entry; options bag with caller-supplied identifier/title/description/message + optional equivalence) with dtslint + a round-trip law; venice-ai (VeniceAI.service.ts:75-95), phoenix (Phoenix.config.ts:16-36), and m365 (M365.config.ts:139-159) migrated wire-identically; uspto (Uspto.config.ts:30-41) optionally gains the missing guard with its own parity note. TSConfigJsonKey is NOT a target (a __proto__ guard, not a fixed-point check). |
| P3 Stretch | pending | Long-tail items, each shippable or closable won't-fix with rationale. | S1: FallowEnvelope.schema.ts findings gain OPTIONAL file/line/symbol; the real work is rewriting the normalize* builders (findings are unfolded from integer counts today — the decoded raw arrays carrying path/name/line are discarded); the audit lane is counts-only and only partially liftable (duplication instances[].file + start_line). S2: committed-branch mode reuses the existing skipCommit fork (Handler.ts:2314) without the --reuse-verified durable-state requirement: skip stage/commit, KEEP proofStep+pushStep+ensurePullRequest+monitorSteps, relax the pre-dispatch --message requirement (Handler.ts:2135). S3: measure `beep worktree new` end-to-end (it already runs bun install, Worktree.command.ts:716), close the adoption gaps that matter for agent lanes (candidates: branch-from-base, list subcommand, --delete-branch on remove), and document it as the canonical agent-lane path. SEAM: coordinate with explorations/agent-pipeline-velocity and standards/git-worktrees.md — do not fork worktree doctrine here. S4: classify recent "operation was canceled" events (benign cancel-in-progress supersession vs infra), then either add rerun automation + a quarantine convention for known-red-on-main required checks, or close won't-fix with the classification data. |
| P4 Close | pending | Confirm DoD; close durably. | Verification Matrix fully green; dogfood ledger table (CI rounds per packet PR, root-cause notes for any >1) in history/; `/reflect` closeout written; `bun run beep lint reflection-artifacts` passes; README + ops/manifest.json statuses updated. |

## Dogfood rule (D4/D8 — no bootstrap exemption)

Every packet PR — including P0's own — runs `bun run beep ci local`
built from that PR's branch, green before push; docs-only /
packet-file-only PRs may use `--fast --affected`. A packet PR needing
>1 CI round is a FAILED dogfood proof: root-cause note in `history/`
AND demonstrated local catch of the exposed class before close.

## Execution notes (carried from the crispening)

- Ship small per-phase PRs via `bun run beep yeet publish --pr` +
  `monitor`; sweep ALL review comments + failing jobs before each push.
- One writer per file-set per wave; codex lanes for the mechanical
  sweeps (the numRuns codemod), concurrency ≤ 4.
- Never run manual turbo/docgen/vitest while a background yeet verify is
  in flight; `bun install` after any bun.lock-changing merge.
- Ledger flows: run the `--write` mode of a gate to author entries, then
  flip status to exception with a reason — never hand-author entry keys.
- The P0 parity proof follows D9: a temporary workflow_dispatch shadow
  workflow on the same head SHA as the unmodified check.yml run, run
  IDs recorded, BEFORE the thinning commit lands.

## Verification Commands

```sh
test "$(wc -m < goals/one-round-loop/GOAL.md)" -le 4000
jq . goals/one-round-loop/ops/manifest.json
git diff --check -- goals/one-round-loop

# Phase gate — run at the close of every phase
bun run beep ci local        # once P0 lands
bun run beep yeet verify
```
