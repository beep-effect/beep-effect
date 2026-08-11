# Handoff: get build-mode typecheck safely under a 32 GB worker

Owner: fresh agent session (Codex Sol or Claude), own worktree/branch.
Do NOT work in the worktrees named `ci-cache`, `findings-batch`, `tsperf-census`,
`endgame`, or `shadow-labels` — they carry in-flight PRs.

## Context

The build-mode typecheck census
(`goals/ci-fleet-endgame/research/build-mode-typecheck-census.md`, raw data in
`research/data/build-mode-census.tsv`; on the `research/build-mode-census`
worktree until its PR merges) measured cold `tsgo -b` RSS for the nine heaviest
packages. Findings that bind this work:

- `@beep/professional-desktop`: **47.59 GiB** build vs 10.82 isolated (4.40x);
  a second cold run measured 36.86 GiB — both exceed a 32 GB worker alone.
- `@beep/epistemic-server`: **24.77 GiB** build vs 5.09 isolated (4.87x).
- `@beep/db-admin`: 11.86 GiB (1.62x). Everything else is ~1x or below.
- Falsified: disabling target declaration emit moved epistemic RSS only
  **-2.8%**. Do not chase target emit; the mass is checking/inference across
  the build closure.
- `isolatedDeclarations` compiled clean on a leaf with zero edits — a viable
  migration experiment, but no proven RSS lever. Not the first move.
- A concurrency cap **cannot** reach the target: epistemic is 24.77 GiB at
  concurrency one; professional-desktop exceeds 32 GiB alone.

## Goal and acceptance

Make every CI typecheck invocation fit a 32 GB worker with headroom — the
fleet's P2 acceptance is "typecheck OOM impossible", and the working target
from the census is **sub-16 GiB peak per process** (safe at concurrency two).

Accept when:

1. A measured table (same method as the census: cold, closure-cleaned,
   `/usr/bin/time -v`, `timeout 1200s`, TSV committed to
   `goals/ci-fleet-endgame/research/data/`) shows every shard/process peak
   under 16 GiB, or documents the best achieved ceiling with the residual gap
   attributed.
2. The mechanism is merged, not just measured: whatever invokes typecheck in
   CI (turbo task graph / package scripts / beep CLI lane) actually runs the
   shards as separate OS processes so memory is released between them. A
   single multi-target `tsgo -b` process is NOT sufficient proof of release —
   the census says so explicitly.
3. Cold-start is honest: no warm `tsconfig.tsbuildinfo` in any accepted
   measurement (warm build-info masks real cost; delete
   `node_modules/.tmp/tsconfig.tsbuildinfo` through the closure and verify
   zero before measuring).

## Ranked plan (from the census — follow this order)

1. **Closure-shard census first (the next falsifiable step).** Split
   `professional-desktop`'s and `epistemic-server`'s project-reference
   closures into separately invoked shards (e.g. build referenced projects
   first in their own processes, then the target with `--noResolve`-equivalent
   warm dist). Measure per-shard peaks. This either proves the sub-16 GiB path
   or falsifies build-graph splitting before any invasive change.
2. **Demand-scoping for professional-desktop.** It aggregates `@beep/html`,
   `@beep/md`, and agents surfaces whose own rows are only 3.3–4.2 GiB.
   Narrow what its entry points import (barrel de-blasting, subpath imports)
   so the aggregated closure shrinks. This is the best targeted lever for the
   47 GiB row; it is NOT supported as the primary epistemic fix.
3. **`@beep/schema` barrel de-blast** — cross-graph inference reduction, prior
   isolated census evidence. Measure its build-mode contribution before and
   after; the census did not isolate it.
4. **`isolatedDeclarations` migration experiment** — only after 1–3, and only
   with a measured RSS claim attached.

## Method constraints

- Measure on an otherwise-quiet box where possible; the census saw a
  10.73 GiB spread between two cold professional-desktop runs under load
  averages of 30+. Record load in the TSV notes.
- `tsgo 7.0.2+effect-tsgo.0.24.3` (repo-pinned). `bunx tsgo -b tsconfig.json`
  from the package dir, `--clean` the exact closure first.
- Repo laws apply: schema-first, no tsconfig drift (`bun run beep
  tsconfig-sync --check`), changesets for touched packages, verify with
  `bun run beep yeet verify`, publish via yeet from a feature branch.
- Record friction receipts in
  `goals/ci-fleet-endgame/research/OPPORTUNITIES.md` as they happen.
- Related prior art: the isolated instantiation census (~1.65M import floor),
  the beta.104 heavy-lane kill set receipt in this ledger, and the parked
  box-typecheck-cost campaign notes.

## Explicitly out of scope

- Fleet/controller changes (instance types, IMDS mitigation) — separate P2 PR.
- Turbo remote cache (P3, PR #654).
- Reducing test-lane memory; this handoff is typecheck lanes only.
