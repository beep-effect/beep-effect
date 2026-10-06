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

## Content migration

`BoxContentMigration` moves local files into a Box folder tree that already
exists under a root folder owned by the service identity. It is a separate
service from `BoxProvisioning` and follows the same rule: plan read-only, then
apply only a plan that a fresh run reproduces.

```ts
import { Box } from "@beep/box"
import { BoxContentMigration, encodeBoxContentMigrationPlan } from "@beep/box-provisioning"
import { Effect, Layer } from "effect"

const makeMigrationLive = (boxLive: Layer.Layer<Box>) =>
  BoxContentMigration.liveLayer.pipe(Layer.provide(boxLive))

// 1. Dry run: reads sources and Box, writes nothing.
const dryRun = (mapInput: unknown) =>
  Effect.gen(function* () {
    const migration = yield* BoxContentMigration
    return yield* encodeBoxContentMigrationPlan(yield* migration.plan(mapInput))
  })

// 2. Review the plan JSON and its `planDigest`, then 3. apply that exact JSON.
const apply = (mapInput: unknown, reviewedPlanJson: string) =>
  Effect.gen(function* () {
    const migration = yield* BoxContentMigration
    return yield* migration.applyReviewedPlan(mapInput, reviewedPlanJson)
  })
```

The migration map (`box-content-migration-map/v1`) lists source files by
relative path, SHA-256, and size, each with a destination folder path and file
name, plus folders that must exist even when empty. It pins
`expectedEnterpriseId` and `expectedSubjectId`; `plan` and `applyReviewedPlan`
check both through `users.getUserMe` before they read a source or list a
folder. The map holds names and paths and stays in the secure runner. The plan,
receipt, and journal identify folders and files only by SHA-256 digests,
provider ids, sizes, and counts.

**Dry run.** `plan` hashes every source in one streaming pass (SHA-256 to
verify the map, SHA-1 to compare with Box), walks the required folders top-down
from the root, lists only folders that exist, and classifies each file:

| Action | Meaning |
| --- | --- |
| `FolderExists` / `FolderCreate` | Required folder is present, or will be created |
| `Upload` | Name is free; `transport` is `single` or `chunked` |
| `SkipIdentical` | Same name already in Box with the local SHA-1 |
| `BlockedNameConflict` | Same name in Box with other content |
| `BlockedSourceMissing` / `BlockedSourceChanged` | Source absent, or its size or SHA-256 differs from the map |

Names compare the way Box compares siblings: case-insensitively, ignoring
trailing whitespace. The plan carries no timestamp, so an unchanged tenant and
unchanged sources produce a byte-identical plan.

**Apply.** `applyReviewedPlan` plans again and fails with
`BoxProvisioningDriftError` before any write if the digest differs from the
reviewed one. It then creates missing folders in depth order and uploads the
`Upload` actions with bounded concurrency (`uploadConcurrency`, default 4).
Files at or above `chunkedThresholdBytes` (default 50 MiB, minimum 20 MiB) use
Box's chunked upload; smaller files use one request carrying the SHA-1 as the
`Content-MD5` header. After each upload the returned `sha1` must equal the
local SHA-1, otherwise the action is `Failed`. The result holds the receipt, a
fresh `postPlan`, and a `verdict` that is `complete` only when the post-apply
plan contains nothing but `FolderExists` and `SkipIdentical`.

**Never overwrite.** The engine creates folders and uploads new files. It never
overwrites, versions, renames, moves, or deletes a Box item, and it opens
sources read-only. A name taken by different content stays
`BlockedNameConflict` on every run. An upload that Box stores with an
unexpected `sha1` is reported and left in place; the next plan shows it as a
name conflict for an operator to resolve.

**Resumability.** One failed upload does not stop the others, and a failed
folder create skips only its dependents. To resume after a partial run or a
crash, run `plan` again: finished uploads appear as `SkipIdentical`, created
folders as `FolderExists`, and applying that new plan sends only what is
missing. If a folder create meets a 409 because another writer created it
first, the engine re-lists the parent and adopts the folder with the
equivalent name; the journal records it as `AdoptedExistingFolder`. Provide
`BoxContentMigrationJournal` through `liveLayerWithJournal` to persist
`Started`, `Applied`, `Failed`, `Skipped`, and `AdoptedExistingFolder` entries
as the run proceeds. An append failure stops the run.

**API budget.** `maxProviderCalls` is a hard cap on Box calls for one run. Each
listing page, the identity check, each folder create, and each single upload
count as one call; a chunked upload counts as `3 + ceil(size / 8 MiB)`. The
plan's `summary.estimatedProviderCalls` is the budget a full apply of that plan
needs, including its own fresh plan and the post-apply plan. Writes are
admitted in plan order while the remaining budget still covers the post-apply
plan; the first write that does not fit, and every write after it, is reported
`NotAttempted` with reason `budget-exhausted`. A run whose budget cannot cover
its required reads fails with `BoxContentMigrationBudgetError` before writing.
The count covers the calls the engine issues: a request the Box SDK retries
internally after a 429 or 5xx is counted once, and the chunked figure assumes
Box's 8 MiB minimum part size, so it never undercounts parts.

**Memory.** Sources are hashed as a stream. The Box SDK buffers a
single-request upload whole and a chunked upload one part at a time, so peak
upload memory is about `uploadConcurrency` times `chunkedThresholdBytes`.

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
