# P3 Visualizer Evidence

Date: 2026-07-09
Branch: `feat/ontology-workbench-p3-visualizer`
Status: `host-verification-required`

## Summary

P3 is locally integrated on the cosmos path. The implementation keeps 100k-scale
projection off the UI thread, consumes the P2 `OntologySnapshot` and
`SessionChangeDelta` surfaces, preserves the sigma fallback behind driver
capability detection, and extends the folded spike probe contract for host-side
webkitgtk proof.

The sandbox cannot run GUI/Tauri/webkitgtk or Bun-backed Vitest reliably, so the
P3 exit criterion remains host-side: synthetic 100k-element ontology interactive
on webkitgtk with folds active.

## Worker Projection Design

Files:

- `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts`
- `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts`
- `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts`
- `packages/ontology/client/src/aggregates/Session/Session.visualizer.worker.ts`

Protocol:

- `WorkerCommand.projectGraph`: `{ snapshot, options }`.
- `WorkerCommand.applyGraphDelta`: `{ snapshot, delta, previous, options }`.
- `WorkerResult.projectGraphSucceeded`: `{ result }`.
- `WorkerResult.applyGraphDeltaSucceeded`: `{ result }`.

Projection buffers:

- `nodeIds: Uint32Array`
- `nodeKinds: Uint8Array`
- `nodeFlags: Uint8Array`
- `pointPositions: Float32Array`
- `edgeIds: Uint32Array`
- `edgeKinds: Uint8Array`
- `links: Float32Array`
- metadata arrays: `nodes`, `edges`, `clusters`, `changedNodeIds`,
  `changedEdgeIds`, and `stats`

Diff strategy:

- Full projection starts from shared `OntologySnapshot.resources` plus
  `OntologySnapshot.relationships`.
- Incremental projection starts from the previous projection's relationships and
  applies only `SessionChangeDelta.removed` and `SessionChangeDelta.added`
  quads.
- The worker does not duplicate P2 classification and does not recompute a full
  graph diff from raw quads. Viewport filtering calls the shared
  `resourceVisibleInViewMode` rule.
- Pinned nodes are reapplied from `options.pinnedNodes`, then previous
  projection positions, then deterministic layout for new nodes.

## Folds L0-L3

Defaults:

- `foldLevel: "L2"`
- `focusDepth: 1`
- `structuralFoldThreshold: 24`
- `autoClusterThreshold: 2500`
- `communityBucketSize: 250`
- `fullLabelThreshold: 250`
- `keyLabelThreshold: 2500`

Fold semantics:

- L0: full visible resource projection.
- L1: annotation properties collapse into
  `urn:beep:ontology:fold:annotations`.
- L2: structural sibling folding happens before clustering when a parent has at
  least `structuralFoldThreshold` children.
- L3: community buckets apply after L1/L2 when visible resource count exceeds
  `autoClusterThreshold`; resources already folded by annotation or structural
  folding are not reassigned.

## Gestures

Files:

- `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts`
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`
- `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx`

Halo gestures are typed as `OntologyGraphGesture` and converted into existing
session `ChangeOperation` values:

- `connect`: `addQuad(source, predicate, target)`
- `delete`: `removeQuad(source, predicate, target)`
- `expand`: `addQuad(source, predicate, target)`
- `instantiate`: `addQuad(instance, rdf:type, class)`

The UI calls `applyOntologyGraphGestureAtom`, which routes the generated ops
through the same `ApplyOntologyBatch` RPC/change-log/undoable pipeline used by
the inspector. Predicate autocomplete is computed from the snapshot relationship
predicates plus `rdf:type`.

## UI And Client Integration

Files:

- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`
- `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx`
- `packages/drivers/cosmos/src/Cosmos.renderer.ts`
- `apps/professional-desktop/src/spikes/CosmosSpike.tsx`
- `apps/professional-desktop/src/spikes/CosmosSpike.worker.ts`

Client atoms added the fold/options/projection/container/backend state, worker
bridge, render bridge, predicate suggestions, graph delta capture, and graph
gesture mutation.

The workbench mounts the graph worker and render bridges, renders the visualizer
panel in the center workspace, exposes L0-L3 fold controls, keeps Turtle source
visible below the viewport, and shows projection stats.

