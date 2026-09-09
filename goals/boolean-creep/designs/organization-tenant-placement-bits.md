# Instance

- id: `organization-tenant-placement-bits`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line:
  `packages/shared/domain/src/entities/Organization/Organization.behavior.ts:38`
- symbol: `hasValidTenantPlacement`
- members: `isTenantRoot`, `hasParentOrganization`
- evidence class: E2 at
  `packages/shared/domain/src/entities/Organization/Organization.behavior.ts:89`
  — the validator accepts only XOR: a root must have no parent and a child
  must have a parent; both combined-true and combined-false are rejected.

# Current shape

The live exported predicates are:

```ts
export const isTenantRoot = (organization: Pick<Model, "id" | "orgId">): boolean =>
  Shared.OrganizationId.equivalence(organization.id, organization.orgId);

export const hasParentOrganization = (organization: Pick<Model, "parentOrgId">): boolean =>
  O.isSome(organization.parentOrgId);

export const hasValidTenantPlacement = (organization: Pick<Model, "id" | "orgId" | "parentOrgId">): boolean =>
  isTenantRoot(organization) !== hasParentOrganization(organization);
```

# Cardinality gap

The two booleans represent four combinations. Two are valid domain states:
`root` means `id === orgId` with no parent, and `child` means `id !== orgId`
with a parent. Root-with-parent and non-root-without-parent are invalid raw
inputs that the current XOR guard rejects.

# Target schema

Add the named payload-free vocabulary to the existing concept value owner,
`Organization.values.ts`, reusing its `LiteralKit`, annotation, and static
installation idiom:

```ts
const OrganizationTenantPlacementBase = LiteralKit(["root", "child"])

export const OrganizationTenantPlacement = OrganizationTenantPlacementBase.pipe(
  $I.annoteSchema("OrganizationTenantPlacement", {
    description: "Valid tenant-hierarchy placement derived for one organization row.",
  }),
  SchemaUtils.withLiteralKitStatics(OrganizationTenantPlacementBase)
)

export type OrganizationTenantPlacement = typeof OrganizationTenantPlacement.Type
```

Replace all three boolean predicates with one exported projection in
`Organization.behavior.ts`:

```ts
export const tenantPlacement = (
  organization: Pick<Model, "id" | "orgId" | "parentOrgId">
): O.Option<OrganizationTenantPlacement> => {
  const root = Shared.OrganizationId.equivalence(organization.id, organization.orgId)
  return O.match(organization.parentOrgId, {
    onNone: () => root ? O.some(OrganizationTenantPlacement.Enum.root) : O.none(),
    onSome: () => root ? O.none() : O.some(OrganizationTenantPlacement.Enum.child),
  })
}
```

`Option` is required because this helper accepts raw partial model data and the
existing API deliberately observes both invalid combinations. Do not invent a
stored placement field or change the encoded `Organization.Model`; derive the
value from `id`, `orgId`, and `parentOrgId` on every call.

Preserve the existing identifier equivalence and already-decoded
`Option<OrganizationId>` input. `None` replaces the current false result for
both invalid placements; it is not a schema decode failure and must not change
the model's existing invalid-id or nullable-parent decoding errors.

# Migration inventory

- `packages/shared/domain/src/entities/Organization/Organization.values.ts:14`
  — add and export the named kit/type beside `LicenseTier`; no new file or
  literal family exists elsewhere in live package source.
- `packages/shared/domain/src/entities/Organization/Organization.behavior.ts:8`
  — import `OrganizationTenantPlacement` from the concept value module.
- `packages/shared/domain/src/entities/Organization/Organization.behavior.ts:38`
  — remove exported `isTenantRoot`.
- `packages/shared/domain/src/entities/Organization/Organization.behavior.ts:56`
  — remove exported `hasParentOrganization`.
- `packages/shared/domain/src/entities/Organization/Organization.behavior.ts:88`
  — replace exported `hasValidTenantPlacement` with `tenantPlacement`, returning
  `Option<OrganizationTenantPlacement>`.
- `packages/shared/domain/src/entities/Organization/index.ts:4-10` — update the
  file-level JSDoc example so it imports and exercises `tenantPlacement`
  instead of the deleted `hasParentOrganization` helper.
- `packages/shared/domain/src/entities/Organization/index.ts:16` and `:31` —
  existing wildcard exports expose the new behavior and value schema; no
  export-list edit or compatibility alias is required.
- `packages/shared/domain/test/Organization.test.ts:147`–`:178` — replace all
  direct boolean-predicate assertions with exact `Some(root)`, `Some(child)`,
  and `None` assertions for the two invalid inputs.

Whole-repo source search found no production consumer of the three current
predicates outside their declaration and documentation. The only in-repo
consumer is `Organization.test.ts`. The atomic decoded TypeScript migration is
authorized by the campaign ratification; there is no encoded or supported
external contract requiring aliases.

# Guard-deletion accounting

- Delete the XOR invariant guard at `Organization.behavior.ts:89`.
- Delete the two separately exported boolean projections at lines `38` and
  `56`, which currently permit callers to reconstruct the invalid four-state
  bit space.
- Replace the comment-only root/child invariant at lines `60`–`67` with the
  named schema and the `Option` result contract; invalidity is represented by
  `None`, not by another boolean.

# Encoded-side impact

none (internal). `Organization.Model`, its PostgreSQL fields, JSON codecs, and
wire names remain unchanged. This is an atomic migration of exported decoded
TypeScript helpers only; the placement literal is derived and never encoded or
persisted.

# Test impact

- `packages/shared/domain/test/Organization.test.ts:147`–`:178` becomes a
  four-row table over the complete bit space: valid root, valid child,
  root-with-parent, and non-root-without-parent.
- Assert the two valid rows decode to the exact kit literals and the invalid
  rows produce `O.none()`.
- Keep the existing package-alias imports and model decoding setup; do not use
  relative test imports into `src`.

# Risk & sequencing

Tier 1C as foundational shared-domain state. Land atomically in
`@beep/shared-domain`; the principal risk is accidentally changing entity
encoding or persistence, neither of which should be touched. Add the required
patch changeset and run full `bun run beep quality package-verify
@beep/shared-domain`.
