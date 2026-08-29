# Meta-Goal: Autonomous ROADMAP Completion Loop — `goals/goal-portfolio-driver`

## Context

You want a non-stop agentic loop that drives **every active goal packet to merged-PR +
`completed-retained`** without your input: Fable 5 as context-preserving orchestrator (reads only
synthesized outputs), codex gpt-5.6-sol `--effort medium` for all token-heavy work, per-goal quality
gates (`quality-review-fix-loop` → `crispen` → codex-Chrome frontend QA) before `/yeet publish`
drives each PR to mergeable (Greptile resolved, CI green, conflicts fixed) and auto-merge lands it.
The deliverable is a new meta goal packet that encodes the whole loop, plus Phase-0 hardening that
removes everything that would stall an unattended run.

**Locked decisions (2026-07-14):** scope = all 25 active packets in dependency order · auto-merge
when gates pass · scoped allow-list extension (no bypassPermissions) · frontend QA = codex CLI +
Chrome browser extension (exists in your setup; smoke-tested in P0; claude-in-chrome as fallback).

## Key facts from exploration (verified today)

- `goals/INDEX.md` is lifecycle machine-truth (25 active / 1 paused / 65 done); ROADMAP.md owns
  priority only and **was already reconciled today** (PR #407) — `bun run beep lint roadmap-refs`
  now exists. Only a small amendment + queue derivation remain (~17 graduation-wave packets have no
  lane placement yet).
- Done-definition is uniform: PR mergeable via yeet → `beep goals set-status <slug>
  completed-retained` → schema-valid reflection required (`beep lint reflection-artifacts`).
- Ruleset: 0 approvals required, 17 required checks, strict:false, thread-resolution not required.
  Greptile gate is yeet-closeout's operator gate, not GitHub's. Greptile threads are API-resolvable.
- **Blockers found:** repo `allow_auto_merge: false` (auto-merge rejected until flipped);
  read-only permission allow-list; flaky required check `Test Integration`
  (`SqlTest.pglite.test.ts` teardown race, red on main now); gh token lacks `workflow` scope;
  PR #409 has 3 unresolved Greptile P1 threads (2 path-traversal, 1 manifest-decode — thread IDs
  captured). PR #408 already merged.
- Prior art to reuse: `goals/repo-crispening-orchestration/` (orchestration-packet template),
  `.claude/skills/yeet/SKILL.md` 10-step mergeable recipe, `goals/_template/`.
- Codex recipe: `codex-companion.mjs task --background --write --effort medium "<prompt>"` (model
  inherits gpt-5.6-sol). No deliverable convention built in → every prompt names an output path.
  Codex sandbox can't write GitHub → all `gh` writes run from the driver. Never trust codex
  self-reports; verify by fresh reads.

## The design

### 1. Meta packet: `goals/goal-portfolio-driver/`

```
goals/goal-portfolio-driver/
├── README.md / SPEC.md / PLAN.md / GOAL.md      # standard template shape
├── ops/
│   ├── manifest.json          # initiative-manifest/v2, completionGate operator=yeet
│   ├── queue.json             # STATIC: 25 slugs, priority, lane, dependsOn, prUnits, frontend flag
│   ├── state/loop-state.json  # resumable machine state, committed locally each transition
│   ├── state/runs/<slug>/     # per-stage verdict files (≤60 lines each)
│   ├── incidents/             # parked-goal records: <date>-<seq>-<class>-<slug>.md
│   ├── status.md              # human heartbeat, regenerated every driver wake
│   ├── merge-bodies/          # pre-validated squash bodies (commitlint <100-char lines)
│   ├── qa-smoke/              # codex-Chrome QA smoke artifacts
│   └── prompts/               # dispatch templates: codex-implement, qa-round, verdict-distiller, greptile-remediate
├── research/                  # SOURCES.md, deep-research report, decisions-locked.md, dependency-graph.md
└── history/reflections/
```

Key invariant: **queue.json is static ordering + dependency edges; live status is always derived
from `goals/INDEX.md`** (single writer stays `beep goals set-status`). Remaining work =
`queue ∩ INDEX.active`, computed fresh each wake — no dual truth, no queue churn.

