# Harness Evidence Ledger Spec

## Objective

Make every harness edit a typed, queryable record, and let evidence about it
expire when the harness or model changes.

A harness is prompts + control flow + tools + skills/memory + context
management + subagents. The model is held fixed. This packet delivers:

1. Schemas in `@beep/ai-metrics`: `ContextSurface`, `MechanismClass`,
   `LedgerDisposition`, `HarnessFingerprint`, and `HarnessLedgerRow`, plus
   derived predicates (`isHarnessEdit`, `requiresBudget`, `isStale`,
   `isWarmRestart`, `editBudget`).
2. A single-writer CLI, `bun run beep harness-ledger`
   (`propose | disposition | list | prune-proposals`), that appends rows to the
   tracked `harness-ledger/rows/YYYY-MM.jsonl` surface.
3. A hook-pulse extension that records a hashed `ContextSurface` id when a
   session touches a skill or an always-loaded harness file.
4. Two scorer fixes: `EvalRecord.configSnapshotId` must hash the config
   fingerprint, not the score breakdown; `evaluateLaw` runs schema-first
   and Biome concurrently, followed by tsgo.
5. A rerun of the parked SkillOpt pilot with an annealed edit budget. Its
   results become the first ledger rows. Its surface census becomes the first
   pruning proposals.

## Relationship To RRSI

RRSI (arXiv 2609.24972 v2, 2026-09-23) is convergent prior art. The repo's own
packets predate it (see `research/SOURCES.md`). This packet ports three of its
mechanisms: the typed per-edit ledger row, evidence expiry by fingerprint, and
retention pruning. It reruns the pilot with an annealed budget, which is the
paper's cosine edit schedule applied to an existing tool.

It deliberately keeps two repo positions that differ from the paper:

- **Human admission.** The loop proposes. A human admits. Nothing is applied
  automatically to AGENTS law, skills, hooks, or settings.
- **Retention-side regularization.** We prune what stops earning its place.
  We do not narrow what may be proposed. The one exception is the rerun, which
  uses the pilot tool's existing budget knob as an experiment.

## Non-Goals

- Reopening `goals/skillopt-training-pilot`. It stays `completed-retained`
  with its PARK verdict. The rerun is new work in this packet.
- Adopting a trained skill. Any lift is evidence for a later human decision.
- Automating AGENTS.md, skill, hook, or settings changes. Pruning output is a
  proposal row, never an applied edit.
- AGENTS.md line-level pruning. It waits for line-level telemetry.
- Leakage critics, noise-band calibration, and cost-justified acceptance as
  shipped code. They may appear as rerun analysis, not as gates.
- Growing always-loaded context.
- Weakening any quality gate.
- Any new observability backend, UI, or agent framework.

## Source Hierarchy

1. The 2026-09-25 operator objective and the locked decisions below.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`schema-first-development`,
   `effect-first-development`, `yeet`, `reflect`).
3. `standards/ARCHITECTURE.md`; the no-paths telemetry doctrine in
   `standards/architecture/12-observability.md` and
   `goals/harness-otel-adoption/research/p0-attribute-contract.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/`, `ops/`, `history/`, and `harness-ledger/README.md`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/library/ai-metrics/src/`: new ledger and fingerprint
  schemas; `hook-pulse.ts` gains the `surface` field; `config-snapshot.ts` is
  reused, not duplicated.
- `packages/tooling/tool/cli/src/commands/HarnessLedger/`: the new command
  family, laid out like `commands/Goals/`.
- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/`: the
  `EvalRecord` and `EvalLawLanes` fixes.
- `.claude/hooks/hook-pulse.sh`: derive and hash the surface id.
- `tools/skillopt/configs/beeplaw.rerun-2026-09.yaml`: the rerun config.
- `harness-ledger/`: tracked, append-only rows. Written only by the CLI.
- This packet's `history/`: rerun outputs, analysis, and reflections.
- Cross-packet amendments: `goals/coding-agent-effectiveness-evidence-loop`,
  `explorations/context-rent-telemetry`, `goals/knowledge-freshness-audit`.

