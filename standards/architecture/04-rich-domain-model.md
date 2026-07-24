# Rich Domain Model

beep-effect prefers a hybrid rich-domain style.

The domain should not be only schemas. Shape and validation are necessary, but
they are not enough. Domain concepts should also own pure behavior: lifecycle
transitions, invariant checks, value-object operations, and domain decisions.

## Rich Versus Anemic

An anemic domain model is a value bag. It may have a schema, but behavior lives
elsewhere.

A rich domain model owns:

- shape
- validation
- identity or value semantics
- pure transformations
- pure decision rules
- actionable domain failures

## Why Schema-First

A schema is not a fancier interface. It is executable domain evidence.

Type aliases and interfaces disappear at runtime. They can describe what we hope
is true, but they cannot decode unknown input, reject invalid data, normalize a
boundary value, produce documentation metadata, or explain a failure. Types can
lie; schemas have to check.

Rich annotated schemas pay back that ceremony because the same definition can:

- create fast backpressure at API, config, persistence, and UI boundaries
- derive TypeScript types instead of duplicating parallel shape definitions
- provide constructors, defaults, normalization, JSON codecs, and boundary
  decoders
- derive guards, equivalence, arbitraries, and tagged/literal static APIs
  instead of hand-written predicate helpers
- feed generated docs and validation messages with the same domain descriptions
  humans read
- keep runtime guarantees attached to the domain language instead of scattered
  through handlers and adapters

For pure data models, define the schema value first and derive the TypeScript
type from it. Plain `interface` and object type aliases remain appropriate for
service contracts, complex type-level transforms, utility types, and overload
surfaces that `Schema` cannot represent cleanly.

Schema-first also means being explicit about the real domain, not just the
primitive category. `S.String` means any string, including empty and Unicode
text. `S.Number` includes `NaN` and infinities. Use non-empty, pattern, length,
finite, integer, range, brand, and collection checks whenever the domain is
narrower than the full primitive space.

## Domain States And Variant Shapes

Finite domain cases are part of the model, not incidental object fields.

When a data shape represents variants, lifecycle states, status/result cases, or
case-specific payloads, model it as a discriminated union. In Effect Schema code,
use tagged unions so the discriminator and payload shape are one executable
contract. Prefer `S.toTaggedUnion("<field>")` for domain discriminators such as
`kind`, `type`, `status`, `profile`, or `family`; reserve
`S.TaggedUnion(...)` for canonical `_tag` unions.

Avoid "maybe every payload" bags where one object has many optional/nullish
fields and callers infer the case from which fields happen to exist. Optional
fields are still correct for true absence inside a single case. They are not a
replacement for modeling the cases themselves.

External protocols may require optional/nullish case bags. Keep that shape at
the boundary when compatibility requires it, then decode or normalize into an
internal tagged model before branching on case-specific behavior.

Tagged schema values should also own their derived helper surface. Use
`S.TaggedUnion` / `S.toTaggedUnion` `.cases`, `.guards`, `.isAnyOf`, and
`.match` helpers instead of duplicating discriminator switches and guard maps.
For internal literal domains, use `LiteralKit` helpers such as `.Enum`,
`.Options`, `.is`, subset helpers, `.$match`, and `.toTaggedUnion`; use
`MappedLiteralKit` when a protocol/code map needs helpers on both the encoded
and decoded sides.

## Hybrid Style

Rich behavior does not mean every function must be an instance method.

Use the shape that best communicates the rule:

| Form | Use when |
|---|---|
| Model method | The behavior is obvious single-object behavior. |
| Exported function | The behavior is pipeable, collection-oriented, or clearer as a named operation. |
| `.behavior.ts` | The behavior is pure but large enough to deserve a visible role file. |
| `.policy.ts` | The behavior is a pure decision rule, often involving multiple values or concepts. |

## Pure Does Not Mean Effect-Free

Domain behavior may return `Effect` when typed validation or typed failure makes
the rule clearer.

Pure means:

- no repositories
- no driver services
- no HTTP
- no database
- no filesystem
- no browser APIs
- no environment reads
- no config reads
- no hidden runtime dependency

An Effect that only models domain success/failure can still be pure in the
architectural sense.

Domain may define driver-neutral schemas and value objects that config
packages reuse when resolving typed settings. Domain behavior must still receive
explicit values from callers rather than reading `Config`, `ConfigProvider`,
`@beep/<kernel>-config`, environment variables, secrets, files, or process state.

### Forbidden Effect dependencies in domain

Pure does not mean Effect-free. It does mean none of these dependencies appear
in the requirements (`R`) channel of any Effect returned from a domain function:

- `Sql` (any database client)
- `HttpClient`
- `FileSystem` (from `effect`)
- `Path` (from `effect`)
- `Terminal` (from `effect`)
- `ChildProcessSpawner` (from `effect/unstable/process`)
- `Config` and `ConfigProvider`
- Anything exported from a `packages/drivers/*` package
- Anything exported from a slice's `server`, `tables`, `client`, or `ui` packages

A domain Effect's signature is allowed to use `Effect.Effect<A, E>` (no `R`) or
`Effect.Effect<A, E, R>` only when `R` resolves to other domain services or to
`never`. If `R` resolves to any of the above, the function does not belong in
domain — move it to a use-case service or to the appropriate adapter.

