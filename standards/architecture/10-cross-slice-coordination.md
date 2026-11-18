# 10 — Cross-slice coordination

A slice is a bounded context. A process that reacts to one context's events
belongs in that context. Between contexts there are exactly two edges: a
synchronous call through a port the consumer declares over the provider's
gateway contract, and an asynchronous integration fact the provider publishes
and the consumer reads into an inbox. Nothing else crosses. Decision numbers
cite `explorations/model-first-slices/DECISIONS.md`; the rules are in
`standards/ARCHITECTURE.md`, "Model-First Slice Topology". Legacy seven-package
slices keep the shared-contract promotion described in the second half of this
chapter until their own migration.

## 1. Where a process belongs

A "process" here means anything that reacts to events to drive further work:
policies, sagas, projections and cluster classes.

- A `Domain.Policy`, `Domain.Saga` or `Domain.Projection` over one context's
  events lives in that context's model, in the Module it serves, with its
  `.handler.ts` beside it.
- A cluster class (`.singleton.ts`, `.entity.ts`, `.cron.ts`, `.workflow.ts`)
  lives in that context's host.
- A process that needs another context's facts reads them through its own
  inbox; a process that needs another context to act calls a port it declares.
  It never imports the other context's model or host.

## 2. Integration facts

A context publishes what other contexts may depend on as versioned
integration facts (D11, D33).

- The producer declares each fact in its contract
  (`<Module>/<Fact>.fact.ts`), one event class per version. A private domain
  event is never a fact: it rebuilds the producer's state, and letting another
  context follow it would make every internal refactor a public breaking change.
- A projection in the producer's model reads the producer's aggregate events
  directly, never a versioned view, and writes the facts to a published
  `Domain.Stream`. That projection is the outbox. No host outbox table or relay
  exists; the library's stream appends nothing twice for a replayed or
  redelivered input.
- The producer's host serves the stream as a feed.
- The consumer's host keeps an inbox keyed by producer, fact id and version. It
  translates each fact into the consumer's own language and sends the
  consumer's own commands, with command ids that are request keys over the
  org, the operation and the fact. A fact delivered twice changes nothing, and
  a crash before the checkpoint is safe.
- A command a fact starts runs under the consuming record's own provenance plus
  a hop naming the fact (producer, contract, version, fact id). Facts carry no
  provenance, and nobody is re-admitted for them (D32).

## 3. Published streams, generations and upgrades

- **Pinned.** Every published stream is pinned to its writer: the projection,
  its generation and its sources. The projection is never rebuilt in place. A
  checker refuses a version bump of the projection or of anything it reads, and
  a change of its sources, unless the generation is pinned closed and a new one
  opened (D43).
- **One log.** The feed serves closed generations followed by the open one as a
  single log. A closed generation's length is fixed, so a checkpoint taken
  before the new generation existed keeps its meaning. The new generation
  republishes what the old one holds under the same fact ids, and the inbox
  drops those by producer, fact id and version.
- **Drained handover.** An upgrade that replaces a publisher waits until the
  outgoing one has published everything pending. The check reads any writer's
  backlog from the host's own records, so no slice writes a query for it (D47,
  D50).

## 4. Fact versioning and retirement

- A change to a fact is a new fact version or a new stream generation. A
  consumer of version 1 keeps working when version 2 appears. Each version's
  schema is compared with a frozen snapshot.
- Each deployment descriptor declares the fact versions its context consumes.
  A producer may drop a version once no descriptor in any app lists it, and its
  newest version is never reported retirable (D34, D40).
- A closed generation stops being served only when the next holds every fact
  it held, every consumer in every descriptor has read past it, and positions
  keep their meaning (D51).

## 5. Synchronous calls

