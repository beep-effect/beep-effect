# Prior-Ritual Lessons for Knowledge-Surface Automation

Date: 2026-07-31. This is archaeology, not a claim that every cited runtime or
hosted service remains live. “Survived” means the contract or mechanism remains
in the current tree; “abandoned” includes explicit deferral, deletion after
distillation, or a required closeout whose completion was never recorded.

## 1. Per-source summary

### Agent Effectiveness Loop

- **Ritual.** Four read-only research lanes narrowed into a small trust-gate:
  doctor, metadata-only annotation plan/check, deterministic bundles, and a
  Phoenix sync that defaults to dry-run and requires confirmation for writes.
  Optional evidence could be `unavailable` without becoming fake success.
  (`goals/agent-effectiveness-loop/SPEC.md:91-175`;
  `goals/agent-effectiveness-loop/history/outputs/phase1-live-proof.md:1-65`)
- **Conclusion.** The repo owns semantics and privacy; Phoenix is an optional
  observation/evaluation tool. Phase 1 closed with hosted, review, privacy, and
  no-mutation proof without manufacturing a live backend write merely for
  closeout. (`goals/agent-effectiveness-loop/history/outputs/phase1-closeout.md:7-37`)
- **Survived / abandoned.** Typed report states, guarded sync, privacy checks,
  scorer, and manual-before-CI survived. Two enrichment/integration successor
  packets were deleted after that constraint was distilled into
  `goals/agent-pipeline-velocity/history/absorbed-constraints.md:1-7`.

### Agent Pipeline Velocity

- **Ritual.** One PR consolidated root instructions behind a drift gate, moved
  detail into progressive-disclosure skills, curated permissions/review bots,
  instrumented Yeet steps, aligned local/hosted work, and added worktree tooling.
  It prohibited net growth of always-loaded context and required measurement
  before optimization. (`goals/agent-pipeline-velocity/SPEC.md:3-27,55-64`;
  `goals/agent-pipeline-velocity/README.md:3-58`)
- **Conclusion.** Root Turbo concurrency 16 was slower than 3; bounded grouping
  of independent lint-policy work reduced 142.4 seconds to 32.3 seconds. The
  lesson was to optimize measured critical paths, not concurrency as a slogan.
  (`goals/agent-pipeline-velocity/history/rqt-ledger.md:3-51`)
- **Survived / abandoned.** Generated instructions, roughly 150 KB less context,
  progressive skills, timings, and `beep worktree` survived. Prose-pinning tests
  proved fragile, and generator/oracle fixtures could not safely be deleted as
  boilerplate. (`goals/agent-pipeline-velocity/history/reflections/2026-07-05-claude.md:39-71`)
- **Drift left behind.** The manifest and README say complete while `PLAN.md`
  still says active/P0. This is exactly the kind of freshness contradiction the
  new gate must catch. (`goals/agent-pipeline-velocity/ops/manifest.json`;
  `goals/agent-pipeline-velocity/README.md`; `goals/agent-pipeline-velocity/PLAN.md:1-16`)

### AI Metrics Stack

- **Ritual.** Privacy-safe discovery, config snapshots, encrypted raw archives,
  DuckDB/Parquet derivation, OTLP/Phoenix, labels, benchmarks, scorecards,
  scheduled proof, and a sanitized mirror. Its key epistemic contract separated
  real, synthetic, unavailable, and not-scored evidence.
  (`goals/ai-metrics-stack/SPEC.md:75-152,183-203`)
- **Conclusion.** Fresh review found flattened subagents, source-starving budgets,
  configured paths presented as changed paths, neutral-looking placeholders,
  weak metadata privacy, and no owned scheduler/status. Repairs added source-aware
  coverage, actual diffs, `completionReady`, explicit gaps, allowlists, and an
  owned timer/lock/retry/status surface.
  (`goals/ai-metrics-stack/history/outputs/p6a-fresh-review-hardening.md:17-88`)
