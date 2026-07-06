# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape

### 2026-07-05 — deep-research sweep (LANDED, reconciled)

Full adversarially-verified report (11 findings, 23 sources, 105 agents):
[`research/deep-research-report.json`](./research/deep-research-report.json).
**Reconciliation verdict: zero contradictions with locked DECISIONS; strong
validation + 5 refinements** (logged in DECISIONS → deep-research
reconciliation). Highlights:

- **[high] Layered CLAUDE.md is native & lazy** (root+ancestors at launch,
  per-subdir on touch) — validates keep-9 nested files + symlink fixes.
- **[high] Context files are a weak aggregate lever** (ETH/LogicStar, SWE-bench
  + AGENTBENCH): explicit imperative rules followed 1.6–2.5×, but repo-overview
  prose adds >20% inference cost with no success gain → instruction files =
  terse non-inferable laws only, delete tour prose.
- **[medium] Size/splitting are cost levers, not compliance levers** (1,650
  Claude Code sessions; Bayesian null BF10=0.096) — surgery justified by
  tokens, not adherence.
- **[medium] Within-session decay is the dominant compliance failure**
  (~5.6% lower odds per generated function; median first omission at 4th) —
  remedy is hooks/linters/CI re-surfacing rules, not prose → elevates C4 hooks
  + lint-rule codification.
- **[high] Context rot is real** (Anthropic + Chroma 18-model study) —
  just-in-time loading, lightweight identifiers.
- **[high] Skill budget rules** (Anthropic docs, verified live): <500-line
  SKILL.md, references ONE level deep, TOC for >100-line reference files,
  executable scripts over prose, short keyword-led descriptions (description
  truncation at ~1% context budget with many skills).
- **[medium] headroom verified real** (57k stars, v0.30.0 2026-07-03; 60–95%
  vendor-claimed, content-type-dependent) — pilot-measure verdict stands.
- **[medium] Prune+summarize evictions** design point (91.6% vs 79.0% at 3.4%
  overhead); "pruning alone is free" REFUTED.
- **[high] Official typescript-lsp plugin** (`/plugin install
  typescript-lsp@claude-plugins-official`) for symbol navigation — new cheap
  trial candidate; monorepo false-positive + memory caveats.
