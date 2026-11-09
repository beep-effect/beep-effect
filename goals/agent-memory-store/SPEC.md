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
  `NodeId` in its import and capture steps (admission rejects one the log
  already holds), but span anchoring inside the Markdown projection is
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

- The store package `@beep/agent-memory-store` at
  `packages/tooling/library/agent-memory-store`, created through
  `bun run beep create-package --family tooling --kind library` (decision
  2026-11-09 `package-home-tooling-library`: repo operations route to tooling
  before `foundation/capability`). Its domain modules never depend on a
  database driver. SQLite (FTS5, `sqlite-vec`) is reached through the new
  driver `@beep/sqlite` at `packages/drivers/sqlite`, wrapping
  `@effect/sql-sqlite-bun` with the `@beep/pglite` roles (decision
  `sqlite-driver-package`). The append-only log is `effect/eventlog`
  (`EventLog` over `SqlEventJournal`) with no compaction registered
  (decision `memory-log-on-effect-eventlog`).
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
  patches, node placement and `gap` nodes, held-write events,
  `ObservationEvent`, admission outcomes, typed findings) and the
  service contracts (`MemoryLog`, `Admission`, `MarkdownProjector`,
  `MemoryIndexes`, `Recall`, `Reranker`, `Embedder`, `ObservationLog`,
  `SymbolResolver`) before any implementation PR.
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

The three rulings of the 2026-11-09 entry (the log is the sole authority;
store-side admission with no CRDT merge on agent write paths; prevalence is an
observation log that never ranks or gates) are fixed here; a change to any of
them is a new decision-log entry, not a packet decision. Ruling 1 also fixes
the vocabulary: the store is "the agent memory store"; its log is Layer 2's
exact episodic records, its indexes are Layer 2 projections, the memory files
are the Layer 1 projection.

Six items were settled by the 2026-11-09 grill and left to the packet: five
by the entry's "Not decided here" paragraph, and typed status fields by the
S14b follow-up the entry cites without listing. P0 confirms or reverses each
by decision file, not by re-litigation in prose:

1. Node identity and identity tiers: the entry's stated starting position is
   an own `NodeId` minted at admission, span anchoring expressed as the
   occurrence preimage of `text-knowledge-stack-rebuild` (source identity,
   unit, range, quote) so the two schemes do not diverge, and `@beep/text`
   adopted when that rename lands; the tier boundaries (exact hash, SCIP
   symbol, fused text) are set in P3 (S2, S9, S10).
2. Node granularity: row and list-item nodes, not top-level blocks (S1: block
   spans are about 33 times the real change; S14: list markers in trivia make
   the `leaf` model unsafe under merge).
3. Typed status fields with a lifecycle guard against backward moves (S14b:
   10/10 status conflicts leave the held path, 0/14 wrong; order flips regress
   12/14 without the guard). Counters are generated projections already
   (the generated goals index); the `## Current Phase` paragraph gets a single owner or
   generation from the manifest, never last-writer.