- **Survived.** Schema-first CLI/library contracts, raw/derived separation,
  privacy, explicit availability, guarded mutation, and owned status artifacts.
  Optional providers and dashboards stayed non-blocking.
  (`goals/ai-metrics-stack/history/outputs/p7-topology-first-production-plan.md:33-80,161-223`)
- **Unclosed.** No credited seven-day/P7e closeout is recorded. Later P7f work
  found a Parquet regression, swallowed causes, about 5.43M turn rows versus
  roughly 516K distinct event hashes, and oversized transactions. Volume was not
  identity, idempotence, or lifecycle proof. (`goals/ai-metrics-stack/PLAN.md:129-156,192-242`)

### Goals Doctor and `goals-doctor.baseline.jsonc`

- **Ritual.** A census led to canonical manifest schema/status, one `set-status`
  writer, idempotent migration, generated index, doctor, drift checks, and Yeet
  integration. Migration decoded all 83 manifests and left none parked.
  (`goals/goals-doctor/SPEC.md:60-122`;
  `goals/goals-doctor/history/p0-oracle.md:8-43`;
  `goals/goals-doctor/history/p2-oracle.md:8-38`)
- **Baseline mechanics.** Migrate first, then capture inherited findings. Stable
  keys classified introduced/inherited/resolved; introduced blocked, inherited
  advised, and resolved prompted shrink. Synthetic corruption proved fail and
  revert-to-pass in the enforcing lane. (`goals/goals-doctor/history/p3-oracle.md:8-71`)
- **Burn-down.** The sealed population fell 36→26→13 as statuses were corrected
  or packets removed; the current 13 keys are debt, not a fresh snapshot.
  (`goals/goals-doctor/history/reflections/2026-07-11-claude.md:128-149`;
  `goals/goals-doctor.baseline.jsonc:1-19`)
- **Survived / weakness.** Manifest-derived lifecycle, generated index, one
  writer, doctor, and ratchet survived. Shrink-only remains procedural: the
  current `--write-baseline` serializes all present blockers and could absorb new
  keys. (`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:664-679,773-798`)

### Quality Gate Ratchets

- **Ritual.** Declared-but-toothless coverage, Knip, JSDoc, boundary, and commit
  checks became committed-baseline gates plus default-branch protection. Every
  gate had to fail on a synthetic regression and pass after revert.
  (`goals/quality-gate-ratchets/SPEC.md:3-16,44-64`;
  `goals/quality-gate-ratchets/history/gate-proofs.md:1-18`)
- **Conclusion.** A checker that has never run in its enforcing lane is not a
  gate. Integration caught real defects; isolated rechecks distinguished defects
  from shared-tree races and runtime artifacts.
  (`goals/quality-gate-ratchets/history/gate-proofs.md:20-47`;
  `goals/quality-gate-ratchets/history/integration-notes.md:1-38`)
- **Survived / cautions.** Regenerable fail-on-growth/drop baselines, two-way
  fixtures, hosted enforcement, and branch protection survived. Line-keyed
  inventories must be generated last; environment-sensitive checks need the real
  runtime matrix; mutators and scanners must not race.
  (`goals/quality-gate-ratchets/history/reflections/2026-07-06-claude.md:93-109`)

### Fallow Advisory Ratchets

- **Ritual.** “New debt fails,” but only after policy, false-positive, and
  baseline questions close. Deterministic boundary-config freshness became hard;
  analyzers, security preview, and fix preview remained advisory. Health and flags
  lacked calibrated registries. (`goals/fallow-advisory-ratchets/SPEC.md:3-16,58-113,143-150`)
- **Survived / abandoned.** Packet validation and boundary-config freshness
  survived; the duplicate ratchet was retired. Health inventory, flag registry,
  raw analyzer promotion, and later lanes were deferred pending a concrete
  regression trigger. (`goals/fallow-advisory-ratchets/README.md:9-19,49-72`;
  `goals/fallow-advisory-ratchets/tasks/tasks.jsonc:68-100,143-210`)