- **[high] Read-only PR remote cache is THE verified poisoning control**
  (turbo #1188/#6624; flag in 2.10.3); HMAC artifact-signing-as-mitigation
  REFUTED 0–3. Mercari measured ~50% turbo task-duration cut from shared cache.
- **[medium] Blacksmith economics**: the 2× speed multiplier, not the
  $0.004/min rate, drives savings — evaluate runner sizing by measured
  wall-clock (validates D6 design).

Known prior signal (user-supplied): [headroom](https://github.com/headroomlabs-ai/headroom)
as a candidate context-optimization tool — evaluation gated on measured benefit
(see BRIEF rabbit holes).

### 2026-07-05 — SkillOpt (user-flagged, verified)

[microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) — **MIT**, v0.2.0
(2026-07-02), 10.8k stars, `pip install skillopt`. Text-space optimizer:
skill doc = trainable state; optimizer model proposes bounded
add/delete/replace edits, accepted only on strict held-out-validation
improvement; deploys a compact `best_skill.md` (**300–2,000 tokens**).
Benchmarked inside Claude Code (+19.1 pts) and Codex CLI (+24.8) harnesses;
artifacts transfer across the two — our exact dual-runtime shape. v0.2.0
adds SkillOpt-Sleep (nightly offline self-evolution behind a validation gate).
Sources: [repo](https://github.com/microsoft/SkillOpt) ·
[MSR blog](https://www.microsoft.com/en-us/research/blog/skillopt-agent-skills-as-trainable-parameters/) ·
[docs](https://microsoft.github.io/SkillOpt/docs/guideline.html).

Implications for this packet: (a) the 300–2,000-token optimal band
independently validates the heavyweight-skill restructure targets
(audit-skills-economy.md); (b) restructured SKILL.md cores should be single
self-contained optimizable documents to stay SkillOpt-compatible; (c) an
actual SkillOpt training loop requires a scored repo-task eval suite — the
infrastructure the absorbed `agent-effectiveness-phoenix-enrichment` scope
pointed toward — recommended as a named successor goal, not this PR.

## In-Repo Capability Inventory

### 2026-07-05 — three-agent baseline sweep

Full reports (this packet's primary in-repo grounding):

1. [`research/baseline-agent-config.md`](./research/baseline-agent-config.md) —
   instruction files (root CLAUDE.md 55 lines / AGENTS.md 62 lines,
   **11 rules Claude-only / 18 Codex-only**, no contradictions), 14 nested
   instruction files (142KB), 29 skills (533KB; heavyweights:
   effect-first-development 34.7KB, turborepo 28.5KB, atom-reactivity 28.3KB),
   `.claude/settings.json` (no hooks, no allowlist), `.codex/config.toml`
   (mirrors skills-lock.json), plugin surfaces, goal/exploration overlap scan.
2. [`research/baseline-pipeline.md`](./research/baseline-pipeline.md) —
   yeet phase anatomy (Planner/Handler/Closeout), quality lanes, turbo.json
   (task-scoped inputs, futureFlags), CI lanes/runners, **YEET_TURBO_CONCURRENCY=3**,
   PR remote cache disabled (CSF-001), prior optimization ledger
   `goals/repo-quality-throughput` rqt-001..010 with measured deltas and named
   remaining bottlenecks.
3. [`research/baseline-review-merge.md`](./research/baseline-review-merge.md) —
   closeout gate anatomy (`PrCloseoutGateName`: hosted-checks | review-threads |
   greptile | coderabbit | chatgpt; none GitHub-required), merged-PR cycle data
   (size↔duration correlation), worktree standard vs duplicate-clone drift,
   workstation profile (32c/64t, 128GB), Blacksmith runner labels (2/4 vCPU).

Key bricks to compose (not rebuild):

- `packages/tooling/tool/cli/src/commands/Yeet/internal/{Planner,Handler,Closeout,Status}.ts` — phase planning, gates, status surfaces (extend).
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` — lane definitions (extend with parity lanes).
- Turbo `--summarize` JSONs + `beep ci append-turbo-summary` — existing timing substrate for Phase-D instrumentation (reuse).
- `goals/repo-quality-throughput/` — rqt numbering, proof-parity-map.md, measured-delta reporting conventions (reuse conventions).
- `standards/git-worktrees.md` — bootstrap checklist the `beep worktree` helper automates (reuse as spec).
- beep CLI command framework (`packages/tooling/tool/cli/src/commands/*` pattern) — home for the NET-NEW `Worktree` command.
- `skills-lock.json` hash pinning + `.codex/config.toml` mirror — must be re-pinned after skill restructuring (reuse).
- NOT FOUND: any single-source generator for CLAUDE.md/AGENTS.md (NET-NEW); any yeet phase wall-time surface (NET-NEW, thin — substrate exists); any worktree helper command (NET-NEW).

### 2026-07-05 — targeted verifications (inline)

- **Turbo 2.10.3 (pinned) natively supports read-only remote cache**:
  `--remote-cache-read-only` ≡ `--cache=remote:r;local:rw` (verified via
  `bunx turbo run build --help`). The CSF-001 amendment (DECISIONS →
  pr-turbo-cache-policy) is implementable exactly as decided, no version bump.
- **PR #291 gate status** (21:5x–22:0xZ): still OPEN; 4 checks failing
  (Build And Test, Lint Policy, Docgen, Codegen Drift); codex iterating
  (`318e5f280d fix(ci): close PR quality follow-ups` in ../beep-effect2).

### 2026-07-05 — audit deepening (LANDED)

Workflow `wf_5e468257-0f6` complete. Reports:
[`research/audit-nested-instructions.md`](./research/audit-nested-instructions.md)
and [`research/audit-skills-economy.md`](./research/audit-skills-economy.md).
Headlines: nested census is **77 real files + 53 symlinks** (~28.9k tokens);
verdicts keep 9 / shrink 21 / merge 1 / **delete 46** (~12k tokens
recoverable) with the CreatePackage `.hbs` templates as the regrowth root
cause; skills corpus 66.7k tokens with 3 heavyweights = 34%; **two config
bugs found** (crispen unpinned in skills-lock.json; quality-review-fix-loop +
onepassword-secret-refs registered twice in the live skill list); 10 skills
GitHub-pinned (turborepo restructure needs a fork/convert-to-local decision);
confirmed stale/wrong nested guides (workspace/server + use-cases claim
WorkItem, postgres↔pglite contradiction, explorations/AGENTS.md mandates the
retired repo-exports catalog).

## Constraints Discovered

- **PR #291 gate**: codex/yeet-verify-repair must merge before code-touching phases (in-flight main-green work, ../beep-effect2).
- Hosted gitleaks reads BASE-branch `.gitleaks.toml` on PRs (deliberate anti-tampering design, check.yml:556-593) — any allowlist change must land on main first.
- rqt-010 gate: external tooling swaps (oxlint/rolldown/etc.) are waived until isolated proof — this packet inherits that discipline.
- GOAL.md launcher hard cap 4,000 chars (goals/README.md).
- `yeet verify` leaves check-mode fallow envelopes that can poison the next run (`rm -rf .beep/fallow` recovery) — Phase-D parity work must not worsen this.
- Effect class idioms are structurally incompatible with `isolatedDeclarations` (measured 2026-07-05, REPO_RATING.md §3) — not a lever for this packet.
