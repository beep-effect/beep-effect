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
- Inventory records the authenticated `users.getUserMe` subject. The desired
  state pins the dedicated service-account id, and the planner returns a typed
  `BoxProvisioningSubjectMismatchError` before producing a plan when a
  same-enterprise credential authenticates as the wrong user.
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

## P2 identity-preflight hardening

The final live-runner preflight checked the installed Box SDK rather than
assuming CCG subject semantics. The SDK authenticates `userId` when it is
present and otherwise authenticates the platform application's enterprise
service account. `BoxCcgConfig` now requires exactly one of those subjects so a
dual-subject configuration cannot silently select a user. The reconciler then
checks the authenticated user id independently of the enterprise id. Focused
tests prove both ambiguous-config rejection and typed wrong-subject rejection.

Canonical handoff after the identity guard:

```text
bun run beep quality package-verify @beep/box
ok audit 11.5s; ok docgen 4.6s

bun run beep quality package-verify @beep/box-provisioning
ok audit 10.6s; ok docgen 3.8s
```

An ignored private runner and starter-intent template now exist under
`.beep/box-provisioning/`. They contain no credentials or real practice names.
Dry-run inventories twice and writes the plan only when both runs are
identical. Apply additionally requires the reviewed plan digest, re-inventories
before mutation, writes a mode-0600 receipt, and immediately verifies that all
actionable resources re-plan as `Noop`. These private operator artifacts are
not Git inputs and must never be copied into tracked history.

## Live boundary

No tenant mutation occurred during P1. Live dry-run and apply remain P2 work.
The session did not have an available 1Password MCP client, and the sanitized
`op whoami` preflight reported no signed-in CLI account. Credentials were not
requested, printed, copied, or stored.

## P2 read-only identity bootstrap

After draft PR #928 opened, the desktop-backed 1Password CLI fallback provided
the three CCG variables through private `op://` references. No credential value
was requested, printed, copied, hashed, or stored in the repository.

The first authenticated `users.getUserMe` read reached Box but the default
response omitted the optional enterprise object, so identity extraction failed
closed before planning. `BoxProvisioningInventory` now requests the exact
`id` and `enterprise` fields. A regression test captures the SDK query without
network access, and the canonical package handoff is green:

```text
bun run beep quality package-verify @beep/box-provisioning
ok audit 10.4s; ok docgen 3.7s
```

The corrected private read-only bootstrap then reported only:

```text
mode: bootstrap-identity
identityGuardsUpdated: true
```

The enterprise and service-subject ids were written directly into the ignored
mode-0600 desired-state file. They did not enter logs or tracked artifacts. No
Box mutation occurred. Only the private client name, matter name, and attorney
login remain before live dry-run.