- **Conclusion.** Mixed shipped/deferred work under one phase lied to the index;
  ledgers may say `deferred`, but manifest phase status must stay canonical.
  Speculative inventories aged without earning their calibration cost.
  (`goals/fallow-advisory-ratchets/history/reflections/2026-07-14-claude.md:25-70`)

### `tools/skillopt`

- **Ritual.** No README exists in the current directory. This is a pinned,
  unpublished Python/uv SkillOpt 0.2.0 runner, not a supply-chain manager. It
  vendors missing wheel prompts, patches an upstream timeout bug, registers the
  `beeplaw` environment, and delegates. (`tools/skillopt/pyproject.toml:1-19`;
  `tools/skillopt/src/beep_skillopt/train.py:1-87`)
- **What it does.** The adapter loads task manifests, copies fixture workspaces,
  injects candidate skill text, invokes Codex, scores through the deterministic
  repo CLI, persists/resumes results, and offers a stub scorer. It does not track
  upstream identity, locks, licenses, pristine trees, or local patch series.
  (`tools/skillopt/src/beep_skillopt/adapter.py:157-389,489-608,637-740`)
- **Reuse / retire.** Reuse corpus contracts, scratch isolation, scorer bridge,
  resume ledger, timeout handling, and validation gates as an optional evaluator.
  Retire wheel monkey patches, prompt-copy materialization, Python authority, and
  auto-adoption: all six pilot candidates scored worse, so the gate kept baseline.
  (`goals/skillopt-training-pilot/history/p5-training/FINDINGS.md:16-60`)
- **Warehouse seed.** `beep skills update [--check]` already hashes installs,
  writes `skills-lock.json`, updates Codex config, and mirrors agent/Claude skills.
  It uses floating refs such as `main` plus content hashes and lacks pristine /
  patch / effective-tree separation. (`skills-lock.json:1-145`;
  `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:519-708,890-1007`)

### Memory Architecture Standard

- **Decision.** Deterministic curated files and exact records are authority;
  semantic systems are bounded, provenance-checked caches. Query the highest-
  certainty layer that can answer, with humans controlling promotion into file
  memory. (`standards/memory-architecture/README.md:3-24,34-42`;
  `standards/memory-architecture/01-memory-layer-taxonomy.md:6-25,144-149`)
- **Survived / abandoned.** Authority/projection/cache separation, provenance,
  review states, and repo ownership survived. Repo-memory v0 was explicitly only
  a learning vehicle; Graphiti progressed from read-frozen to retired after the
  bitemporal port; Cognee remains bounded operator memory, not product authority.
  (`standards/memory-architecture/04-decision-log.md:7-147`)
- **Live contradiction.** `06-agent-memory-operations.md` still tells agents to
  read Graphiti after the later decision closed that window. The standard itself
  demonstrates the need for contradiction/freshness gates.
  (`standards/memory-architecture/04-decision-log.md:20-38`;
  `standards/memory-architecture/06-agent-memory-operations.md:8-27`)

## 2. Cross-cutting lessons for permanent gates