Schema is the one borderline case: domain may construct and apply schemas, and
may yield decoded values, because schemas are pure values themselves. Domain may
not, however, depend on `S.Layer`-style live encoder/decoder services that read
configuration.

## Example Shape

`Membership.model.ts` can own simple behavior:

````ts
import { $IamDomainId } from "@beep/identity"
import { LiteralKit } from "@beep/schema"
import * as Model from "@beep/schema/Model"
import { Effect } from "effect"
import * as S from "effect/Schema"
import { ActorId } from "@beep/iam-domain/entities/Actor"
import { OrganizationId } from "@beep/iam-domain/entities/Organization"
import { MembershipAlreadyRevoked } from "./Membership.errors.ts"

const $I = $IamDomainId.create("entities/Membership/Membership.model")

/**
 * Branded identifier for an organization membership.
 *
 * @category models
 * @since 0.0.0
 */
export const MembershipId = S.String.pipe(
  S.brand("MembershipId"),
  $I.annoteSchema("MembershipId", {
    description: "Unique identifier for an organization membership.",
  })
)
export type MembershipId = typeof MembershipId.Type

/**
 * Role granted by an organization membership.
 *
 * @category models
 * @since 0.0.0
 */
export const MembershipRole = LiteralKit(["owner", "admin", "member"]).pipe(
  $I.annoteSchema("MembershipRole", {
    description: "Role granted by an organization membership.",
  })
)
export type MembershipRole = typeof MembershipRole.Type

/**
 * Lifecycle status of an organization membership.
 *
 * @category models
 * @since 0.0.0
 */
export const MembershipStatus = LiteralKit(["active", "invited", "revoked"]).pipe(
  $I.annoteSchema("MembershipStatus", {
    description: "Lifecycle status of an organization membership.",
  })
)
export type MembershipStatus = typeof MembershipStatus.Type

/**
 * Actor participation in an organization.
 *
 * @category schemas
 * @remarks
 * Owns the lifecycle predicate `canRevoke` and the pure transition `revoke`,
 * which fails with {@link MembershipAlreadyRevoked} when the membership is
 * already in the `revoked` status.
 * @invariant `status` only transitions toward `"revoked"` via `revoke`.
 * @since 0.0.0
 */
export class Membership extends Model.Class<Membership>($I`Membership`)(
  {
    id: MembershipId,
    organizationId: OrganizationId,
    actorId: ActorId,
    role: MembershipRole,
    status: MembershipStatus,
  },
  $I.annote("Membership", {
    description: "Actor participation in an organization.",
  })
) {
  /**
   * Whether this membership can transition to `revoked`.
   *
   * @category predicates
   * @since 0.0.0
   */
  readonly canRevoke = (): boolean => !MembershipStatus.is.revoked(this.status)

  /**
   * Pure transition that revokes the membership when allowed.
   *
   * @category combinators
   * @since 0.0.0
   */
  readonly revoke: () => Effect.Effect<Membership, MembershipAlreadyRevoked> = Effect.fn("Membership.revoke")(
    function* (this: Membership) {
      if (!this.canRevoke()) {
        return yield* Effect.fail(new MembershipAlreadyRevoked())
      }
      return Membership.make({
        id: this.id,
        organizationId: this.organizationId,
        actorId: this.actorId,
        role: this.role,
        status: MembershipStatus.Enum.revoked,
      })
    }
  )
}
````

`Membership.policy.ts` can own larger pure decisions:

````ts
import { type Membership, MembershipRole, MembershipStatus } from "./Membership.model.ts"

/**
 * Pure decision rule: whether a membership may be promoted to `owner`.
 *
 * @category predicates
 * @remarks
 * Only memberships whose status is `active` and whose role is not already
 * `owner` may be promoted.
 * @since 0.0.0
 */
export const canPromoteToOwner = (model: Membership): boolean =>
  MembershipStatus.is.active(model.status) && !MembershipRole.is.owner(model.role)
````

`Membership.behavior.ts` can own pure transitions:

````ts
import { Effect } from "effect"
import { MembershipRoleChangeRejected } from "./Membership.errors.ts"
import { Membership, MembershipRole } from "./Membership.model.ts"
import { canPromoteToOwner } from "./Membership.policy.ts"

/**
 * Pure transition that promotes a membership to the `owner` role when allowed.
 *
 * @category combinators
 * @remarks
 * Delegates the decision to {@link canPromoteToOwner}; on rejection fails with
 * {@link MembershipRoleChangeRejected} instead of mutating the model.
 * @since 0.0.0
 */
export const promoteToOwner: (model: Membership) => Effect.Effect<Membership, MembershipRoleChangeRejected> =
  Effect.fn("Membership.promoteToOwner")(function* (model: Membership) {
    if (!canPromoteToOwner(model)) {
      return yield* Effect.fail(new MembershipRoleChangeRejected())
    }
    return Membership.make({
      id: model.id,
      organizationId: model.organizationId,
      actorId: model.actorId,
      role: MembershipRole.Enum.owner,
      status: model.status,
    })
  })
````

The use-case service then orchestrates loading, authorization, persistence, and
event publication around these pure domain rules.
