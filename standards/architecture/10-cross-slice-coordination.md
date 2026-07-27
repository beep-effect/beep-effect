# 10 — Cross-slice coordination

A process touching one slice's events belongs in that slice. A process touching
multiple slices' events doesn't belong in any of them. It either uses emitted
events, promotes a durable contract into a future `shared/use-cases` package, or
decomposes until a dedicated slice owns the coordination.

## 1. Where a process belongs

A "process" here means anything that reacts to events to drive further work: process managers, sagas, schedulers, projectors, thin event handlers.

Rules:

- A process that touches **only one slice's events and aggregates** belongs in that slice's `server` package.
- File role:
  - `*.processes.ts` — multi-step coordination, retries, state across events
  - `*.event-handlers.ts` — thin reactions (one event in, one effect out)
- A process touching **multiple slices' events** does not belong in any single slice's server. See sections 2 and 5.

Diagnostic: if `packages/iam/server/src/Membership/Membership.processes.ts` imports from `@beep/billing-use-cases` or `@beep/billing-server`, that file is hosting a cross-slice process. It is in the wrong home regardless of how small it is.

## 2. Cross-slice promotion of event contracts

Cross-slice event flow goes through shared contracts only after promotion. There
is no `shared/use-cases` package today; a promotion PR creates it when a real
contract clears the bar. Concretely:

- The **event contract** (tag, payload schema, error schema, primary-key derivation, metadata) lives in `shared/use-cases/<owning-slice>/events/` after that package exists.
- The owning slice (`iam`) emits using the shared contract.
- Consuming slices (`billing`) import the same contract from the future `@beep/shared-use-cases/public` subpath and never from `@beep/iam-use-cases`.

Promotion bar is the same as any other `shared/*` export: a promotion record per `02-shared-kernel.md` Appendix. The record lists known consumers — `billing` shows up as a consumer of `MembershipRevoked`, not as a dependency of `iam`.

Naming after promotion: `shared/use-cases/iam/events/MembershipRevoked.ts` exports the event contract; ownership stays with the producing slice's team, but the file lives under shared so consumers can import without breaching the slice boundary.

### 2a. Foundation-mediated port inversion

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
§2. Reach for the port only when the contract genuinely carries no product
semantics; "it was easier than promoting an event" is not an admission
condition.

## 3. Forbidden direct event reads

- A slice's `*.processes.ts` or `*.event-handlers.ts` MUST NOT import another slice's `*.events.ts` from anywhere except promoted `shared/use-cases` contracts.
- A slice MUST NOT subscribe to another slice's internal event bus, in-process queue, or PubSub directly. Cross-slice flow goes through the shared event log / shared bus, with contracts published in future `shared/use-cases` only after promotion.
- A slice MUST NOT read another slice's tables, projections, or read models to recover an event it could have subscribed to. Reading another slice's tables is a slice-to-slice coupling per `01-hexagonal-vertical-slices.md`.

If a needed event isn't yet promoted to future `shared/use-cases`, the right move is to promote it in a PR that creates the package if needed and adds the promotion record. It is not "reach across the boundary now and promote later" — that PR never gets opened.

Lint expectation: a repo check should reject imports of `@beep/<other-slice>-use-cases/*/events/*` from any non-shared package. Until that check exists, treat it as a review-blocking convention.

## 4. Event contract versioning

Event contracts in future `shared/use-cases` follow the same evolution rules as commands and queries — see `11-evolution-and-deprecation.md`. In short:

- Additive changes (new optional payload field, new optional metadata) are free; consumers that ignore the new field keep working.
- Breaking changes (renamed/removed field, narrowed type, changed semantics) require a new tagged variant alongside the old one, plus a deprecation window long enough for every listed consumer to migrate.
- A consuming slice should never have to redeploy because the producing slice changed an event's optional fields. If a "small change" to an event forces a billing redeploy, the change wasn't additive — it was a breaking change wearing additive clothes.

The promotion record's consumer list is what makes the deprecation window enforceable: you know who has to migrate before the old variant can be retired.

## 5. Anti-pattern: God Process Manager

A process is becoming a God Process Manager when:

- It listens to events from `>=3` slices it doesn't own
- Its `*.processes.ts` file is the only consumer of multiple future `shared/use-cases/*/events/` modules
- It owns business logic that more naturally belongs in one of the consuming slices
- Removing it would orphan `>=3` slices that no longer coordinate

If a process matches `>=2` of these, it is a God Process Manager. Resolutions, in order of preference:

1. **Push the logic to the outcome owner.** If the process schedules a billing action in response to an iam event, the logic belongs in `billing/server` reacting to the shared event — not in a third party that pokes billing. The owner of the *outcome* owns the process.
2. **Decompose into per-slice processes.** Each consuming slice gets its own handler for the one shared contract it cares about. The "central" coordinator vanishes; each slice reacts independently.
3. **Promote the orchestrator to its own slice.** If the coordination is genuinely a cross-cutting capability with no natural home — e.g. lifecycle management spanning iam, billing, and notifications — create a dedicated slice (`subscriptions`, `lifecycle`, etc.) that owns the cross-cut as its own domain. That slice then has its own `domain`, `use-cases`, `server`, and the orchestration is first-class instead of squatting.

What you do not do: leave it where it is and add a comment explaining why this one is fine.

## 6. Worked example: billing observes membership revocation

Setup:

- `iam` owns the `Membership` aggregate.
- `iam/use-cases` defines the `RevokeMembership` command and the `MembershipRevoked` event.
- `billing` needs to react to `MembershipRevoked` and cancel any in-flight invoices for that membership.

### Wrong shape

`packages/iam/server/src/Membership/Membership.processes.ts` imports `cancelInvoicesFor` from `@beep/billing-use-cases/server` and calls it after a successful `RevokeMembership`. This is a slice-to-slice direct import. It is forbidden by `01-hexagonal-vertical-slices.md` and it puts billing logic on iam's deploy path.

### Right shape after promotion (three changes)

**1. Promote the `MembershipRevoked` event contract to shared.**

The promotion PR creates `packages/shared/use-cases/src/iam/events/MembershipRevoked.ts`. The event contract is defined there using the v4 EventLog `Event.make` constructor (see `effect/unstable/eventlog/Event`), with a payload schema annotated per the repo's schema-annotation rules. The package and identity composer are generated as part of that promotion, because they do not exist today:

````ts
import { $SharedUseCasesId } from "@beep/identity"
import * as Event from "effect/unstable/eventlog/Event"
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
 * @remarks
 * Promotion-record governed: ownership stays with the producing slice (iam),
 * but the contract surface and its consumers are tracked by the shared
 * promotion record per `02-shared-kernel.md` Appendix.
 */
export class MembershipRevokedPayload extends S.Class<MembershipRevokedPayload>($I`Payload`)(
  {
    membershipId: S.String,
    revokedAt: S.DateTimeUtc,
    reason: S.optionalKey(S.String)
  },
  $I.annote("Payload", {
    description: "Emitted when an iam Membership transitions to revoked."
  })
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

Add a promotion record to the newly created `packages/shared/use-cases/README.md` listing `iam` as the producer and `billing` as a known consumer, per `02-shared-kernel.md` Appendix.

**2. `iam/server` emits using the shared contract.**

The `RevokeMembership` command handler in `iam/server` writes `MembershipRevoked` to the event log using the promoted contract imported from the future `@beep/shared-use-cases/public` subpath. The event group it registers under (via `EventGroup` + `EventLog.group` from `effect/unstable/eventlog`) lives in `iam/server` because iam owns the write side. The contract is shared; the *writing* of it is not.

(Exact handler/group wiring is left to the slice's server package — `EventGroup` accumulates event handlers and `EventLog.group` binds them; refer to `effect/unstable/eventlog/EventLog` for current shapes. Code shape elided here to avoid drift against in-flight v4 EventLog APIs.)

**3. `billing/server` subscribes via a thin handler.**

New file: `packages/billing/server/src/Subscription/Subscription.event-handlers.ts`. It imports `MembershipRevoked` from the future `@beep/shared-use-cases/public` subpath after promotion, registers a handler that decodes the payload, and calls billing's own internal `cancelInvoicesFor` use-case. The handler returns an `Effect.Effect<A, E, R>` and is built with `Effect.fn` per repo convention; failures decode into a `TaggedErrorClass` (from `@beep/schema`) defined in `billing/use-cases`.

Result:

- `iam` knows nothing about `billing`. Its imports stay within iam plus `shared/*`.
- `billing` depends on a shared contract, not on `iam`. Its imports stay within billing plus `shared/*`.
- Either slice can be deleted, rewritten, or split without touching the other. The contract — and only the contract — is the coupling, and it is governed by a promotion record.

## See also

- `01-hexagonal-vertical-slices.md` — slice-to-slice direct imports forbidden; cycle prohibition.
- `02-shared-kernel.md` — promotion record schema and `shared/use-cases` ownership.
- `07-non-slice-families.md` — `foundation/*` admission rules a mediating port must satisfy.
- `11-evolution-and-deprecation.md` — additive vs breaking event contract changes, deprecation windows.
- `DECISIONS.md` (2026-07-25) — foundation-mediated port inversion; §2a above.