A consumer's model declares a port in its own language (for example a
`ReviewRuns.external.ts` port in a product context). Its host implements the
port in an `.adapter.ts` over the provider's gateway contract
(`.gateway.ts` in the provider's contract). The consumer's model never learns
which context answers. On a cluster the call goes over the pool's own
dispatch; contexts in a pool trust each other, a caller from another pool
presents that pool's gateway token, and every call carries provenance that the
authority context re-admits (D39).

## 6. What crosses and what does not

| Crosses | Never crosses |
|---------|---------------|
| A provider's contract: ids, commands, read contracts, facts, gateway contracts, capabilities | Another context's aggregate, private event, view, store, handler, model or host |
| Integration facts through a published stream into an inbox | Direct reads of another context's tables, projections or unpublished streams |
| The shared kernel's language: ids, `Invocation` and `Provenance` schemas, the grant-check language, the fact envelope, the request key | Kernel Layers, aggregates or credential handling (the kernel holds none) |

A process that listens to facts from three or more contexts and owns logic one
of them would naturally own is the God Process Manager of §L5 below; the same
resolutions apply, with "promote to shared" read as "publish a fact from the
owner".

## Legacy seven-package slices

The rest of this chapter governs legacy seven-package slices until their own
migration. A model-first context does not use `shared/use-cases`; its
synchronous contracts live in the provider's contract package and its facts in
the provider's published stream.

A process touching one slice's events belongs in that slice. A process touching
multiple slices' events doesn't belong in any of them. It either uses emitted
events, promotes a durable contract into the `shared/use-cases` package, or
decomposes until a dedicated slice owns the coordination.

### L1. Where a process belongs

A "process" here means anything that reacts to events to drive further work: process managers, sagas, schedulers, projectors, thin event handlers.

Rules:

- A process that touches **only one slice's events and aggregates** belongs in that slice's `server` package.
- File role:
  - `*.processes.ts` — multi-step coordination, retries, state across events
  - `*.event-handlers.ts` — thin reactions (one event in, one effect out)
- A process touching **multiple slices' events** does not belong in any single slice's server. See §L2 and §L5.

Diagnostic: if an `iam` slice's `packages/iam/server/src/Membership/Membership.processes.ts` imports from the `billing` slice's use-cases or server package, that file is hosting a cross-slice process. It is in the wrong home regardless of how small it is.

### L2. Cross-slice promotion of event contracts

Cross-slice event flow goes through shared contracts only after promotion. The
`shared/use-cases` package (`@beep/shared-use-cases`, with its `./public` subpath
and the `$SharedUseCasesId` identity composer) already exists; a promotion PR adds
the contract to it when a real contract clears the bar. Concretely:

- The **event contract** (tag, payload schema, error schema, primary-key derivation, metadata) lives in `shared/use-cases/src/<owning-slice>/events/` once it is promoted.
- The owning slice (`iam`) emits using the shared contract.
- Consuming slices (`billing`) import the same contract from the `@beep/shared-use-cases/public` subpath and never from the `iam` use-cases package.

Promotion bar is the same as any other `shared/*` export: a promotion record per `02-shared-kernel.md` Appendix. The record lists known consumers — `billing` shows up as a consumer of `MembershipRevoked`, not as a dependency of `iam`.

Naming after promotion: `shared/use-cases/src/iam/events/MembershipRevoked.ts` exports the event contract; ownership stays with the producing slice's team, but the file lives under shared so consumers can import without breaching the slice boundary.

#### L2a. Foundation-mediated port inversion

Event promotion is not the only lawful cross-slice mechanism. A slice may also
implement a `foundation`-owned port that another slice consumes, with the two
bound at an application entrypoint and neither slice naming the other. Ratified
2026-07-25 — see `DECISIONS.md`, "Foundation-Mediated Port Inversion Is A Legal
Cross-Slice Mechanism", for the five admission conditions and the README-record
requirement.

This exists because events cannot express a gate that must fail closed *before*
an action runs. Where the coordination is synchronous, product-neutral, and
decides whether the consuming slice proceeds, use the port. Where it is a
product fact one slice publishes and others react to, use an event contract per
§L2. Reach for the port only when the contract genuinely carries no product
semantics; "it was easier than promoting an event" is not an admission
condition.

### L3. Forbidden direct event reads

- A slice's `*.processes.ts` or `*.event-handlers.ts` MUST NOT import another slice's `*.events.ts` from anywhere except promoted `shared/use-cases` contracts.
- A slice MUST NOT subscribe to another slice's internal event bus, in-process queue, or PubSub directly. Cross-slice flow goes through the shared event log / shared bus, with contracts published in `shared/use-cases` only after promotion.
- A slice MUST NOT read another slice's tables, projections, or read models to recover an event it could have subscribed to. Reading another slice's tables is a slice-to-slice coupling per `01-hexagonal-vertical-slices.md`.

If a needed event isn't yet promoted to `shared/use-cases`, the right move is to promote it in a PR that adds the contract to that package and adds the promotion record. It is not "reach across the boundary now and promote later" — that PR never gets opened.

Lint expectation: a repo check should reject imports of `@beep/<other-slice>-use-cases/*/events/*` from any non-shared package. Until that check exists, treat it as a review-blocking convention.

### L4. Event contract versioning

Event contracts in `shared/use-cases` follow the same evolution rules as commands and queries — see `11-evolution-and-deprecation.md`. In short:

- Additive changes (new optional payload field, new optional metadata) are free; consumers that ignore the new field keep working.
- Breaking changes (renamed/removed field, narrowed type, changed semantics) require a new tagged variant alongside the old one, plus a deprecation window long enough for every listed consumer to migrate.
- A consuming slice should never have to redeploy because the producing slice changed an event's optional fields. If a "small change" to an event forces a billing redeploy, the change wasn't additive — it was a breaking change wearing additive clothes.

The promotion record's consumer list is what makes the deprecation window enforceable: you know who has to migrate before the old variant can be retired.

### L5. Anti-pattern: God Process Manager

A process is becoming a God Process Manager when:

- It listens to events from `>=3` slices it doesn't own
- Its `*.processes.ts` file is the only consumer of multiple `shared/use-cases/src/*/events/` modules
- It owns business logic that more naturally belongs in one of the consuming slices
- Removing it would orphan `>=3` slices that no longer coordinate

If a process matches `>=2` of these, it is a God Process Manager. Resolutions, in order of preference:

1. **Push the logic to the outcome owner.** If the process schedules a billing action in response to an iam event, the logic belongs in `billing/server` reacting to the shared event — not in a third party that pokes billing. The owner of the *outcome* owns the process.
2. **Decompose into per-slice processes.** Each consuming slice gets its own handler for the one shared contract it cares about. The "central" coordinator vanishes; each slice reacts independently.
3. **Promote the orchestrator to its own slice.** If the coordination is genuinely a cross-cutting capability with no natural home — e.g. lifecycle management spanning iam, billing, and notifications — create a dedicated slice (`subscriptions`, `lifecycle`, etc.) that owns the cross-cut as its own domain. That slice then has its own `domain`, `use-cases`, `server`, and the orchestration is first-class instead of squatting.

What you do not do: leave it where it is and add a comment explaining why this one is fine.

### L6. Worked example: billing observes membership revocation

Setup (illustrative slices; neither `iam` nor `billing` exists in the tree today):

- `iam` owns the `Membership` aggregate.
- `iam/use-cases` defines the `RevokeMembership` command and the `MembershipRevoked` event.
- `billing` needs to react to `MembershipRevoked` and cancel any in-flight invoices for that membership.

#### Wrong shape

`iam/server/src/Membership/Membership.processes.ts` imports `cancelInvoicesFor` from the `billing` use-cases package's `server` subpath and calls it after a successful `RevokeMembership`. This is a slice-to-slice direct import. It is forbidden by `01-hexagonal-vertical-slices.md` and it puts billing logic on iam's deploy path.

#### Right shape after promotion (three changes)

**1. Promote the `MembershipRevoked` event contract to shared.**

The promotion PR adds `packages/shared/use-cases/src/iam/events/MembershipRevoked.ts` to the existing package and exports it from `./public`. The event contract is defined there using the v4 EventLog `Event.make` constructor (see `effect/eventlog/Event`), with a payload schema annotated per the repo's schema-annotation rules. The package and its `$SharedUseCasesId` composer already exist, so nothing else is generated:

````ts
import { $SharedUseCasesId } from "@beep/identity"
import * as Event from "effect/eventlog/Event"
import * as S from "effect/Schema"

const $I = $SharedUseCasesId.create("iam.events.MembershipRevoked")

/**
 * Cross-slice event contract emitted when an iam `Membership` transitions to
 * revoked. After promotion, this lives under `shared/use-cases` so consuming
 * slices (e.g. billing) can import the contract without breaching the iam slice
 * boundary.
 *
 * @category schemas
 * @since 0.0.0
 *
 * **Details**
 *
 * Promotion-record governed: ownership stays with the producing slice (iam),
 * but the contract surface and its consumers are tracked by the shared
 * promotion record per `02-shared-kernel.md` Appendix.
 */
export class MembershipRevokedPayload extends S.Opaque<MembershipRevokedPayload, { readonly brand: unique symbol }>()(
  S.Struct({
    membershipId: S.String,
    revokedAt: S.DateTimeUtc,
    reason: S.optionalKey(S.String)
  }).pipe($I.annoteSchema("Payload", {
    description: "Emitted when an iam Membership transitions to revoked."
  }))
) {}

/**
 * EventLog contract bound to {@link MembershipRevokedPayload}. The owning
 * slice (`iam/server`) registers this on its `EventGroup`; consumers
 * (`billing/server`) subscribe via the same exported value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const MembershipRevoked = Event.make({
  tag: "iam.MembershipRevoked",
  primaryKey: (p) => p.membershipId,
  payload: MembershipRevokedPayload
})
````

Add a promotion record to the existing `packages/shared/use-cases/README.md` listing `iam` as the producer and `billing` as a known consumer, per `02-shared-kernel.md` Appendix.

**2. `iam/server` emits using the shared contract.**

The `RevokeMembership` command handler in `iam/server` writes `MembershipRevoked` to the event log using the promoted contract imported from the `@beep/shared-use-cases/public` subpath. The event group it registers under (via `EventGroup` + `EventLog.group` from `effect/eventlog`) lives in `iam/server` because iam owns the write side. The contract is shared; the *writing* of it is not.

(Exact handler/group wiring is left to the slice's server package — `EventGroup` accumulates event handlers and `EventLog.group` binds them; refer to `effect/eventlog/EventLog` for current shapes. Code shape elided here to avoid drift against in-flight v4 EventLog APIs.)

**3. `billing/server` subscribes via a thin handler.**

New file: `packages/billing/server/src/Subscription/Subscription.event-handlers.ts`. It imports `MembershipRevoked` from the `@beep/shared-use-cases/public` subpath after promotion, registers a handler that decodes the payload, and calls billing's own internal `cancelInvoicesFor` use-case. The handler returns an `Effect.Effect<A, E, R>` and is built with `Effect.fn` per repo convention; failures decode into a class extending `S.TaggedError` directly from `effect/Schema`, defined in `billing/use-cases`.

Result:

- `iam` knows nothing about `billing`. Its imports stay within iam plus `shared/*`.
- `billing` depends on a shared contract, not on `iam`. Its imports stay within billing plus `shared/*`.
- Either slice can be deleted, rewritten, or split without touching the other. The contract — and only the contract — is the coupling, and it is governed by a promotion record.

## See also

- `standards/ARCHITECTURE.md`, "Model-First Slice Topology" — legal imports, integration facts and published streams.
- `01-hexagonal-vertical-slices.md` — slice-to-slice direct imports forbidden; cycle prohibition.
- `02-shared-kernel.md` — promotion record schema and `shared/use-cases` ownership.
- `07-non-slice-families.md` — `foundation/*` admission rules a mediating port must satisfy.
- `11-evolution-and-deprecation.md` — additive vs breaking event contract changes, deprecation windows.
- `DECISIONS.md` (2026-07-25) — foundation-mediated port inversion; §L2a above.
