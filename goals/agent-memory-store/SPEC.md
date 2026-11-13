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

- [x] **AC-1 Byte identity (S1, pre-registered).** Exporting the Markdown
      projection of an unchanged tree reproduces every byte: 100% of files
      identical on the `goals/**` fixture; edits are confined to the touched
      node's span with a zero-failure `3/n` bound at or below 0.1%, which
      needs at least 3,000 replayed edits (S1 replayed 5,168, bound 0.058%);
      0 concurrent insertions read as deletions (S1: 0/2,618).
      Proven in P1 by `test/MarkdownProjector.byte-identity.test.ts` in the
      store package: "AC-1 byte identity" (172/172 sample files, and a rebuild
      from the log alone matching every `FileImported` digest), "AC-1 edit
      confinement" (3,096 generated node edits, 0 outside the span, `3/n` =
      0.097%; decision `p1-edit-replay-is-generated-node-edits`) and "AC-1
      concurrent insertions" (0/2,940).
- [x] **AC-2 Zero silent loss (S14, pre-registered).** On the adversarial
      concurrent-edit fixture, no admitted write drops another's content: 0 of
      100 runs; every contested node is held with both texts (S14: 70/70).
      Proven in P2 by `test/Admission.acceptance.test.ts` in the store
      package: "AC-2 zero silent loss" (100 seeded runs of the fixture's 118
      cluster writes, 0 runs with a loss under an oracle that never reads
      admission's judgment, 1,000/1,000 contested nodes held with both texts;
      decision `p2-adversarial-fixture-is-seeded-contention-strata`).
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

### The AC-1 and AC-8 fixture is a packed, stratified sample of tracked goals Markdown, 2026-11-10