4. Retrieval order: authoritative filters, BM25-leaning convex fusion (S7:
   64/71 recall at 5 against RRF's 59/71), cross-encoder, admissibility gate
   with typed findings including the typed identity lookup, then budgets.
5. Dedupe: exact hash defers to tier 0 with nothing dropped (S10: 73.0% of
   duplicates carried a tier-0 pointer); near-duplicates flag only (S10:
   simhash at t=2 false-flagged 1.78%, 18/1010; t=4 reached 9.01%, past the
   kill).
6. Symbol liveness for code-referencing notes: SCIP resolves identity; a
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
      the measured ratio 26/279 of cluster writes (9.32%, compared as a ratio,
      never as a rounded percentage) on the upper-bound replay (S14b: 26/279),
      the entry's "about 9%" budget with no margin; a margin needs a decision
      file citing a new measurement. Per-op admission lands at least 95% of
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
      Abstention is reported beside false continuation and stays below 30% of
      true continuations on single-block edits in every stratum (S2: at most
      11.29% on the synthetic strata; 1/16 on the real single-block sample,
      UB95 26.4%), so a resolver cannot pass by minting everything.
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
      generated projection; the runbook documents the loop. Bootstrap on a
      nonempty existing memory folder imports every file into the log before
      any projection runs and re-exports it byte-identical; a failed or
      partial import leaves the folder untouched, and the projector refuses
      to write over a folder the log has not imported (a test asserts no
      existing file is replaced or emptied).
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

### Admission outcomes are a superset of ClaimGateResult with a pure projection onto it, 2026-11-09

Amends findings-reuse-epistemics-gate. ClaimGateVerdict is two-way (admitted, rejected), but admission has four outcomes: landed, deferred (exact-hash dedupe), held (both texts kept for a resolver) and rejected. A two-way verdict cannot carry the deferred node or the held texts, so AdmissionOutcome stays a store union discriminated on outcome. It does not duplicate the gate shapes: every finding is a MemoryGateViolation { code, violation } whose violation is a ClaimGateViolation with ClaimGateSeverity, and the pure toClaimGateResult projects any outcome onto ClaimGateResult (landed and deferred to admitted; held and rejected to rejected with the inner ClaimGateViolations). RecallResult findings use the same MemoryGateViolation. Code: packages/tooling/library/agent-memory-store/src/Admission.models.ts. Rejected: embedding a ClaimGateResult field in each variant (stores the verdict twice and lets it disagree with the outcome tag).

Lane goals/agent-memory-store-p0

Reverse: Collapse AdmissionOutcome to ClaimGateResult plus a side channel for deferral and held texts, by decision file, if the four-way outcome stops earning its keep

### Dedupe defers exact hashes to tier 0 and only flags near-duplicates, 2026-11-09

Confirmed from S10: 73.0% of duplicate writes carried a tier-0 pointer, so exact-hash duplicates defer to the existing node with nothing dropped; simhash at t=2 false-flagged 1.78% (18/1010) while t=4 reached 9.01%, past the kill, so near-duplicates are flagged as typed findings and never merged or dropped. The ContentHash is Sha256Hex over the normalized node text; the near-duplicate flag is advisory for consolidation only.

Lane goals/agent-memory-store-p0

Reverse: Re-baseline by decision file citing a new S10 measurement

### A memory file is the ordered partition of its nodes; the log alone rebuilds it, 2026-11-09

Amends granularity-row-and-list-item, dedupe-exact-defer-near-flag (gap nodes are exempt from exact-hash deferral) and identity-depends-on-provenance (where a NodeId is minted). Ruling 1 makes every memory file a projection rebuildable from the log, but the first P0 schemas could not rebuild one: NodeCreated kept only an occurrence anchor into the imported source and dropped the insert operation's afterNodeId, and no event held the bytes between nodes. A file is now the exact concatenation of its live nodes' texts in document order. NodeCreated.after names the predecessor (absent opens the file); nodes naming the same predecessor order newest first by journal entry order (creation time, then entry id bytes, the same on every replica); a retired node keeps its place as a tombstone. An insert carries the NodeId its capture step minted, so a later operation in the same batch can follow it (a paragraph and its separator are two inserts); admission rejects an id the log already holds (finding nodeIdAlreadyExists), and an insert whose predecessor did not land is held (finding insertAfterMissingNode), never placed elsewhere, until its resolver places it. NodeKind gains gap for the bytes between content nodes, so every byte belongs to exactly one node; gap nodes are never indexed and never deduplicated, and list markers stay inside list-item nodes (S14). FileImported records each file's path, digest and node count, so a rebuild proves AC-1 against the imported bytes and an empty file has a record. The anchor stays as import provenance, is absent on a node an agent wrote, and never decides order. Every memory event also names the lineage that wrote it, so the log holds the per-revision provenance S15 found a CRDT drops. Code: packages/tooling/library/agent-memory-store/src/NodeEvent.events.ts. Rejected: a per-node leading-separator field (deleting the first node of a file strands its successor's separator and needs separator-editing operations) and storing the imported file text beside its nodes (two copies of every byte that disagree after the first edit).

Lane goals/agent-memory-store-p0

Reverse: Replace gap nodes with a per-node separator field by decision file citing an AC-1 replay in which gap nodes fail byte identity or inflate held writes