1. A ritual sticks when it becomes the normal path: one owned command, typed output, actionable remediation, hosted enforcement, and branch protection.
2. Prove both directions: a passing fixture, a counterexample that fails, and revert-to-pass proof in the actual enforcing lane.
3. Measure before mutation. Read-only reports, dry-run defaults, and explicit confirmation expose policy mistakes before enforcement creates churn.
4. Use the narrowest truthful gate. Config freshness may block while a noisy analyzer stays advisory; a quiet run alone does not justify promotion.
5. Absence is data. Preserve `unavailable`, `not-scored`, and coverage; never substitute neutral placeholders, raw volume, or invented success.
6. Diff first, baseline second. Prevent new semantic debt without exemptions; seal the corpus only after the evaluator and identity are trusted.
7. A baseline needs stable keys, default-branch provenance, enforced shrink-only authority, resolved-key reporting, and relabeling defenses.
8. Capture baselines after intentional migrations, or migration noise becomes normalized debt. Prefer regenerable identities over source-line keys.
9. False-positive rate is a design input. Broad exemptions or path laundering mean the rule remains report-only until policy improves.
10. Derived surfaces stay derived: one schema-backed authority feeds statuses, indexes, graphs, mirrors, and dashboards deterministically.
11. Census before code, and protect oracles. Inventory consumers, identity, fixtures, and debt; boilerplate-looking files may be generator evidence.
12. Ergonomics determine adoption: causal grouping, exact labels, scoped reruns, bounded runtime, offline/shallow-clone behavior, and producer hints.
13. Time and human memory do not close rituals. Deadlines need owned status, freshness alarms, and machine-verifiable closeout transitions.
14. Delete obsolete packets only after transferring each live constraint to a named successor; otherwise cleanup destroys hard-won knowledge.

## 3. Direct implications per workstream

### A — clone-agnostic references

- Scan Git trees/archives, not the ambient filesystem; prove clean-clone,
  randomized-location, offline, and shallow-clone behavior.
- Start from normalized HEAD-minus-base findings. Classify real historical
  machine-bound evidence explicitly instead of blanket rewriting or exemption.
- Search generators, fixtures, manifests, and proof records before moves. A
  governed rename updates both path and `beep:ref` identity and rejects copies.
- Give generated targets producer identities and actionable regeneration hints.

### B — vendored-skill warehouse

- Extend schema-first `beep skills`; keep SkillOpt an optional evaluator after
  materialization, never a second Python source of truth.
- Lock immutable revision, license, pristine hash, ordered patch hash, and
  effective-tree hash; equivalence-check both generated skill targets.
- Derive the first line patches from pristine-versus-installed content. Graduate
  to semantic guides only after repeated upstream drift proves patches inadequate.
- Make per-skill updates resumable; persist conflict/hunk decisions, owners,
  labels, and drop conditions. Hand edits to outputs must fail `check`.

### C — self-proving docs

- Stage 1 is paired-archive semantic delta with no baseline writer; golden cases
  cover edits, reflow, renames, commands, assertions, fences, and spellings.
- Stage 2 may reuse stable-key classification, but baseline minting is CI-only at
  a reviewed default-branch SHA and rejects additions or key relabeling.
- Seed freshness fixtures from closed-manifest/active-plan and retired-Graphiti /
  live-runbook contradictions. Keep unknown evidence unknown and group cascades.
- Reuse domain doctors, require expiring owned suppressions, and use
  counterfactual target removal as the evaluator non-vacuity test.

### D — capability-derived roadmap

- Manifest status remains authoritative; folders, prose, Mermaid, and dashboards
  are projections. Deferred detail belongs in ledgers, not new status tokens.
- Add defaulted `provides`/`requires`, census/decode every packet, and generate the
  capability catalog instead of hand-maintaining another registry.
- Use disposable `bun:sqlite` plus a pure-TypeScript oracle; test AND requirements,
  multi-provider OR, collisions, cycles, fog nodes, completed providers, and status.
- One semantic projection feeds JSON/Mermaid/HTML. Readiness separates nominal
  manifest claims from tree-bound evidence receipts.

### E — packet bootstrap

- Follow census → pure schema compiler → deterministic plan → writes. Golden-test
  `compileMaterializationPlan` before exposing publish.
- One status/index writer serves bootstrap, graduate, adopt, and editor clients
  through the same `--plan --json` contract.
- Separate whole-file generated/authored ownership. Three-way rematerialization
  uses prior blobs and region hashes; uncertain adoption emits a reviewable patch.
- Validate an overlay before atomic no-replace publish; prove idempotent reruns,
  concurrent-target safety, fixture protection, and lineage preservation.

## 4. Contradictions with ratified decisions

