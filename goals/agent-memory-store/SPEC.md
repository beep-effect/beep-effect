# Agent Memory Store Spec

## Objective

Build the agent memory store that the 2026-11-09 entry in
`standards/memory-architecture/04-decision-log.md` licenses: a set-union log
of immutable node events as the sole authority; the operator's Markdown memory
files and every index as rebuildable projections; agent writes admitted
store-side with no CRDT merge on agent write paths; prevalence as an
observation log that never ranks or gates. The first projected store is the
Claude Code memory folder (the per-repository `MEMORY.md` index and its note
files); the store is operator agent-memory, keyless and local.

The design was validated before this packet opened by nine pre-registered
spikes over this repository's `goals/**` history, the operator's auto-memory
notes and twenty session transcripts
([`research/2026-11-08-validation-scoreboard.md`](./research/2026-11-08-validation-scoreboard.md),
criteria in
[`research/2026-11-07-validation-spike-plan.md`](./research/2026-11-07-validation-spike-plan.md)).
Five of the nine pre-registered spikes killed a candidate feature on their
clause, and the S14b follow-up killed a sixth (its lane-declared 5% bar);
each kill made the design simpler. This packet builds what survived and turns
every surviving measurement into a named test.

## Relationships

- **Governs:** `standards/memory-architecture/04-decision-log.md` (2026-11-09
  entry) and the amended Layer 1 and Layer 2 text of
  `01-memory-layer-taxonomy.md`. Those rulings are not re-opened here; a
  change to them is a new decision-log entry, not a packet decision.
- **Converges with:** `text-knowledge-stack-rebuild`. The store mints its own
  `NodeId` at admission, but span anchoring inside the Markdown projection is
  expressed as that packet's occurrence preimage (source identity, unit, range,
  quote). This packet does not wait for `@beep/text`; when it lands, P1's
  anchoring module adopts it in one PR and deletes its local copy.
- **Reuses:** the epistemic and ontology kernels where they fit (PROV-O
  vocabulary, `ClaimLifecycle` transitions for typed status fields) rather
  than minting parallel vocabularies.
- **Supersedes nothing in code.** The 2026-08-29 removal stands: no external
  memory service, no MCP memory frontend. File memory remains what each agent
  reads; this store is what writes and reconciles it.

## Non-Goals

- A CRDT on any agent write path, including Loro `update` on free text. A CRDT
  for human editing is out of scope for this packet entirely.
- A separate retrieval relevance stage (S7: nothing over cross-encoder plus
  admissibility gate), prevalence counts in rank or gate (S9), a normalized
  span hash as a staleness verdict (S35), or any result budget derived from
  the paper's 120-competitor figure (S5).
- Product memory for the IP-law flywheel, BeepGraph, or any client or corpus
  material. The store holds operator agent-memory only.
- A shared external memory service, MCP memory server, or code index. The
  2026-08-29 ruling stands.
- Hosted-model dependence for any authority or admission path. Local models
  are allowed for retrieval ranking (cross-encoder, embeddings) and must be
  optional: the exact record, BM25 and the gate work without them.
- Committing the operator's memory notes, transcripts or any client-derived
  material to this public repository. Fixtures are synthetic or drawn from
  `goals/**` history.
- A sub-5% held-write target for free-text agent writes (S14b: the structural
  floor alone is 5.7%).

## Source Hierarchy

1. The 2026-11-09 decision-log entry and the memory-architecture standard.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and the numbered architecture docs.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- One new workspace package for the store, created only through
  `bun run beep create-package` after P0's specific-home-first routing
  decision. Working hypothesis: a `packages/tooling/*` package, because the
  store is repo-owned operator tooling with no product semantics; P0 confirms
  or reverses by decision file. SQLite (FTS5, `sqlite-vec`) access goes
  through the existing driver family (`@beep/pglite`, `@beep/duckdb` are the
  nearest wrappers); if none fits, a `packages/drivers/*` wrapper is a second
  `create-package` with its own routing decision file. The store's domain
  modules never depend on a database driver directly.
- A planned `memory` command family on `@beep/repo-cli` (`export`,
  `admit`, `project`, `recall`, `observe`, `doctor`) as the only agent-facing
  write path.
- `standards/memory-architecture/`: status notes as phases land; no doctrine
  changes.
- An operator runbook under `docs/runbooks/`, created by P5.
- Test fixtures under the package's `test/` directory, synthetic or derived
  from `goals/**` history.

## Constraints

- **Rulings are fixed.** Log is sole authority; no CRDT merge on agent paths;
  prevalence never ranks or gates. Any phase that cannot meet a ruling stops
  and reports; it does not route around it.
