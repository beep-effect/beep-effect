# Findings: phase 1 rework (structure, contract, authority, relay)

Written by the phase 1 implementing agent, 2026-11-13. Re-run by the orchestrating session the same
day: `bun run check` clean for ten packages, `bun run test` 38 tests in 13 files pass,
`bun run handlers:check` passes. The source citations below were not individually re-read.

Library references are to `~/YeeBois/references/effect/alchemy/packages/domain/src/` at
2.0.0-beta.87 (the installed version).

## Decisions

### D2 unit of architecture: built as decided

Two bounded contexts, one `Domain.Model` each (`Party`, `Authority`). Neither needed a second Model.

### D3 client closure: built as decided for three of four packages

Party and authority each have `contract`, `model`, `host`; `web` is a later phase. The model imports
commands, events, public rejections, ids, read DTOs and capabilities from the contract.
`party/contract/test/Contract.imports.test.ts` walks every contract entry and reaches no model, host,
`.aggregate.ts`, `.handler.ts`, `.model.ts` or `.adapter.ts`; its negative control from the model's
entries reaches `Claim.aggregate.ts` and a handler.

### D4 authority: built as decided; approval-as-command deferred to phase 2 as briefed

`Invocation` in the kernel; every event carries it via `carry(...)`; policies and sagas use
`relay(...)` and never stamp a process as root; capability grants replace `audience` (removed). The
story "a policy's command carries the reviewer's root, relayed one hop, never a system" asserts the
`PartiesMerged` invocation exactly; a mutation (hop dropped) fails it. `ReviewAssist` and
`HumanDecision` still work; the signal carries an `Invocation` and is still forgeable in process.

### D7 authority home: built differently

The authority context owns Grant, Delegation, Accountability and the trusted boundary, and imports
nothing from Party (grants name a `CapabilityId`). The kernel holds more than the schema and ids: the
check language (`ResourceScope`, `GrantTerms`, `CapabilityGrant`, `Capability`, `covers`, `allows`,
`requireGrant`, `MissingGrant`), so every context checks grants with one definition of "covers". No
Layer, aggregate, or credential handling in the kernel.

### D9 contract production: built differently (sound, two interim workarounds)

The contract is `Domain.Api` over a model-shaped catalog of aggregate-free declarations
(`shared/contract-kit/src/Catalog.ts`). It builds the group through the library's own path
(`Api.ts:1250-1261`) and keeps the typed nested client. Parity tests compare all four Apis' groups
(tags, JSON Schema of encoded payload/success/error, stream flag, middleware). The contract client
drives the hosted model over the real Api's in-process protocol; rejections decode to the same
classes.

- Views: a model view holds `from` and inline `evolve` (`View.ts:210`, `View.ts:235`). The contract
  declares a read contract per view: `Domain.View` with `from: []`, the id schema as `key`, the
  shared state schema, and explicit `events` in aggregate order. RPCs match because `readRpcs` uses
  `Key.idSchemaOf(def.key)` (`ReadRpcs.ts:145`) and `def.events` when present (`ReadRpcs.ts:47`).
- Queries: the RPC gains `ConsistencyTimeout` only when `waitsFor` is non-empty (`Query.ts:321`),
  and `Domain.verify` refuses a wait the model does not hold by identity (`Kernel.ts:697-703`,
  `UnknownWait`). Model and contract each declare `FindParties` from shared parts; the contract's
  waits on `Catalog.waitsOnProjection(...)`, a cast that only shapes the RPC.

### D10 file grammar: built as decided, naming questions open

`<Module>/<Noun>.<kind>.ts`; `.live.ts` gone (`.handler.ts`, `.adapter.ts`; middleware server half
`authority/host/src/Session.adapter.ts`). Exact `exports` everywhere. `Party.handlers.ts` and
`Authority.handlers.ts` are generated from the Model (`shared/tooling/src/HandlerRegistry.ts`);
`--check` fails on drift, a missing handler, or an unregistered `.handler.ts`; a test runs it. The
purity assertion lives in `Party.ports.ts`; a temporary leak probe still fails with TS1360.

### D18 supervision: built as decided

`Accountability` per run: `Live { accountable, onBehalfOf }` until released. The boundary admits an
agent only while Live and roots it at `Agent { run, accountable }`. Tested through the real Session
(`Unaccountable`). Law-practice supervision not built.

## The Invocation, as built

- `root`: `Human { principal }` or `Agent { run, accountable }`. No process case; required.
- `onBehalfOf`.
- `grants`: `[{ grant, delegation | null, capability, operations | null, resource, expires | null }]`.
- `chain`: `[{ by: Process { process } | Agent { run }, cause: Event { stream, seq, event } |
  SagaStep { saga, key, step } | Session { scheme } }]`.

Operator, run and accountable are derived (`operatorOf`, `runOf`, `accountableOf`).

## How hard it is to construct a root invocation outside the boundary

Not hard. The kernel must export the schema, so `Invocation.make`, `Root.cases.*.make` and decode are
public. Any in-process code can `provideService(CurrentInvocation, x)`; the library encodes what is in
the fiber (`RequestContext.ts:93`) and decodes it before `decide` without verification
(`RequestContext.ts:107`). The line is held by `authority/host/test/RootConstruction.test.ts`, a regex
scan of every package's `src` for `Root.cases.*.make`, `Root.make`, `Invocation.make(Unsafe)`,
`chain: []`, and `provideService(…CurrentInvocation, X)` with `X` not `relay(`, allowed only in
`Boundary.ts` and `Session.adapter.ts`, with a negative control. It misses object spreads, schema
decodes, aliased tags and forged variables. Hardening needs a signed root or upstream item 4.

## Two models on one Domain.InMemory

