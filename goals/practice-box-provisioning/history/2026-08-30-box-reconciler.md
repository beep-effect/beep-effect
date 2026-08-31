# P1 Box reconciler evidence

Date: 2026-08-30

## Package placement

The architecture preflight selected a product-neutral technical driver. The
canonical scaffold command created `@beep/box-provisioning` at
`packages/drivers/box-provisioning` and registered its package identity,
TypeScript references, root catalog, and workspace metadata.

## Implemented contract

The package now has versioned Schema contracts for desired state, normalized
observed state, redacted plans, typed errors, and apply receipts. Its service
roles are separate:

- `BoxProvisioningInventory` has read verbs only and follows marker pagination
  for folders, collaborations, webhooks, retention, and Box Sign listings.
- `BoxProvisioningPlanner` is pure and deterministic. It rejects a tenant
  mismatch, blocks ambiguous matches, reports foreign folders without their
  names, and emits explicit entitlement blockers for metadata and retention.
- `BoxProvisioningApplier` rejects destructive actions before the first Box
  call, checks dependency order, and supports the v1 folder, collaboration,
  and webhook create/update set.
- `BoxProvisioning.reconcile` is the default read-only entry point.
  `applyReviewedPlan` inventories and plans again, compares the fresh digest
  with the reviewed digest, and fails closed before mutation on drift.

Plan and receipt codecs serialize only provider identifiers, counts, and
SHA-256 digests. Secure intent values such as folder names, collaborator
principals, and webhook addresses do not enter those artifacts.

## Local proof

The package tests cover deterministic repeated planning, foreign-resource and
entitlement evidence, schema rejection of folder cycles, zero apply calls from
the default reconciliation path, and zero apply calls after reviewed-plan
drift.

Final commands:

```text
bun run lint
Checked 21 files. No fixes applied.

bun run check
source and test typechecks passed

bun run test
3 files passed, 5 tests passed

bun run test:integration
no live tests selected; exited 0

bun run docgen
11 modules, 53 examples; succeeded

bun run beep quality package-verify @beep/identity
ok audit; ok docgen

bun run beep quality package-verify @beep/box-provisioning
ok audit; ok docgen
```

The first reconciler package-verification attempt exposed a stale dependency
declaration for the newly registered package identity. The dependency package
verification rebuilt it, and the unchanged canonical reconciler command then
passed. The friction and proposed prevention are recorded in
`research/OPPORTUNITIES.md`.

## Live boundary

No tenant mutation occurred during P1. Live dry-run and apply remain P2 work.
The session did not have an available 1Password MCP client, and the sanitized
`op whoami` preflight reported no signed-in CLI account. Credentials were not
requested, printed, copied, or stored.