## Constraints

- Design order is schema, then service contract, then implementation.
- Effect v4 only. Use `LiteralKit` for literal domains and effect `HashSet` /
  `HashMap`, never native `Set` / `Map`.
- Rows never carry paths, secrets, prompts, tool arguments, or personal data.
  Surfaces are hashed ids.
- Rows are immutable. A disposition change appends a new row that references
  the prior `rowId`.
- Evidence expires by fingerprint, not by date. An ordinary code commit does
  not expire evidence. A model change or a harness-surface change does.
- The machine proposes. A human admits.
- The rerun runs locally and detached, overnight at most, with full-log
  capture. It never runs inside a Codex sandbox.
- This repo is public. Nothing from the out-of-repo corpus enters rows,
  fixtures, or history.

## Locked Decisions

All decisions were locked in the 2026-09-25 grill-with-docs session. Text is
reproduced from the session plan.

### D1 (2026-09-25): Scope

- **Question:** Which of the paper-derived pieces does this work cover?
- **Answer:** All four, pilot rerun first. Ledger row schema, retention-side
  pruning, fingerprint expiry, SkillOpt pilot rerun. Sequenced so the rerun
  writes the first rows.
- **Rationale:** The rerun is the cheapest first experiment and gives the
  ledger real rows on day one.
- **Rejected:** schema-only; pilot-only.

### D2 (2026-09-25): Admission

- **Question:** Who admits a harness change?
- **Answer:** Loop proposes, human admits. Keeps the evidence-loop lock
  ("never automate AGENTS/skill changes") and "metrics observational, never
  targets". Regularization guards what Benjamin sees, not what ships.
- **Rationale:** Preserves existing locked doctrine. The ledger informs a
  human; it does not act.
- **Rejected:** auto-admit in the pilot's target file; recursive for skills.

### D3 (2026-09-25): Fingerprint

- **Question:** What identity decides whether evidence is still valid?
- **Answer:** Fingerprint = model id + reasoning effort + content hash of
  always-loaded harness surfaces (AGENTS.md, skill files, hooks, settings,
  enabled MCP set). A model release or a harness edit expires evidence;
  ordinary code commits do not.
- **Rationale:** Distinguishes two harness edits under one model, without
  turning every commit into a new regime.
- **Rejected:** model+effort only (two harness edits indistinguishable);
  adding repo rev (every commit a new regime).

### D4 (2026-09-25): Vocabularies

- **Question:** Which vocabulary classifies an edit?
- **Answer:** Two LiteralKits. `ContextSurface` = repo surfaces (AGENTS law,
  skill, hook, pattern, MCP server, agent definition, settings, JSDoc) for the
  observed `touched` set; `MechanismClass` = the paper's K (prompt,
  control_flow, config, output_plumbing, context_mgmt, client_tool, skill,
  memory, subagent) for the declared class, so survival curves compare to the
  literature.
- **Rationale:** Observed surfaces fit this repo. Declared classes compare to
  published results.
- **Rejected:** either vocabulary alone.

### D5 (2026-09-25): Warm restart

- **Question:** What widens the edit budget again?
- **Answer:** Warm restart = model id change only. Budget resets to b_max and
  anneals again. Effort and harness-hash changes expire evidence but do not
  widen the budget.
- **Rationale:** A new model is a new regime worth broad exploration. Our own
  accepted edits should not re-widen the budget.
- **Rejected:** any component (every accepted edit re-widens); manual only.

### D6 (2026-09-25): Declaration

- **Question:** How does an edit declare itself a harness edit?
- **Answer:** Declaration via ledger CLI. `bun run beep <ledger> propose`
  writes the row (hypothesis, mechanismClass, fingerprint captured at
  creation); commit/PR trailer carries the row id; no row = product lane.
- **Rationale:** The fingerprint is captured when the edit is made, not
  reconstructed later. Rows stay queryable.
- **Rejected:** commit trailers only (free text, fingerprint reconstructed
  later); hand-authored packet files (not queryable).

