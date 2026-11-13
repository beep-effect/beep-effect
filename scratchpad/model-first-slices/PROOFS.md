# Proof inventory

<!-- Generated from proofs/Proofs.data.ts by scripts/proofs.ts. Do not edit: `bun run proofs`
     rewrites it, and `bun run proofs --check` fails on drift. -->

Every invariant this prototype enforces (D8): 22 entries. Mechanical laws run in
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
- **Gaps:** A text scan: an aliased import, a re-export or a constructed object literal passes. Tests are not scanned. Re-admission trusts the provenance it is handed (D25).
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

A producer publishes every fact version some composed descriptor consumes; versions nobody consumes are reported as retirable (D34).

- **Checker:** `shared/tooling/src/FactRetirement.ts`, `apps/practice/test/Deployment.test.ts`
- **Reads:** The deployment descriptors the app composes (D13).
- **Assumes:** Every consumer's descriptor is composed into some app; descriptors read their versions from code, not by hand.
- **Gaps:** One app today; descriptors from other apps would need composing too.
- **Left to a reviewer:** Whether a retirable version may really go (consumers outside the repo).

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
- **Gaps:** Executing an outcome is not asserting it well; refusals raised by middleware before decide are not counted.
- **Left to a reviewer:** Whether the stories assert invariants rather than restate decide.

### generated-files

Generated files are never edited: handler registries, the web bindings and this document match their generators.

- **Checker:** `shared/tooling/src/GeneratedFile.ts`, `party/web/scripts/bindings.ts`, `scripts/proofs.ts`
- **Reads:** The file on disk against the generator's output; `bun run generated:check`.
- **Assumes:** Generators are deterministic.
- **Gaps:** None known.
- **Left to a reviewer:** Nothing mechanical.

## Outcome coverage gaps

`bun run outcomes --check` lists 15 declared outcomes no story executes, each with its reason:

- `Grant.IssueGrant` GrantAlreadyIssued: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Grant.NarrowGrant` accepted: no story sends it directly: narrowing and revocation are exercised through DelegateGrant and RevokeGrant
- `Grant.NarrowGrant` GrantNotActive: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Grant.NarrowGrant` TermsWiden: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Grant.NarrowGrant` MissingGrant: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Grant.RevokeGrant` GrantNotActive: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Grant.RevokeGrant` MissingGrant: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Grant.DelegateGrant` GrantNotActive: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Delegation.OpenDelegation` DelegationAlreadyOpen: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Delegation.NarrowDelegation` DelegationNotActive: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Delegation.RevokeDelegation` accepted: no story sends it directly: narrowing and revocation are exercised through DelegateGrant and RevokeGrant
- `Delegation.RevokeDelegation` DelegationNotActive: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Delegation.RevokeDelegation` NotDelegator: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Delegation.DelegateFurther` DelegationNotActive: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4
- `Accountability.AssignAccountability` AccountabilityAlreadyAssigned: authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4

## Questions for an independent reviewer

- **Context naming.** Does each context, aggregate and command name a thing the business recognises, and does a new one belong in the context it was put in?
- **Capability scope.** Is each capability and operation list the narrowest that does the job, and does a delegation narrow rather than copy its source?
- **Public facts.** Should this fact be public at all, and does each field belong in what other contexts may depend on for years?
- **Stored retention.** What may a stored field retain: names, evidence excerpts, provenance? Is anything recorded that should be a reference instead?
