# Notes: phase 3 rework (defects, integration fact, projection rebuild, stored formats, idempotency)

Thirteen workspace packages; `bun run check`, `bun run handlers:check` and `bun run test` pass from
the prototype root: 98 tests in 28 files (party/contract 4, runs/contract 2, party/model 35,
authority/model 11, runs/model 17, authority/host 7, runs/host 6, party/host 16). Phase 2 ended at
68 in 21. Library: `@alchemy.run/domain` 2.0.0-beta.87, effect 4.1.4. Library references are to
`packages/domain/src/` at 2.0.0-beta.87 (the installed copy and the reference checkout's
`InMemory.ts` are identical).

## Phase 2 defects: fixed, each with a test

- **The executor follows a continuation.** Every `RunsGateway.report` returns the live run of the
  lineage (`CurrentRun`: run and provenance). The gateway follows `Continued` to the run it
  continued as (`runs/host/src/Lineage.ts`, waiting for the policy that opens it) and re-admits under
  that run's own provenance. Party's `ReviewRuns` port returns `LiveRun` from every report, and the
  saga acts as the live run from then on (its key stays the first run). A continuation now carries
  the parent and any open reservations, so a reservation open at the bound settles on the new run.
  Tests: `runs/host` "a report to a run that continued..." and the Party story "a run that continues
  at its history bound is followed".
- **A parent resumes when its child finishes.** `ResumeParent` (runs model) reacts to
  `RunCompleted`, `RunExhausted` and `RunCancelled`, reads the finished run, and sends internal
  `ChildFinished` to its parent with what the child's lineage did not spend. `ChildRunFinished`
  returns the parent to `Running`, releases the allocation and books the child's spend. Story: "a
  child that finishes resumes its parent".
- **A claim decided directly concludes its run.** The saga no longer waits on an approval signal:
  `ApprovalGiven`, `ResumeOnApproval` and the `complete` report are gone. The run waits in
  `AwaitingApproval` until Party publishes `ClaimDecided`, and the runs inbox concludes it with
  internal `ConcludeRun`, whether a person approved the proposal or accepted the claim outright.
  Tests: `party/host` "a claim a person decides directly, with no approval, still concludes its
  waiting run", and the approval path in the existing end-to-end test.
- **`CompleteRun` releases open reservations.** `RunCompleted` carries `released`, and every
  completion (reported or concluded) clears the reservations. Story: "completing a run releases its
  open reservations".
- **`runs/host` has tests of its own**: six, on a fresh `InMemory.make()` with the real authority
  host (`runs/host/test/RunsWorld.ts`).

## Decisions

### D11 between contexts: built as decided, with the outbox in the model

- **Fact:** `party/contract/src/Facts/ClaimDecided.fact.ts` declares `ClaimDecidedV1` (claim, org,
  outcome, review runs) and `ClaimDecidedV2` (decision, basis `approval | direct`, approval id).
  Neither carries a proposition, evidence, provenance or grant terms;
  `party/contract/test/ClaimDecided.snapshot.test.ts` pins both versions' JSON Schema against frozen
  files and checks the field list. The phase's private-event change (`ClaimAccepted` lost
  `corroboration`) left both snapshots unchanged.
