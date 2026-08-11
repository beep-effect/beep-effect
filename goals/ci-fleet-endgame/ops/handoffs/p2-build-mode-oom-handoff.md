# Handoff: get build-mode typecheck safely under a 32 GB worker

Owner: fresh agent session (Codex Sol or Claude), own worktree/branch.
Do NOT work in the worktrees named `ci-cache`, `findings-batch`, `tsperf-census`,
`endgame`, or `shadow-labels` — they carry in-flight PRs.

## Context

The build-mode typecheck census
(`goals/ci-fleet-endgame/research/build-mode-typecheck-census.md`, raw data in
`research/data/build-mode-census.tsv`, full transcript in
`research/data/build-mode-census-transcript.md`) measured cold `tsgo -b` RSS
for a nine-package sample selected from the prior isolated census — NOT the
nine heaviest: `@beep/law-practice-server`, `@beep/practice-kg-mcp`,
`@beep/ontology-client`, and `@beep/agents-client` had higher isolated RSS
than several included rows and have no build-mode measurement yet. Findings
that bind this work:

- `@beep/professional-desktop`: two cold runs measured **36.86 GiB** (first)
  and **47.59 GiB** (rerun) vs 10.82 isolated — both exceed a 32 GB worker
  alone; the census table uses the rerun (4.40x).
- `@beep/epistemic-server`: **24.77 GiB** build vs 5.09 isolated (4.87x).
- `@beep/db-admin`: 11.86 GiB (1.62x). Everything else is ~1x or below.
- Falsified: disabling the target package's own declaration emit moved
  epistemic RSS only **-2.8%**. That rules out target emit as the dominant
  term and nothing more — it does not attribute the remainder among
  checking/inference, dependency declaration emit, and build-program
  retention.
- These rows bound the COLD WORST CASE of one process compiling the whole
  closure. The hosted Check lane runs root Turbo at concurrency one with
  every dependency's `check` task first as its own process (outputs
  preserved), so the CI graph's real per-process peak is unmeasured and
  process sharding may partially duplicate Turbo's existing ordering.
- `isolatedDeclarations` compiled clean on a leaf with zero edits — a viable
  migration experiment, but no proven RSS lever. Not the first move.
- A concurrency cap **cannot** reach the target: epistemic is 24.77 GiB at
  concurrency one; professional-desktop exceeds 32 GiB alone.

## Goal and acceptance

Make every CI typecheck invocation fit a 32 GB worker with headroom — the
fleet's P2 acceptance is "typecheck OOM impossible". The per-process working
target is **sub-13 GiB peak**, and per-process conformance alone is NOT
acceptance: two conforming processes at concurrency two must leave real
system headroom.

Accept when ALL of:

1. A measured table (same method as the census: cold, closure-cleaned,
   `/usr/bin/time -v`, `timeout 1200s`, TSV committed to
   `goals/ci-fleet-endgame/research/data/`) shows every shard/process peak
   under 13 GiB. A best-achieved ceiling above budget with the residual gap
   attributed is a documented STOP CONDITION, not an acceptance branch — it
   makes the gap the next work item and the handoff remains unaccepted.
2. A measured concurrency-two run of the two heaviest conforming processes
   peaks under **26 GiB combined**, leaving at least 6 GiB on a 32 GB worker
   for the OS, Bun/Turbo wrappers, and compiler launch overlap.
3. The mechanism is merged, not just measured: whatever invokes typecheck in
   CI (turbo task graph / package scripts / beep CLI lane) actually runs the
   shards as separate OS processes so memory is released between them. A
   single multi-target `tsgo -b` process is NOT sufficient proof of release —
   the census says so explicitly.
4. Cold-start is honest: no warm `tsconfig.tsbuildinfo` in any accepted
   measurement (warm build-info masks real cost; delete
   `node_modules/.tmp/tsconfig.tsbuildinfo` through the closure and verify
   zero before measuring).

## Ranked plan (from the census — follow this order)

1. **Measure the real CI workload first (the next falsifiable step).** Record
   per-process RSS from a cold root Check run (root Turbo, concurrency one,
   `^check` prerequisites running first as their own processes with outputs
   preserved) — this is the graph CI actually executes and it may already
   deliver most of the memory release that sharding would add. Then measure
   each heavy target after its `^check` prerequisites complete, extend the
   census to the four omitted higher-isolated-RSS packages
   (law-practice-server, practice-kg-mcp, ontology-client, agents-client),
   and only shard closures whose measured post-prerequisite peak still
   exceeds budget. This either proves the sub-13 GiB path or falsifies
   build-graph splitting before any invasive change.
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
