# @beep/box-provisioning

Schema-first desired-state reconciliation for Box tenant resources.

The package inventories an anchored Box folder tree, produces a redacted plan,
and applies only a freshly reproduced reviewed plan. The default `reconcile`
method is read-only. Apply is a separate method and rejects the plan if a fresh
inventory changes its digest.

Metadata and retention intent stays visible as `BlockedByEntitlement` on plans
that do not include those features. Version 1 never deletes or replaces Box
resources.

## Dry run

```ts
import { Box, BoxCcgConfig } from "@beep/box"
import { BoxProvisioning } from "@beep/box-provisioning"
import { Effect, Layer, Redacted } from "effect"
import * as O from "effect/Option"

const BoxLive = Box.makeCcgLayer(BoxCcgConfig.make({
  clientId: "injected-client-id",
  clientSecret: Redacted.make("injected-client-secret"),
  enterpriseId: O.some("expected-enterprise-id")
}))

const ProvisioningLive = BoxProvisioning.liveLayer.pipe(Layer.provide(BoxLive))

const dryRun = (desiredInput: unknown) =>
  BoxProvisioning.pipe(
    Effect.flatMap((provisioning) => provisioning.reconcile(desiredInput)),
    Effect.provide(ProvisioningLive)
  )
```

Configure exactly one CCG subject. `enterpriseId` uses the application's
service account; `userId` uses that explicit Box user. Pin the resulting
`users.getUserMe` id as `expectedSubjectId` in the secure desired state so a
same-enterprise credential for the wrong user fails before planning or apply.

Keep the desired-state document and CCG credentials in the secure runner. The
desired document can contain folder names, collaborator principals, and webhook
addresses. Plans and receipts replace those values with digests before they
leave the runner.

Use `encodeBoxProvisioningPlan` to serialize the dry-run result for review.
Pass that exact JSON to `applyReviewedPlan` only during an attended apply. The
method inventories and plans again, compares the new digest with the reviewed
digest, and fails with `BoxProvisioningDriftError` before any write if they
differ.

## Apply safety

`applyReviewedPlan` is the only write entry point on the root barrel. Before
the first mutation it re-inventories, compares digests, validates the tenant
and subject, and enforces the blocker contract: every `Blocked` action must be
a declared metadata or retention `BlockedByEntitlement`; ambiguity, policy,
dependency, and permission blockers reject the plan with zero writes. The
returned `BoxReviewedApplyResult` carries the receipt, the immediate post-apply
plan, and a verdict that requires the same entitlement blockers plus `Noop`
for everything else.

Pre-existing Box folders are never adopted silently. A desired folder that
matches a live sibling (Box compares sibling names case-insensitively after
trimming trailing whitespace, and the planner uses that same equivalence) is
`BlockedByPolicy` unless one `adoptions` entry binds its logical key to that
exact provider id and parent id. An empty allowlist blocks every collision.

Each dependent write re-reads its parent folder and compares the redacted
identity digest (provider id, parent id, name, etag) before the POST. Provide
`BoxProvisioningApplyJournal` to persist sanitized `Started`, `Applied`, and
`Failed` entries as the apply runs; the default layer discards them. Plan
counts such as `declaredExternalCollaboratorCount` come from the intent
author's `billingImpact` declarations and are not provider-verified.

Ownership of folders the apply creates is returned as `adoptions` on the
`BoxReviewedApplyResult`, so the caller persists it into the versioned intent
and the next reconciliation plans those folders as `Noop` instead of blocking
them as unowned matches. Every journal entry carries the reviewed plan digest
and an attempt id; after a mid-apply failure, the exported recovery function
rebuilds the adoption allowlist from the latest attempt's `Applied` folder
entries so the remaining work can resume. Dependency revalidation compares the
parent's provider id, parent id, and canonical name, not its etag, because Box
does not document whether child membership changes a folder's etag.

## Development checks

```bash
bun run build
bun run check
bun run test
bun run test:integration
bun run lint
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/box-provisioning` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
