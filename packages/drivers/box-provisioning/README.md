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

Keep the desired-state document and CCG credentials in the secure runner. The
desired document can contain folder names, collaborator principals, and webhook
addresses. Plans and receipts replace those values with digests before they
leave the runner.

Use `encodeBoxProvisioningPlan` to serialize the dry-run result for review.
Pass that exact JSON to `applyReviewedPlan` only during an attended apply. The
method inventories and plans again, compares the new digest with the reviewed
digest, and fails with `BoxProvisioningDriftError` before any write if they
differ.

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