GOAL.md (≤4000 chars) is a **Fable driver launcher**: every wake = read loop-state.json (or run
recovery probe) → read INDEX Active table → advance each lane one transition → dispatch stage
agents (never do stage work inline, never read raw logs/diffs) → write+commit state → schedule
next wake (self-paced: immediate when work is local, ~5 min while everything waits on hosted
checks/codex jobs).

### 2. Session topology & concurrency

- **Driver**: one long-lived Fable session in its own worktree
  `beep-effect-worktrees/portfolio-driver` (branch `goals/goal-portfolio-driver`), kept alive by
  `/loop` self-pacing. Runs all `gh` writes (merge arming, thread resolution) itself.
- **2 edit lanes + 2 PR-monitor slots** (max 4 goals in flight), each edit lane in its own worktree
  `beep-effect-worktrees/lane-<slug>` (created via `bun run beep worktree new`, `lane-` prefix
  keeps the 7 pre-existing worktrees untouchable). While a PR sits in hosted checks/Greptile
  (10–25 min dead time), its lane is reseeded with the next queue item.
- **Global verify mutex**: only one `yeet verify`/`publish`-class proof runs at a time, machine-wide
  (turbo/PGLite contention; also satisfies the crispen "no manual turbo beside background verify"
  rule). Merges serialize: no new merge armed while the previous merge's main run is unresolved.
- Stage routing: codex bg jobs = backend/docs/research implementation + browser QA rounds; Fable
  subagents = packet briefs, quality-review-fix-loop, crispen, frontend implementation/fixes, yeet
  publish recipe, reflections; driver Bash = all GitHub writes + merge verification.

### 3. Per-goal state machine (normative in SPEC)

```
QUEUED → LANE_SETUP (worktree from fresh origin/main)
  → PACKET_REVIEW (Fable subagent → ≤40-line brief: remaining phases, PR units, frontend flag)
  → IMPLEMENT per phase (codex bg; gate = phase verificationCommands pass on fresh re-run by a
      distiller subagent; budget 2 codex attempts + 1 Fable rescue)
  → QUALITY_LOOP (quality-review-fix-loop skill; gate = zero required blockers; budget = skill's 3
      rounds, then waiver-or-park)
  → CRISPEN (crispen skill; gate = second pass is a no-op; budget 2 passes)
  → [frontend? = diff touches apps/** | packages/**/ui/** | non-test *.tsx]
      FRONTEND_QA (codex+Chrome round → findings file → Fable FE fix subagent → re-QA; budget 3)
  → PUBLISH [verify mutex] (yeet 10-step; final PR-unit's last commit carries set-status +
      INDEX regen + /reflect reflection — closeout rides the PR, so INDEX never lies)
  → PR_MONITOR (red check → attribution → repair, budget 2; Greptile <5/5 → remediation loop,
      budget 3 rounds; all green → arm gh pr merge --squash --auto → verify merged via fresh
      gh api read → watch main's push run)
  → MERGED → DONE (or next PR unit)

ANY STATE on budget exhaustion → PARK: write ops/incidents/<...>.md, free the lane, continue queue.
```

Multi-phase packets (e.g. legal-document-intake P4/P5/P6) run as sequential PR units.
`professional-desktop-adversarial-qa` is a standing campaign: QA→repair rounds until two
consecutive clean rounds, then closeout.

### 4. Context economy protocol

Driver MAY read only: loop-state.json, queue.json, INDEX Active table, ≤60-line `*.verdict.md`
files, incident files, one-line/JSON-count command outputs. Everything else (packet docs, diffs,
logs, reviewer findings, Greptile thread bodies, codex transcripts) is delegated. Every dispatched
agent terminates by writing `<stage>-r<N>.verdict.md` (YAML: status/goal/stage/round/nextAction +
≤15 bullets + evidence *paths*); full reports sit beside it for the *next stage agent*, never the
driver. Codex stage completion is confirmed by a cheap distiller subagent that re-runs the stage's
verification commands and fresh-reads deliverables.

### 5. Failure-mode playbook (in SPEC; each = detect → remedy → budget → park-and-continue)

- **Local verify fail**: fallow-envelope pre-clean (`rm -rf .beep/fallow`) → changeset-status rule
  (publish commits first; empty changeset for version-neutral deps) → codex fix rounds (3) →
  attribution guard for the systemic @beep/schema $defs repo-wide red (check main HEAD first).