1. **Stage 1 before baselines.** Quality Ratchets went directly to baselines and
   Goals Doctor migrated then baselined. The ratified order is now diff-scoped
   Stage 1 with no baseline machinery, then sealed Stage 2.
   (`goals/quality-gate-ratchets/SPEC.md:18-24`;
   `goals/knowledge-surface-automation/SPEC.md:14-24,133-164`)
2. **Baseline authority.** Goals Doctor says shrink-only, but its writer can absorb
   all current findings. CI-only sealing at a reviewed default-branch SHA
   supersedes that procedural trust. (`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:664-679,773-798`)
3. **No status folders.** Goals Doctor left archive moves open as a follow-up; the
   new decision rejects moves because status is manifest-derived and paths are
   durable. (`goals/goals-doctor/SPEC.md:24-33`;
   `goals/knowledge-surface-automation/SPEC.md:180-194`)
4. **`bun:sqlite` projection.** Memory architecture preferred FalkorDB for graph
   projection and AI Metrics used DuckDB. D instead requires disposable
   `bun:sqlite`, differential-tested against pure TS.
   (`standards/memory-architecture/04-decision-log.md:151-202`;
   `goals/knowledge-surface-automation/SPEC.md:180-212`)
5. **Patches before semantic guides.** SkillOpt rewrites whole skill prose and the
   updater overwrites from upstream. B preserves pristine source, applies ordered
   line patches first, and promotes only repeatedly fragile edits to guides.
   (`tools/skillopt/src/beep_skillopt/adapter.py:527-608`;
   `goals/knowledge-surface-automation/SPEC.md:43-54,98-125`)
6. **Immutable source identity.** `skills-lock.json` records floating `main` plus
   content hash; B requires immutable revision plus pristine snapshot. Drift
   detection is not provenance pinning. (`skills-lock.json:39-45,76-88,120-132`)
7. **Clone-agnostic history.** AI Metrics contains checkout-specific operational
   runbooks. A bans live host paths while C permits explicit historical-with-commit
   evidence, so migration must classify rather than blindly rewrite or exempt.
   (`goals/ai-metrics-stack/history/outputs/p6-proof-runner-isolation-and-runbook.md`;
   `goals/knowledge-surface-automation/SPEC.md:61-96,147-167`)
8. **Retired memory procedure.** The current decision retires Graphiti reads, but
   the operations runbook still instructs them. This is a blocking contradiction,
   not harmless history. (`standards/memory-architecture/04-decision-log.md:7-44`;
   `standards/memory-architecture/06-agent-memory-operations.md:18-27`)

## 5. Open questions worth grilling

1. What marker plus ancestor commit permits machine-bound historical evidence without laundering live guidance?
2. Which surfaces justify inline `beep:ref`, and what token/churn threshold forces a sidecar identity?
3. Does A block only new host references, or modified lines that retain inherited ones too?
4. Which customized external skill is B’s first adoption, with what immutable revision, license, and local divergence?
5. What repeated-breakage threshold promotes a line patch to a semantic guide, and who approves the change?
6. Must warehouse reconstruction be network-free from a committed pristine snapshot, or may CI fetch an immutable digest?
7. Who may mint or emergency-repair a Stage-2 baseline, and what audit prevents feature-branch debt laundering?
8. What finding identity survives Markdown reflow/rename without merging distinct claims, and what false-positive ceiling permits promotion?
9. What are capability slug granularity, collision, deprecation, alias, and substitution rules? Are providers OR while `requires` entries are AND?
10. Which Yeet lanes may mint evidence receipts, and how are receipts bound to tree, command, tool version, and result?
11. Which packet files are generated, authored, or adoptable, and how can a human correct ownership without losing rematerialization?
12. When planning races target creation or index regeneration, what atomic failure/retry behavior preserves concurrent work?
13. Do stale plan/manifest contradictions block in Stage 1, or begin as freshness findings until an authority hierarchy exists?