### Typed findings reuse the @beep/epistemics claim-gate shapes, 2026-11-09

The SPEC reuses the epistemic kernel where it fits and @beep/repo-cli already depends on @beep/epistemics. Admission outcomes and retrieval-gate findings extend ClaimGateResult, ClaimGateViolation and ClaimGateSeverity with store-specific violation codes as a LiteralKit domain (held conflict, backward status move, missing candidate edge, failed identity lookup, unimported folder); the typed identity lookup is one violation kind. One finding vocabulary serves claim gates and memory admission. Rejected: a store-local union that duplicates severity and verdict shapes.

Lane goals/agent-memory-store-p0

Reverse: Introduce a store-local finding union by decision file if the epistemics gate vocabulary changes under the store

### Node granularity is row and list-item nodes, 2026-11-09

Confirmed from the spikes: S1 found top-level block spans about 33 times the real change, and S14 found list markers in trivia make the leaf model unsafe under merge. Nodes are table rows and list items inside the @beep/markdown positioned mdast (MarkdownRange carries 0-based offsets); paragraphs and headings are single nodes; fenced code is one node. The L0 raw-slice projection preserves every byte outside the touched node span (AC-1).

Lane goals/agent-memory-store-p0

Reverse: Re-baseline by decision file citing a new S1 or S14 replay on a different node model

### Held writes and their resolutions are log events keyed by HoldId, 2026-11-09

Ruling 1: the log is the sole authority, and AC-2 holds every contested write with both texts. The first P0 schemas had no event for a hold, so held state had no authority behind it, and Admission.resolve took a NodeId, which is ambiguous when two writes are held on one node and impossible for a held insert. WriteHeld records the operation exactly as submitted (the agent's text), the head revision the log held (the other text), the author and the findings, under a store-minted HoldId; HoldResolved records the resolver's choice and the revision it produced. The held outcome and the HeldConflict read model carry the HoldId and make ours and theirs optional, so deleteVersusEdit (no agent text) and insertUnderDeletedAnchor (no logged text) are representable; the node id is always present because an insert carries the id its capture step minted. A theirs or merged resolution writes its revision on the node's heads at resolve time, never on the stale revision the operation named; ours writes none and is also how a hold is closed once the node has moved on without it. A held insert is created by theirs or merged; when its predecessor never reached the log (held, deferred or rejected in the same batch, finding insertAfterMissingNode) the resolution carries an InsertPlacement, so the resolver is never left with ours as the only choice. A HoldResolved lands only while its hold is open, checked in the journal transaction and refused with the typed HoldNotOpenError, so two resolvers cannot both settle one hold. Amends admission-outcome-supersets-claim-gate in the held variant's fields only; the projection onto ClaimGateResult is unchanged. Code: packages/tooling/library/agent-memory-store/src/Admission.models.ts. Rejected: a side table for holds (state outside the log that a rebuild or a set-union sync would lose) and copying both texts into the event (the log already holds one and the operation carries the other).

Lane goals/agent-memory-store-p0

Reverse: Fold WriteHeld and HoldResolved into a holds table by decision file if held writes prove too frequent for the log; ruling 1 must be amended by a decision-log entry first

### Node identity depends on @beep/provenance now and follows the @beep/text rename, 2026-11-09

The entry's starting position is confirmed: the store mints its own NodeId at admission and RevisionId = hash(NodeId, parents, ContentHash) with Sha256Hex from @beep/schema; span anchoring in the Markdown projection is the occurrence preimage (SourceTextIdentity with extractor pins, unit, range, quote) imported from @beep/provenance, which text-knowledge-stack-rebuild P2 renames to @beep/text and migrates every consumer in that PR. Identity tiers (exact hash, SCIP symbol, fused text) are bounded in P3 from S2, S9 and S10. Rejected: waiting for @beep/text (puts P1 on another packet's schedule) and a store-local anchor (forks span identity, forbidden by the SPEC constraint).

Lane goals/agent-memory-store-p0

Reverse: Pin the store to its own anchor schema by decision file only if text-knowledge-stack-rebuild abandons the occurrence preimage

