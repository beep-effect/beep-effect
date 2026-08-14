# @beep/shared-domain

Shared-kernel domain language for cross-slice product concepts, values, schemas,
and pure behavior.

This package contains the shared entity kernel, shared identity vocabulary,
actor provenance language, and shared value-object modules. Future exports
should be added only when multiple slices deliberately agree on the same
driver-neutral product meaning.

## Belongs Here

- Shared value objects and schema-first models tied to product language.
- Shared domain events, pure policies, guards, and lifecycle behavior.
- Driver-neutral access vocabulary and invariants that multiple slices reuse.

## Does Not Belong Here

- Slice-private entities or partially promoted domain models.
- Runtime configuration, `ConfigProvider`, environment access, or secrets.
- Persistence, client, server, UI, drivers, workflow orchestration, or adapters.
- Generic schema helpers that belong in foundation modeling packages.

## Exports

- `@beep/shared-domain`
- `@beep/shared-domain/*`
- `Identity.Shared`
- `BaseEntity`
- `EntityId`
- `EntityRef`
- `Principal`
- `SourceKind`
- `@beep/shared-domain/entity`
- `@beep/shared-domain/entity/primitives`

Persisted shared entities use `BaseEntity.Class` from
`@beep/shared-domain/entity/BaseEntity` for shared product invariants and
`@beep/schema/EntitySchema` descriptors for storage-neutral persistence
metadata. Domain models remain schema-first; the decoded side is domain
language and the encoded side is the persistence row shape.

## Source Map

| Path                                         | Intended role                                          |
|----------------------------------------------|--------------------------------------------------------|
| `src/entity/index.ts`                        | Entity constructor barrel: `BaseEntity`, `EntityId`, `EntityRef`, `Principal`, `primitives`, and `SourceKind`. |
| `src/entity/primitives.ts`                   | Shared driver-neutral entity primitive schemas.        |
| `src/identity/index.ts`                      | Shared entity-id modules and identity vocabulary.      |
| `src/identity/Shared.ts`                     | Cross-slice organization, user, membership, and actor ids. |
| `src/values/index.ts`                        | Shared value objects.                                  |
| `src/values/ClaimLifecycle/`                 | Shared claim admission lifecycle vocabulary and transition value object. |

## Promotion Records

### Promotion record: User

- **Date promoted:** 2026-05-02
- **Shared product semantics:** A human account identity that multiple product slices may reference without depending on a tenancy slice.
- **Current consumers:** `@beep/shared-domain/entity/Principal` uses shared user identity for actor provenance; workspace, agents, law-practice, and shared table packages depend on the shared entity contract.
- **Rejected homes:**
  - Owning slice - `tenancy` owns future lifecycle authority, but user identity is cross-slice product language used by workspace, epistemic, agents, law, and wealth contexts.
  - Foundation - user identity is product semantics, not domain-agnostic modeling substrate.
- **Surface:** `@beep/shared-domain/entities`, `@beep/shared-domain/entities/User`, `Entities.User.Model`, `Identity.Shared.UserId`.
- **Runtime limits:** no live Layers.
- **Coupling acceptors:** Architecture grilling session accepted shared-kernel ownership; PR review sign-off pending.
- **Removal trigger:** retire if a future IAM or tenancy slice becomes the explicit shared-kernel owner and all consumers migrate through a replacement promotion record.

### Promotion record: Membership

- **Date promoted:** 2026-05-02
- **Shared product semantics:** The organization-scoped relationship between a shared user and the organization they belong to.
- **Current consumers:** all BaseEntity-backed product slices share `Identity.Shared.OrganizationId` tenant scoping; workspace, agents, law-practice, and shared table packages consume the shared entity contract.
- **Rejected homes:**
  - Owning slice - `tenancy` owns future lifecycle workflows such as invites and role changes, but the membership noun is cross-slice product language.
  - Foundation - membership is product policy language, not reusable domain-agnostic substrate.
