# Proof inventory

<!-- Generated from proofs/Proofs.data.ts by scripts/proofs.ts. Do not edit: `bun run proofs`
     rewrites it, and `bun run proofs --check` fails on drift. -->

Every invariant this prototype enforces (D8): 35 entries. Mechanical laws run in
`bun run check`, `bun run test` and `bun run generated:check`; semantic questions stay with a
reviewer who did not write the change.

## Invariants

### model-verify

Each model's definition is structurally sound: no duplicate tags, every command handled, every event evolved.

- **Checker:** `party/model/test/Party.verify.test.ts`, `runs/model/test/Runs.verify.test.ts`, `authority/model/test/Authority.verify.test.ts`
- **Reads:** The model classes, through the library's Domain.verify.
- **Assumes:** The library's verifier is complete for what it claims.
- **Gaps:** Structure only: it cannot tell that a transition is right, or that two evidence sources are independent.
- **Left to a reviewer:** Whether the states and transitions mean what the domain means.

### primary-export

Each <Noun>.<kind>.ts file has one designated primary export of its kind, named from the noun; companions of other kinds are allowed.

- **Checker:** `shared/tooling/src/PrimaryExport.ts`, `shared/tooling/test/PrimaryExport.test.ts`
- **Reads:** Every role file under each workspace package's src, imported at run time; the rule table per kind.
- **Assumes:** The role suffix names the file's kind; a kind missing from the table fails as unknown.
- **Gaps:** `.rules.ts` is exempt, with its reason. The names are conventions; the checker cannot tell a well-chosen noun.
- **Left to a reviewer:** Whether the noun names the concept the file holds.

### contract-closure

A contract package's module graph reaches no model, host, aggregate or handler file.

- **Checker:** `party/contract/test/Contract.imports.test.ts`, `runs/contract/test/Contract.imports.test.ts`
- **Reads:** Import specifiers, resolved through each package's exports.
- **Assumes:** Specifiers are static; the regex finds every import and export-from.
- **Gaps:** Dynamic imports built at run time are not followed. Ambient globals are not imports.
- **Left to a reviewer:** Whether a contract exposes only what other contexts should depend on.

### web-closure

The web package imports the contract and never a model or host file, except a listed screen that opts into Aggregate.predict, for the files it lists.

- **Checker:** `party/web/test/Web.imports.test.ts`
- **Reads:** The import graph from each web entry point; the predict exception list in that test.
- **Assumes:** As for contract closure.
- **Gaps:** Test files are outside the closure, by design. The exception list is empty today.
- **Left to a reviewer:** Whether a screen that asks to predict really needs the model's decide.

### exact-exports

A package is reached only through an entry its exports lists.

- **Checker:** `shared/tooling/src/ImportGraph.ts`, `party/contract/test/Contract.imports.test.ts`, `party/web/test/Web.imports.test.ts`
- **Reads:** The import walk fails with UnlistedEntry on a specifier no exports entry names; tsc resolves through exports too.
- **Assumes:** Every package declares its exports exactly (no wildcard entries).
- **Gaps:** Checked only on the walks the closure tests make, and by tsc for type imports.
- **Left to a reviewer:** Whether each listed entry should be public.

### port-purity

A hosted model needs only its declared ports and the platform: no other service leaks into its Layer.

- **Checker:** `party/model/src/Party.ports.ts`, `runs/model/src/Runs.ports.ts`, `authority/model/src/Authority.ports.ts`
- **Reads:** The hosted Layer's requirement type, checked by `bun run check`.
- **Assumes:** Handlers reach the outside world only through Effect services.
- **Gaps:** A handler can still call fetch, Date.now or a global; the type cannot see it (Astra 9).
- **Left to a reviewer:** Whether a handler hides an effect outside its ports.

### handler-registries

Each model's handler registry is exactly what its model generates: every policy, saga, view and projection handled.

- **Checker:** `shared/tooling/src/HandlerRegistry.ts`, `party/model/test/Party.handlers.test.ts`, `runs/model/test/Runs.handlers.test.ts`, `authority/model/test/Authority.handlers.test.ts`
- **Reads:** The model's members and the handler files on disk; `bun run handlers:check`.
- **Assumes:** Handler files follow the naming the generator expects.
- **Gaps:** It checks presence, not behaviour.
- **Left to a reviewer:** Nothing mechanical; behaviour is the stories' job.