- **Outbox:** the library's own pieces. `ClaimFacts` is a projection from the `ClaimReview` view
  (it needs the view's state for org and review runs) into `PartyFacts`, a `Domain.Stream` under
  one key, `claims`. The stream is the outbox: the library appends nothing twice for a replayed or
  redelivered input, and the fact id (`<claim>:decided`) is stable. Both versions are published
  while version 1 has consumers. `party/host/src/Facts/PartyFactsFeed.adapter.ts` serves it as
  `PartyFactsFeed` (in the Party contract) in `FactEnvelope`s: producer, contract, version, fact id,
  stream position, encoded payload.
- **Inbox:** `runs/host/src/Inbox/ClaimDecided.inbox.ts` subscribes to version 1 only, keyed by
  `inboxKey` (producer, fact id, version), with its own checkpoint per producer in `InboxStore`.
  The fact is marked handled and the checkpoint moves in one write. A fact already handled, or of
  another version, only moves the checkpoint. It translates into `ConcludeRun` at the live run of
  each named review run.
- **Authority for a fact-started command (decided here):** the fact carries no provenance, so the
  inbox does not re-admit anyone. `ConcludeRun` is internal (no middleware, no Api), and the run
  concludes under its own provenance extended by a `Fact` hop: the inbox as a process, the
  producer, contract, version and fact id as the cause (`Cause.Fact` in the kernel). Rationale: the
  consumer acts on its own record, on a fact the producer committed. No grant from the consumer's
  world authorises "a claim was decided". Reverse it by carrying a publishable provenance summary in
  the fact and re-admitting it, if a consumer ever needs to act as the producer's actor.
- **Tests (runs/host):** a duplicate delivery changes nothing (one commit); a crash between the
  command and the checkpoint is safe on redelivery (the same command id is answered from the first
  receipt); a version 1 consumer keeps working when the producer publishes version 2 beside it.
  Party stories pin what is published for a direct acceptance, an approval and a retraction, and
  that a rejected command publishes nothing.
- **Not built:** the optional revocation fact from authority. The app (`apps/practice`) does not
  run the inbox: on the cluster it needs a singleton and a durable inbox store, which is cluster
  work.

### D14 replay, sinks and idempotency: built as decided, side-effect suppression by structure

- **Sink (D14, D16):** `PartyDirectoryStore.apply(generation, writes)` takes each change with its
  source stream and position. Per generation it keeps rows and a checkpoint per source stream, and a
  change at or before the checkpoint is refused; the rows and checkpoint move in one write. Writes
  for a generation older than the active one are refused. Astra's counterexample (a registration
  replayed after a merge used to reset `absorbed`) is a sink test.
- **Rebuild:** `partyDirectoryLive(generation)` sets the projection's `version` to the generation;
  the store writes the new generation beside the old one; `switchWhenCaughtUp(generation)`
  (`party/model/src/Directory/RebuildDirectory.ts`) waits for `PartyDirectory.Progress.history` to be
  complete and then for the store's own catch-up check, and switches. Queries read the old
  generation until then. The rebuild test redeploys the model on the same platform and store and
  shows: the same read model, the old generation served until the switch, and zero side effects
  (no commit, no port call, no saga, no fact, no failure).
- **Suppression is structural, not a mode:** bumping a projection's `version` replays history to
  that projection only. Policies, sagas and the fact outbox keep their own checkpoints. The library
  has no replay mode to switch; the guarantee is per consumer generation.
- **Crash between sink write and checkpoint:** a store that writes and then dies leaves the batch
  unprocessed. The library hands it over again with the next input on that key, the store refuses
  the replayed change, and the directory matches a run without the crash (test asserts the batch of
  two with one applied).
- **Idempotency, pinned as the library behaves** (runs stories): a reused command id with the same
  payload returns the first receipt; with a different payload it also returns the first receipt and
  its reply, and the second request is never decided; a caller who is refused with a fresh id
  receives the stored result when it reuses the id. The receipt lookup precedes decoding,
  authorisation and `decide`.
- **Guard:** `requestKey` (kernel) derives command ids from tenant, operation and a SHA-256
  fingerprint (first 128 bits) of the canonical encoded request, through `effect/crypto/Digest`.
  The runs gateway uses it for every request and report (tenant: the principal acted for). The
  inbox uses it for every `ConcludeRun` (tenant: the producer). Tests: same request, same id
  whatever the key order; any difference, another id; a gateway retry is one command; a different
  report under the same hop is decided on its own.

### D22 schema evolution: built as decided, with one change the library cannot express

Each change is on a real declaration, converted on read:

| Change | Where | How |
| --- | --- | --- |
| Added field with default | `EvidenceSignal.trust`; `RunCompleted.released`; `RunContinued` and `ContinuationOpened` `parent`, `reservations` | `S.withDecodingDefaultKey` (runs: `Since.phase3`) |
| Removed field | `ClaimAccepted.corroboration` | dropped; a stored key is ignored on decode |
| Renamed field | `EvidenceSignal.excerpt` to `quote` | `S.encodeKeys({ quote: "excerpt" })`: the stored key stays |
| Compatible type change | `ProposalApproved.corroboration` Int to `NullOr(Int)` | widened |
| Incompatible change | `MergeRefused.reason` text to a `MergeRefusal` union | `StoredMergeRefusal`: union of the new form and a declared read-time transform from the old text |

Frozen fixtures, written by the phase 2 declarations before the changes (`party/model/test/stored/`,
`runs/model/test/stored/`): event histories, aggregate state, a receipt with its reply
(`AssertClaim` now replies with the review run, `ReserveBudget` with what remains), the
`ReviewAssist` workflow payload, and provenance. The runs histories omit the keys phase 3 added,
as phase 2 wrote them. Tests: every fixture decodes to the expected value; the frozen histories
replay through today's `evolve` to the expected state and read model; reading leaves the bytes
unchanged, and re-encoding writes the new form. No new event tag was added for a changed shape; the
only new tags are new facts (`ClaimDecidedV1`/`V2`, `ChildRunFinished`).

Runs has no saga, so its fixtures have no saga payload.

## Library facts from this phase

- **Receipts answer before anything is checked:** the platform looks the command id up and returns
  the stored receipt before decoding, authorising or deciding (`InMemory.ts:647-650`). A different
  payload or a lapsed caller under a reused id gets the first result.
- **Command ids:** `SendOptions.commandId` is the idempotency key (`Aggregate.ts:186-190`); without
  one, a send inside an activity or a policy run takes that run's next deterministic id, otherwise a
  random UUID (`Aggregate.ts:680-692`). A gateway send made inside another model's activity
  therefore picks up the caller's activity id unless it passes its own.
- **Stream as outbox:** `append` takes the input being handled, and "a replayed or redelivered input
  appends nothing twice" (`Stream.ts:105-111`); the origin is the input's position and append
  count (`Model.ts:1090-1115`), and the platform skips a write whose origin is not after the last
  (`InMemory.ts:1191`). Only a projection that lists the stream in `writes` may append, keyed like
  the projection.
- **Projection from a view:** each input carries the view's state after the event
  (`Projection.ts:17-30`); from an aggregate it carries none. A policy from an aggregate also gets
  no state (`Policy.ts:31`); `ResumeParent` reads the finished run instead.
- **Generations:** a projection's `version` is its generation. A higher generation clears the
  platform's partition logs and the history is replayed into it (`InMemory.ts:1036-1039`);
  deliveries for an earlier generation are dropped (`InMemory.ts:1108`). The user's store is not
  touched: "Clear or migrate your store first" (`Projection.ts:52-58`).
- **Progress:** each hosted projection provides `Progress` with `history` (complete once the
  history has been accepted into its logs, not necessarily handled) and `caughtUp(receipt)`
  (`Projection.ts:107-127`). Neither says the whole history has been handled, so the store keeps its
  own catch-up check.
- **Batches and checkpoints:** the handler runs, then `processed` and the partition's checkpoints
  advance (`InMemory.ts:1093-1100`). A handler defect leaves the batch unprocessed; it is handed
  over again with the key's next input.
- **A defect in a timer-flushed batch is not recorded:** the batch-wait fork has no `catchCause`
  (`InMemory.ts:1078-1088`), unlike the intake path (`InMemory.ts:1115-1121`), so `control.failures`
  stays empty. The crash test asserts the redelivery instead.
- **Stored decoding:** every event, state and reply is decoded through `Schema.toCodecJson` with
  default options (`Kernel.ts:104-112`); the event codec is chosen by the stored tag; a receipt's
  reply is decoded with the command's current reply schema (`Kernel.ts:1616-1624`). Excess keys are
  ignored, which is what makes a removed field safe.