- **Design order is schema, then `Context.Service` contract, then
  implementation.** P0 lands the schemas (`NodeEvent`, `NodeId`,
  `RevisionId = hash(NodeId, parents, ContentHash)`, L0 raw-slice spans and
  patches, `ObservationEvent`, admission outcomes, typed findings) and the
  service contracts (`MemoryLog`, `Admission`, `MarkdownProjector`,
  `MemoryIndexes`, `Recall`, `ObservationLog`) before any implementation PR.
- **Effect v4 only**, validated against `.repos/effect`; `effect/HashMap`,
  `HashSet` and their mutable forms, never `Map` or `Set`; `Effect.fn` or
  `Effect.fnUntraced` for generator functions; `LiteralKit` for literal
  domains; no root `effect` barrel imports.
- **Bars come from the spikes, not from preference.** Each acceptance
  criterion below names its spike and the pre-registered or measured number
  it derives from, tagged `pre-registered` or `measured` with any margin
  stated. A bar may be re-baselined only by a decision file that cites a new
  measurement; the S14b lesson (set held-write bars on the resolver-needed
  count, not the CAS-fail count, and check the structural floor first)
  applies to every new bar.
- **One labeller.** A fixture's labels are authored by the lane that builds
  it and declared in the test file; zero counts are reported as `3/n` upper
  bounds.
- **Identity converges, never forks.** Span anchoring uses the occurrence
  preimage shape; no second span identity is minted.
- **Keyless and local.** No hosted API is required for any path; optional
  local models are feature-gated and the tests run without them.
- **Public repository.** No operator notes, transcripts, client or corpus
  material in fixtures, snapshots or docs; machine-local evidence is named,
  not path-linked (`bun run beep knowledge refs --check` gates `~` paths).
- At most three concurrently open PRs for this packet; `bun run beep quality
  package-verify <pkg>` before every handoff; `final-check` before `ready`.

## Resolved Design Items for P0

Two items are rulings of the 2026-11-09 entry and are fixed here; a change to
them is a new decision-log entry, not a packet decision:

- Vocabulary: the store is "the agent memory store"; its log is Layer 2's
  exact episodic records, its indexes are Layer 2 projections, the memory
  files are the Layer 1 projection.
- Node identity: own `NodeId` minted at admission; occurrence-preimage span
  anchoring; adopt `@beep/text` when it exists.

Five items were settled by the 2026-11-09 grill but left to the packet by the
entry's "Not decided here" paragraph; P0 confirms or reverses each by decision
file, not by re-litigation in prose:

3. Node granularity: row and list-item nodes, not top-level blocks (S1: block
   spans are about 33 times the real change; S14: list markers in trivia make
   the `leaf` model unsafe under merge).
4. Typed status fields with a lifecycle guard against backward moves (S14b:
   10/10 status conflicts leave the held path, 0/14 wrong; order flips regress
   12/14 without the guard). Counters are generated projections already
   (the generated goals index); the `## Current Phase` paragraph gets a single owner or
   generation from the manifest, never last-writer.