### contract-parity

Each contract Api's RPC group equals the model Api's group, so the interim contract cannot drift from the model (D9).

- **Checker:** `shared/tooling/src/RpcParity.ts`, `party/model/test/Api.parity.test.ts`, `runs/model/test/RunsApi.parity.test.ts`, `authority/model/test/AuthorityApi.parity.test.ts`
- **Reads:** Both Api groups, compared as JSON Schema.
- **Assumes:** JSON Schema equality is wire equality for these schemas.
- **Gaps:** Annotations that do not reach JSON Schema are not compared.
- **Left to a reviewer:** Whether a contract change is a breaking one.

### root-construction

Only the authority boundary builds a root invocation or provides an invocation that no re-admission produced.

- **Checker:** `shared/tooling/src/SourceScan.ts`, `authority/host/test/RootConstruction.test.ts`
- **Reads:** Every package's source text, comments stripped, against three patterns.
- **Assumes:** Construction is spelled as the patterns expect.
- **Gaps:** A text scan: an aliased import, a re-export or a constructed object literal passes. Tests are not scanned. Re-admission trusts the provenance it is handed (D25). One named exception besides the boundary: the conformance-only control route (Control.route.ts).
- **Left to a reviewer:** Any new code path that hands an invocation to a send.

### no-grant-terms-in-events

Events carry provenance (grant ids, delegation ids, chain), never grant terms.

- **Checker:** `party/host/test/ReviewerApi.test.ts`
- **Reads:** A view's list and events through the Api, asserting ids present and capability, operations and resource absent.
- **Assumes:** The read paths tested cover the event shapes that matter.
- **Gaps:** No schema-level check over every event; a new event field holding terms would pass until a read test sees it.
- **Left to a reviewer:** What a new event field retains (see the questions below).

### readmission-adds-nothing

Re-admission never adds a grant the provenance did not name, refuses when all lapse, and re-checks an agent's accountable human.

- **Checker:** `authority/host/test/Boundary.test.ts`
- **Reads:** The boundary's readmit over issued, revoked and expired grants.
- **Assumes:** The fixture credential stands in for real authentication.
- **Gaps:** Partial lapse returns the rest (D30); the provenance itself is trusted.
- **Left to a reviewer:** Capability scope of each grant a change asks for.

### fact-snapshots

A published fact's shape changes only on purpose: each version's JSON Schema equals a frozen snapshot, and it carries no private field.