- **Saga payload:** the workflow payload is the key, the input and an optional cause
  (`Saga.ts:281-286`); `ReviewAssist.workflow.payloadSchema` decodes the stored form.
- **Renames:** `Domain.Event(tag, fields)` takes a field map (`Event.ts:74-82`), so a top-level
  event field cannot be renamed with `encodeKeys`, which needs a `Struct`. Nested struct fields can.

## Where the sketches did not match

- **D11 puts translation in a host outbox.** Here it is a model-level projection writing a stream,
  with the host only serving the stream. The library's projection and stream give replay safety and
  exactly-once appends per input, which a host outbox would have to rebuild. The stream is a
  published-facts stream, not a private one, so D11's rejection of "consumers following the
  producer's `Domain.Stream`" still holds: the consumer reads envelopes through a contract gateway
  and never sees a private event.
- **D14's "replay modes that suppress side effects"** are not a mode: the library replays one
  consumer per generation, and the rebuild test shows nothing else runs.
- **Activity results are a stored format too** (not in D22's list). This phase changed the review
  saga's activity results (`reserve` from a boolean to `LiveRun | null`, every report from void to
  `LiveRun`) and removed its durable deferred. A review run in flight across that deploy would fail
  to decode its recorded results. The prototype has none in flight; the rule should be a new saga
  name (or a read-time transform) when an activity's result changes.
- **Run and claim lifetimes:** a run ends from a fact, not from its executor. An executor that
  reports after the decision (mid-assessment) is refused with `RunNotRunning`, and its saga ends
  with that error.

## Upstream changes wanted (new this phase)

1. **Check a reused command id** (Astra "Wrong on the merits" 1): store a request fingerprint with
   the receipt and reject a reuse whose fingerprint differs, and re-run authorisation (middleware
   and the grant check) before answering from a receipt, or bind the id to the caller.
2. **Rename a top-level event field:** accept a `Struct` transformation (or an `encodedKeys` option)
   on `Domain.Event`, so `encodeKeys` works at the top level.
3. **An upcaster per tag:** one declared read-time transform per version step, run before the
   codec, instead of folding old forms into the field schema as a union.
4. **Record batch-flush defects:** catch and record handler defects on the batch-wait fork as the
   intake path does.
5. **Progress that says "handled":** `Progress` should report when the whole history has been
   handled, not only accepted, so a rebuild switch needs no store-side check.
6. **Receipt reply evolution:** document that replies are decoded with the current schema, or store
   the reply's schema version.

## Open questions for the owner

- **Fact authority:** is "the target's own provenance plus a `Fact` hop" the rule for every
  fact-started command, or should facts carry a publishable provenance summary for consumers that
  must act as the producer's actor?
- **Outbox placement:** accept the outbox as a model-level projection and stream (as built), or
  insist on a host-level outbox per D11's wording?
- **Version retirement:** when may Party stop publishing `ClaimDecidedV1`? It needs a registry of
  consumers and their versions.
- **Activity results:** add them to D22's compatibility contract, with a rule (new saga name or a
  transform)?
- **Tenant in `requestKey`:** the principal acted for (gateway) and the producer (inbox) are
  stand-ins; should it be the org?

## Known defects left for later phases

- **The inbox runs in process only:** a polled loop with a memory store, not a cluster singleton
  with a durable store; the app does not run it.
- **A decision during assessment** ends the run, and the executor's next report is refused; the
  saga ends with an error rather than recognising the decision.
- **Re-admission still trusts the provenance it is handed**, and in-memory gateways authenticate no
  caller (D25); internal commands (`ConcludeRun`, `ChildFinished`) are unguarded in process.
- **The gateways and the inbox poll** with bounded waits; a timeout shows as a refusal.
- **`requestKey` covers only the prototype's own sends.** A client choosing its own id is still
  answered from the stored receipt (upstream 1).
- **Phase 2 items not touched:** the Reasoner tape lives in memory; the mailbox poller's assertions
  each start a review run; the app is type-checked only.