- **Surface:** `@beep/shared-domain/entities`, `@beep/shared-domain/entities/Membership`, `Entities.Membership.Model`, `Entities.Membership.Role`, `Entities.Membership.Status`, `Identity.Shared.MembershipId`.
- **Runtime limits:** no live Layers.
- **Coupling acceptors:** Architecture grilling session accepted shared-kernel ownership; PR review sign-off pending.
- **Removal trigger:** retire if membership authority moves behind a different promoted shared contract and direct entity references are migrated away.

### Promotion record: OnePasswordReference

- **Date promoted:** 2026-05-14
- **Shared product semantics:** A credential input in installer flows is a reference to a 1Password item field, never a plaintext secret.
- **Current consumers:** no active product-slice package consumers in this checkout; driver-side probe contracts still share the no-plaintext-secret vocabulary.
- **Rejected homes:**
  - Owning slice - removed installer packages owned validation and resolution behavior; the reference remains shared with driver-side contracts without importing slice internals directly.
  - Foundation - this is product security language for the Stack Installer, not a domain-agnostic string primitive.
- **Surface:** `@beep/shared-domain/values`, `@beep/shared-domain/values/OnePasswordReference`, `Values.OnePasswordReference.OnePasswordReference`.
- **Runtime limits:** no live Layers.
- **Coupling acceptors:** Stack Installer P1A planning accepted shared-domain ownership; PR review sign-off pending.
- **Removal trigger:** retire if installer credential references move behind a different promoted shared contract that preserves the no-plaintext-secret boundary.

### Promotion record: ClaimLifecycle

- **Date promoted:** 2026-06-18
- **Shared product semantics:** The admission lifecycle of a claim — `candidate -> shape_valid -> consistency_checked -> admitted` — plus the transition value object. It is the cross-vertical vocabulary for "where is this claim in its journey to authority," product-agnostic across knowledge verticals.
- **Current consumers (2):** `@beep/epistemic-domain` — owns the gate/lifecycle/projection mechanism that drives the states and re-exports this vocabulary on its public surface (`packages/epistemic/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts`); `@beep/law-practice-domain` — types its `Distinction.lifecycleState` work-product field from it (`packages/law-practice/domain/src/entities/Distinction/Distinction.model.ts:12`). The promotion was sequenced ahead of the second consumer (the spike was the forcing function, per `standards/architecture/DECISIONS.md` 2026-06-18); that consumer has now landed in the spike's P0, so the >=2-current-importer bar is met.
- **Rejected homes:**
  - Owning slice - `epistemic` owns the lifecycle *mechanism* (the SHACL gate, the transition service, the projection), but the lifecycle *vocabulary* is cross-slice product language a second vertical (`law-practice`) now types against; a slice's `domain` cannot import another slice's `domain` (`standards/architecture/01-hexagonal-vertical-slices.md:60-61`).
  - Foundation - the claim-admission lifecycle is product semantics, not a domain-agnostic modeling substrate (contrast `@beep/provenance` `TextAnchor` / `@beep/schema` `UnitInterval`, which are substrate and live in foundation).
- **Surface:** `@beep/shared-domain/values`, `@beep/shared-domain/values/ClaimLifecycle`, `Values.ClaimLifecycle.ClaimLifecycle`, `Values.ClaimLifecycle.ClaimLifecycleTransition`.
- **Runtime limits:** no live Layers; pure schema-first value objects only. Transition *legality* is enforced by the owning slice's use-cases service, not here.
- **Coupling acceptors:** Architecture grilling session 2026-06-18 (cross-slice consumption of the epistemic boundary, recorded in `standards/architecture/DECISIONS.md`) chose this promotion; an adversarial review (2026-06-18) verified the routing and flagged the pre-second-consumer status captured above. PR review sign-off pending.
- **Removal trigger:** retire if a single vertical reclaims sole ownership of the claim lifecycle and all other consumers migrate off the shared vocabulary, or if it is superseded by a different promoted shared contract.

## Development

```bash
bun run check
bun run test
bun run docgen
bun run lint
```

## License

MIT