- **Checker:** `party/contract/test/ClaimDecided.snapshot.test.ts`
- **Reads:** ClaimDecided v1 and v2 against test/snapshots/*.json; the field list.
- **Assumes:** The listed public fields are the right ones.
- **Gaps:** A new fact needs its own snapshot; nothing forces one to be added.
- **Left to a reviewer:** Which facts are public, and which fields of them.

### fact-retirement

A producer publishes every fact version some composed descriptor consumes; versions nobody consumes are reported as retirable (D34), except each producer's newest (D40).

- **Checker:** `shared/tooling/src/FactRetirement.ts`, `apps/practice/test/Deployment.test.ts`
- **Reads:** The deployment descriptors the app composes (D13).
- **Assumes:** Every consumer's descriptor is composed into some app; descriptors read their versions from code, not by hand.
- **Gaps:** One app today; descriptors from other apps would need composing too.
- **Left to a reviewer:** Whether a retirable version may really go (consumers outside the repo).

### published-stream-generations

A projection that writes a published stream is never rebuilt or re-sourced behind it: a bump of its version, of a view it reads, a change of its sources or of the projection itself fails unless the stream generation is pinned closed and a new one opened (D43, phase 9).

- **Checker:** `shared/tooling/src/PublishedStreams.ts`, `shared/tooling/test/PublishedStreams.test.ts`, `party/model/test/StreamPins.test.ts`, `party/model/src/Facts/StreamPins.ts`
- **Reads:** Each model's pins; the hosted model's streams, their writers, and each writer's generation from the hosted kernel (its Layer version included) and sources.
- **Assumes:** Every stream of the model is published, so every stream is pinned. A pinned writer is identified by projection name, generation and source names; a handler rewritten with the same three is not caught.
- **Gaps:** Only Party has a published stream today. What a new generation republishes is the writer's business: here it is every decision, under the same fact ids, and consumers dedupe (party/host/test/PartyFactsFeed.test.ts).
- **Left to a reviewer:** Whether a handler change that keeps the version should have opened a new generation anyway.

### decision-scope

Each decision event carries the org and review runs the published fact needs, so the fact is built from the event alone; a decision stored before that reads with no scope and takes it from what generation 1 published, or else from the claim's state and the event (D43, D22).

- **Checker:** `party/model/test/Facts.story.test.ts`, `party/model/src/Facts/ClaimDecisions.handler.ts`
- **Reads:** Stories over decide and over seeded decisions without a scope (generation 1 empty).
- **Assumes:** Review runs are named `review:<claim>:<n>` from 1 to the claim's review count, as decide names them.
- **Gaps:** The lookup in generation 1 is not exercised: in memory nothing writes generation 1, and on the cluster the one legacy decision in phase 6's dump never reached the publisher (the backfill lists no instances there). A decision stored before phase 9 that generation 1 never published gets only the run its event names: other review runs of that claim are not concluded by the fact (logged).
- **Left to a reviewer:** Whether an upgrade should drain the old publisher first, closing that gap.

### stored-formats

Stored events, state, receipts with replies, saga payloads, activity results and provenance written by earlier declarations still decode and replay, converted on read, with bytes untouched (D22, D35).

- **Checker:** `party/model/test/StoredFormat.test.ts`, `runs/model/test/StoredFormat.test.ts`
- **Reads:** Frozen fixtures under each model's test/stored; today's declarations; the library's evolve.
- **Assumes:** The fixtures are what the platform stores (they are encoded with the same codecs).
- **Gaps:** Fixtures are produced by the prototype, not captured from a running platform; cluster storage is not covered.
- **Left to a reviewer:** Whether a change is compatible or needs a declared transform or a new saga version.

### saga-versions

A saga run in flight finishes on the version it started while new runs start on the next (D35).

- **Checker:** `party/model/test/SagaVersions.test.ts`
- **Reads:** Two saga versions across an in-memory redeploy.
- **Assumes:** In memory only; the cluster engine is not checked.
- **Gaps:** No way to list runs in flight, so nothing proves an old version may be removed.
- **Left to a reviewer:** When an old saga version may be dropped.

### sink-positions

The directory sink applies each source stream's changes once, in order, and refuses stale application, writes and checkpoints together.

- **Checker:** `party/model/test/PartyDirectory.sink.test.ts`, `party/model/test/Rebuild.test.ts`
- **Reads:** The store's apply and checkpoints; a crash injected between the write and the library's checkpoint.
- **Assumes:** One store write is atomic (it is, in memory).
- **Gaps:** A real database needs the same transaction; not shown.
- **Left to a reviewer:** Nothing beyond the store's transaction boundary.

### rebuild-no-side-effects

A projection rebuild writes a new generation beside the old one, serves the old until caught up, and fires no policy, saga, external call or fact.

- **Checker:** `party/model/test/Rebuild.test.ts`
- **Reads:** Commit counts, port call counts, saga deaths, failures and the fact stream across a redeploy.
- **Assumes:** In memory; the library replays only the bumped projection.
- **Gaps:** Cluster backfill is not exercised.
- **Left to a reviewer:** Nothing mechanical.

### command-id-reuse

The library answers a reused command id from its receipt before any check (pinned); the prototype's own sends derive ids from org, operation and request (D36).

- **Checker:** `runs/model/test/Runs.story.test.ts`, `runs/host/test/RunsHost.test.ts`
- **Reads:** Stories that reuse an id with the same payload, a different payload and a refused caller; the gateway's guard.
- **Assumes:** Clients of the Apis choose ids responsibly; the hazard stays upstream.
- **Gaps:** A client choosing its own id is still answered from the receipt (upstream ask).
- **Left to a reviewer:** Any new send path that does not use requestKey.

### inbox-idempotency

The inbox acts on each fact once: duplicates change nothing, a crash before the checkpoint is safe, a v1 consumer survives v2.

- **Checker:** `runs/host/test/RunsHost.test.ts`
- **Reads:** Commit counts on the target run across redeliveries.
- **Assumes:** The inbox store's commit is atomic.
- **Gaps:** In process; a durable inbox store is cluster work.
- **Left to a reviewer:** What a fact-started command may do (D32).

### screen-causality

The claim review machine correlates on command id, receipt and view revision: no second command while one is in flight, late and duplicate replies ignored, stale snapshots dropped, unknown outcomes retried under the same id.

- **Checker:** `party/web/test/ClaimReview.story.test.ts`, `party/web/test/Bindings.test.ts`, `party/web/test/Screens.render.test.tsx`
- **Reads:** The pure update through the screen-story kit; the bindings over the hosted Party; a render under happy-dom.
- **Assumes:** The library's view cursor orders a key's states.
- **Gaps:** No browser: real input, timing, focus and layout are browser QA.
- **Left to a reviewer:** Whether the screen's notices say the right thing to a person.

### outcome-coverage

Every command's accepted path and each declared rejection is executed by some story or test, counted at run time; gaps are listed with reasons.

- **Checker:** `shared/tooling/vitest/outcomes.setup.ts`, `scripts/outcomes.ts`, `proofs/Outcomes.allow.ts`
- **Reads:** The library's domain.commands metric after each test file.
- **Assumes:** Every test runs on the default metric registry.
- **Gaps:** Executing an outcome is not asserting it well; refusals raised by middleware before decide are not counted. All 109 declared outcomes execute since phase 5.
- **Left to a reviewer:** Whether the stories assert invariants rather than restate decide.

### generated-files

Generated files are never edited: handler registries, the web bindings and this document match their generators.

- **Checker:** `shared/tooling/src/GeneratedFile.ts`, `party/web/scripts/bindings.ts`, `scripts/proofs.ts`, `apps/practice/scripts/entries.ts`
- **Reads:** The file on disk against the generator's output (registries, bindings, cluster entry modules, this document); `bun run generated:check`.
- **Assumes:** Generators are deterministic.
- **Gaps:** None known.
- **Left to a reviewer:** Nothing mechanical.

### drain-lease-takeover

A queue or projection drain that finds its lease held comes back just after the lease expires, so rows a dead drain left are delivered; while live drains keep taking the lease it comes back once per lease, not in a loop.

- **Checker:** `conformance/test/StrandedDrain.test.ts`, `conformance/test/SimHost.ts`, `patches/@alchemy.run%2Fdomain@2.0.0-beta.87.patch`
- **Reads:** An in-process Durable Object host over the patched library, with a TestClock and a lease written as a dead instance leaves it; the view, the stream and lease reads.
- **Assumes:** The lease row is what a runner killed mid-drain leaves; the in-process alarm stands in for a host's.
- **Gaps:** The cluster's wake delivery latency is not modelled (it adds seconds after the lease on Effect Cluster).
- **Left to a reviewer:** Whether waiting out the lease is acceptable, or the lease should follow shard ownership.

### commit-version-check

A commit is acknowledged only on the version its decide read: when the stored version moved meanwhile (two runners on one instance while its shard moves), the commit writes nothing and fails the call, and the caller's retry decides again under the same command id (D41, patch 3).

- **Checker:** `conformance/test/LostWrite.test.ts`, `conformance/test/SimHost.ts`, `patches/@alchemy.run%2Fdomain@2.0.0-beta.87.patch`
- **Reads:** Two in-process runners sharing one instance's storage over the patched library, with a TestClock: events and meta after both commits.
- **Assumes:** The shared storage serializes transactions per instance, as the cluster's advisory lock does in patch 3.
- **Gaps:** Whichever runner's transaction runs first wins; a stale runner that commits first is acknowledged and the other retries. Fencing by shard ownership would refuse the stale one instead (notes/phase-9.md).
- **Left to a reviewer:** Whether first-commit-wins is the guarantee wanted, or the stale runner must always lose.

### compiler-effect-build

`bun run check` runs the Effect build of tsrs at the monorepo's pinned @effect/tsgo and tsrs over every project, each taking its rules from the monorepo's base config, and exits 0; only the vendored upstream project drops the rules. The prototype holds one inline diagnostics directive: `strictEffectProvide:off` on the generated front's deploy-time `Effect.provide(Database)`, an Alchemy class entry point, emitted by apps/practice/scripts/entries.ts with its reason, owner (@proto/practice) and exit.

- **Checker:** `shared/tooling/test/Compiler.guard.test.ts`
- **Reads:** The root manifest's check script, the installed compiler manifests and `--version`, the monorepo catalog pins, each project's tsconfig extends chain, and every source file's comment lines for a diagnostics directive.
- **Assumes:** The proxy's `--version` names the Effect build; a project's rules come only from its extends chain.
- **Gaps:** It proves the wiring, not that every rule is right for the prototype; the rules are the monorepo's.
- **Left to a reviewer:** Whether a new project was added to the check, whether a rule's finding was fixed by meaning, and whether the one directive's exit condition has been met.

### compiler-canary

An Effect-only finding (a floating Effect) fails the check: the canary project fails under the Effect build, with exactly one effect(floatingEffect) error and no unknown-rule warning.

- **Checker:** `shared/tooling/test/Compiler.guard.test.ts`, `shared/tooling/canary/Canary.ts`
- **Reads:** The compiler's output and exit code over the canary project.
- **Assumes:** The canary's one finding is one the stock compiler cannot report.
- **Gaps:** One rule; a rule the Effect build stopped reporting would pass unnoticed.
- **Left to a reviewer:** Nothing beyond keeping the canary's finding Effect-only.

### saga-refused-report-hop

A report hop of the review run (reserve, settle, step, release, exhaust, the wait) the runs context refuses, for example after the delegation was revoked, is recorded on the claim and reported to the run, which gives back what its open reservations held; the executor stops there.

- **Checker:** `party/model/test/Review.story.test.ts`, `runs/model/test/Runs.story.test.ts`, `runs/host/test/RunsHost.test.ts`, `conformance/test/Own.conformance.ts`
- **Reads:** The saga's port calls and the claim's events (party), the run's RunRejected and Refused state (runs model), the gateway over the real authority with the grant revoked before settle (runs host), and on the cluster (phase 8, P5) the saga's activity replies, the claim's events and the run's stored events and state.
- **Assumes:** The refusal report needs no re-admission, so it lands although the hop's grant lapsed.
- **Gaps:** On the cluster only the settle hop has been refused (P5 holds the run's next commit, which is the reservation's); the other hops are in-memory stories.
- **Left to a reviewer:** Whether a refused report should end the run, or leave it for a person to resume.

### cluster-upstream-conformance

The host passes upstream's ten Domain conformance cases, with the vendored conformance model on the stack's pool.

- **Checker:** `conformance/test/Upstream.conformance.ts`, `conformance/upstream/src/conformance.ts`
- **Reads:** The deployed front over HTTP and WebSocket.
- **Assumes:** The vendored files match upstream at 33c10dd except import paths.
- **Gaps:** Two runners on one workstation; no network partitions.
- **Left to a reviewer:** Nothing mechanical.
- **Needs a live stack:** run against a deployed stage, from the conformance driver on the stack's network (README).

### cluster-idempotent-sends

On the cluster, a command sent twice, or retried after a lost response, under one id commits once and its reaction happens once.

- **Checker:** `conformance/test/Own.conformance.ts`
- **Reads:** Receipts, the claim's view entries and the review run's state through the front.
- **Assumes:** The client's timeout stands in for a lost response.
- **Gaps:** Retries from another client, after the receipt's retention (none exists), are not covered.
- **Left to a reviewer:** Nothing mechanical.
- **Needs a live stack:** run against a deployed stage, from the conformance driver on the stack's network (README).

### cluster-faults

A runner killed after a commit, a projection batch cut by a crash, a grant revoked mid-chain and a run waiting across a restart each end correctly: stored results, reactions once, refusals recorded, completion after approval.

- **Checker:** `conformance/test/Own.conformance.ts`
- **Reads:** The front's Apis, the runs-state route, and the cluster database through `docker exec psql`.
- **Assumes:** `docker kill` of every runner models a crash. The projection crash and the revocation are placed by a row lock held from a session of the conformance's own (phase 6); the kill after a commit is not timed.
- **Gaps:** Since phase 9 (D42) the kill-after-commit case asserts the guarantee as ruled: every reaction once, all within RECOVERY_BOUND_MS (the library's 60 s lease plus two 10 s message polls, checked against the installed sources by conformance/test/RecoveryBound.test.ts) of the kill; phase 9 measured 66.8 s. Recovery is still bounded by the lease, not by shard ownership (notes/upstream/04).
- **Left to a reviewer:** Whether each fault was really exercised (the evidence log says).
- **Needs a live stack:** run against a deployed stage, from the conformance driver on the stack's network (README).

### cluster-two-runners

Two runners never both commit to one instance (D38): a runner paused past its shard lock must not overwrite the commit of the runner that took over.

- **Checker:** `conformance/test/Own.conformance.ts`, `conformance/src/TwoRunners.model.ts`
- **Reads:** The slot's stored events in alchemy_domain_objects before and after unpausing.
- **Assumes:** `docker pause` freezes the runner's shard-lock refresh as a long GC pause or partition would; a row lock holds the stale runner inside its commit for the second timing.
- **Gaps:** Two timings; not a model-checked proof. Phase 9 ran the paused-inside-commit timing three times with patch 3: nothing acknowledged was lost, but the stale runner was acknowledged each time (its transaction began first), and only one run moved the shard to the other runner, whose commit then waited on the advisory lock, lost the version check and landed after it. Paused in decide, the shard did not move (notes/phase-9.md).
- **Left to a reviewer:** Whether first-commit-wins is acceptable, or the stale runner must be fenced out (shard ownership inside the commit).
- **Needs a live stack:** run against a deployed stage, from the conformance driver on the stack's network (README).

### cluster-backup-restore

A pg_dump taken while a run waits for approval and a hold's expiry is pending restores into a fresh stack with aggregates, views, the directory, receipts, the waiting run and scheduled work intact, and the pending expiry is delivered after the restore.

- **Checker:** `conformance/test/Restore.conformance.ts`
- **Reads:** The seeded expectations file and the restored stack through the front.
- **Assumes:** Phase 8 freezes the runners and the front with docker pause the moment the before half records, then dumps: scaling them to zero lets a runner finish a due expiry during its graceful stop. Runners are scaled to zero around the restore.
- **Gaps:** A volume-level restore (which needs the matching Alchemy state) is not exercised. A dump of an older code version restored under this one fails on facts (cluster-stored-forms).
- **Left to a reviewer:** What must be retained with a backup besides the database.
- **Needs a live stack:** run against a deployed stage, from the conformance driver on the stack's network (README).

### cluster-stored-forms

State in the forms earlier phases stored decodes on the cluster under today's declarations: a run written in phase 6's requested and cancelled-before-grant forms and a session view in phase 6's form take a command and read back, and a stack restored from phase 6's dump reads its claim, run, party, directory, receipt and hold, and completes the waiting run on approval.

- **Checker:** `conformance/test/StoredForms.conformance.ts`
- **Reads:** Rows written straight into the cluster's object storage from the frozen run fixtures and phase 6's view form; phase 6's dump and restore record (RESTORE_PHASE=across).
- **Assumes:** The object and key names are the cluster storage's as observed (Practice/<Context>.<Class>/<id>, meta, snapshot).
- **Gaps:** Phase 9: the restore from phase 6 passes (the publisher reads claim events and writes generation 2). But on Effect Cluster a new consumer's backfill lists no instances (object-call arguments go through JSON, so the directory listing's absent cursor arrives as null and lists nothing), so generation 2 holds only decisions made after the upgrade; consumers stay correct because the feed still serves generation 1 (notes/phase-9.md, notes/upstream/06).
- **Left to a reviewer:** Whether generation 2 must be complete on its own before generation 1 may ever be retired.
- **Needs a live stack:** run against a deployed stage, from the conformance driver on the stack's network (README).

## Outcome coverage gaps

`bun run outcomes --check` lists 0 declared outcomes no story executes, each with its reason:


## Questions for an independent reviewer

- **Context naming.** Does each context, aggregate and command name a thing the business recognises, and does a new one belong in the context it was put in?
- **Capability scope.** Is each capability and operation list the narrowest that does the job, and does a delegation narrow rather than copy its source?
- **Public facts.** Should this fact be public at all, and does each field belong in what other contexts may depend on for years?
- **Stored retention.** What may a stored field retain: names, evidence excerpts, provenance? Is anything recorded that should be a reference instead?