- **Hosted check fail**: attribute first (introduced/inherited/unrelated/environment-only).
  Vercel 429→TS6305 = rerun (2×). Secret Scanning reads BASE `.gitleaks.toml` → neutralize string
  in-file, allowlist entries land main-first as own PR. Secret-split divergence → reproduce with
  fixture parity locally.
- **Greptile rounds**: classify fix/rebut/resolve-as-stale (P1 security = always fix; rebuttals
  need evidence). Codex implements + drafts replies; **Fable reviews every reply before posting**;
  resolve via `yeet closeout --reply-thread/--resolve-threads`; re-gate with
  `--require-greptile-score 5/5 --require-greptile-issues 0`. 3 rounds/PR.
- **Stale base/conflicts**: yeet publish refuses → `git fetch && git rebase origin/main` in-lane
  (conflicts in files the goal never touched = misattribution signal → park) → re-verify →
  `publish --push-only --reuse-verified --pr` (never `--staged-only` with amend/push-only). 2
  rebase cycles/PR.
- **Main red after merge**: halt arming merges; attribute; introduced → fix-forward at queue head
  (4h budget) then revert-PR through the full pipeline; inherited → don't misattribute.
- **Codex job death**: re-derive lane state from `git status`+`yeet status` (never the worker's
  last message); 2 respawns. **Driver death**: stateless recovery — probe `git worktree list`,
  `gh pr list`, INDEX, verdict files; armed auto-merges safely outlive the driver.

**Circuit breakers**: 3 consecutive parks on same class → halt queue · main red → halt merges
(local work continues) · same flaky check blocks 3 PRs → quarantine mini-goal at queue head ·
12 codex-hours on one goal → park · disk <50GB → no new lanes.

**Safety rails (deny-list + protocol text in GOAL.md + every codex prompt preamble)**: never
force-push, never stash clear/drop/pop, never branch-delete/worktree-prune/reset-hard/clean (the
33 stashes/135 branches/7 worktrees are yours), never revert unexplained out-of-scope changes in
the main checkout (you work there mid-session), never edit `.github/workflows/**` or
`docs/_internal/**`, never merge with `--admin`/lower gate thresholds, never weaken
`.gitleaks.toml` in-PR, never mutate `.claude/settings.json` or repo settings, never trust
self-reports.

## Phase plan

### P0 — Kickoff hardening (you present at start; ~half day)

1. **User-present one-time actions**: `gh api -X PATCH repos/:owner/:repo -f allow_auto_merge=true`
   (verified currently false); `gh auth refresh -h github.com -s workflow` (else CI-touching goals
   park via B7); approve the settings diff.
2. **Permissions diff** in [.claude/settings.json](.claude/settings.json): add scoped allow entries
   (git add/commit/push/fetch/rebase/switch/checkout -b/stash push; `bun run beep yeet
   repair|publish|monitor|closeout`; `bun run beep worktree new|doctor|remove`; gh pr
   create/merge/comment/ready, gh issue create, gh run rerun/watch, gh api; exact
   `rm -rf .beep/fallow`; bunx commitlint; bun install; codex exec) + deny list (force-push
   variants, stash clear/drop/pop, branch -d/-D, worktree prune/--force, git clean/reset --hard,
   gh pr merge --admin, gh pr close, gh api DELETE/PATCH, Edit/Write on `.github/workflows/**`,
   `docs/_internal/**`, `.claude/settings.json`) + `additionalDirectories:
   ["/home/elpresidank/YeeBois/projects/beep-effect-worktrees"]`. Verify one deny actually blocks.
3. **`/deep-research`** (codex-powered) on residual unknowns: codex-Chrome-extension unattended
   operation, multi-lane worktree failure modes, auto-merge + strict:false pipelining hazards,
   Greptile resolution API mechanics → `research/deep-research-<date>.md`.
4. **`/grill-with-docs`** over the draft SPEC → `research/decisions-locked.md` (queue-static/
   INDEX-status, 2+2 concurrency + verify mutex, closeout-rides-final-PR, frontend heuristic,
   budget table, ROADMAP lane-policy reading, park-and-continue).
5. **Flaky-test fix** (branch `fix/pglite-teardown-flake`): deterministic pool shutdown in the
   pg-external driver finalizer + bounded connect-retry in
   [SqlTest.pglite.test.ts](packages/tooling/test-kit/test-utils/test/integration/SqlTest.pglite.test.ts)
   (10× local proof; 2h timebox, else quarantine skip-with-issue). **This PR is the auto-merge dry
   run** — full pipeline: publish → monitor → closeout gates → `gh pr merge --squash --auto` →
   fresh-read merge verification → main-run watch.