### Index search applies the authoritative filters; Embedder is a port with an unavailable default, 2026-11-09

Amends retrieval-order-convex-fusion and extends reranker-port-pass-through. The pipeline starts with authoritative filters, but MemoryIndexes.searchText and searchVector took only a query and a limit, so a filter could run only after each index had cut its top hits, and matching nodes ranked below unrelated ones were lost. Both now take an IndexSearch (text, filters, limit) and the index applies the filters before the limit. They return IndexHit with the index's own score; Candidate stays the fused shape recall builds. Embeddings are an optional local model like the cross-encoder (SPEC Non-Goals), so Embedder is a Context.Service port whose default Layer returns none; the vector index embeds node texts and the query through that one port, stays empty without a model, and recall then fuses the text index alone. Code: packages/tooling/library/agent-memory-store/src/Embedder.service.ts. Rejected: recall embedding the query and passing a vector (index and query could come from different models) and a mandatory embedding dependency (a model download in install and hosted CI).

Lane goals/agent-memory-store-p0

Reverse: Collapse the Embedder port into the vector index Layer by decision file if no second embedding backend appears

### MemoryLog enforces the per-node compare-and-set inside the journal transaction, 2026-11-09

Admission is a per-node compare-and-set (ruling 2) and several agent processes share one SQLite file, so a head read followed by an append is not atomic. effect/eventlog runs each event handler inside the journal's writer transaction (EventLog write and writeMany over SqlEventJournal, read in the Effect reference checkout), so the check lives there: a revision-producing event lands only when its parents are exactly the node's current heads, a NodeCreated only when the node has none, and a stale event fails the whole batch with the typed StaleParentsError, which the four node event definitions declare as their error schema and Admission turns into a staleExpectedRevision finding. Handlers read heads from a table they maintain in that same transaction, so a later event of a batch sees the earlier ones. The check applies to appends through MemoryLog, the only writes any phase of this packet makes, so every node keeps one head. A remote replay is a set-union and must not be refused, so it bypasses the check and could add a second head; no phase wires a remote, and the packet that does must first decide by decision file how a forked node is held and resolved, because agent operations name one expected revision. MemoryLog exposes heads(nodeId), a LogCursor (the count of entries this replica has committed, numbered by the store in commit order; not a journal entry id, because a remote replay can commit an older id after a newer one) and entriesAfter(cursor) in place of a frontier of unkeyed revisions and a read of the whole log; BaseExport records the cursor it reflects. revisionPreimage deduplicates parents so a repeated parent cannot change a RevisionId. Code: packages/tooling/library/agent-memory-store/src/MemoryLog.service.ts. Rejected: a lock file around read-then-append (a second locking scheme beside SQLite's) and resolving forks at projection time (a merge on the agent write path, which ruling 2 forbids).

Lane goals/agent-memory-store-p0

Reverse: Move the check into Admission behind a store-level lock by decision file if effect/eventlog stops running handlers inside the writer transaction

### MemoryLog sits on effect/eventlog with SqlEventJournal over @beep/sqlite, 2026-11-09

Repo law: never hand-roll what an Effect module provides. effect/eventlog ships EventLog (typed Event groups with tag, payload schema and primaryKey), EventJournal (time-ordered EntryId, memory and SQL backends via SqlEventJournal), opt-in compaction and remote set-union sync, and @beep/duckdb already builds on it. NodeEvents are typed Events in one EventGroup with primaryKey = NodeId; the journal is SqlEventJournal over the @beep/sqlite driver; no compaction is registered for node events, so the log stays Layer 2's exact record; MemoryLog is a thin typed facade over EventLog and projections read entries and reactivity. Rejected: EventJournal-only writes (re-implements tag and payload plumbing) and an own append-only table (forbidden by the law).

Lane goals/agent-memory-store-p0

Reverse: Replace the EventLog facade with a store-owned append table by decision file, citing the Effect module gap that forced it

### Package home: tooling/library/agent-memory-store as @beep/agent-memory-store, 2026-11-09

Specific-home-first (standards/architecture/07, routing step 3): the store is repo operations and automation for operator agent memory, with no product semantics and no external engine of its own, so it routes to tooling before foundation/capability (step 5, which also needs two named importers and has none). Created only through bun run beep create-package agent-memory-store --family tooling --kind library. The memory command group is @beep/repo-cli/commands/Memory importing the library, because goals/beep-cli-composition is still active and repo-cli remains the composition root (DECISIONS 2026-10-28). Rejected: foundation/capability (fails the negative gate today), and a domain/store split before any consumer exists (SPEC Non-Goals exclude product memory).

Lane goals/agent-memory-store-p0

Reverse: Move the package with a new routing decision file once a second named consumer outside repo operations exists; create-package --family foundation --kind capability is the only alternative home that passes the negative gate

### Program shape: design first, then log, admission, identity, retrieval, agent loop; bars are the spike measurements, 2026-11-09

The packet builds the 2026-11-09 decision in the order the evidence suggests: P0 lands schemas and Context.Service contracts and confirms or reverses the six packet-decidable design items by decision file (node identity and identity tiers, granularity, status fields, retrieval order, dedupe, symbol liveness) and routes the package home by specific-home-first (working hypothesis a tooling package); the entry's three rulings stay fixed and ruling 1 fixes the vocabulary; P1 the append-only log and raw-slice Markdown projection (AC-1, S1); P2 store-side admission with held conflicts and typed status fields (AC-2, AC-3, S14, S14b); P3 tiered identity and the observation log (AC-4, AC-5, AC-7, S2, S9, S10); P4 retrieval with no relevance stage (AC-6, S7); P5 the agent loop and runbook (AC-8). Every bar is the spike's pre-registered or measured number; a missed bar is remediated on route or re-baselined by a decision file citing a new measurement, per the S14b lesson. A phase opens only when the previous phase's bars are green on main.

Reverse: Reorder or merge phases by a new decision file; the rulings of the 2026-11-09 decision-log entry are not reversible here

### Reranker is a Context.Service port with a pass-through default; AC-6 is a model-gated recorded measurement, 2026-11-09

S7 measured the gate with bge-reranker-base on CPU; the SPEC requires keyless, local operation with tests that run without local models. Reranker is a Context.Service port in the Recall pipeline (filters, BM25-leaning convex fusion, Reranker, admissibility gate, budgets); its default Layer preserves fused order, so every test runs keyless. A model-gated test, skipped without a local reranker, records the AC-6 measurement into a committed fixture, which the SPEC admits as a recorded measurement. Rejected: a mandatory ONNX reranker dependency (model download in install and hosted CI) and dropping the cross-encoder (contradicts S7 and fails AC-6).

Lane goals/agent-memory-store-p0

Reverse: Make a local reranker a hard dependency by decision file if hosted CI gains a model cache and the operator accepts the install cost

### Retrieval order is filters, convex fusion, reranker, admissibility gate, budgets; no relevance stage, 2026-11-09

Confirmed from S7: BM25-leaning convex fusion recalled 64/71 at 5 against RRF's 59/71, the cross-encoder plus gate cut macro lure acceptance 57.7% at zero recall loss, the typed identity lookup closed the renamed stratum 10/57 to 0/57, and the relevance stage was killed. Recall runs authoritative filters, convex fusion over FTS5 and vector candidates, the Reranker port, the admissibility gate with typed findings including the typed identity lookup, then budgets. Prevalence never enters rank or gate (ruling 3). AC-6 re-measures against the convex pool and records both numbers.

Lane goals/agent-memory-store-p0

Reverse: Re-baseline by decision file citing a new S7 measurement on the adopted pool

### SQLite access through a new driver packages/drivers/sqlite (@beep/sqlite), 2026-11-09

External engines and SDK wrappers route to drivers (07, step 2); @beep/pglite already wraps @effect/sql-pglite with SqliteClient-style roles (client service, errors, test-layer), so the consistent route is a second create-package --family drivers named sqlite wrapping @effect/sql-sqlite-bun 4.1.2 (catalog). The driver owns connection options, FTS5 availability and sqlite-vec extension loading through SqliteClient.loadExtension; the store's domain modules never import it. Drift recorded, not fixed here: @beep/repo-cli, @beep/repo-ai-metrics and @beep/test-utils import @effect/sql-sqlite-bun bare (cleanup-on-touch). Rejected: reusing @beep/duckdb (changes the substrate S7 and S10 measured on, forcing AC-6 and AC-7 re-measurement).

Lane goals/agent-memory-store-p0

Reverse: Retire @beep/sqlite per standards/architecture/11 and import @effect/sql-sqlite-bun in the store directly, by decision file

### Status prose is generated from ops/manifest.json; typed status fields carry a lifecycle guard, 2026-11-09

S14b: typed status fields resolve 10/10 with 0/14 wrong and need a lifecycle guard against backward moves (12/14 regress without it). The Current Phase paragraph and counters are projections of typed manifest fields (currentPhase, status enums), regenerated like the goals index and the decisions blocks, so no agent writes the paragraph and last-writer conflicts cannot arise. The admission path models status as LiteralKit fields with an ordered lifecycle and rejects backward transitions as typed findings. Rejected: a hand-written paragraph with a single-owner lock (adds an ownership rule to admission and lets text and manifest drift).

Lane goals/agent-memory-store-p0

Reverse: Switch the Current Phase paragraph to a single-owner lock by decision file if manifest generation proves too coarse for a packet

### Status values are manifest data with a StatusLifecycle order, not static LiteralKit domains, 2026-11-09

Amends status-generated-from-manifest. Its sentence that the admission path models status as LiteralKit fields cannot hold in P0: the status fields and their values come from ops/manifest.json at runtime, so no static LiteralKit can name them. P0 models a value as StatusValue (a branded NonEmptyString), a field's order as StatusLifecycle { field, order } with a no-duplicates check, and the guard as the pure lifecycleAllows, which admits only forward or same-position moves (S14b: 12/14 regress without it). Backward moves still surface as the backwardStatusMove finding. The rest of the decision (manifest-generated status prose, typed fields with a lifecycle guard) stands. Code: packages/tooling/library/agent-memory-store/src/StatusLifecycle.models.ts. Rejected: a hard-coded LiteralKit of today's manifest values (goes stale the first time a packet adds a status and fails decoding of valid manifests).

Lane goals/agent-memory-store-p0

Reverse: Generate one LiteralKit domain per status field from ops/manifest.json once the field set is closed, and type StatusTransition per field, by decision file

### SymbolResolver owns its SCIP index; the store models references and resolutions only, 2026-11-09

Amends symbol-resolver-port-scip-driver-p3. The port took a decoded SCIP index document on every call and the store carried that document's schema. A SCIP index covers every source file of the repository, decoding it through a store schema per call is waste, and the document shape belongs to the tool that writes it. SymbolResolver.resolve now takes the SymbolReference only; the implementing Layer loads and holds the index, and the index schema arrives with the SCIP driver in P3. The store keeps ScipSymbol, ScipRange, ScipDefinition, SymbolReference and SymbolResolution. Code: packages/tooling/library/agent-memory-store/src/SymbolResolver.service.ts. Rejected: keeping the document schema in the store for the P3 driver to import (a driver would depend on a tooling library for its own wire shape).

Lane goals/agent-memory-store-p0

Reverse: Restore the index parameter by decision file if a caller must resolve against more than one index in one process

### SymbolResolver is a port over a decoded SCIP index; drivers/scip arrives in P3, 2026-11-09

S35: SCIP resolves identity (372/373 real imports, re-exports included) and the normalized span hash is a re-verify signal, never a staleness verdict (109/129 flags on intact claims). P0 defines SymbolResolver taking a decoded SCIP index document (schema in the store) and returning symbol identity plus a re-verify flag; P3 adds packages/drivers/scip wrapping @sourcegraph/scip-typescript (external tool, drivers family) with its own routing decision file. Rejected: shelling out from repo-cli (an engine wrapper inside the CLI) and deferring the contract (breaks the schema, contract, implementation order).

Lane goals/agent-memory-store-p0

Reverse: Collapse the port into the P3 implementation by decision file if no second resolver backend appears

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