5. Retrieval order: authoritative filters, BM25-leaning convex fusion (S7:
   64/71 recall at 5 against RRF's 59/71), cross-encoder, admissibility gate
   with typed findings including the typed identity lookup, then budgets.
6. Dedupe: exact hash defers to tier 0 with nothing dropped (S10: 73.0% of
   duplicates carried a tier-0 pointer); near-duplicates flag only (S10:
   simhash at t=2 false-flagged 1.78%, 18/1010; t=4 reached 9.01%, past the
   kill).
7. Symbol liveness for code-referencing notes: SCIP resolves identity; a
   normalized span hash marks re-verify, never stale (S35: 109/129 hash flags
   were on intact claims).

## Acceptance Criteria

Each criterion is a named test or a recorded measurement in the package's
test suite, titled with its id.

- [ ] **AC-1 Byte identity (S1, pre-registered).** Exporting the Markdown
      projection of an unchanged tree reproduces every byte: 100% of files
      identical on the `goals/**` fixture; edits are confined to the touched
      node's span with a zero-failure `3/n` bound at or below 0.1%, which
      needs at least 3,000 replayed edits (S1 replayed 5,168, bound 0.058%);
      0 concurrent insertions read as deletions (S1: 0/2,618).
- [ ] **AC-2 Zero silent loss (S14, pre-registered).** On the adversarial
      concurrent-edit fixture, no admitted write drops another's content: 0 of
      100 runs; every contested node is held with both texts (S14: 70/70).
- [ ] **AC-3 Held-write budget (S14b, measured).** First the structural
      floor is measured and reported: writes held for delete-vs-edit or
      insert-under-a-deleted-anchor conflicts (S14b: 8/279, 2.9%; 16/279 with
      the CAS-only writes). Then writes that need a resolver stay at or below
      9.3% of cluster writes on the upper-bound replay (S14b: 26/279), the
      entry's "about 9%" budget with no margin; a margin needs a decision file
      citing a new measurement. Per-op admission lands at least 95% of
      operations (S14b: 98.0%, 1938/1977). Typed status conflicts leave the
      held path with 0 wrong resolutions (S14b: 10/10, 0/14); the lifecycle
      guard rejects every backward move in the fixture (S14b: 12/14 regress
      without it).
- [ ] **AC-4 Identity tiers (S2, pre-registered).** False continuation at or
      below 1% (`3/n`) on each synthetic stratum (S2: UB95 at or below 0.70%
      on six strata); the similarity tier never transfers a claim without a
      candidate edge; on the delete-and-rewrite control, which the similarity
      tier alone continued 731/1,100 times, only op capture or a handle may
      continue a claim and the similarity tier mints with a candidate edge.
- [ ] **AC-5 Prevalence out of rank (S9, ruling).** No retrieval or gate code path
      reads a count; a lint or test proves it. The observation log records
      `read`, `write`, `restate`, `update` as typed events and exposes
      distinct-lineage counts only.
- [ ] **AC-6 Retrieval (S7, measured).** On the lure-strata fixture,
      cross-encoder plus gate cuts macro lure acceptance by at least 50% at
      zero recall loss against the fused candidate pool alone (S7 measured
      57.7% against its RRF pool; AC-6 re-measures against the convex-fusion
      pool the packet adopts and records both); the typed identity lookup
      closes the renamed stratum to 0 of its items (S7: 10/57 to 0/57); no
      relevance stage exists in the pipeline.
- [ ] **AC-7 Dedupe (S10, measured).** Exact-hash deferral carries at least
      70% of duplicate writes to a tier-0 pointer with 0 dropped (S10: 73.0%;
      stricter than the pre-registered 60% because set from the measurement).
      The near-duplicate filter flags only, with a false-flag rate at or below
      2% at simhash t=2 (S10: 1.78%, 18/1010).
- [ ] **AC-8 Agent write path (P5, no spike).** An agent edit to a memory file through
      the planned `memory admit` command is captured as operations against the
      exported base and admitted store-side; the `MEMORY.md` index is a
      generated projection; the runbook documents the loop.
- [ ] **AC-9 Packet discipline.** Every phase ships one PR or stack through
      Yeet with `final-check` before `ready`; every bar change is a decision
      file citing a measurement.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/agent-memory-store/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/agent-memory-store/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/agent-memory-store` | Passes |
| Decisions projection | `bun run beep goals decisions check --slug agent-memory-store` | Passes |
| Research projection | `bun run beep goals manifest --check` | Passes |
| Packet doctor | `bun run beep goals doctor` | No new blocking findings |
| Package handoff | `bun run beep quality package-verify <store package>` | Passes per PR |
| Spike-derived bars | Tests titled `AC-1` to `AC-7` in the store package | Green |
| Agent write loop | the planned `memory doctor` command on a fixture folder | Reports 0 drift |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at closeout |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- A ruling of the 2026-11-09 entry cannot be met by the phase as designed:
  that phase stops and reports; the ruling is not routed around.
- A spike-derived bar is missed: remediation on the current route, or a
  decision file that re-baselines the bar with a new measurement; never a
  silent threshold edit.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add agent-memory-store --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug agent-memory-store`; add a `kind: decision` file there, never edit this block._

### Program shape: design first, then log, admission, identity, retrieval, agent loop; bars are the spike measurements, 2026-11-09

The packet builds the 2026-11-09 decision in the order the evidence suggests: P0 lands schemas and Context.Service contracts and confirms or reverses the five packet-decidable design items by decision file (granularity, status fields, retrieval order, dedupe, symbol liveness) and routes the package home by specific-home-first (working hypothesis a tooling package); the vocabulary and node-identity items are rulings of the entry and stay fixed; P1 the append-only log and raw-slice Markdown projection (AC-1, S1); P2 store-side admission with held conflicts and typed status fields (AC-2, AC-3, S14, S14b); P3 tiered identity and the observation log (AC-4, AC-5, AC-7, S2, S9, S10); P4 retrieval with no relevance stage (AC-6, S7); P5 the agent loop and runbook (AC-8). Every bar is the spike's pre-registered or measured number; a missed bar is remediated on route or re-baselined by a decision file citing a new measurement, per the S14b lesson. A phase opens only when the previous phase's bars are green on main.

Reverse: Reorder or merge phases by a new decision file; the rulings of the 2026-11-09 decision-log entry are not reversible here

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
