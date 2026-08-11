# Add more strict planning & design requirements in goal packets & general exploration / goal packet improvements

Progress: 0%
Assignee: Benjamin Oppold
Status: Parking Lot
AI summary: Proposes a comprehensive redesign of goal‑packet handling that adds strict pre‑code design gates, separates lifecycle, readiness and run states, and makes packets event‑sourced with immutable journals and derived state. It introduces detailed design artifacts (exact file tree, symbol ledger, test design), traceable requirements, evidence receipts, deterministic generation, and tiered approval/automation mechanisms. The plan outlines architecture, schema, command extensions, implementation milestones, and key guardrails—ensuring traceability, reproducibility, cost‑effective gating, and integration with existing tooling while addressing current contradictions and failure modes.
Summary: Research-backed redesign (gated design, state machines, traceability, evidence receipts), an adversarial second pass (derive-don't-store, unforgeable approvals, ratchet adoption), and a third repo-grounded pass: unresolved stage/ownership contradictions, gate memoization via the existing docgen proof-manifest pattern, in-toto/Sigstore attestations, property-tested transition tables, and moving the design gate ahead of the lane slot.

Before any line of code is written for a goals implementation phase require the following.

- The exact file structure in `tree` format be determined before files are created. If during implementation an agent believes that an additional file is needed or would be optimal then the goal’s file tree artifact should be ammended with a reason logged in an appropriate canonical goal packet file. This also includes tests
- require that every modules symbol (types, interfaces, const’s, functions, classes, namespaces, etc) be pre determined before it’s written. If during implementation a coding agent believes that a symbol not already listed in the packets plan should be created first it must verify that such as symbol doesn’t already exist in the repo in a location that can be imported from without violating architectural boundaries. If no such symbol exists already then an amendment must be made to the pre determined list with a reason for its addition and a [OPPORTUNITIES.md](http://OPPORTUNITIES.md) item that provides a possible solution so that this doesn’t happen again.
- use html artifacts more

---

## Research synthesis — 2026-08-10

### Current baseline

The repository already has a strong foundation:

- `explorations/` is a six-stage fuzzy front end: capture → research → align → shape → decompose → graduate. It preserves raw capture, a provenance ledger, branch-closing decisions, a Shape Up brief, and a capability-aware goal map.
- `goals/` is a docs-as-code execution contract with `SPEC.md` as normative source, mutable `PLAN.md`, compact `GOAL.md`, a machine-readable manifest, evidence history, reflections, a generated portfolio index, and a PR-to-mergeable completion gate.
- `beep goals doctor`, `set-status`, generated `INDEX.md`, reflection lint, and Yeet integration already prevent several classes of lifecycle drift.
- The knowledge-surface automation packet already points toward the correct bootstrap architecture: a pure `compileMaterializationPlan`, `--plan --json`, prospective-overlay validation, atomic publication, immutable packet identity, content-addressed rematerialization, and exploration → goal lineage.

The remaining weakness is that the system is stricter about **packet shape and lifecycle labels** than about **design completeness, legal transitions, requirement traceability, and proof that the implementation matches the design**. Exploration validation is still conversational, goal phases are mostly free-form prose, and the generic template allows an agent to reach implementation without a mechanically checkable program-design contract.

### External patterns worth adopting

1. **Software Factory four-gate flow** — product intent → architecture → program design → vertical slices. The highest-leverage addition is the program-design gate: exact files, types/signatures, call stack, tests, and least-confident decisions are settled before implementation. Later discoveries reopen the owning gate instead of being silently improvised. [Source](https://gist.github.com/Maciejdziuba/88890d7e0eeefa5a8738bbe9fd5e20b8)
2. **Frequent intentional compaction** — separate research, planning, and implementation into fresh contexts; compact verified state to disk at every boundary; use sub-agents primarily for context isolation. Human review of research and plans has more leverage than reviewing a huge generated diff. [Source](https://www.humanlayer.dev/blog/advanced-context-engineering)
3. **OpenAI ExecPlans** — plans must be self-contained, living, novice-executable, outcome-focused, and updated with `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`. Each milestone must be independently verifiable. [Source](https://developers.openai.com/cookbook/articles/codex_exec_plans)
4. **Anthropic skill guidance** — use progressive disclosure, deterministic scripts, plan → validate → execute → verify, explicit feedback loops, and evaluation-driven skill development: baseline first, at least three representative scenarios, then the minimum instructions needed to improve results. [Source](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
5. **Matt Pocock’s small/composable skills** — separate user-invoked orchestrators from model-invoked disciplines; use tracer-bullet tickets with explicit blocking edges; review standards-conformance and spec-conformance as independent axes; make TDD, research, review, domain modeling, and debugging reusable primitives rather than one enormous process skill. [Source](https://github.com/mattpocock/skills)
6. **GitHub Spec Kit** — constitution compliance, clarification markers, structured tasks, safe parallel groups, pre-implementation gates, and checklists that act as unit tests for a specification. [Source](https://github.com/github/spec-kit)
7. **EARS requirements** — gently constrained forms such as “When `<trigger>`, the `<system>` shall `<response>`” expose missing preconditions and map cleanly to tests. [Source](https://alistairmavin.com/ears/)
8. **Durable workflow design** — deterministic replay requires append-only history, explicit side-effect boundaries, versioned transitions, idempotency, and recorded results rather than recomputation. These ideas transfer directly to resumable packet execution. [Source](https://docs.temporal.io/workflow-definition)
9. **Systems assurance** — bidirectional requirements traceability, milestone reviews, objective evidence, discrepancy ledgers, and closure of findings are standard ways to make assurance auditable rather than ceremonial. [Source](https://essp.larc.nasa.gov/simplex/pdf_files/NASA_SystemsEngineeringHandbookRev2.pdf)

## Proposed target architecture

### 1. Separate lifecycle, readiness, and execution state

Do not make one `status` field carry three meanings. Keep three orthogonal state machines:

| Axis | Suggested states | Meaning |
| --- | --- | --- |
| Lifecycle | `active`, `paused`, `completed-retained`, `superseded`, `reference` | Portfolio disposition; preserve the current closed vocabulary. |
| Readiness | `capture`, `grounding`, `aligned`, `shaped`, `designed`, `planned`, `ready` | How complete and approved the contract is. |
| Run | `idle`, `executing`, `blocked`, `verifying`, `reviewing`, `mergeable`, `closed` | What an execution attempt is doing now. |

Explorations use the readiness subset through `shaped`/`planned`; graduation requires `ready`. Goals begin at `designed` or `planned`, not automatically `ready`.

Every transition must be declared in one transition table with:

- legal source and target states;
- required artifacts and approvals;
- required evidence/oracles;
- side effects and generated projections;
- rollback/reopen target;
- idempotency key;
- transition schema version.

No agent may edit state fields directly. Use a single writer such as:

```bash
bun run beep packets transition <kind>/<slug> <event> \
  --expect-version <n> --plan --json
```

The write form should use compare-and-swap semantics, append an event, validate the prospective overlay, atomically publish, and regenerate projections. Repeating the same idempotency key must be a byte-identical no-op.

### 2. Make the packet event-sourced and replayable

Add an append-only `ops/events.jsonl` or equivalent typed ledger. The current manifest remains a compact projection, not the only historical record.

Each event should record:

- `packetId`, `runId`, monotonic `sequence`, schema version;
- previous and next state;
- actor/agent and toolchain version;
- source commit and worktree identity;
- input artifact hashes;
- decision/evidence references;
- timestamp supplied as explicit input;
- transition idempotency key.

`beep packets replay <slug>` should reconstruct the current projection and fail on a hash or transition mismatch. `doctor` should verify that replayed state, the manifest, README status, PLAN progress, and generated indexes agree.

### 3. Add a hard pre-code design gate

Create a normative `DESIGN.md` for execution-capable goals. No implementation code may be written until the packet reaches `ready` and the design gate passes.

Required sections:

1. **Architecture fit** — current components, target boundaries, dependency direction, public contracts, data ownership, external systems, and explicit reuse of existing repo capabilities.
2. **Exact change tree** — every file expected to be created, modified, generated, moved, or deleted, in `tree` form. Each row has owner, purpose, authored/generated status, and governing standard.
3. **Symbol ledger** — every proposed public or module-level type, schema, service, interface, function, class, constant, namespace, migration, and test fixture; include intended module, visibility, signature/shape, invariants, and reuse-search evidence.
4. **Call and data flow** — main-path call stack, error paths, state transitions, persistence boundaries, and side effects.
5. **Test design** — test names and assertions before bodies exist; identify the highest stable seam, fixtures, counterexamples, and failure-injection needs.
6. **Migration and rollback** — expand/contract sequence, compatibility window, data migration, rollback oracle, and removal condition for temporary code.
7. **Least-confident decisions** — ranked decisions requiring challenge before code.
8. **Approval record** — who approved, which artifact hash was approved, and when.

The original requirement on this page becomes a strict amendment protocol:

- A new file or symbol requires a typed `DesignAmendment` before creation.
- The amendment records discovery evidence, duplicate/reuse search, affected requirement/task/test IDs, updated file tree or symbol ledger, reason the design missed it, and an improvement opportunity.
- If the amendment changes architecture, scope, acceptance, or a locked decision, transition back to `designed` and require re-approval.
- Leaf amendments may proceed only after `beep packets amend --plan --json` validates the prospective design.

### 4. Make requirements test-shaped and traceable

Add stable IDs and typed records rather than prose-only checkboxes:

- `REQ-*` — requirement, preferably EARS-shaped;
- `DEC-*` — locked or superseding decision;
- `RISK-*` — risk and mitigation;
- `TASK-*` — independently verifiable vertical slice;
- `TEST-*` — executable oracle;
- `EVD-*` — immutable evidence receipt;
- `EXC-*` — exception/debt lease.

Every requirement must declare:

- source and rationale;
- preconditions/trigger/system response;
- positive and negative examples;
- verification oracle type: `command`, `test`, `inspection`, `human-approval`, or `external-system`;
- expected observable result;
- owning design element and task;
- risk/security/compatibility tags.

Generate a bidirectional traceability projection:

```
REQ → DEC/DESIGN → TASK → TEST → EVD → commit/PR
```

`beep goals trace <slug> --check` fails for orphan requirements, unproven acceptance criteria, tasks without a requirement, tests without an assertion target, or evidence captured against stale hashes.

### 5. Treat tasks as a dependency graph of vertical slices

Replace the generic “P1 Implement” phase with generated `ops/tasks.jsonc` or a schema-backed equivalent.

Each task contains:

- stable ID and outcome;
- blockers and safe parallel group;
- exact write surface;
- related requirements/design symbols;
- preflight and completion oracle;
- expected evidence path;
- context budget / “fits one fresh session” assertion;
- authority level and approval-required operations;
- retry/stop policy.

Default to tracer-bullet vertical slices that end in observable behavior. For wide mechanical refactors, require an explicit expand → migrate batches → contract plan. A task cannot start until its blockers are terminal and its input artifact hashes still match.

### 6. Upgrade verification from command lists to evidence receipts

A verification command is a promise; an evidence receipt proves it ran against a specific state.

Each receipt should contain command, cwd, source commit, environment/tool versions, relevant input hashes, start/end time, exit status, normalized output digest, and artifact paths. Secrets and private paths must be redacted by schema.

Require, when applicable:

- red-before-green proof or a counterfactual demonstrating the test would fail without the change;
- unit + integration + user-visible/live seam proof;
- property/model-based tests for state machines and parsers;
- mutation or fault-injection checks for high-risk logic;
- crash/restart and idempotency proof for durable workflows;
- clean-checkout regeneration with zero diff;
- spec-axis review and standards-axis review by separate read-only critics;
- unresolved-review-thread count = zero and merge state = clean.

Use a verification ladder: focused oracle first, affected-package checks second, full Yeet last. A failure must be classified as `introduced`, `inherited`, `unrelated`, or `environment-only`, with reproduction evidence.

### 7. Make generation deterministic by construction

All packet creation, graduation, adoption, amendment, and transition commands should share these laws:

- pure compiler from decoded input to a materialization plan;
- `--plan --json` on every mutating workflow;
- stable ordering and canonical serialization;
- clocks, random IDs, environment paths, and Git state supplied as explicit inputs;
- generated files fully generated and authored files fully authored—avoid mixed ownership regions;
- content-addressed previous versions for three-way rematerialization;
- prospective-overlay validation before any write;
- same-filesystem staged write + no-replace atomic rename;
- rerun with identical inputs produces identical bytes and no writes;
- fault-injection tests at every publish boundary.

This should extend, not duplicate, the already designed knowledge-surface automation Workstream E.

## Skills and specialized agents

Prefer one thin user-invoked orchestrator plus small model-invoked disciplines.

### User-invoked skills

- `/packet-design` — runs grounding → architecture → program design → slice planning and pauses at approval gates.
- `/packet-amend` — captures and validates a file/symbol/scope amendment; reopens the correct gate when necessary.
- `/packet-resume` — reconstructs state from the event ledger, verifies hashes, reports the frontier, and starts only one legal transition.

### Model-invoked skills

- `repo-grounding` — dated codebase inventory with `file:line`, exports, standards, and freshness.
- `symbol-plan` — duplicate search, import-boundary check, exact symbol ledger, and change tree.
- `requirements-compiler` — converts prose to typed EARS requirements and trace links.
- `test-oracle-design` — derives falsifiable tests, counterexamples, and non-vacuity checks.
- `packet-critic` — checks ambiguity, omissions, scope creep, contradictions, stale references, and unverified claims.
- `architecture-critic` — independently checks topology and dependency direction.
- `spec-review` and `standards-review` — separate read-only review axes.
- `evidence-distiller` — converts raw logs into bounded, schema-validated receipts without replacing raw artifacts.

Sub-agents should be used for isolated evidence gathering and independent criticism, not role-play. Critics are read-only; fixers have explicit non-overlapping write surfaces.

Every new skill must be evaluation-first: at least three realistic packet scenarios, a no-skill baseline, expected behaviors, multi-model runs, and a fail-closed adoption decision. Keep the skill body small and move detailed rules, examples, schemas, and scripts into progressive-disclosure references.

## Bootstrap and doctor commands

Suggested command surface:

```
beep explore bootstrap|doctor|transition|graduate
beep goals bootstrap|doctor|design|ready|transition|amend|trace|verify|replay
beep packets diff|render|adopt|rematerialize
```

Important contracts:

- `bootstrap`, `graduate`, `adopt`, and `rematerialize` call the same compiler.
- `ready` is a guarded transition, not a status edit.
- `doctor --explain <finding-id>` returns the violated invariant, evidence, and exact safe remediation.
- `verify --plan --json` reports the minimum oracle ladder before execution.
- Unknown slugs, stale versions, missing artifacts, and illegal transitions return typed errors and never partially write.

## Proposed schema additions

At minimum, evolve the manifest with:

```json
{
  "packetId": "immutable-content-independent-id",
  "schemaVersion": "packet-manifest/v3",
  "revision": 7,
  "lifecycle": "active",
  "readiness": "designed",
  "runState": "idle",
  "sourceCommit": "<sha>",
  "artifacts": [],
  "requirements": [],
  "decisions": [],
  "risks": [],
  "tasks": [],
  "approvals": [],
  "evidence": [],
  "exceptions": [],
  "provides": [],
  "requires": [],
  "materialization": {
    "generatorRevision": "<sha>",
    "inputHash": "<sha256>",
    "outputHash": "<sha256>"
  }
}
```

Use IDs and references in the manifest; keep rich prose in owned documents. Generated projections should render a human-readable status page, dependency graph, traceability matrix, and current execution frontier.

## Definition of Done for this packet-system improvement

- [ ]  Goal and exploration manifests decode through one versioned packet core with kind-specific extensions.
- [ ]  All legal transitions are enumerated; every illegal transition has a fixture and typed error.
- [ ]  Exploration packets have a blocking doctor instead of conversational-only validation.
- [ ]  An execution-capable goal cannot enter `ready` without grounded architecture, exact change tree, symbol ledger, test design, vertical-slice task graph, approvals, and zero unresolved blocking questions.
- [ ]  File/symbol amendments are first-class, hash-linked, and can mechanically reopen the owning gate.
- [ ]  Requirement → design → task → test → evidence → PR traceability is complete and bidirectional.
- [ ]  Bootstrap/graduation/adoption/rematerialization are dry-runnable, deterministic, atomic, idempotent, and fault-injection tested.
- [ ]  State can be replayed from an append-only event history; manifest and prose projections are checked for drift.
- [ ]  Verification receipts are tied to exact commits and artifact hashes; stale evidence cannot satisfy a gate.
- [ ]  Program-design, requirements, oracle-design, critic, resume, and amendment skills have baseline evaluations and at least three representative scenarios each.
- [ ]  Three pilots pass: one small feature, one cross-package feature, and one migration/refactor with expand-contract sequencing.
- [ ]  The system self-hosts: the packet implementing these improvements is itself created, transitioned, verified, reviewed, and closed using the new machinery.
- [ ]  Measured outcomes are recorded: design amendments discovered after coding, verification reruns, review findings per changed line, context/session count, time to first failing oracle, time to mergeable, and packet drift findings.

## Recommended implementation order

1. **P0 — Invariant census and evaluation corpus.** Mine recent packet reflections and failures; encode representative bad/good fixtures before changing templates.
2. **P1 — Packet core schema and transition engine.** Add orthogonal state axes, typed events, legal-transition table, replay, compare-and-swap, and doctor diagnostics.
3. **P2 — Exploration enforcement.** Add `beep explore doctor`, guarded stage transitions, approvals, research freshness, provenance/license checks, and definition-of-ready enforcement.
4. **P3 — Deterministic materialization.** Land the already-designed compiler, dry-run JSON contract, atomic publish, adoption, graduation, rematerialization, and golden/fault tests.
5. **P4 — Program-design gate.** Add `DESIGN.md`, exact change tree, symbol ledger, amendment protocol, and `ready` guard.
6. **P5 — Traceability and evidence.** Add typed requirements/tasks/evidence, generated trace matrix, stale-proof detection, and separate spec/standards reviews.
7. **P6 — Skills and sub-agents.** Build minimal evaluated skills over the command surface; avoid a monolithic process prompt.
8. **P7 — Pilot, migrate, measure, ratchet.** Adopt three packets, compare against the evaluation baseline, fix false positives, then make the gates blocking in Yeet.

## Key guardrail

Strictness should mean **fewer silent decisions and stronger evidence**, not more prose. Anything a machine can derive should be generated. Anything requiring judgment should have an explicit owner, approval, and decision record. Anything claiming success should point to a reproducible oracle and immutable evidence receipt.

---

## Second-pass adversarial review — 2026-08-10

This pass re-grounded the proposal against the live repo and adversarial external literature. Verdict: the direction holds, but several mechanisms should change — some because beep-effect already owns better machinery, some because the first draft has exploitable holes.

### A. What the repo already has that the first draft missed (reuse, don't rebuild)

1. **OPPORTUNITIES.md is already a live convention** — but ad-hoc: `research/OPPORTUNITIES.md` exists in 7+ packets (speed-loop, knowledge-surface-automation, jsdoc-carrier-migration, coding-agent-effectiveness-evidence-loop, graphnosis-prior-art, fleet-coordination, legal-position-relator-runtime) with no shared schema and no fleet roll-up. The original page bullet links `[OPPORTUNITIES.md](http://OPPORTUNITIES.md)`, which renders as a bogus external URL. **Improvement:** schema-validate the per-packet file (fields: what happened / evidence / what would have prevented it / disposition / owner), generate a fleet-wide roll-up projection, and let design amendments write into it mechanically.
2. **A hash-chained append-only ledger already exists**: `agent-execution-authority`'s `ExecutionRecord` (write-ahead decision records chained per run, `ChainVerification` = `chain-intact | chain-broken` at first failing index, canonical JSON encoding, digests everywhere). Its doctrine is directly load-bearing for packet events: **a hash proves correspondence and ordering only — never that an action was authorized, truthful, or complete**; payloads are committed-to, never embedded; and mutable-looking state must have *no storable representation* (their "decided, outcome unknown" is a derived LEFT JOIN, deliberately unrepresentable).
3. **A JSONL event journal already exists with hard-won test cases**: Yeet's branch-scoped `AttemptJournal` (`YeetAttemptJournalEvent` tagged union) already solved crash tails (half-written final line → prior events + explicit tail warning), corrupt middle rows (surfaced, never skipped), concurrent writers (bounded append test; writer lock if it fails), dedupe by `(attemptId, _tag)`, and schema round-trip. The proposed `ops/events.jsonl` must adopt this exact test matrix instead of reinventing it — and be per-run or per-branch scoped, because parallel lanes and worktrees make one-append-only-file-per-packet a merge-conflict generator.
4. **A run-state machine already exists**: `goal-portfolio-driver` runs `QUEUED → LANE_SETUP → PACKET_REVIEW → IMPLEMENT → QUALITY_LOOP → CRISPEN → [FRONTEND_QA] → PUBLISH → PR_MONITOR → MERGED → DONE`, any state → `PARK`, with "never trust self-report," bounded verdict files, and budgets. The first draft's `runState` axis (`idle/executing/…`) competes with it. **Reconcile:** the packet system stores packet truth; the driver's loop state consumes it. Do not maintain two run vocabularies.
5. **Design gates have in-repo precedent**: `graph-3d-view` carries `research/DESIGN.md` + `DESIGN-REVIEW.md` + `VERIFICATION.md` with a conformance table and a *conditional* design gate; `_gold-intake` already runs review gates (critique `RESEARCH.md` before align; critique each graduated `SPEC.md` before quality proof). The 4-point graduation definition-of-ready already exists and has been exercised (explorations `EXAMPLE.md` session 6 — the gate caught an ambiguous answer and dropped back to align). The proposal formalizes and hardens existing practice rather than importing a foreign one.
6. **The adoption machinery is proven**: advisory → baseline-frozen ratchet → blocking flip (fallow / schema-first / jsdoc precedents; GRILL-DECISIONS #32: new gates born compliant, ratchet blocks baseline growth, existing debt migrates cleanup-on-touch). The first draft's "P7: make gates blocking in Yeet" should use this exact ratchet form.
7. **Dual-write drift is not hypothetical**: the template audit comment in `_template/PLAN.md` documents PLAN-vs-manifest phase-sequence contradiction inherited by 4 of 112 packets. And speed-loop's gate-value audit found doctor/index/reflection gates "valuable on packet changes but wasteful on ordinary code-only PRs" — with a standing rule that **no new always-on gate ships without a cost-vs-catch case**.

### B. Better solutions found

1. **Derive, don't store (biggest correction).** The first draft proposed three *stored* state axes. The ledger doctrine says derived states must have no storable representation — and the doctor's `phases-terminal-but-active` finding class exists precisely because two stored surfaces disagreed. **Better:** store only (a) lifecycle — a genuine human disposition decision, (b) the event log, (c) approvals. Compute readiness (`grounded/designed/planned/ready`) and run state as pure functions of events + artifact presence/validity + approvals. Drift between stored and derived state becomes unrepresentable; doctor's job shifts from "compare stored fields" to "verify the derivation inputs."
2. **Approvals must be unforgeable.** An `approvals[]` array inside the packet is editable by the very agent being gated — self-approval is one file edit away. **Better:** approvals ride the existing completion gate's trust anchor — a human-authored git commit containing the approved artifact hash, a GitHub PR review, or a signed trailer. The packet records only the *reference* (commit SHA / review URL) plus the hash approved. Autonomous-driver reconciliation: grill outcomes already land as docs-PRs before implementation PRs (knowledge-surface-automation practice) — that merged docs-PR **is** the pre-approval; the driver may only execute approved hashes, and any amendment beyond leaf scope triggers park + operator notify instead of re-approval.
3. **Extend the command surface, don't fork it.** A new `beep packets` group conflicts with `beep goals`, `beep explore`, and the already-designed knowledge-surface-automation Workstream E (bootstrap / graduate / adopt / rematerialize / `--plan --json`). **Better:** one internal packet-core library (transition table, event journal, derivation, trace projection) consumed by the existing `beep goals …` / `beep explore …` groups; `set-status` remains the single writer of lifecycle and becomes the only path for guarded transitions.
4. **Risk-tier routing instead of uniform four gates.** The external critique is blunt: uniform heavyweight process is BDUF rebranded, and process cost compounds ("spec-driven development: the rebranded BDUF"; hidden-costs analyses converge on full/light/none lanes). The gist already exempts trivial tweaks; beep already routes explorations vs goals. **Better:** explicit tier routing — full design gate for cross-cutting/high-blast-radius work, light gate (short spec + checklist) for medium, none for mechanical/trivial — with the tier decision itself recorded and challengeable.
5. **Timestamps: record both kinds.** The determinism law ("timestamp supplied as explicit input") fights auditability. **Better:** a logical timestamp as a hash input (determinism; the codex-findings skill precedent — capture date comes from the export filename, never the clock, so re-ingestion is byte-identical) plus an observed wall-clock advisory field excluded from hashes.
6. **Schema evolution policy from day one.** Event-sourcing literature (Overeem et al.; Akka/Pekko evolution docs) names event-schema evolution as the #1 practitioner pain: versioned events, weak-schema tolerance, upcasting, copy-and-transform. And never compact away history; projections are disposable working copies (Fowler). The event envelope needs `schemaVersion` + `eventVersion` per record, unknown-field tolerance on read, and a tested upcast path before the first v2 event exists.
7. **Traceability must be generated, never hand-maintained.** The decay literature (Mäder & Gotel) is unambiguous: hand-maintained trace links rot; semi-automated maintenance with continuous monitoring is the only durable form. **Better:** derive REQ→TASK→TEST→EVD links from things agents already produce — stable IDs in commit trailers, test titles, file paths — and have doctor *detect* decay continuously. A hand-maintained matrix decays into false confidence, which is worse than none (the jsdoc-carrier-migration packet shipped a conservation proof describing 146 blocks that no longer existed — orphaned evidence is a real failure mode).
8. **Metrics are observational, never targets.** Goodhart / specification-gaming research: agents find technically-compliant workarounds; what actually works is code enforcement plus hidden/holdout evaluation. Every DoD metric on this page (amendment counts, review findings per line, time-to-mergeable) is a telemetry output, never an optimization target, and every invariant must be enforced by the transition engine, not by prompt instructions.

### C. Footguns and failure modes to design against

- **Approval self-forgery** (B2) — the highest-severity hole in the first draft.
- **Gate cost compounding** — path-scope all packet gates to `goals/**` / `explorations/**` changes (speed-loop r4 recommendation); doctor reports its own runtime; each gate carries a measured cost budget; the loop becoming its own bottleneck is a standing stop signal (speed-loop closing rule).
- **Design doc bloat** — DESIGN.md needs the same treatment as GOAL.md: a size budget (GOAL.md caps at 4,000 chars; INDEX.md at ~25k tokens) with detail pushed to progressive-disclosure references.
- **Skill-count explosion** — the first draft sketched 8+ skills; Anthropic's guidance is minimal instructions, and the repo already deleted four zero-signal skills. Start with at most 2–3 evaluated skills (design-gate orchestrator, amendment, resume); everything else is command behavior.
- **Event-log merge conflicts and concurrent writers** — per-run/branch-scoped journal files, a union merge driver for JSONL, writer lock, crash-tail tolerance (A3's test matrix).
- **The self-hosting bootstrap paradox** — build v1 with the *current* process, then adopt the system onto itself first, using KSA's planned pattern: hash-pinned adoption patch + preservation report.
- **Capture-stage friction** — gates begin at graduate/ready boundaries only. `INBOX.md` and `CAPTURE.md` must stay zero-friction by design; interrogating capture kills the funnel.
- **Frozen-wrong-design risk** — a strict symbol ledger can lock in early mistakes. The least-confident-decisions list is the release valve: leaf amendments must be nearly free; only architecture/scope/locked-decision amendments reopen the gate.
- **Audit theater** — any link not continuously checked against live hashes is worse than no link (B7).

### D. Corrections to first-draft specifics

- `revision: 7` in the schema sketch is confusing — version belongs to the event-chain head; the manifest is a projection.
- Replace the stored `readiness`/`runState` fields with derivation (B1).
- Replace the `beep packets` command group with a shared packet-core library behind existing command groups (B3).
- Evidence receipts: capture non-vacuity/counterfactual proof **once at oracle creation** and again at gate runs — not on every verification run (cost).
- Events: not one `ops/events.jsonl` per packet — per-run/branch journal files plus a generated per-packet projection (A3).
- DESIGN.md location: packet root (peer of SPEC.md), size-capped, linked from GOAL.md's read-order — the graph-3d-view precedent hid it under `research/`.

### E. Open questions for the grill

1. Does readiness derivation live in doctor, or in a new `beep goals status --explain <slug>` that renders the derivation?
2. Event store: branch-scoped journals (Yeet-style) vs per-run files under `ops/events/` — which survives the driver's two edit lanes + worktrees better?
3. Which packet is pilot #1 — the KSA adoption case, or this packet-system improvement adopting onto itself?
4. What is the tier-routing rubric (which signals force full vs light gate), and who can override a tier with what record?
5. Does `OPPORTUNITIES.md` get promoted to a schema-validated canonical artifact with a fleet roll-up, and does the design-amendment protocol write to it mechanically?

---

## Third-pass review — internal contradictions, gate economics, flow — 2026-08-10

This pass targets what the first two did not: contradictions **inside** the existing packet system that any transition table must resolve before it can be written, a cost problem already solved by machinery in this repo, standards-based approvals, and the flow economics of adding gates to a WIP-capped pipeline.

### F. Contradictions in the current system that block a transition table

1. **`stage` is overloaded and self-contradictory.** `explorations/README.md` says the manifest "records the furthest stage reached" *and* that "the manifest `stage` remains the authoritative resume point, not file presence" — while the pipeline diagram sanctions backward loops (align → research on a research gap, shape → align on a reopened decision, decompose → shape on wrong scope). On any loop-back those two readings diverge. Ship both as derived values: `furthestStage` (monotonic high-water mark) and `resumeStage` (current cursor). Stop storing one ambiguous field.
2. **Artifact presence is not a readiness signal — this corrects pass 2's B1.** The same README explicitly sanctions pre-seeding: "A later-stage artifact may be pre-seeded when its content lands early." This is live practice, not theory — `explorations/legal-position-relator-runtime/DECISIONS.md` opens with a header stating the packet is still at stage `capture` and that the entries landed early from the packet-open session. Pass 2 proposed deriving readiness from "events + artifact presence/validity + approvals." Drop presence; keep validity. Readiness derives from **events and approvals only**.
3. **Surface ownership is declared for exactly two surfaces.** `docs/ROADMAP.md` states "Priority stays owned by this file; lifecycle stays owned by `goals/INDEX.md`." Nothing owns stage, `openQuestions`, ATLAS rows, README Next-Open-Question/Trail lines, or PLAN phase tables. The real drift surface count per packet:

| Surface | Kind | Should be |
| --- | --- | --- |
| `ops/manifest.json` | both | Owned — single writer (`set-status` / transition engine) |
| `goals/INDEX.md` | goal | Projected — already generated (`beep goals index --write|--check`) |
| README lifecycle / stage / Trail lines | both | Projected — regenerate the block, never hand-edit |
| `PLAN.md` phase table | goal | Owned prose, projected status column |
| `docs/ROADMAP.md` lane entry | goal | Owned (priority); `beep lint roadmap-refs` already checks refs |
| `explorations/ATLAS.md` | exploration | Projected — README already says it is "navigation, never doctrine" |
| `explorations/INBOX.md` | exploration | Owned — must stay zero-friction |
| Notion `Development Todo's` row | both | Non-normative mirror (see L) |

ATLAS is the clearest win: because it is doctrine-free by rule, generate it wholesale and lint that it contains nothing not derivable from manifests. That mechanizes the existing "if a sentence starts being load-bearing, move it" convention instead of leaving it to discipline.

### G. Gate cost is already a solved problem here — memoize, don't just path-scope

Pass 2 flagged gate-cost compounding and recommended path-scoping. Path-scoping is necessary but weak; the repo already owns the strong form.

- **The empirical case.** `speed-loop`'s gate-value audit measured the JSDoc ratchet at hosted p50 **289s**, p95 371s, with **0 failures in 88 runs** — and its verdict was to scope the inventory to affected barrel exports rather than delete the gate. That is the template: scope the *inputs*, keep the *catch*.
- **What exists and is broken.** Yeet's `--reuse-verified` is all-or-nothing. `assertReusableVerifiedState` accepts a saved proof only when branch, base, head, HEAD SHA, a `full` tier, **and** one whole-worktree SHA-256 fingerprint over `git status --short` + `git diff --binary HEAD` + `git diff --binary --cached` all match. Any tracked-file change invalidates every lane repo-wide. Per-lane `commandHash` entries are written to the state file and never read.
- **What exists and works.** `beep docgen check --reuse-proof-manifest` keys per-package on input/output file digests plus tool version. That is the pattern to copy, and it is already trusted in production.
- **Recommendation.** Every packet gate — doctor, `index --check`, trace check, design gate, reflection lint — emits and consumes a proof manifest keyed on `(packet subtree digest, tool version, gate id)`. On a code-only PR each packet gate collapses to a digest comparison. This converts pass 2's footgun from a policy problem into an engineering problem with an in-repo reference implementation. Note the unification: **a memoized gate result and an evidence receipt are the same artifact.** Build one thing, not two.

### H. Evidence receipts and approvals should be in-toto attestations, not a bespoke schema

- in-toto's ITE-6 envelope is exactly the shape pass 1 sketched: statement type, **subject** (artifact + digest), **predicate** (the claim). SLSA provenance is simply an in-toto attestation carrying a SLSA predicate, and the framework is explicitly designed for bundling heterogeneous claims — "two party code reviews, successful test runs, and so on." [Source](https://slsa.dev/blog/2023/05/in-toto-and-slsa)
- GitHub ships this natively via `actions/attest-build-provenance` and artifact attestations. [Source](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
- Sigstore `gitsign` gives keyless OIDC-identity commit signing, verifiable with `git verify-commit` and logged to Rekor — no long-lived keys in CI. [Source](https://github.com/sigstore/gitsign)
- **The repo already researched the TypeScript path.** `explorations/agent-execution-sandbox/research/04-external-tamper-evident-records.md` cites `sigstore-js` (Apache-2.0, including `@sigstore/rekor-types`) as a permissive port source, concluding that transparency-log client verification is viable natively in TS without a Go sidecar.
- **Recommendation.** Pass 2's "approvals ride a git commit" upgrades to: approval = a signed attestation with predicate `beep.dev/packet-approval/v1`, subject = the approved `DESIGN.md` digest. Verification is `git verify-commit` plus a digest compare. No bespoke crypto, no new trust anchor, no new vocabulary.
- **Carry the known failure mode.** The most common rollout mistake is generating attestations and never verifying them. The DoD needs a *verification* line, not a generation line.

### I. Property-test the transition table instead of hand-writing illegal-transition fixtures

Pass 1's DoD requires "every illegal transition has a fixture and typed error." Across three axes that is combinatorial, and hand-authored fixtures rot for exactly the reason pass 2 gave for hand-maintained trace links.

The machinery already shipped: `one-round-loop` P1 landed a property-law lane — `@beep/test-utils` `fcRuns(inline?)` returning `max(inline ?? 100, BEEP_FC_NUM_RUNS)`, a codemod that migrated 144/158 files and 211 `fc.assert` sites with the floor invariant proven by multiset equality, a `configureGlobal` floor in `vitest.setup.ts`, a per-PR affected lane at 400 runs, and a nightly sweep at 1000+.

**Recommendation.** Express the transition table as data and assert a handful of laws with fast-check over (state × event) instead of N² fixtures:

- every event from every state either transitions legally or returns the typed illegal-transition error — never a silent no-op;
- replaying an idempotency key is a byte-identical no-op;
- no terminal state has an outgoing edge except its declared reopen path;
- every state is reachable from init, and `PARK` is reachable from every state (the driver's existing rule);
- derivation is pure: the same event prefix always yields the same projection.

Hand-write fixtures only for transitions with interesting side effects. Full model-based generation from a TLA+/TLC state graph is the heavier next rung — proven to generate tens of thousands of conformance tests per second on real distributed systems — and is not warranted at this size yet. [Source](https://arxiv.org/html/2512.08698v1)

### J. Put the design gate before the lane slot, not inside it

`docs/ROADMAP.md` sets the funnel policy — shape freely, graduate only into a lane slot — capped at three concurrent thematic program lanes, while the driver runs two edit lanes, two monitor slots, one verify mutex, and serialized merges.

That makes the *placement* of the design gate a throughput decision, not a taste decision. Queueing theory is blunt: adding a stage to a WIP-capped pipeline raises cycle time and lowers throughput, and front-end variability has the worst impact of all. [Source](https://less.works/less/principles/queueing_theory) The agile literature makes the same point about this exact artifact — a definition-of-ready used as a stage gate is a named anti-pattern, and "in a Flow/Lean environment DoR is not a stage gate." [Source](https://www.mountaingoatsoftware.com/blog/the-dangers-of-a-definition-of-ready)

But in beep-effect the asymmetry cuts the other way: shaping is explicitly unbounded and off-lane, while lane slots are scarce. The same gate is nearly free before graduation and expensive after it.

**Recommendation.** Move the exact change tree and symbol ledger into `MAP.md` as a fifth graduation check, beside the existing capability check. `DESIGN.md` is then *seeded* at graduation the same way `SPEC.md` is seeded from `BRIEF.md` (no-gos → non-goals, rabbit holes → constraints), so the in-lane cost is a review pass, not an authoring pass. Goals that deliberately skip explorations — `quality-gate-ratchets` records "No exploration packet (deliberate)" with research and align satisfied by other artifacts — must author `DESIGN.md` in-lane, and that is precisely where pass 2's tier routing has to force an explicit, recorded decision.

### K. The scarcest resource is the operator — budget approvals like a lane

The proposal adds at least three human approvals per packet: design approval, tier assignment or override, and amendment re-approval. Against the driver's locked 25-slug queue that is roughly 75 synchronous interrupts on one person who is also working in the same tree mid-session — driver decision D3 already has the driver probe machine-wide and *defer* around the operator's own turbo/vitest/yeet processes.

The repo already knows how to batch this. Driver decision D1 has the operator approving an entire wave-2 queue "with one message," and `patent-citation-candor-gate` shows a whole shaped design approved in a single dated entry after a three-lens adversarial review folded 24 findings in first.

**Recommendation.**

- **Pre-authorize by policy.** Auto-approve when tier is light-or-below, blast radius is under a declared threshold, and there is no architecture/scope/locked-decision delta — recording the policy reference in place of a signature. Reserve synchronous approval for full tier and envelope breaches.
- **Batch at wave granularity**, not packet granularity.
- **Reuse `PARK`.** The driver already parks with an incident record and push-notifies rather than blocking. An amendment that exceeds its envelope should park, not wait.
- **Measure approval latency** as a first-class metric. It will dominate time-to-mergeable, and it is the single number that says whether the gates are affordable.

### L. Notion is a fifth surface — and a packet decision already governs it

This page is a row in the workspace `Development Todo's` database with an auto-filled AI summary property, which makes Notion a genuine drift surface alongside manifest, README, INDEX, and ATLAS.

The repo has already ruled on exactly this case. `explorations/full-document-editor/DECISIONS.md` D27: "the Notion page is the product/evidence hub for visual browsing and stakeholder context. Repository exploration and goal packets are the normative execution contracts. *Rejected:* maintaining two independent normative specifications."

**Recommendation.** Promote D27 from packet-local to a standing convention, and have any Notion page mirroring a packet carry a one-line non-normative banner naming the packet path it defers to. This page should get one when it graduates.

### M. Two scoping corrections

1. **There is no `beep explore` command.** Pass 1 listed `beep explore bootstrap|doctor|transition|graduate` as though extending an existing group. Exploration validation is conversational by design — "Validation is conversational in v1 (the skill checks shape); there is no lint gate yet" — and the `/explore` skill is the only driver. P2 is therefore net-new command-group work, not an extension, and should be estimated as such. Cheapest first rung: a read-only `--check` invoked by the skill and run advisory in CI, then flipped blocking through the established ratchet.
2. **Part of pass 1's P0 invariant census is already written.** `explorations/graphnosis-prior-art/research/mining/map-proof.md` already audited this repo for evidence integrity and found no content hashing of evidence files and — more damning — **no prose-to-data binding**: "Goal packet READMEs and ledgers quote numbers (`requiredCount: 0`, 'five real defects', coverage percentages) that nothing recomputes." Verdict `partial`, value 4, effort M. That names the exact failure class the receipt workstream exists to close, and pairs with the `jsdoc-carrier-migration` orphaned-evidence case from pass 2. Start P0 from this file, not from scratch.

### N. Ordering delta

Keep pass 1's P0–P7 spine, with three moves:

- Pull **gate memoization** (G) forward into P1. It is the precondition that makes every later gate affordable, and it ships the receipt format for free.
- Split **P4**: change tree and symbol ledger land in the graduation definition-of-ready (cheap, off-lane); `DESIGN.md` lands in the goal packet afterward (J).
- Add **approval economics** to P7's measurement set: approval latency, auto-approved fraction, and envelope-breach parks (K).

### O. Additional open questions

1. Is `stage` a high-water mark or a resume cursor — and do we ship both as derived values? (F1)
2. Which surfaces flip from hand-edited to generated in the first PR: ATLAS only, or ATLAS plus packet README status blocks? (F3)
3. Do packet gates emit in-toto attestations from day one, or a bespoke receipt with an attestation migration later? (H)
4. What is the auto-approval envelope's blast-radius metric — files touched, packages touched, or public-export delta? (K)
5. Does the change tree and symbol ledger live in `MAP.md` for exploration-derived goals, with `DESIGN.md` reserved for exploration-skipping goals? (J)