The tracked goals tree is about 3,600 Markdown files and 31 MB: too slow for the unit lane, and a package test that reads outside its package is invisible to the Turbo input hash and can go stale-green. The fixture is test/fixtures/goals-markdown-sample.json.gz in the store package: one gzipped JSON file (so repository scanners and formatters do not walk its Markdown) holding 172 files, 1,065,752 Markdown bytes, 386,973 bytes packed, sampled at commit baf225131bd. test/fixtures/build-goals-markdown-sample.ts regenerates it deterministically from one commit (argument, default HEAD): it lists the commit's tree with git ls-tree and reads every file's bytes with git show of that commit, never the index or the working tree, so the recorded commit rebuilds the identical file (checked: the generator run at baf225131bd reproduces the committed fixture's SHA-256). It ranks them by the SHA-256 of their path, and fills eleven strata (table, nested list, fenced code, frontmatter, HTML, block quote, non-ASCII, no trailing newline, plain, two long files of 40 to 130 KB, and five synthetic edge files: empty, blank lines only, CRLF, a byte order mark, astral characters with tab markers) within a per-stratum byte budget. The agent-memory-store-p1 lane is the only labeller and the test files declare it. An opt-in test (BEEP_TEST_AGENT_MEMORY_FULL_TREE set, skipped by default) runs byte identity over the whole live goals tree. Rejected: loose .md fixture files (scanners and formatters walk them) and a fixture larger than about 1 MB (the AC-1 file must stay under about 30 s in the hosted unit lane).

Lane agent-memory-store-p1

Reverse: Replace the packed sample with a test that reads the tracked goals tree, by decision file once the unit lane hashes inputs outside the package

### P1 content hashes and revision ids hash the exact node text, 2026-11-10

ContentHash is documented as the SHA-256 of a node's normalized text, but no normalization is defined yet and P1 needs hashes to mint revision ids. contentHashOf hashes the exact UTF-8 bytes of the node text and revisionIdOf hashes the UTF-8 bytes of revisionPreimage, both through the effect/crypto/Digest service (Digest.layerWebCrypto in the live projector). The import anchors record normalizationVersion 1 for this identity normalization. Exact-hash deferral (P3, decision dedupe-exact-defer-near-flag) may define a normalization; it then bumps the version, and revisions minted before keep their ids because a revision id is never recomputed. Code: packages/tooling/library/agent-memory-store/src/NodeIdentity.digest.ts. Rejected: inventing a whitespace normalization in P1 (no measurement behind it).

Lane agent-memory-store-p1

Reverse: Introduce a text normalization with normalizationVersion 2 by decision file in P3, citing the S10 dedupe measurement it must reproduce

### The export fence trusts only bytes the store imported from or wrote to that same folder, 2026-11-10

Supersedes export-fence-is-per-file-known-bytes. The first fence merged every recorded digest with every FileImported digest and never named a folder, so a folder the log never imported passed whenever each of its memory files matched an imported or projected file at the same relative path; exportFolder then replaced the differing files and created the rest. Review reproduced it with a foreign folder holding one byte-identical MEMORY.md. The fence is now bound to the folder: agent_memory_folder_files (root, file_path, file_digest) records, for each folder, the bytes the store imported from it and the bytes it wrote to it, and the folder key is the folder's resolved path (FileSystem.realPath), so two spellings of one folder share their rows and a copy elsewhere shares none. importFolder inserts the rows for every file it read before it appends; a failed append leaves rows that say only that the folder held those bytes, which stays true. exportFolder makes the folder, inserts the rows of the files it is about to write and then writes them through a temporary file and a rename. The check passes when the log holds a FolderImported and every memory file of the folder is in that folder's rows; a folder with no memory files still passes, so the log can be rebuilt into an empty folder, and the rebuilt folder then has rows of its own. A second importFolder runs the same check. Losing the table can only refuse an export, never permit a wrong one. Moving the folder makes it foreign until it is rebuilt into its new place. Code: packages/tooling/library/agent-memory-store/src/MarkdownProjector.layer.ts; tests: the AC-8 export refusal case (now with a copy holding one imported file byte for byte) and the foreign-copy case in test/MarkdownProjector.test.ts. Rejected: adding a root to FolderImported (it changes a P0 event, and a path in the log is a machine detail every replica would carry) and comparing the folder digest only (refuses every export after the first edit).

Lane agent-memory-store-p1

Reverse: Return to a per-path fence over every folder by decision file if the store must export into folders it never saw, with a new import mode that names them

### exportFolder writes only over memory files whose bytes the log imported or the store projected, 2026-11-10

Superseded by decision export-fence-is-bound-to-the-folder: review found that this fence names no folder, so a foreign folder whose memory files all match imported files at the same paths passed it. The text below records the first design.

AC-8 requires that the projector refuse to write over a folder the log has not imported. FolderImported names the folder only by its digest at import time, so a digest comparison alone would refuse every export after the first edit. exportFolder therefore checks, before it writes anything, that the log holds a FolderImported and that every memory file in the target folder holds bytes the log knows for its path: the FileImported digest, or a digest this store wrote there before. The second set lives in agent_memory_projected_files (file_path, file_digest) in the log's database; its rows are inserted in one statement before the files are written, so an export cut short leaves each file at old or new bytes, both known. A folder with no memory files passes (a rebuild from the log alone into an empty folder), a folder with one unknown file is refused whole with UnimportedFolderError naming the root and the folder digest, and nothing is replaced or emptied. Files are written to a temporary sibling and renamed, and only files whose bytes differ are written. The table is a safety record, not authority: losing it can only refuse an export, never permit a wrong one. Code: packages/tooling/library/agent-memory-store/src/MarkdownProjector.layer.ts; tests: the AC-8 export refusal case (empty log, a foreign folder sharing a path, a folder mixing an imported file with a foreign one) in test/MarkdownProjector.test.ts. Rejected: comparing the folder digest with FolderImported only (refuses every second export) and keeping the last export digest in memory (a fresh process would refuse its own folder).

Lane agent-memory-store-p1

Reverse: Replace the projected-file table with a FolderExported log event by decision file if the fence must survive a rebuilt database

### Export fence rows are inserted in chunks of 300 inside one transaction, 2026-11-10

Review note on PR 3058: recordFolderFiles bound three parameters per file in one INSERT, so a folder of about 10,900 files would pass SQLite's 32,766 bound-parameter limit. The rows now go in chunks of 300 (900 parameters, under the 999 limit of the oldest SQLite builds) inside one transaction, so a folder's rows still land all or none. Test: the 301-file import case in test/MarkdownProjector.test.ts.

Lane agent-memory-store-p1

Reverse: Insert the fence rows in one statement again if the store moves to a driver without a bound-parameter limit

### A folder import is one journal transaction, 2026-11-10

Implements the AC-8 clause that a failed or partial import leaves the log without a claim that the folder was imported. MarkdownProjector.importFolder reads and decodes every memory file before it appends anything, then appends every NodeCreated (each naming its predecessor through after, with the occurrence anchor as import provenance), one FileImported per file (an empty file included) and the FolderImported bootstrap event last, in one MemoryLog.appendMany, which is one SqlEventJournal transaction. A read, decode or digest failure appends nothing, and a failure inside the transaction rolls every row back, so no completion marker is needed: the FolderImported event is the claim and it commits with the nodes or not at all. The import never writes to the folder. Measured on this workstation before deciding: the frozen goals sample (172 files, 1,065,752 bytes, 10,792 nodes, 10,965 entries) imports in about 1.0 s; the whole live goals tree (3,593 files, 31,705,138 bytes, 295,570 nodes, 299,164 entries) imports in 48.4 s in one transaction with a peak resident set of about 5.1 GB, and a rebuild from the log alone takes 9.7 s and reproduces every file. A Claude Code memory folder is tens of files, three orders of magnitude below the tree, so one transaction per folder holds with a wide margin. The AC-8 test aborts the transaction at its 5,000th entry with a SQLite trigger and checks the log is empty and every file byte-identical. Code: packages/tooling/library/agent-memory-store/src/MarkdownProjector.layer.ts. Rejected: per-file batches plus a completion marker (a second protocol whose half-written state every reader must recognise) and writing a marker file into the folder (the import must leave the folder untouched).

Lane agent-memory-store-p1

Reverse: Split the import into per-file batches closed by an explicit completion marker, by decision file citing a memory folder whose single transaction exceeds the busy timeout of a concurrent writer or the memory of the host

### Markdown partition construct mapping and node boundaries, 2026-11-10

Amends granularity-row-and-list-item with the cut of every construct the decision left open, for the pure partition in packages/tooling/library/agent-memory-store/src/MarkdownPartition.parser.ts. The file is parsed with @beep/markdown (GFM, frontmatter capture on). Ranges count UTF-16 code units, the unit MarkdownRange and TextAnchor use, and no boundary falls inside a surrogate pair, so the node texts concatenate to the file and their UTF-8 bytes equal the file bytes. A content node starts at the start of its first line, so indentation and container prefixes ride inside the node and list markers stay inside list-item nodes (S14); gap nodes hold the bytes between blocks (line terminators, blank lines, a leading byte order mark), while trailing whitespace on a line stays in its node. A list item with one child block, or whose first child is a container, is one listItem node; otherwise its marker and first block are the listItem node and each later child block (a nested list item, a continuation paragraph, a table row) is its own node, which keeps nested bullets at item granularity (S1). A table header row and its delimiter row are one tableRow node because their column counts must agree; each body row is a tableRow node. Frontmatter, thematic breaks and HTML blocks keep their own kinds; indented code maps to codeFence; a block quote, a link reference definition and a footnote definition are each one paragraph node, prefixes included. @beep/markdown carries the MDX node vocabulary but does not parse MDX, so MDX syntax partitions as ordinary Markdown. A leading byte order mark is stripped before parsing (the parser otherwise reads it as paragraph text) and kept as the first gap node; CRLF and tabs stay verbatim; a file without a trailing line terminator ends on its last content node; an empty file has no nodes. Rejected: a blockquote kind or a definition kind (NodeKind stays as P0 landed it; recall indexes these as prose) and splitting block quotes into their children (a quote marker would land in a gap, the S14 hazard).

Lane agent-memory-store-p1

Reverse: Re-cut the affected constructs by decision file citing an AC-1 or merge replay where a node boundary in this mapping fails byte identity or strands a structural marker

### The Markdown partition is total and coarsens on unusable parser positions, 2026-11-10

The partition in packages/tooling/library/agent-memory-store/src/MarkdownPartition.parser.ts is total: it never fails and never drops a byte, whatever @beep/markdown yields. Positions are checked, not trusted, and each failure coarsens only as far as it must. A top-level block whose child spans overlap, run backwards, leave the block or split a surrogate pair becomes one node of the block kind (a list becomes one listItem node, a table one tableRow node), and the partition reports fallback block. Top-level positions that overlap, run backwards, leave the file or split a surrogate pair make the whole file one paragraph node, fallback file. A file the parser rejects outright (a hardening guard such as the 256-level nesting cap) is one paragraph node, fallback unparsed. Zero-width spans are dropped because they hold no bytes. MarkdownPartition carries the fallback level so the importer and the projector can report coarse files instead of hiding them. On the 3,579 tracked goals Markdown files every file partitions at fallback none. Rejected: failing the import on a parse anomaly (AC-8 needs every nonempty folder importable) and repairing overlapping positions by clipping (a guess about which node owns the bytes).

Lane agent-memory-store-p1

Reverse: Replace the fallback ladder by decision file citing a file where a coarse node blocks an AC-2 or AC-3 merge that a finer recovery would admit

### Memory files are .md files outside dot segments, 2026-11-10

The projector reads and writes only the regular files under the folder whose relative path ends in .md (lowercase, case-sensitive) and has no path segment starting with a dot. The rule matches the Claude Code memory folder (MEMORY.md plus note files) and the goals fixture, keeps version-control folders, editor swap files and the projector's own temporary files (.name.agent-memory-store-tmp, written then renamed) out of the log, and leaves every other file in the folder untouched: never read into the log, never written, never deleted. Upper-case .MD and other Markdown extensions are not memory files. Code: isMemoryFilePath in packages/tooling/library/agent-memory-store/src/MarkdownProjector.layer.ts; test: the memory-file rule case in test/MarkdownProjector.test.ts. Rejected: every file in the folder (binary attachments cannot be partitioned) and a configurable glob (no second consumer asks for one).

Lane agent-memory-store-p1

Reverse: Widen or narrow isMemoryFilePath by decision file citing a memory folder file the rule misclassifies

### The memory log refuses a NodeCreated whose predecessor is not a node of the same file, 2026-11-10

A file is the concatenation of its nodes placed by their predecessors (decision file-is-an-ordered-node-partition), but the log checked only that a created node had no heads. A NodeCreated naming a predecessor of another file, or a node the log does not hold, committed and then appeared in no export, with no error: review reproduced both. The log now refuses both inside the journal transaction, where the compare-and-set already runs. A fourth store table, agent_memory_nodes (node_id, file_path), records the file of every created node in the same transaction; the NodeCreated handler looks up the named predecessor and fails with the new tagged UnplacedNodeError (nodeId, filePath, after, afterFilePath, none when the predecessor is unknown), and the whole batch rolls back. A predecessor created earlier in the same batch counts, so an import or an insert run lands in one appendMany. This is a minimal contract change: NodeCreatedEvent declares the union of StaleParentsError and UnplacedNodeError as its error schema and MemoryLog's append and appendMany add UnplacedNodeError. P2 admission still holds an insert after a missing node (insertAfterMissingNode) before it reaches the log; this check is the log's own floor under it. Code: packages/tooling/library/agent-memory-store/src/MemoryLog.layer.ts, src/MemoryLog.service.ts, src/NodeEvent.events.ts and src/AgentMemoryStore.errors.ts; tests: the unplaced-node case in test/MemoryLog.test.ts and the NodeCreated error schema case in test/NodeEvent.test.ts. Rejected: surfacing unplaced nodes only at export (the log would keep content no projection shows) and reusing MemoryLogError (a refusal is not an I/O failure).

Lane agent-memory-store-p1

Reverse: Drop the placement check and have exportFolder fail on unplaced nodes instead, by decision file if a replica must accept such a node from a remote

### MemoryFilePath carries the memory-file rule, so no event can name a path outside the folder, 2026-11-10

Review finding on PR 3058: MemoryFilePath was only a non-empty PosixPath, so an agent-written NodeCreated could open ../escape.md, .git/x.md or notes.txt and exportFolder would write it. The rule of decision memory-files-are-md-files-outside-dot-segments now lives in the schema as one pattern check: a relative path ending in .md whose segments are non-empty and do not start with a dot (PosixPath already refuses backslashes). isMemoryFilePath is the derived guard S.is(MemoryFilePath). Every payload, store row and projection that carries a file path decodes through it, so the append fails before the journal writes anything (a MemoryLogError whose cause is the schema error naming filePath, and the batch appends nothing), and the projection refuses such an entry at decode, so export fails with ProjectionError before any write even when a damaged database or a writer that skipped the schema holds one. Tests: the memory-file-rule append case in test/MemoryLog.test.ts and the damaged-entry export case in test/MarkdownProjector.test.ts. Rejected: a separate path check in the NodeCreated handler (the schema already refuses at encode, and a second rule could drift from the scan's).

Lane agent-memory-store-p1

Reverse: Return MemoryFilePath to a non-empty PosixPath and filter at the scan, by decision file citing a memory path the schema rule refuses wrongly

### MemoryLog keeps heads, holds and commit order in store tables written in the journal transaction, 2026-11-10

Implements memory-log-checks-parents-in-the-journal-transaction and the open-hold check of held-writes-are-log-events. Verified in the Effect reference checkout: EventLog.writeMany runs every handler of a batch, in input order, inside the effect it passes to EventJournal.writeMany, and SqlEventJournal.writeMany runs that effect inside sql.withTransaction before it inserts the entries; write is writeMany of one event. The handlers use the same SqlClient, so their statements join that transaction, and a handler failure rolls back the store rows and commits no journal entry. @effect/sql-sqlite-bun opens writable transactions with BEGIN IMMEDIATE and a busy timeout, so two connections to one file serialize and the later one reads the earlier one's heads. Three tables hold the read models: agent_memory_heads (node_id, revision_id), replaced by every NodeCreated, NodeRevised, NodeStatusChanged and NodeRetired that passes the check; agent_memory_holds (hold_id, open), where WriteHeld inserts an open row and never reopens a settled HoldId and HoldResolved closes an open row or fails with HoldNotOpenError; and agent_memory_order (sequence, entry_id, event, primary_key), numbering every committed entry MAX(sequence) + 1 in commit order. cursor is that count, entriesAfter(c) reads sequences above c and fetches the entries with EventJournal.entriesById, and history(n) reads the node events whose primary key is n in commit order, so a WriteHeld naming n (keyed by its HoldId) is not part of it. The rows commit with the journal rows, so reopening a file finds them and nothing is rebuilt. A SQL or decode failure inside a handler, and a write lock the busy timeout could not take, reach the caller as MemoryLogError, not as a defect. Code: packages/tooling/library/agent-memory-store/src/MemoryLog.layer.ts; tests: packages/tooling/library/agent-memory-store/test/MemoryLog.test.ts. Rejected: deleting a resolved hold's row (a repeated WriteHeld would reopen it), numbering the cursor by journal entry id (a remote replay can commit an older id later, as the parent decision says) and a store-level lock (the journal transaction already serializes writers).

Lane agent-memory-store-p1

Reverse: Rebuild the store tables from the journal on open instead of persisting them, by decision file citing a journal write that bypasses the handlers

### P1's AC-1 edit replay is generated node edits; S1's real-history replay stays the spike evidence, 2026-11-10

AC-1 needs at least 3,000 replayed edits with zero confinement failures. S1 replayed 5,168 real goals history edits as raw-slice patches; expressing a history edit as node operations is op capture, which is P2, and hosted checkouts are shallow and have no history to replay. P1 therefore replays generated node edits against the log: a seeded generator (mulberry32, seed 20261110) visits every file of the frozen goals sample once per round and rotates through every (kind, operation) pair of the kinds that file holds: slot k = round + file index names kind k mod m of the file's m kinds and operation floor(k / m) mod 3 of revise, insert and retire, so the two choices are independent (the first version drew both from k mod 9 and k mod 3, which tied each kind to one operation, and counted an insert against the wanted kind rather than a node it touched). A revision or retirement touches a node of the wanted kind; an insert goes right after one, and one insert in ten goes to any position instead, tombstones, gaps and the top of the file included. Edits are counted by the kind of the node actually touched, an insert by the kind of its predecessor. Each round's edits are appended in one appendMany and exported once, and each file is checked to differ from its previous bytes only inside the touched node's span and to equal the test's own model of the ordering rule. Measured: n = 3,096 edits in 18 rounds (915 revisions, 1,099 inserts, 1,082 retirements), 0 outside the span, 3/n = 0.097% (at or below the 0.1% bar). Every one of the nine node kinds is in the sample and took at least 3 revisions, 3 retirements and 3 inserts after it, which the test asserts; html (7, 6, 6) and thematicBreak (5, 6, 3) are the scarcest because a handful of sample files hold them, and the other kinds took 24 to 319 of each. The concurrent-insertion case writes two inserts naming the same predecessor against one base from two connections and commits them one after the other, because bun:sqlite blocks the thread on a busy lock and two in-process connections that interleave inside a transaction deadlock; 0 of 2,940 positions read as a deletion. S1's 5,168/5,168 remains the spike evidence for real history. Test: packages/tooling/library/agent-memory-store/test/MarkdownProjector.byte-identity.test.ts. Rejected: a real-history replay through a hand-written diff-to-operations step (that step is P2's op capture, and a P1 copy would be a second capture path).

Lane agent-memory-store-p1

Reverse: Replace the generated replay with a replay of real goals history expressed as node operations, by decision file once P2 op capture can turn a history diff into node operations

### projectNode returns the raw-slice edit of the node's latest event and refuses one the reparse check finds disturbing, 2026-11-10

The contract takes only a NodeId, so projectNode returns the edit that brings the node's span from its state before its latest event to its current state, with every other node of the file at its current state: an insertion of length zero for a created node, a replacement for a revision and an empty replacement for a retirement. Applied event by event it keeps a file current; when other nodes of the file changed in between, exportFolder rebuilds the file instead. The reparse check of scoreboard design item 5 runs on every edit: the file before the edit is partitioned, the edit is widened to the node run it touches and checkReplacement partitions the result. When any node outside that run changes kind or text (a deleted blank line joining two paragraphs, an insert without its separator), projectNode fails with ReparseRefusedError naming the disturbed node indices (first ProjectionError operation reparseCheck; decision projector-refusals-are-typed-errors), and the caller exports the file; the log stays the authority and its bytes are exact either way. P1 has no admission to hold such a write; P2 runs the same check before a write lands. Measured on the AC-1 replay: of 774 projectNode cross-checks, 400 were refused (223 inserts without a separator, 173 retirements, 4 revisions) and the 374 returned edits all reproduced the exported bytes. Code: packages/tooling/library/agent-memory-store/src/MarkdownProjector.layer.ts; tests: the projectNode cases in test/MarkdownProjector.test.ts and the cross-check in test/MarkdownProjector.byte-identity.test.ts. Rejected: returning a disturbing edit unflagged (the caller would apply a write whose node structure differs from the log) and reading the file from disk (the contract names no folder).

Lane agent-memory-store-p1

Reverse: Return the widened edit covering every disturbed node instead of refusing, by decision file once P2 admission holds disturbing writes before they reach the log

### Projector refusals are typed errors; ProjectionError is left to I/O and decoding failures, 2026-11-10

Supersedes the error choice in projectnode-refuses-a-disturbing-edit-in-p1 and second-import-is-idempotent-on-a-projected-folder, which both refused with ProjectionError. The P0 contract docblock reserves ProjectionError for I/O and decoding failures, and a caller could tell those refusals from a real failure only by comparing the operation string; a foreign folder on importFolder and a read failure on importFolder could not be told apart at all. This is a minimal contract change: two tagged errors are added and the MarkdownProjector error unions widen. importFolder fails with ForeignFolderError (root, folderDigest) when the log already holds a folder and the given one does not pass the export fence (decision export-fence-is-bound-to-the-folder). projectNode fails with ReparseRefusedError (nodeId, path, disturbed node indices) when the reparse check finds the edit disturbing. UnimportedFolderError keeps its meaning, but its root and folderDigest are now optional: exportFolder always sets both, while projectNode, which names no folder, sets neither when the log holds no FolderImported, instead of naming the file's relative directory and the digest of an empty listing. ProjectionError remains for file system, decoding and journal failures and for a node the log does not hold. Code: packages/tooling/library/agent-memory-store/src/AgentMemoryStore.errors.ts, src/MarkdownProjector.service.ts and src/MarkdownProjector.layer.ts; tests: the second-import, reparse-refusal and unimported projectNode cases in test/MarkdownProjector.test.ts, the error schema cases in test/AgentMemoryStore.errors.test.ts, and the AC-1 replay, which now counts refusals by their tag. Rejected: keeping ProjectionError and rewriting the docblock (the refusals stay stringly typed) and reusing UnimportedFolderError for the second import (the folder may well be importable into an empty log; the refusal is that this log holds another one).

Lane agent-memory-store-p1

Reverse: Fold the refusal errors back into ProjectionError by decision file if callers never branch on them, and rewrite the MarkdownProjector docblock to match

### The reparse check compares every other node by kind and text, 2026-11-10

The reparse check (scoreboard design item 5) is checkReplacement in packages/tooling/library/agent-memory-store/src/MarkdownPartition.parser.ts. It takes the base partition and a NodeReplacement naming a run of node indices [start, end) and its new text, so one call covers replacing one node (end = start + 1), inserting between nodes (end = start) and deleting (empty text). It partitions the edited text once and matches the longest prefix and suffix of nodes by kind and text; nodes outside the run that fall in neither are the disturbed indices, and the check is stable when there are none. The result returns the edited partition and the region of edited nodes covering the replacement, so the projector reuses them instead of partitioning twice. A run outside the partition fails with the typed NodeReplacementOutOfRangeError; the partition itself never fails. The comparison is by kind and text, not by nesting: deleting a list item first line can re-parent its indented continuation under the previous item while every other node keeps its text and kind, and that reports stable. Rejected: comparing ranges (every node after an edit shifts) and comparing tree paths (the projector holds node texts from the log, not trees).

Lane agent-memory-store-p1

Reverse: Add a nesting comparison by decision file citing a replay where a stable check let a projected edit re-parent a node

### A second import of the imported folder returns the current base; any other folder is refused, 2026-11-10

FolderImported carries a digest and no root, and FileImported paths are relative to the folder, so one log holds exactly one memory folder (one store database per memory folder, which matches the per-repository Claude Code memory folder). When the log already holds a FolderImported, importFolder appends nothing: if every memory file now in the folder holds bytes this store imported from or wrote to that same folder (the export fence, decision export-fence-is-bound-to-the-folder), it returns the base of the log's current state, so a bootstrap step can run import unconditionally; otherwise it fails with ForeignFolderError (first ProjectionError; decision projector-refusals-are-typed-errors), because re-importing would mint a second set of nodes for the same bytes and an edited or foreign folder must reach the log as captured operations (P2 admission, P5 memory admit), not as a fresh import. Tests: the second-import case in packages/tooling/library/agent-memory-store/test/MarkdownProjector.test.ts. Rejected: re-importing and diffing (op capture is P2) and appending a second FolderImported (two claims for one folder).

Lane agent-memory-store-p1

Reverse: Let one log hold several folders by adding a folder identity to FolderImported and FileImported, by decision file once the store must project more than one memory folder

### The live MemoryLog Layer takes a SqlClient and loads the Bun driver by dynamic import, 2026-11-10

Implements memory-log-on-effect-eventlog without changing the MemoryLog contract. MemoryLogLayer is Layer<MemoryLog, MemoryLogError, SqlClient>: it builds SqlEventJournal (tables agent_memory_journal and agent_memory_remotes), EventLog.layerEventLog, a throwaway EventLog Identity from EventLogEncryption.layerSubtle (no remote reads it) and the MemoryEvents handlers, all over the one SqlClient the caller provides, so the projector and the P4 indexes can share the SQLite file and its transactions. makeMemoryLogSqliteLayer(config) opens that client through @beep/sqlite, and MemoryLogTestLayer is the same over ":memory:", a fresh private database on every build. @beep/sqlite wraps @effect/sql-sqlite-bun, which imports bun:sqlite at module load, and the package index is loaded by suites that run under Node (the coverage command and plain bunx vitest), so the driver is reached with a dynamic import when the layer is built, as the driver's own test does; under Node the build fails with MemoryLogError operation loadDriver and the MemoryLog suite is skipped there, running only under bunx --bun vitest. Code: packages/tooling/library/agent-memory-store/src/MemoryLog.layer.ts and MemoryLog.test-layer.ts. Rejected: a static driver import (the package index stops loading under Node), keeping the live layer out of the index (the next stage would import a deep path), and a Node SQLite driver beside the Bun one (a second substrate the spikes did not measure).

Lane agent-memory-store-p1

Reverse: Import @beep/sqlite statically in MemoryLog.layer.ts and drop MemoryLogLayer's SqlClient requirement by decision file, once every suite that loads the package index runs under Bun

### The log refuses a second FolderImported in the writer transaction, 2026-11-10

Review finding on PR 3058: the projector decided first import from its in-memory fold, outside the journal transaction, so two first imports racing on one database both landed and doubled every file. The FolderImported handler now fails the batch with FolderAlreadyImportedError when the order table already holds a FolderImported, inside the writer transaction, so the whole losing import (its NodeCreated and FileImported events with it) appends nothing. Matching decision second-import-is-idempotent-on-a-projected-folder, the losing projector returns the current base when its folder digest equals the imported one and fails with ForeignFolderError otherwise. The finding's second ask, refusing a NodeCreated with no predecessor for a file that already has a root, is not taken: several roots are how an insert at the top of a file is written (decision file-is-an-ordered-node-partition orders them newest first, and the AC-1 replay inserts at the top), and the race is closed by the FolderImported check because an import is one journal transaction (decision folder-import-is-one-journal-transaction). The import's export-fence rows and its batch commit in one SQL transaction (the journal's writer transaction runs on the calling fiber's connection, so it nests as a savepoint), so a refused or failed append rolls the rows back and a folder holds fence rows only when its own import landed; otherwise a later export would pass the fence and overwrite that folder with the log's files. A same-digest loser records its rows after the refusal, because its bytes are the log's. Tests: the second-FolderImported case in test/MemoryLog.test.ts, the two lost-race cases and the failed-append case in test/MarkdownProjector.test.ts.

Lane agent-memory-store-p1

Reverse: Drop the FolderImported handler check and the race mapping together with decision second-import-is-idempotent-on-a-projected-folder, once one log may hold several folders

### The projection fold advances its cursor with each entry and lists a node once, 2026-11-10

Review finding on PR 3058: applyEntries mutated the fold entry by entry but moved the cursor once after the loop, so an interruption or a payload that failed to decode mid-batch made the next catch-up fold the same entries again, and pushTo listed a node twice, doubling it in the export. Each entry's payload is now decoded first, then its change and its cursor step run with no yield between them, so the cursor always sits right after the last folded entry; pushTo also skips a node id already listed. catchUp runs only inside importFolder, exportFolder and projectNode, which all hold the projector's one-permit semaphore, so two fibers never fold one projection at once; two projector layers hold two projections. Tests: test/MarkdownProjection.test.ts.

Lane agent-memory-store-p1

Reverse: Advance the cursor after the whole batch again, by decision file, only together with a fold into a copy that is swapped in whole

### Admission judges and appends each operation inside one SQL transaction and re-judges a stale append, 2026-11-12

The task bar is that an operation's check and its append cannot be separated by another writer. The log's compare-and-set covers only the node's own parents: an insert whose predecessor is retired between the judgment and the append would still land, unflagged as insertUnderDeletedAnchor. The live Admission layer therefore runs each operation's judgment (it reads the node's history from MemoryLog) and its append inside sql.withTransaction on the SqlClient the log writes through. On SQLite that is BEGIN IMMEDIATE, so the write lock is held from the read to the commit, and the journal's own writer transaction nests as a savepoint (the P1 fact that EventLog.write runs on the caller's fiber and connection). It is not a second lock: it is the database's write lock the log already uses. The log's compare-and-set still runs and is still the authority: a StaleParentsError from the append makes the layer judge the same operation again against the new heads, up to two more times, and any other log failure is an AdmissionError. resolve runs its re-judgment and its append in one transaction the same way; whether the hold is still open is the log's own check, so of two resolvers exactly one settles a hold and the other gets HoldNotOpenError. Each operation is its own transaction, so one contested node never blocks or rolls back the batch's other operations. Measured by the race tests in test/Admission.layer.test.ts, which run the other writer inside the first one's transaction between its read and its append on the shared connection: two revisions of one node end with one landed and one held, and two concurrent status moves end at the furthest state with no hold. Code: packages/tooling/library/agent-memory-store/src/Admission.layer.ts. Rejected: a store-level lock file (a second locking scheme beside SQLite's) and checking the predecessor inside the log handler (a schema change to NodeCreated's admission that P2 does not need).

Lane agent-memory-store-p2

Reverse: Drop the per-operation transaction and rely on the log's compare-and-set alone by decision file if a non-SQLite journal cannot nest the journal write in a caller transaction

### Admission names what it refused: unknownNode, unknownRevision and statusOutsideLifecycle join the violation codes, 2026-11-12

AC-3 needs every held or rejected write to carry a typed finding, and the P0 MemoryViolationCode domain had no code for the outright refusals the P2 admission layer makes: an operation naming a node the log never held (or an insert whose predecessor is no node of its file, the same rule as the log's UnplacedNodeError), an expected revision that was never a revision of its node, and a status move whose field has no lifecycle, whose target value is outside it or whose node text holds no single value of it. Reusing staleExpectedRevision or identityLookupFailed would make a never-existed revision read as a lost race and a malformed status move read as a retrieval finding. The domain gains unknownNode, unknownRevision and statusOutsideLifecycle; MemoryGateViolation and the projection onto ClaimGateResult are unchanged. Code: packages/tooling/library/agent-memory-store/src/Admission.models.ts. Rejected: one generic malformedOperation code (a consumer of the replay could not tell a bad base from a bad lifecycle).

Lane agent-memory-store-p2

Reverse: Fold the three codes back into heldConflict with distinguishing messages by decision file if consumers never branch on them

### An operation that depends on an insert of its batch that did not land is held with insertAfterMissingNode, 2026-11-12

Admission judges a batch in order and keeps the ids of the batch's inserts that did not land (held or rejected; P2 has no deferral, which arrives with exact-hash dedupe in P3). An insert placed after one of them is held with insertAfterMissingNode on path afterNodeId, as decision file-is-an-ordered-node-partition requires. A replace, delete or status move naming one of them is held with the same code on path nodeId, rather than rejected as an unknown node, so the write waits for its insert's resolver instead of being lost; resolving it with theirs before its node exists returns rejected with unknownNode and keeps it open. An operation on a node the batch inserted and that landed is judged like any other, against the revision its capture step computed. Code: packages/tooling/library/agent-memory-store/src/Admission.layer.ts; test: the batch dependency case in test/Admission.layer.test.ts. Rejected: a dedicated dependency code (it needs another literal for a case the replay has not yet measured).

Lane agent-memory-store-p2

Reverse: Reject such operations with unknownNode instead, by decision file, if the adversarial replay shows held dependents only add resolver work

### Op capture derives base node kinds from the partition of the base text, 2026-11-12

BaseNode carries a node id, a revision and an occurrence anchor whose quote is the node's exact text, but no kind, and the exported base is built by the MarkdownProjector layer, so adding a kind field would change a P1 contract and its producer. Capture needs base kinds only to tell a kept node from a same-text node of another kind and to refuse a replace that would change a node's kind. It derives them: the concatenated quotes of a base file are partitioned, and when that partition cuts exactly the base nodes (same count, same texts) each base node takes the kind of its partition node. When it does not (a log state whose node boundaries differ from a fresh parse, such as a P1 insert without its separator), the file's base kinds are unknown: kept nodes then match by text alone and no changed pair becomes a replace, so every changed node is a delete plus an insert. Operation.models.ts is unchanged. Code: packages/tooling/library/agent-memory-store/src/internal/OperationCapture.align.ts; tests: the misaligned-base case in packages/tooling/library/agent-memory-store/test/OperationCapture.test.ts. Rejected: adding kind to BaseNode in this lane (a contract change for a case the derivation already covers) and refusing a misaligned base (the log can hold one, and capture can still express any edit of it exactly).

Lane agent-memory-store-p2

Reverse: Add kind to BaseNode and read it in capture by decision file once a producer other than the projector exports bases

### Op capture is pure with an injected node id minter and a digest-verified variant, 2026-11-12

Capture is a pure function over values with no file system and no log: captureBatch(base, edits, author, mintNodeId) returns a Result of an optional OperationBatch (none when no file changed). An edit is a FileEdit tagged on edit: edited (a base file and its whole new text), created (a file the base lacks) or removed (a base file the agent deleted). A removed file and an edited file whose text is empty produce the same batch, a delete of every node, because the operation vocabulary has no file-level operation in P2; a created file with empty text produces nothing. Edits are captured in path order whatever order they arrive in, and the NodeId of each insert comes from an injected minter (uuidV7NodeIdMinter for real captures, seededNodeIdMinter for reproducible tests), so equal inputs give equal batches apart from minted ids. CRLF, a leading byte order mark and a missing trailing newline need no special case: the partition keeps them verbatim in their nodes. Capture refuses with typed errors instead of emitting a batch: CaptureEditRefusedError for a path outside the memory file rule, an edited or removed file the base lacks, a created file the base has, and two edits of one path; CaptureBaseRefusedError for a base listing a path or a node id twice or whose anchors do not tile the file; MintedNodeIdCollisionError when the minter returns an id the base or the batch holds. captureBatchVerified additionally hashes the node texts of every base file an edit names and refuses a mismatch with the recorded fileDigest (digestMismatch); it needs the Digest service, so the pure function trusts the digests. applyOperations is the reference semantics the invariant is tested against: replace swaps text, insert places its node right after its predecessor (the log's newest-first rule puts it there), delete removes the node. Code: packages/tooling/library/agent-memory-store/src/OperationCapture.diff.ts, src/OperationCapture.apply.ts, src/OperationCapture.models.ts and src/OperationCapture.errors.ts. Rejected: minting from the SecureRandom service inside capture (it would make capture effectful and its tests unreproducible) and a file-level remove operation (no event can record one in P2).

Lane agent-memory-store-p2

Reverse: Make capture an Effect over SecureRandom and Digest by decision file if a caller needs capture without a minter

### Op capture pairs only equal-count runs between kept nodes, 2026-11-12

Op capture turns an agent's edited memory files into node operations against the exported base. Each edited file is partitioned with the existing MarkdownPartition parser and aligned with the base nodes of the same file by effect/TextDiff (diffWith: Myers' minimal edit script after common prefix and suffix trimming), two nodes being equal when their exact texts are equal and their kinds agree. A kept node produces no operation. Each changed region between two kept nodes is a run of k base nodes replaced by j edited nodes, and P2 pairs only what position justifies: when k = j the nodes pair in order, a pair whose kinds agree becomes a replace naming the base revision, and a pair whose kinds differ becomes a delete and an insert (a replace keeps the node's kind in the log); when k != j nothing pairs, every base node of the run is deleted and every edited node is inserted. Similarity matching belongs to P3's identity tiers, so P2 never guesses which base node an edited node continues. A moved node is a delete plus an insert. Gap nodes (blank lines, separators, a byte order mark) are nodes like any other, so editing whitespace is a replace or insert of a gap and round-trips byte for byte. Every insert names the node the edited text puts right before it: a kept or replaced base node, or the node minted by the previous insert, so an inserted run is a chain; it never names a node the batch deletes, and an insert at the top of a file has no predecessor. Because capture re-partitions the whole edited file, an edit that changes how a neighbouring node parses (deleting the blank line between two paragraphs) makes that neighbour part of the changed run, and the node list the batch produces equals the partition of the edited text by kind and text; the reparse check therefore cannot find a disturbed node after the whole batch lands, and no lossy batch exists to report. Admission that runs the reparse check per operation on intermediate states can still see a paragraph inserted before its separator, so the check belongs on a file's whole captured run. Measured on the frozen goals sample (516 seeded edits, three per file, node-level revisions, inserts, deletions and moves plus raw character splices across node boundaries): 3,659 operations against a lower bound of 3,051 (the sum over changed runs of max(k, j), which no capture can beat), ratio 1.1993; 534 of 1,143 changed runs were equal-count runs. Code: packages/tooling/library/agent-memory-store/src/internal/OperationCapture.align.ts and src/OperationCapture.diff.ts; tests: test/OperationCapture.test.ts and test/OperationCapture.property.test.ts. Rejected: pairing unequal runs from either end or by kind sequence (a continuation position cannot justify) and a hand-written LCS (Effect ships TextDiff).

Lane agent-memory-store-p2

Reverse: Pair unequal runs with P3 identity tiers by decision file citing a goals-sample capture replay where the tier never mis-pairs a node

### The P2 three-way merge decides per whole node text and holds everything it cannot prove safe, 2026-11-12

PLAN.md asks for a three-way merge on disjoint nodes, and AC-2 forbids any admitted write that drops another writer's content. Two writers that changed different nodes need no merge: each operation is judged on its own node by the per-node compare-and-set at row and list-item granularity, so both land. For one node the merge compares whole texts only: base is the text at the revision the writer named, ours the log head text, theirs the writer's text. When ours equals theirs, or theirs equals base (the writer changed nothing), the log keeps its text and the write lands at the head revision with no event appended. When ours equals base (the node moved on but its text is back at the base, as after a revert), the writer's text is written on the current head. Anything else is held with staleExpectedRevision and both texts. A retire is the same rule: it lands on the current head when the head text is still the base text and is held with deleteVersusEdit otherwise; an edit of a retired node is held with deleteVersusEdit and no logged text; a retire of a node already retired lands at its tombstone. No text is ever merged inside itself (ruling 2; S14 measured a character-level CRDT mashing 48 of 70 contested nodes), so a held write is the only outcome that can carry two different texts. Code: threeWay in packages/tooling/library/agent-memory-store/src/internal/AdmissionPlan.ts and the judge in src/Admission.layer.ts; tests: the merge cases in test/Admission.layer.test.ts. Rejected: line-level diff3 inside a node (S14's line merge reproduced a mashed status row) and last-writer-wins on free text (drops content).

Lane agent-memory-store-p2

Reverse: Admit a finer merge (for example table-cell or list-marker aware) by decision file citing an S14-style replay with zero silent loss

### resolve re-judges a held write on the node's current head and writes the resolution under a fixed resolver lineage, 2026-11-12

The Admission.resolve contract takes a HoldId and a ConflictResolution and names no resolver, but HoldResolved and any revision it produces need an author. The layer writes HoldResolved, and a merged text, under the constant lineage agent-memory-store:resolve (AdmissionResolverLineage); a theirs resolution writes the held text under the lineage that submitted it, because the text is that writer's. Outcomes: ours appends only HoldResolved and returns rejected with heldConflict, since the held write was not applied. theirs and merged judge the held operation again on the node as the log holds it at resolve time and write on its current heads together with HoldResolved in one journal transaction, returning landed: a held revise writes its text (reviving a retired node), a held retire retires, a held status move re-runs the lifecycle guard, and merged writes the resolver's text as a revision. A held insert is created at the resolver's placement, or at its submitted one, after a retired predecessor if need be. When the re-judgment cannot apply the write (the predecessor is still missing, the node never reached the log, the status guard refuses) nothing is appended, the hold stays open, and resolve returns held (same HoldId) or rejected with the finding, so the resolver can choose again or close the hold with ours. The read model keeps ours as the text at the head revision the hold recorded and theirs as the submitted text, absent for a retire and for a status move, whose submission is a transition, not a text. Code: packages/tooling/library/agent-memory-store/src/Admission.layer.ts. Rejected: changing the resolve signature in P2 (the contract is implementable as written) and closing a hold whose resolution could not be applied (it would lose the held write).

Lane agent-memory-store-p2

Reverse: Add a resolver lineage parameter to Admission.resolve by major changeset if the operator review surface needs per-resolver provenance

### A typed status field is one whole lifecycle token in a node's text, moved by setStatus against the log head, 2026-11-12

S14b: status cells, counters and pointers leave the held path as typed last-writer fields, and the lifecycle guard must reject backward moves (12 of 14 regress without it). Decision status-values-are-manifest-data makes the lifecycles runtime data, so the admission layer takes them as StatusFields (one StatusLifecycle per field) when it is built. A node is a typed status field for a field when its text holds exactly one value of that field's lifecycle as a whole token, a token being bounded by the text's ends or by characters that are not letters, digits, underscore or hyphen (so progress is not read inside in-progress). Only the setStatus operation takes the status path; a replace of the same node stays on the text path. setStatus is judged against the value the log head text holds, never the writer's base revision or the transition's from: an equal value lands at the head with no event (idempotent), a later value is written on the current head as a NodeStatusChanged whose transition records the head value as from and whose text changes only that token, and an earlier value is rejected with backwardStatusMove. Concurrent moves are therefore never held: in every interleaving the furthest value wins and the others are rejected or idempotent. A field with no lifecycle, a value outside it and a node text with no single value are rejected with statusOutsideLifecycle. The only held status move is one on a retired node (deleteVersusEdit). Code: packages/tooling/library/agent-memory-store/src/StatusField.models.ts and src/Admission.layer.ts; tests: the typed status field cases in test/Admission.layer.test.ts. Rejected: a status node kind (needs a partition change and a re-import) and trusting the transition's from (lets a stale writer move a field backward).

Lane agent-memory-store-p2

Reverse: Mark status nodes explicitly (a node kind or a manifest-generated node registry) by decision file if token reading misreads a real memory file

### Admission does not run the reparse check; the log's bytes stay exact and capture absorbs a disturbed partition, 2026-11-13

Decision projectnode-refuses-a-disturbing-edit-in-p1 ends with "P2 runs the same check before a write lands", and the admission lane left it open. It is not taken. A memory file is the exact concatenation of its live nodes' texts in document order (decision file-is-an-ordered-node-partition), so the log's bytes are exact whatever admission lands, and exportFolder rebuilds a changed file from the log rather than patching it. The reparse check protects one thing only: an incremental projectNode edit whose neighbours would change kind or text if the file were partitioned again, and projectNode already refuses those with ReparseRefusedError so the caller exports the file. Running the check inside admission would hold or refuse writes that lose nothing: op capture partitions the whole edited file again, so any neighbour whose parse the edit disturbs is already in the captured batch (decision op-capture-pairs-only-equal-count-runs), and a per-operation check would refuse the intermediate states of a correct batch (a paragraph inserted before its separator gap), as the op capture lane found. Two concurrent writers can still leave a file whose partition no longer matches its log nodes (each batch was clean against the base, their combination is not); the bytes stay exact and the next capture handles it, because a base whose node cut differs from a fresh partition has unknown kinds and captures as deletes and inserts (decision op-capture-derives-base-kinds). Code: no admission change; the AC-2 replay checks every run's export against the log byte for byte. Rejected: a file-context reparse check per admitted batch (holds clean writes, and needs every live node of the file inside the admission transaction).

Lane agent-memory-store-p2

Reverse: Add a file-context reparse check to admission by decision file citing a replay where a disturbed partition loses content or breaks a later capture

### Every string the memory log stores is well-formed UTF-16, 2026-11-13

A schema-derived property added in P2 (a HoldResolved payload round-trips through the journal codec admission reads it with) failed on an author lineage holding a lone surrogate: the journal stores payload strings as UTF-8, which cannot encode a lone surrogate, so the string came back with U+FFFD in its place. Any free string in a log payload had the same defect: a node text, a submitted or merged text, a status value or field name, or a lineage. The store compares texts as strings (the three-way merge, the status token) and hashes them, so a text it judged before the append would differ from the text it later reads back. The fix is at the schemas, not in the codec: isWellFormedText (String.prototype.isWellFormed) is a check in NodeIdentity.models.ts, and LineageId, StatusValue, the status field names of StatusLifecycle and StatusTransition, the text of NodeCreated, NodeRevised and NodeStatusChanged, the replace and insert texts of NodeOperation and the merged text of ConflictResolution carry it, so a lone surrogate is refused when the value is made or decoded, before it can reach the log. Text read from UTF-8 files is always well-formed, so import is unaffected. Op capture takes whole file texts from its caller, so the edited and created texts of FileEdit carry the check too: an ill-formed text is refused when the edit is made, not thrown from inside capture when it builds an operation. The seeded edit generator of the capture suites cuts on code point boundaries for the same reason (the goals sample holds astral characters). The package is private and unpublished, so no changeset. Code: packages/tooling/library/agent-memory-store/src/NodeIdentity.models.ts and the schemas named; tests: the lone-surrogate cases in test/NodeIdentity.test.ts (FileEdit included) and the HoldResolved round-trip property in test/Admission.layer.test.ts. Rejected: narrowing the property's generator to well-formed strings (hides a real codec failure) and repairing strings on write (a silent change of a writer's text, which AC-2 forbids).

Lane agent-memory-store-p2

Reverse: Drop the check by decision file if the journal moves to an encoding that carries lone surrogates exactly

### Op capture submits a status token swap as a typed setStatus, 2026-11-13

Text capture sees a status cell edit as a replace of the whole table row, and admission judges a replace with the whole-node three-way merge, so two concurrent moves of one status cell would be held as a staleExpectedRevision conflict even though S14b measured typed status fields resolving 10 of 10 such conflicts with 0 of 14 wrong. The admission lane flagged that capture never emitted setStatus. After capture, typeStatusMoves rewrites a replace into a setStatus when the base text the batch exported for the node holds exactly one whole-token value of a lifecycle, the new text is the base text with exactly that token replaced by another whole token (a run of letters, digits, underscore and hyphen) and every other byte unchanged, and exactly one of the layer's StatusFields reads it so (statusMoveBetween in StatusField.models.ts). The new token need not be a lifecycle value: a move to a token outside the lifecycle still reads as a move, so admission refuses it with statusOutsideLifecycle instead of landing it as free text. Any replace that changes more than the token stays a replace. The setStatus names the replace's node and expected revision; transition.from is the base value, which admission ignores in favour of the head value (decision typed-status-fields-are-whole-token-values). The step is pure over the batch, runs after captureBatch and before admit, and is part of the write path composition admitEdits. Code: packages/tooling/library/agent-memory-store/src/OperationCapture.status.ts and statusMoveBetween in src/StatusField.models.ts; tests: test/OperationCapture.status.test.ts, the status case of test/AgentWrite.test.ts and the status strata of the AC-3 replay. Rejected: typing inside admission (admission would have to diff texts it was handed as a replace, and a replace is a free-text claim the agent made) and requiring agents to submit setStatus by hand (the P5 loop captures edits of files, not typed commands).

Lane agent-memory-store-p2

Reverse: Drop typeStatusMoves by decision file citing a replay where typed status moves resolve worse than the text merge

### The AC-2 and AC-3 fixture is seeded contention strata over the goals sample, fixed before measurement, 2026-11-13

AC-2 and AC-3 run on an adversarial concurrent-edit fixture that this lane built and labelled (one-labeller rule; the spike's traces are machine-local and are not used). Its composition is fixed here, before any admission outcome was measured. Generator: test/admission-fixture.ts in the store package, deterministic (mulberry32, seed 20261112), over real partitioned Markdown from the frozen goals sample: every sample file of at most 40,000 characters holding at least two table rows with exactly one whole-token value of the fixture lifecycle (status: pending, in-progress, complete), then the first files in path order of at most 16,000 characters with at least three table rows and three list items, fourteen files in all (1,710 nodes). Candidate places are the sample's content nodes in a seeded random order; a cluster takes a place only when its window, with one untouched node on each side, is free of every earlier cluster and when op capture plus status typing turns every writer's edit into exactly the operations the stratum declares (a revision is one replace of the node, a retirement two deletes of the node and one neighbouring gap, an insert a content insert and its gap after the node or its gap, a status move one setStatus); the choice depends on capture only, never on admission. Every writer edits a whole-file copy of the one base and is admitted through admitEdits. Strata, clusters and writes (118 writes, 156 operations): reviseVersusRevise 6 clusters, 12 writes (two different texts for one node); identicalText 4, 8; reviseVersusRetire 6, 12; insertUnderRetiredAnchor 4, 8; insertsAfterOnePredecessor 4, 8; contestedChainHead 3, 6 (a retire against a chain of two paragraphs, four inserts); differentNodesOneFile 4, 12 (three writers, three nodes; must all land); tableRowNeighbours 4, 8; listItemNeighbours 4, 8; gapNodeEdits 4, 8 (a gap widened against the next node revised); statusForward 3, 6; statusEqual 2, 4; statusBackward 3, 6; statusOutsideLifecycle 2, 4; mixedCleanAndContested 4, 8 (one writer revises a clean node and the contested one). A run admits all 118 writes in a seeded random order (run seeds 1 to 100) on a fresh store imported from the fourteen files, then exports. Why it is an upper bound on contention: every writer works from the same base with no re-export between writes, 41 of 57 clusters put two writers on one node or one anchor, and S14 found only 2 of 70 real merges in goals history touching one file on both sides. Comparability: S14b's 26/279 and 98.0% per-op landing came from a replay of real goals sessions (279 cluster writes, about 7.1 operations each). This fixture is not that replay: by construction 16 of its 118 writes (reviseVersusRevise 6, reviseVersusRetire 6, mixedCleanAndContested 4) need a resolver in every interleaving, already 16/118 against 26/279, and the insert-under-retired strata add more whenever the retire lands first; its writes average 1.3 operations, so contested operations weigh far more per write than in S14b. The resolver-needed ratio and the per-op landing share measured here therefore cannot be compared honestly with the SPEC bars. The bars stay as SPEC.md states them; the tests report the measured ratios and what they were measured on, assert the exact measured counts so a regression shows, and AC-3 is not ticked on them. A re-baseline needs a decision file citing a new measurement on a comparable replay.

Lane agent-memory-store-p2

Reverse: Replace the fixture by decision file citing a comparable replay (real concurrent sessions) and its measured ratios

### The P2 write path is one composition: capture against the export, admit, export, 2026-11-13

PLAN.md P2 names the write path: op capture against the exported base, then store-side admission. The pieces composed cleanly but took four calls with two error channels each, so the package gains two thin helpers in AgentWrite.program.ts. admitEdits(base, edits, options) captures the agent's FileEdit values against the base with captureBatchVerified (refusing a base whose node texts do not hash to its file digests), types status token swaps (decision op-capture-types-a-status-token-swap) and calls Admission.admit; an edit that changes nothing submits nothing. writeEdits(root, base, edits, options) runs admitEdits and then MarkdownProjector.exportFolder on the memory folder, returning the admitted write and the new export, which is the base of the agent's next edit. The memory folder itself is written only by the projector: the agent edits its own copy of the exported files and hands the edited texts over, because the export fence (decision export-fence-is-bound-to-the-folder) treats bytes the store did not write as foreign and would refuse the next export. Options carry the writer's lineage, the StatusFields (the same lifecycles the admission layer was built with) and the node id minter for inserts. Results are schema classes AdmittedWrite and ExportedWrite in AgentWrite.models.ts. The planned memory command family (P5) decides where the agent's copy lives. Code: packages/tooling/library/agent-memory-store/src/AgentWrite.program.ts and src/AgentWrite.models.ts; tests: test/AgentWrite.test.ts, including two agents that edit different nodes of one file from one base, both landing with the export holding both edits byte for byte. Rejected: a new Context.Service for the write path (it would own no state and add a layer to every consumer) and letting the agent edit the memory folder in place (the export fence refuses the next export).

Lane agent-memory-store-p2

Reverse: Replace admitEdits and writeEdits with a write-path service by decision file if P5 needs state the helpers cannot carry

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