### D7 (2026-09-25): Ownership

- **Question:** Which packet owns the work?
- **Answer:** New goal `harness-evidence-ledger` + amend three. The new goal
  owns LedgerRow/fingerprint/predicates, retention proposals, and the pilot
  rerun as its first vertical slice (`discoveredFrom` evidence-loop;
  `provides` the ledger). Amend evidence-loop P7 to consume the ledger
  (`requires`), flip context-rent-telemetry's resume trigger to this packet,
  cross-link knowledge-freshness-audit's expiry semantics. No reopen of the
  parked pilot (evidence-loop SPEC:24 forbids it).
- **Rationale:** One owner for the ledger. Existing packets consume it rather
  than fork it.
- **Rejected:** amend evidence-loop only; new exploration first.

### D8 (2026-09-25): Observing `touched`

- **Question:** How is the `touched` surface set observed?
- **Answer:** `touched` observed by extending hook-pulse with a hashed
  ContextSurface id on PostToolUse rows when toolName is Skill, or Read/Edit
  under AGENTS.md, `.claude/**`, `.patterns/**`. Obeys the no-paths doctrine
  (12-observability, p0-attribute-contract).
- **Rationale:** Reuses a live telemetry surface and keeps paths out of rows.
- **Rejected:** post-hoc transcript scanner; both.

### D9 (2026-09-25): Pruning scope

- **Question:** What do pruning proposals cover first, and over what window?
- **Answer:** Pruning proposals: skills + hooks + MCP servers first; window in
  sessions (default 30, tunable) under the current harness hash; proposals
  only, never applied. AGENTS.md lines wait for line-level telemetry.
  Amended below: hooks are out of scope until hook execution telemetry exists.
- **Rationale:** These surfaces are observable today. A session window
  tracks use, not the calendar.
- **Rejected:** skills only; all surfaces with a day window.

#### D9 amendment (2026-09-25)

Question: D8 stamps `surface` only on PostToolUse rows for Skill, `mcp__*`, and
file tools. Hook execution never stamps a hook surface, so an always-on hook
looks zero-touch in every window. Keep hooks in prune proposals?
Answer: no. Hooks are excluded from prune candidates until hook execution
telemetry exists; prune proposals cover skills and MCP servers only.
Rationale: a file-tool touch cannot tell an unused hook from one that runs on
every event, so every hook would be proposed for retirement every window.
Rejected: count a file Read or Edit of the hook as use (measures editing, not
execution); keep hooks and document the false positives.

### D10 (2026-09-25): Fingerprint home

- **Question:** Where does `HarnessFingerprint` live?
- **Answer:** `HarnessFingerprint` lives in `@beep/ai-metrics`, composed from
  the existing config-snapshot hashes (sessionHash, baselineHash) + modelId +
  reasoningEffort. Repo rev is a sibling field on the row, not identity.
- **Rationale:** Reuses `config-snapshot.ts` instead of a second hasher.
- **Rejected:** reuse AgentConventionControls (command-owned, carries
  repositorySnapshot); standalone hashing (duplicates config-snapshot.ts).

### D11 (2026-09-25): Rerun parameters

- **Question:** What does the pilot rerun change?
- **Answer:** Rerun params: cosine 4→1, 3 epochs, workers 4, Opus optimizer,
  codex_exec target. Same 8/4 split and scorer as P5. The target is amended
  to claude_code_exec by the D14 amendment below.
- **Rationale:** Tests the two levers the pilot's FINDINGS named (bigger edit
  budgets, parallel workers) and holds everything else fixed.
- **Rejected:** 3→1/2 epochs/Sonnet; autonomous scheduler.

### D12 (2026-09-25): Slug

- **Question:** What is the packet slug?
- **Answer:** Slug `harness-evidence-ledger`.
- **Rationale:** Names the durable artifact, not the paper.
- **Rejected:** harness-regularization; rrsi-harness-ledger.

### D13 (2026-09-25): Ledger home