They share the platform cleanly (`InMemory.ts:366`; `Platform.ts:698-721` refuses only same-named
models). They cannot share one Effect context: `Model.Internals` is one key (`Model.ts:62-80`,
`Model.ts:719`). Merged hosted Layers make `ReviewerApi.clientInProcess` die with `DefinitionError:
AcceptClaim is served, but no hosted aggregate handles it` (`DefinitionError.ts:161`). Working shape:
each Api gets its own model's Layer; Session gets the authority model privately (output `Session`
only). `party/host/test/ReviewerApi.test.ts` pins both.

## Library facts handed to this phase, checked

- Api needs the Model at declaration: true as to shape (`Api.ts:1250-1261`); a model-shaped catalog
  suffices.
- Remote clients need only the group: half. Flat client yes (`Api.ts:1065`); the typed nested client
  also needs the served declarations for `nest` (`Api.ts:912-982`).
- Commands import no aggregate: true (`Command.ts:1-8`).
- Views hold `from` and inline `evolve`: true; `from: []` plus a schema key plus explicit `events`
  gives identical RPCs.
- View read RPCs come from `ReadRpcs` and need a key schema and explicit events: true
  (`ReadRpcs.ts:45-58`, `78-145`); `ReadRpcs` is `@internal` (line 24) yet exported via `"./*"`
  (`package.json:34`).

## Where the fourth-draft sketches did not match the library or the build

1. Invocation sketch (`principal`, `org`, `run`, `grants: NonEmptyArray(GrantId)`, chain of
   `{step, commandId, correlationId}`): built with a root union, grants with terms (ids cannot be
   checked in `decide`), derived operator and run, typed hop causes.
2. `org` on the invocation and `FindPartiesLive` reading it: built with no ambient org;
   `AssertClaim`, `RegisterParty` and `FindParties` take `org` as input and the grant check names it.
3. `relay(event.invocation, {step, commandId, correlationId})`: built as `relay(carrier, hop)` over
   any carrier (event, saga input, signal).
4. `Capability.make(id, { operations: [classes], resource })`: built as a kernel schema with tags;
   the resource scope sits on the grant.
5. Session "checks a grant covers AcceptClaim": built so the middleware only builds the invocation;
   `decide` checks, since the resource is known only from state.
6. "Contract RpcGroup written by hand": the typed client survives; views and queries need separate
   declarations.
7. `Handlers.ts` and `Ports.ts`: built as `Party.handlers.ts` and `Party.ports.ts`.
8. Recording a vetoed merge: not built; vetoes and missing grants still record nothing.

## Upstream changes wanted

1. A model-free Api contract (`Api.contract(name, {commands, reads, queries, streams})`), a view read
   contract separable from its fold (`View.contract({key, state, events, middleware, rejects})` plus
   `View.make(contract, {from, evolve})`), and an aggregate declaration separate from `decide` and
   `evolve`.
2. Move `waitsFor` out of the query declaration: declare read-after-write consistency on the query,
   bind reads in the Model or `toLayer` (`Query.ts:321` versus `Kernel.ts:697-703`).
3. Persist request context on the envelope: `SendMeta.context` exists (`Aggregate.ts:245`), the
   Envelope (`Aggregate.ts:45-61`) drops it. An opt-in `RequestContext.make(key, schema, {persist:
   true})` plus decoded `envelope.context` on triggers. Removes `carry` (D4).
4. A verification hook for request context: `RequestContext.make(key, schema, {verify})` run in
   `restore` (`RequestContext.ts:107`), or a context only middleware may provide.
5. `Model.Internals` keyed per model (`Model.ts:62-80`), or Apis capture their own model's internals.
6. Expose handled members on `ModelClass` (`Model.ts:111-145` lacks `sagas` though `Model.ts:332` has
   it), or a `Model.handled(model)` matching `HandledBy`.
7. Make `ReadRpcs` public or private (`ReadRpcs.ts:24` versus `package.json:34`).

## Open naming and placement questions

- The authority context's name.
- `.adapter.ts` for the middleware server half.
- Contract `.read.ts` beside model `.view.ts` with the same noun.
- `Boundary/Boundary.ts` (a service, no suffix).
- `Party.handlers.ts`, `Party.ports.ts`, `Party.capabilities.ts`, `Party.catalog.ts`,
  `*.contract.ts`, `scripts/Party.registry.ts`.
- Grant-check language in the kernel or in the authority contract.
- Placement of `shared/contract-kit` and `shared/tooling`.
- Party's capability split, and whether `party.propose` is a human capability agents exercise.
- Delegation to principals as well as runs.

## Known defects left for later phases

- Provenance is readable: view `events` and `list` return payloads with full invocations (grant
  terms) to any `party.read` holder.
- Relayed grants are a snapshot: expiry is checked against `decide`'s `now`; revocation after
  admission is not seen by later hops.
- `ReviewAssist` proposes under the asserting human's grants (needs `party.propose`); phase 2
  AgentRun.
- `HumanDecision` signal accepts any invocation in process; phase 2 approval command.
- `MergeOnSameParty` drops `MergeVetoed` and `MissingGrant` silently.
- `OpenDelegation` trusts its sender (only the model's policy sends it; the boundary drops any
  delegation its live parent does not cover).
- Boundary indexes (`HolderGrants`, `RunDelegations`) lag; tests poll. Revocation is immediate.
- `bootstrap(owner, org)` is break-glass; the fixture credential is an unsigned header.
- `ClaimNotPending` and `MergeVetoed{not-registered}` answer before the grant check; `MissingGrant`
  names the capability.
- Behaviour changes: every assertion now starts a run (poller assertions included); `MergeVetoed`
  lost `other-org` (now `MissingGrant`).
- The import-graph walker and the root scan are regex-based (static specifiers, direct forms).
- The app is type-checked only.
