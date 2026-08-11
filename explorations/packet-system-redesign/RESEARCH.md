# Research — Exploration & Goal Packet System Redesign

## 2026-08-10 (latest) — Packets dashboard lane (lane 7)

Operator capture: a read-only `packets` app answering "what should I do
next" (pulse, kanban, roadmap, dependency DAG, parallel groups, tabbed
markdown drill-in, near-realtime). Report:
[`research/grok/reports/7-packets-dashboard.md`](./research/grok/reports/7-packets-dashboard.md).
Key findings:

- Closest prior art is the 2025–26 **markdown-native agent board family**
  (Backlog.md, kanban-md, taskmd, markplane, single-file HTML kanbans) — not
  Backstage/hosted trackers. Backlog.md is both the structural twin and the
  cautionary one: its web UI *writes*, recreating the dual-writer trap.
- The named failure mode is the **catalog maintenance trap**: status UIs
  drift from the artifact of record and rot; escape = project from what
  people already edit, single writer, single projector, `sourceTip`
  staleness shown as first-class UI chrome.
- KSA's ratified order stands on evidence: projector + JSON + Mermaid +
  **static self-contained HTML v1** first (single-file kanban tools prove
  it's a finished product shape), React v2 only when daily use proves an
  *interaction* gap. v2 stack when justified: @xyflow/react + dagre,
  hand-rolled read-only kanban (no dnd-kit), react-markdown + GFM + Shiki
  (no MDX for packet files), TanStack Query over `projection.json`, existing
  Vite + portless shell; scoped chokidar → reproject → Vite custom HMR
  event, 2s ETag poll as the honest fallback.
- Build-vs-buy: generic internal dashboards are a documented regret class
  (~2.5k-like practitioner thread); the narrow justified exception is
  exactly this case — proprietary domain (event-derived stages, CAS tips,
  frontier CTEs) no hosted tracker can model without dual-write, one
  power-user consumer, viewer-only over an existing projector.
- Operator reasoning reframes the IA: the primary screen is the **pulse /
  frontier view** ("start these N now, in parallel; blocked-by; awaiting
  you"), which is KSA's `beep goals next`/`explain` rendered; kanban, DAG,
  roadmap, tabs are secondary navigation.

## 2026-08-10 (later) — Pocock skills workflow comparison + drift audit

Post-align expansion: [`research/2026-08-10-pocock-skills-comparison.md`](./research/2026-08-10-pocock-skills-comparison.md)
compares the aihero.dev workflow to beep's and audits the three vendored
skills against upstream @ 84fdeff. Headlines: `teach` is byte-identical;
`grill-me` is the current upstream thin pointer but dangles (no local
`/grilling` skill exists); `grill-with-docs` is a deliberate repo-native
fork that predates upstream's frontier-rounds grilling protocol (PR #788,
2026-08-06) — the one upstream improvement clearly worth porting, plus the
two-axis (Standards × Spec) code-review shape which doubles as this
packet's plan-vs-diff conformance critic (§A6).

## 2026-08-10 — Synthesis of imports + six Grok research lanes

Inputs: two imported documents (the Notion three-pass proposal and the Codex
deep-research revision, both under `research/`) plus six Grok CLI research
lanes (web + GitHub + x.com, reports under `research/grok/reports/`):

1. [`1-spec-driven-dev.md`](./research/grok/reports/1-spec-driven-dev.md) — SDD/Spec Kit/Kiro/Tessl in real use
2. [`2-agent-plan-gates.md`](./research/grok/reports/2-agent-plan-gates.md) — ExecPlans, HumanLayer FIC, Horthy 4-gate, Pocock skills, plan drift
3. [`3-event-sourced-control.md`](./research/grok/reports/3-event-sourced-control.md) — event-sourced control planes, journals vs CAS files, durable execution
4. [`4-attestation-approvals.md`](./research/grok/reports/4-attestation-approvals.md) — gitsign/in-toto/GitHub attestations, HITL approval leakage
5. [`5-traceability.md`](./research/grok/reports/5-traceability.md) — trace decay, derived matrices, EARS, LLM link recovery
6. [`6-gate-economics.md`](./research/grok/reports/6-gate-economics.md) — DoR anti-pattern, queueing, approval latency, memoized gates

### A. Convergent findings (imports and lanes agree; high confidence)

1. **Risk-tiered ceremony is the universal survivor.** Every lane found the
   same field pattern: uniform heavyweight process is selectively abandoned
   (Spec Kit skipped for small/medium brownfield; BMAD "six hours, still on
   story three"; Böckeler never finished the mid-size feature), while
   clarify/grill, constitutions, short EARS/GWT acceptance criteria, and a
   *few* human phase gates survive. Thoughtworks keeps SDD and Spec Kit at
   **Assess**. The Light/Standard/Full tiering in the Codex revision is
   confirmed; the tier decision itself must be recorded and challengeable.
   Field test for what belongs in a spec: *"would you be annoyed if the agent
   decided that differently?"* (lane 1).
2. **Clarify/grill is the highest-ROI gate.** The one mechanic praised across
   every tool and every practitioner cluster. beep already owns it (align
   stage; grill skills). Formalize the *decisions* as recorded events;
   Pocock's "specs are deletable projections of grilling" is compatible when
   answers land in DECISIONS/SPEC, not in six markdown templates.
3. **Derive readiness; never store status.** All lanes: stored status fields
   are "RTM rot by another name" / "boolean theater." Existence proof in the
   wild: `agent-spec` recomputes liveness from verify verdicts and stores only
   anchors + digests. This confirms pass-2/3 "derive, don't store" and the
   Codex `blockedBy`-explanation readiness shape.
4. **Event-source the control plane only, as per-event CAS files.** Lane 3's
   decisive evidence: spec-kitty lost mission audit history when its
   append-only `status.events.jsonl` hit a git 3-way merge (issue #569) —
   exactly the failure pass 2 worried about. Per-event immutable files with
   parent digests give conflict-free parallel appends and *detectable forks*
   (two children of one head). Schema policy from day one: `type` + `v` per
   event, additive-only minors, upcasters for breaks, projector version
   recorded in snapshots, tiny golden-stream replay tests in CI. Do NOT
   event-source prose edits — git already versions documents.
5. **Approvals: GitHub protected review on digest-bearing PRs is the day-0
   trust anchor; Sigstore is Full-tier-later.** Lane 4 confirms the Codex
   correction (`gitsign verify` with pinned identity/issuer; `git
   verify-commit` checks integrity only) and adds three practical blockers
   for gitsign-by-default: public Rekor leaks identity/timing, GitHub UI
   shows gitsign commits as Unverified, and verifier bugs (CVE-2024-51746)
   are part of the TCB. The strongest empirical warning: humans rubber-stamp —
   ~93% approve rates (Anthropic auto-mode), ~1-in-3 dangerous actions
   approved in a 409k-decision study. So: fewer, digest-bound, batched
   approvals with a fail-closed verifier; never mint attestations no consumer
   verifies (the Mastra anti-pattern).
6. **Traceability must be derived from in-band anchors.** Stable IDs in spec
   clauses, test titles, commit trailers; matrix always regenerated (shtracer
   / pytreqt / tdm / contextlint are small existence proofs); deterministic
   orphan lints in CI; LLMs only propose candidate links (best F1 ≈ 80% with
   phantom-link failure modes — never stored truth). Mäder/Gotel: usable
   fresh links gave ~24% faster / ~50% more-correct evolution tasks; stale
   matrices are worse than none.
7. **Gate economics: memoize by input digest and budget the operator as a
   single-server queue.** Lane 6 independently converges on the pass-3
   recommendations: proof-manifest memoization for every packet gate (docgen
   pattern; `(gate_id, tool_version, packet_subtree_digest)` keys; code-only
   PRs pay ~0), design ceremony placed *before* the WIP-capped lane slot
   (front-loading cuts in-lane service-time variance), park-and-notify over
   block-the-fleet, batch approvals at wave granularity with digest-bound
   subjects, and a gate-value-audit SLA (p50/p95 + catch rate) before any new
   always-on gate. Approval-wait p50/p95 and parked-lane age are the metrics
   that decide whether gates are affordable — observational, never targets.
8. **Exact file tree: yes (Standard+). Every symbol: no.** Field evidence
   backs the Codex narrowing — symbol ledgers at Full tier only, covering
   public/boundary/serialized/architecturally significant symbols, kept
   *living* (regenerated + event-diffed), never frozen checklists. The plan
   compliance study (16,991 trajectories) warns a bad/over-detailed plan is
   worse than none; plan reinjection improves compliance; a plan-vs-diff
   checker is the enforcement backstop.
9. **Plans are living control surfaces with a drift protocol.** ExecPlans
   (Progress / Surprises / Decision Log), Horthy gate reopening, HumanLayer
   compact-back, and the stale-plan literature agree: on drift, rewrite the
   normative body and emit amendment/reopen events; never leave course
   changes only in chat. Four amendment classes (Codex revision) fit this.
10. **Evidence = receipts bound to commit + artifact digests.** "A green test
    that never touches the code is worthless"; "recover the history, then
    prove the history is true." Unbound snapshots are catalogue rows without
    a store — the same failure class graphnosis's map-proof already found
    in-repo (prose quoting numbers nothing recomputes).

### B. Tensions and corrections surfaced by the lanes

- **Plans-in-VCS staleness** (Horthy: keep research/plans *out* of the repo;
  ~500 likes of agreement) vs beep's docs-as-code packets. Resolution
  candidate: keep packets tracked (public auditability) but make stale plans
  *non-executable* — readiness derivation refuses a PLAN whose approved
  digest no longer matches, and archived-vs-active paths keep old plans out
  of agent context.
- **Human approval is statistically leaky** (~33% miss rate) — so the
  redesign's approvals must be few, batched, context-rich, and digest-bound;
  adding *more* human gates reduces safety past a threshold. Auto-approval
  classifiers themselves miss ~17% of overeager actions — envelopes are
  policy + sandbox, not a solved problem.
- **Merge queues + agent swarms thrash** (AgentOps merge-door analysis):
  probabilistic review on the critical path re-speculates constantly.
  Supports two-phase done (deterministic land ≠ accepted/closed) for packet
  completion semantics.
- **DoR is not always wrong** (Galen): refusing under-cooked work out of
  scarce committed capacity is healthy; the anti-pattern is 100%-complete
  stage-gating. Maps exactly onto "gate at graduation into scarce lanes,
  keep shaping unbounded."
- **METR caution**: perceived speedup ≠ measured speedup; instrument or the
  redesign is faith-based.

### C. In-repo capability inventory (bricks this packet composes)

| Capability | Where | Disposition |
| --- | --- | --- |
| Six-stage exploration pipeline + graduation DoR | `explorations/README.md` | extend (5th graduation check: change tree + symbol ledger) |
| Goal contract, doctor, generated INDEX, set-status | `goals/`, `beep goals` CLI | extend; set-status stays the single lifecycle writer |
| Hash-chain ledger doctrine (commit-to, don't embed; no storable derived state) | `goals/agent-execution-authority` | reuse pattern |
| JSONL journal crash/corruption/concurrency test matrix | Yeet `AttemptJournal` | reuse test matrix; storage shape superseded by per-event CAS files (lane 3) |
| Proof-manifest memoization | `beep docgen check --reuse-proof-manifest` | copy for every packet gate |
| Run-state machine + PARK + budgets | `goals/goal-portfolio-driver` | boundary: packet stores truth, driver consumes it |
| Property-law lane (`fcRuns`, per-PR 400 runs) | `@beep/test-utils` | transition-table laws via fast-check |
| Ratchet adoption (advisory → baseline → blocking) | fallow / schema-first / jsdoc precedents | adoption path for every new gate |
| Deterministic materialization compiler design | `goals/knowledge-surface-automation` Workstream E | extend, not duplicate; shared packet-core library |
| Grill practice + docs-PR-before-implementation | `/grill-with-docs`, KSA precedent | docs-PR merge = the approval anchor |
| OPPORTUNITIES.md convention (7+ packets, no schema) | packet `research/` ledgers | promote: schema + fleet roll-up |

NOT FOUND in-repo: any `beep explore` command group (exploration validation
is conversational by design — P2 is net-new work); prose-to-data binding for
evidence numbers (graphnosis map-proof verdict `partial`); per-gate proof
manifests outside docgen.

### D. Open questions carried into align

The combined set from pass 2 §E, pass 3 §O, and the lanes — the grill agenda:

1. Event storage shape: per-event CAS files under `ops/events/` (lane 3 +
   Codex) vs branch-scoped JSONL journals (Yeet precedent). Includes fork
   semantics and merge-driver needs.
2. Approval anchor day-0: protected docs-PR merge on digest subjects (lane 4
   recommendation) — and what, if anything, ever justifies Sigstore here.
3. Stage semantics: ship `furthestStage` + `resumeStage` as derived values?
4. Tier rubric: which signals force Full; who overrides; what blast-radius
   metric bounds the auto-approval envelope.
5. Design-gate placement: change tree + symbol ledger into MAP.md as a 5th
   graduation check, DESIGN.md seeded at graduation (exploration-skipping
   goals author it in-lane) — confirm.
6. Which hand-edited surfaces flip to generated first (ATLAS wholesale;
   packet README status blocks?).
7. OPPORTUNITIES.md: schema-validated + fleet roll-up + mechanical writes
   from design amendments; scoped to systemic misses only?
8. Command surface: shared packet-core library behind existing `beep goals`
   / net-new explore checks — no `beep packets` fork. Confirm.
9. Pilot #1: self-host this packet vs KSA adoption case.
10. Completion semantics: adopt two-phase done (deterministic land vs sealed
    receipts + approval) for goal closure?
11. Metrics: which of approval-wait p50/p95, parked-lane age, gate cache-hit,
    amendment-rate-by-tier land in v1 instrumentation?