- **Question:** Where do rows live?
- **Answer:** Tracked `harness-ledger/` at repo root, append-only jsonl by
  month (`harness-ledger/rows/YYYY-MM.jsonl`), same laws as `research/`
  (append-only, immutable rows, machine proposes / human admits) with its own
  writer (the ledger CLI).
- **Rationale:** A repo-level surface that outlives this packet, with a
  single writer.
- **Rejected:** packet-local; under research/ledger (single-writer conflict).

### D14 (2026-09-25): Rollout target

- **Question:** Which agent runs the rerun rollouts?
- **Answer:** Rollout target codex_exec (P5 parity; Codex is logged in as of
  09-25).
- **Rationale:** Keeps the subject under test identical to the pilot.
- **Rejected:** claude_code_exec (changes the subject under test); both arms.

#### D14 amendment (2026-09-25, later the same day)

Question: the Codex pool reported its usage limit exhausted until 2026-10-02 after three
launch attempts, so the `codex_exec` target could not run. Proceed how?
Answer: switch the rollout target to `claude_code_exec` with the `opus` alias now.
Rationale: the run computes its own baseline, so before/after within the run stays valid; only
comparability to P5's 0.4714 baseline is lost. Rejected: hold until Oct 2 (loses a week);
the CLIProxyAPI Codex leg (may share the same account limit).
Adapter change: the candidate skill is mirrored at `.claude/skills/` next to `.agents/skills/`,
and the Claude tool allowlist includes Edit/Write (the harness default is Read,Bash).

### Routine calls (2026-09-25, made without asking)

- Disposition LiteralKit = proposed | accepted | rejected | deferred | waived |
  tombstoned (union of evidence-loop and paper vocabulary).
- Fix the `EvalRecord` `configSnapshotId` defect in this slice. It hashes the
  score breakdown, not config, which blocks fingerprint integrity.
- Two PRs. PR1 = packet + schemas + CLI + hook-pulse + scorer fix + rerun
  config. PR2 = rerun results + first rows + pruning proposal output.

## Derived Predicates

| Question | Predicate |
| --- | --- |
| Is this a harness edit? | `touched` (observed context surfaces) is non-empty, decided after the fact. |
| Does the edit budget apply? | `hypothesis` is `Some`. |
| Is this evidence stale? | `fingerprint` differs from the current fingerprint. |
| Is this a warm restart? | The model id changed. Nothing else counts. |
| Did a mechanism hold up? | Its `mechanismClass` survives across fingerprints. |

## Acceptance Criteria

- [ ] Schemas decode and round-trip; predicates have unit tests, including
      `isWarmRestart` false on effort-only and harness-only changes.
- [ ] `harness-ledger propose` writes one immutable row; `disposition`
      appends a new row referencing the prior `rowId`; `list` shows both.
- [ ] Editing a skill file flips `isStale`; changing only the model id flips
      `isWarmRestart`.
- [ ] A session that invokes a Skill emits a hook-pulse row with `surface`
      set; a product-only session does not. No path appears in any row.
- [ ] `evals score` records a `configSnapshotId` that changes with AGENTS.md
      or an injected candidate skill outside the repo, and not with the score.
- [ ] Scorer wall time per task drops against P5's roughly 2 minutes.
- [ ] The rerun completes; results, first ledger rows, and
      `prune-proposals --window 30` output land in PR2.
- [ ] Both PRs reach mergeable through Yeet. A reflection exists.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/harness-evidence-ledger/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/harness-evidence-ledger/ops/manifest.json` | Passes |
| Packet lint | `bun run beep lint goal-packets` | Passes |
| Goals doctor | `bun run beep goals doctor` | No finding for this packet |
| Reflections | `bun run beep lint reflection-artifacts` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/ai-metrics` | Passes |
| Whitespace | `git diff --check -- goals/harness-evidence-ledger harness-ledger` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- A row or telemetry field would carry a path, prompt, tool argument, secret,
  or corpus content. Stop and redesign the schema.
- A change would apply a harness edit without human admission.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