`@beep/cosmos` now supports handle updates so the render bridge can reuse a
mounted cosmos/sigma handle for new projections. The fallback remains
capability-detected and renders nodes/edges; full P3 behaviors are cosmos-path.

The spike now uses `CosmosSpike.worker.ts` to build the synthetic folded
projection off the UI thread. `window.__COSMOS_SPIKE__` still reports `backend`,
`elementCount`, and `fps`, and now also reports `foldLevel`,
`projectedNodeCount`, and `projectedEdgeCount`.

## Local Proof

Passed:

- `bun run --cwd packages/drivers/cosmos check`
- `bun run --cwd packages/drivers/cosmos lint`
- `bun run --cwd packages/drivers/cosmos docgen`
- `bun run --cwd packages/ontology/use-cases check`
- `bun run --cwd packages/ontology/use-cases lint`
- `bun run --cwd packages/ontology/use-cases docgen`
- `bun run --cwd packages/ontology/client check`
- `bun run --cwd packages/ontology/client lint`
- `bun run --cwd packages/ontology/client docgen`
- `bun run --cwd packages/ontology/ui check`
- `bun run --cwd packages/ontology/ui lint`
- `bun run --cwd packages/ontology/ui docgen`
- `bun run --cwd apps/professional-desktop check`
- `bun run --cwd apps/professional-desktop lint`
- `bunx vitest run --passWithNoTests packages/drivers/cosmos packages/ontology/use-cases packages/ontology/client packages/ontology/ui --exclude='**/test/integration/**'`
  - 4 files, 13 tests passed.
- `bun run beep quality jsdoc-inventory`
  - `packages=108 openPackages=0 openExports=0 openModules=0 rootPolicyOpen=0`
- `bun run beep quality jsdoc-ratchet`
  - `tracked=6 increased=0 current_totals=17`
- `bun run fallow:boundaries:check`
- `bun run version-sync`
- `bunx syncpack lint`
- `git diff --check`
- `jq . goals/ontology-workbench/ops/manifest.json`
- `test "$(wc -m < goals/ontology-workbench/GOAL.md)" -le 4000`

Known local gate caveats:

- `bunx syncpack list-mismatches` is deprecated in installed syncpack v14; the
  supported `bunx syncpack lint` passed.
- `bunx syncpack format --check` fails broad repo baseline package ordering
  across many unrelated packages. No repo-wide package sort was applied.
- `bun run config-sync:check -- --filter apps/professional-desktop` passed.
  The package filters for `packages/drivers/cosmos`,
  `packages/ontology/use-cases`, `packages/ontology/client`, and
  `packages/ontology/ui` report `package-docgen` drift. Running
  `bun run beep tsconfig-sync --write --filter packages/drivers/cosmos`
  reproducibly rewrote that valid `docgen.json` to a single blank line while
  reporting success, so the blank output was restored and this tool path is
  recorded as a blocker rather than applied.

## Host Re-Proof Commands

Run on a host with GUI/Tauri/webkitgtk available:

```sh
bun install
bun run --cwd packages/drivers/cosmos check
bun run --cwd packages/ontology/use-cases check
bun run --cwd packages/ontology/client check
bun run --cwd packages/ontology/ui check
bun run --cwd apps/professional-desktop check
bunx vitest run --passWithNoTests packages/drivers/cosmos packages/ontology/use-cases packages/ontology/client packages/ontology/ui --exclude='**/test/integration/**'
COSMOS_SPIKE=1 COSMOS_SPIKE_SIZE=100000 bun run --cwd apps/professional-desktop dev:tauri
```

In the Tauri window devtools or host automation, verify:

```js
window.__COSMOS_SPIKE__
```

Expected proof shape:

- `backend === "cosmos"`
- `foldLevel === "L3"`
- `elementCount >= 100000`
- `projectedNodeCount > 0`
- `projectedEdgeCount > 0`
- interactive FPS remains acceptable with folds active

## Risks For P4

- The `tsconfig-sync` package-docgen write path should be fixed or avoided
  before relying on it as a closeout gate.
- P4 should consume the same snapshot/change-log discipline for inferred graph
  invalidation; do not add a second resource classifier.
- Worker projections currently support layout preservation from pins and prior
  projections, but persistent user-authored layout storage is not yet a domain
  concept.
- The sigma fallback intentionally remains a rendering fallback. Full editing,
  folds, and benchmark exit proof stay on the cosmos path unless SPEC changes.