6. **Greptile exercise on PR #409**: fix both P1 path-traversal findings (TaxonomyLoader.ts /
   TaxonomyRegistry.ts) via codex, reproduce-then-fix the manifest-decode finding, Fable-reviewed
   replies, resolve threads, re-gate, merge through the pipeline.
7. **Codex-Chrome QA smoke**: scripted unattended QA pass against a running app writing findings to
   `ops/qa-smoke/`; pass = no interaction, findings file, <10 min, twice. Fallback documented =
   claude-in-chrome lane (driver-serial).
8. **Exit criteria**: settings live + deny verified; auto-merge flag true; flaky PR merged via
   auto-merge; main `Test Integration` green; PR #409 merged; QA smoke proven (or fallback locked);
   packet skeleton goals-doctor-green.

### P1 — Scaffold + queue (one PR through the full pipeline)

Codex research sweep (background, ~1 agent per 6 packets) extracts dependency edges + PR units +
frontend flags from all 25 packet SPECs → `research/dependency-graph.md` → Fable locks
`ops/queue.json` (seed edges: semantic-foundation M1/M4 → legal-document-intake P4;
court-reporter-vocabulary → citation-extraction-engine; citation-verified-span-substrate →
law-doc-structure-oa-slice; uspto-* → law-docketing-patent-spine; epistemic-bitemporal-edge-core →
projection-dispatch-core). Author all packet files (SPEC modeled on
[repo-crispening-orchestration/SPEC.md](goals/repo-crispening-orchestration/SPEC.md), manifest from
[goals/_template/ops/manifest.json](goals/_template/ops/manifest.json)). Small ROADMAP amendment
(driver note + stale-row refreshes — not a rewrite; #407 already reconciled;
`beep lint roadmap-refs` becomes a queue-PR verification command). Ship via yeet with full gates.

### P2 — The drain loop (~1–2 weeks continuous)

Start driver: `/goal follow the instructions in goals/goal-portfolio-driver/GOAL.md` + `/loop`
self-pacing. Runs the §3 state machine at 2+2 concurrency until `queue ∩ INDEX.active` = ∅ or a
breaker fires. `ops/status.md` regenerated every wake is your dashboard; incidents park goals
without stopping the queue.

### P3 — Final audit

Fresh audit subagent (not the driver): every queue slug `completed-retained` with merged-PR
evidence; no open `goals/*` PRs; no leftover `lane-*` worktrees; incident ledger empty or
explicitly accepted → `history/outputs/LEDGER.md`.

### P4 — Close

Final state snapshot + LEDGER in the meta packet's own closing PR; `/reflect`;
`set-status goal-portfolio-driver completed-retained` (same-PR packet-state flip per repo law).

## Verification

- P0: each exit criterion is a fresh-read command (`gh api ... --jq .allow_auto_merge`, denied
  command blocked, `gh api repos/.../pulls/<n> --jq .merged`, main check-run conclusion, QA
  findings file exists).
- P1: `bun run beep goals doctor`, `beep goals index --check`, `beep lint roadmap-refs`,
  `jq . ops/queue.json`, full yeet proof on the scaffold PR.
- P2 (continuous): status.md heartbeat mtime; merge ledger cross-checked against
  `gh pr list --state merged`; INDEX active-count monotonically decreasing.
- P3: audit report + LEDGER.

## Additional recommendations (beyond your ask)

1. **Escalate-and-continue over stop-the-world**: parked goals + incident files keep the queue
   draining overnight; you adjudicate incidents in batches. This is the single biggest
   finish-probability lever.
2. **Closeout rides the final PR** (set-status + reflection in the goal's last commit) — INDEX can
   never claim completion for an unmerged PR, and the reflection lint can never block after the fact.
3. **The dry runs are real work**: the flaky-test fix and PR #409's security findings exercise every
   pipeline stage before the queue starts, on changes you'd want anyway.
4. Dual-Max window flips (your memory): the driver is resumable by design — switching accounts
   mid-run costs one recovery probe, nothing else.
5. Consider `delete_branch_on_merge=true` later (currently false) to stem branch accumulation from
   ~30+ loop PRs; left out of scope since it's a repo-settings mutation.
