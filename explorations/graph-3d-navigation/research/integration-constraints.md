# Graph 3D Navigation: In-Repo Integration Constraints

Method: static inspection of the live `beep-effect6` checkout and the packet's named primary evidence only; no network sources were used (`explorations/graph-3d-navigation/ops/manifest.json:1`).
Scope: this is lane (f)'s design-gate constraint ledger, not a renderer-stack decision; unresolved facts remain explicit (`explorations/graph-3d-navigation/ops/manifest.json:7`).

## 1. Render-handle contract

The existing public handle is this schema class:

```ts
export class CosmosRenderHandle extends S.Class<CosmosRenderHandle>($I`CosmosRenderHandle`)(
  {
    backend: CosmosBackend,
    destroy: Fn({ output: S.Void }),
    fps: Fn({ output: S.Finite }),
    update: Fn({
      input: CosmosGraphProjection,
      output: S.Void,
    }),
  },
  $I.annote("CosmosRenderHandle", {
    description: "",
  })
) {}
```

This makes the surface to mirror `backend`, idempotent resource cleanup via `destroy()`, sampled `fps()`, and synchronous `update(projection)`; the renderer owns animation-frame and backend resources until `destroy()` is called (`packages/drivers/cosmos/src/Cosmos.renderer.ts:295`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:315`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:545`).

The effective public mount signature is `(container: HTMLElement, projection: CosmosGraphProjection) => Effect.Effect<CosmosRenderHandle, CosmosDriverError>`: it probes WebGL2, selects a backend, and returns the mounted handle in the typed driver error channel (`packages/drivers/cosmos/src/Cosmos.renderer.ts:576`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:580`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:583`). A `Graph3DRenderHandle` that is meant to substitute at the bridge should preserve that mount/update/destroy lifecycle; any selection callback or theme input would be an intentional extension because neither is present today (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1279`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1305`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1327`).

The internal Cosmos configuration surface, currently instantiated only with defaults and not accepted by `renderCosmosGraph`, is:

```ts
{
  enableDrag: true,
  enableSimulation: true,
  fitViewDelay: 100,
  fitViewOnInit: true,
  fitViewPadding: 0.15,
  linkBlending: false,
  simulationFriction: 0.15,
  simulationGravity: 0,
  simulationRepulsion: 0.45,
  transitionDuration: 0,
  linkWidthScale: 1.6,
  pointSizeScale: 2.4,
  renderLinks: true,
  scalePointsOnZoom: true,
}
```

Those are schema defaults on a non-exported `CosmosGraphConfig`, and the driver always calls `CosmosGraphConfig.make()` itself (`packages/drivers/cosmos/src/Cosmos.renderer.ts:20`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:38`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:338`). A 3D config can mirror the lifecycle-relevant controls, but exposing configuration would be a new public contract rather than compatibility with an existing caller-supplied config (`packages/drivers/cosmos/src/Cosmos.renderer.ts:330`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:338`).

`update()` does not consume deltas. The Cosmos path replaces every point position and link buffer, repaints all sizes/colors, renders, destroys the entire label layer, and rebuilds it (`packages/drivers/cosmos/src/Cosmos.renderer.ts:434`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:450`). The Sigma fallback is also full replacement: it clears graphology, repopulates every node and edge, then refreshes (`packages/drivers/cosmos/src/Cosmos.renderer.ts:476`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:529`). The ontology-to-Cosmos adapter drops `changedNodeIds` and `changedEdgeIds`, so a renderer behind the current handle cannot perform sparse updates without extending the projection/handle contract (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1244`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1256`).

## 2. Projection schema

### Ontology projection inventory

`OntologyGraphProjection` contains:

| Field | Shape / meaning |
| --- | --- |
| `revision` | integer projection revision |
| `foldLevel` | `L0 | L1 | L2 | L3` |
| `labelDetail` | `full | key | hidden` |
| `nodeCount`, `edgeCount` | integer counts |
| `nodeIds` | `Uint32Array` |
| `nodeKinds`, `nodeFlags` | `Uint8Array` buffers |
| `edgeIds` | `Uint32Array` |
| `edgeKinds` | `Uint8Array` |
| `pointPositions` | `Float32Array` |
| `links` | `Float32Array` source/target index pairs |
| `nodes`, `edges`, `clusters` | schema arrays of metadata records |
| `changedNodeIds`, `changedEdgeIds` | integer ID arrays |
| `stats` | visible/projected/folded counts |

The schema declares that full inventory directly (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:405`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:428`). Each node currently carries `id`, `iri`, `label`, `kind`, `classification`, `folded`, `memberCount`, `x`, and `y`; each edge carries `id`, endpoint IDs/IRIs, predicate IRI, label, and `folded`; each cluster carries `id`, `iri`, `label`, `foldLevel`, and `memberCount` (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:241`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:255`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:282`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:295`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:319`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:329`). The stats record is `visibleResourceCount`, `projectedNodeCount`, `projectedEdgeCount`, and `foldedResourceCount` (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:352`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:363`).

### Cosmos projection inventory

`CosmosGraphProjection` is smaller: `nodeCount`, `edgeCount`, `nodeIds`, `pointPositions`, `links`, and optional `labels` in point order (`packages/drivers/cosmos/src/Cosmos.projection.ts:42`, `packages/drivers/cosmos/src/Cosmos.projection.ts:58`). It does not carry revision, kind/flag buffers, edge IDs/kinds, IRIs, clusters, LOD, stats, or changed-ID arrays (`packages/drivers/cosmos/src/Cosmos.projection.ts:42`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1244`).

### Where `z` must cross

The current layout seed and persistence path are two-dimensional: pinned nodes have only `x/y`; prior positions are retained as `[number, number]`; the deterministic seed returns `[x, y]`; graph nodes expose only `x/y`; and `pointPositions` allocates `nodes.length * 2` and writes two floats per node (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:141`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:150`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:764`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:788`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:815`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:821`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:978`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:986`).

Therefore worker-owned 3D layout requires a schema decision at `OntologyPinnedNode`, `OntologyGraphNode`, and `OntologyGraphProjection`: either make the canonical position buffer interleaved xyz and update every stride, or add a distinct 3D buffer while retaining the 2D buffer (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:141`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:241`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:405`). The renderer projection must then expose the same choice through `CosmosGraphProjection` or a new graph-3D projection schema; merely adding `z` to node metadata would not reach the typed-array renderer path (`packages/drivers/cosmos/src/Cosmos.projection.ts:42`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1244`).

The worker command already embeds `OntologyGraphProjectionOptions`/the previous projection, and both success cases embed `OntologyGraphProjection`, so changing those schemas changes the encoded worker message shape without a separate handwritten message interface (`packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:73`, `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:93`, `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:203`, `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:218`). Both sides deliberately encode/decode because the boundary is structured clone and drops prototypes (`packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:255`, `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:267`).

`pointPositions` is currently copied, not transferred: the client calls `postMessage(encodedCommand)` with no transfer list, and the worker calls `postMessage(encodedResult)` with no transfer list (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1215`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1220`, `packages/ontology/client/src/aggregates/Session/Session.visualizer.worker.ts:20`, `packages/ontology/client/src/aggregates/Session/Session.visualizer.worker.ts:25`). Adding a larger xyz buffer preserves correctness under structured clone but also preserves copy cost unless the protocol and ownership model are explicitly extended with transferables (`packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:255`, `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:267`).

`changedNodeIds` means projected node IDs reached from IRIs touched by a session delta after fold mapping; it is deduplicated, while `changedEdgeIds` is currently always empty (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1007`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1018`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1044`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1045`). Delta application mutates the relationship list from added/removed quads, records affected endpoint/subject IRIs, and then still rebuilds a complete projection (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1216`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1264`). A sparse 3D update cannot treat the arrays as complete topology deltas until edge IDs and add/remove semantics are defined; today they are change hints inside an otherwise complete projection (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1020`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1052`).

## 3. Label LOD

The LOD domain is exactly `full | key | hidden` (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:84`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:103`). Defaults are `fullLabelThreshold = 250` and `keyLabelThreshold = 2_500`; projected node count `<= 250` is `full`, `251..2,500` is `key`, and `> 2,500` is `hidden` (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:202`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:214`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:743`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:744`). The count is taken after focus/folding because `labelDetailFor(nodes.length, options)` is assigned while constructing the completed projection (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1020`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1029`).

There is no distinct key-label subset today. The client drops all labels only for `hidden`; both `full` and `key` map every projected node to its label in node order (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1244`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1256`). The Cosmos DOM overlay then truncates that ordered string array to the first 300 labels (`packages/drivers/cosmos/src/Cosmos.renderer.ts:84`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:110`). Thus a 2,500-node `key` projection does not identify graph-theoretic key nodes; it forwards all 2,500 names and displays the first 300 in sorted projection order (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:887`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1255`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:110`).

Each displayed label consumes only a string plus the point at the same index. The overlay creates one absolutely positioned `<span>` per shown string, uses `getPointPositions()` and `spaceToScreenPosition([x,y])` every animation frame, and offsets the text eight pixels below the point (`packages/drivers/cosmos/src/Cosmos.renderer.ts:96`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:127`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:135`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:151`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:387`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:401`). It does not consume node importance, community, font scale, opacity, camera distance, selected state, or label priority because none of those fields enter `CosmosGraphProjection.labels` (`packages/drivers/cosmos/src/Cosmos.projection.ts:42`, `packages/drivers/cosmos/src/Cosmos.projection.ts:54`). Proportional distance-faded 3D labels therefore need new per-node label attributes or a renderer-side derivation contract, not reuse of the present string-only overlay (`packages/drivers/cosmos/src/Cosmos.projection.ts:49`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:110`).

## 4. Theming

The workbench has two coordinated theme surfaces. Tailwind maps semantic utilities to CSS custom properties such as `--background`, `--foreground`, `--primary`, `--muted-foreground`, `--border`, and five chart colors (`packages/foundation/ui-system/ui/src/styles/globals.css:20`, `packages/foundation/ui-system/ui/src/styles/globals.css:58`). Professional Desktop imports that base and overrides the semantic variables for `:root` and `.dark` with the green/parchment and near-black/green palettes (`apps/professional-desktop/src/styles/globals.css:1`, `apps/professional-desktop/src/styles/globals.css:28`, `apps/professional-desktop/src/styles/globals.css:56`, `apps/professional-desktop/src/styles/globals.css:82`). The graph mount itself uses `bg-background`, so its surrounding surface already follows `--background` (`packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:816`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:820`).

The React provider is MUI's color-scheme provider, not a `next-themes` provider: the shared theme sets `colorSchemeSelector: "class"`, `AppThemeProvider` delegates to `MuiThemeProvider`, and the desktop wrapper defaults it to system mode (`packages/foundation/ui-system/ui/src/themes/theme.ts:48`, `packages/foundation/ui-system/ui/src/themes/theme.ts:52`, `packages/foundation/ui-system/ui/src/themes/theme-provider.tsx:186`, `packages/foundation/ui-system/ui/src/themes/theme-provider.tsx:197`, `apps/professional-desktop/src/theme/WorkbenchThemeProvider.tsx:77`, `apps/professional-desktop/src/theme/WorkbenchThemeProvider.tsx:82`). The app supplies matching MUI light/dark palette overrides, but those MUI palette values are separate from the app-local Tailwind custom properties (`apps/professional-desktop/src/theme/WorkbenchThemeProvider.tsx:13`, `apps/professional-desktop/src/theme/WorkbenchThemeProvider.tsx:56`, `apps/professional-desktop/src/styles/globals.css:25`, `apps/professional-desktop/src/styles/globals.css:82`).

A canvas renderer that must visually match the workbench can read computed semantic CSS values from its mounted element/document and refresh them when the root class changes; the existing R3F Orb establishes the repo precedent by observing `document.documentElement.class` with a `MutationObserver` (`packages/foundation/ui-system/ui/src/components/orb.tsx:202`, `packages/foundation/ui-system/ui/src/components/orb.tsx:220`). The exact graph palette mapping remains a design input because the repo has background/foreground/border/primary/chart tokens but no graph-specific `edge`, `node-community`, or `label` token (`packages/foundation/ui-system/ui/src/styles/globals.css:20`, `packages/foundation/ui-system/ui/src/styles/globals.css:58`).

Cosmos does not use those tokens today. Its point and link colors are hardcoded float RGBA tuples, its DOM labels use hardcoded RGBA text and shadow, and Sigma defaults use hardcoded hex colors (`packages/drivers/cosmos/src/Cosmos.renderer.ts:45`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:49`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:114`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:118`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:170`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:187`). Neither the Cosmos config nor the projection exposes theme colors (`packages/drivers/cosmos/src/Cosmos.renderer.ts:20`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:43`, `packages/drivers/cosmos/src/Cosmos.projection.ts:42`, `packages/drivers/cosmos/src/Cosmos.projection.ts:58`).

## 5. Doctrine verdict: placement consequences, without a winner

The binding driver rule is:

> Direct driver imports are intentionally narrow:
>
> - `server` may import drivers
> - `tables` may import drivers
> - `client` may import only browser-safe driver entrypoints
> - `domain`, `use-cases`, `config`, `ui`, and `shared/*` do not import drivers

(`standards/architecture/03-driver-boundaries.md:75`, `standards/architecture/03-driver-boundaries.md:85`)

The same doctrine says a client browser entrypoint is `@beep/<driver>/browser`, the package root is not browser-safe by default, and a driver must not require slice language to make sense (`standards/architecture/03-driver-boundaries.md:28`, `standards/architecture/03-driver-boundaries.md:37`, `standards/architecture/03-driver-boundaries.md:57`, `standards/architecture/03-driver-boundaries.md:59`). It also distinguishes `drivers = external engines and SDK boundaries` from `foundation = repo-owned reusable substrate` (`standards/architecture/03-driver-boundaries.md:87`, `standards/architecture/03-driver-boundaries.md:101`).

The non-slice routing order is equally explicit:

> 1. Product semantics go to the owning slice or `shared/*`.
> 2. External engines, SDKs, services, frameworks, and browser platform wrappers go to `drivers`.
> 3. Repo operations, generators, policy packs, and automation go to `tooling`.
> 4. Product-agnostic UI primitives, themes, tokens, hooks, and composition helpers go to `foundation/ui-system`.
> 5. Only remaining repo-owned, domain-agnostic technical services may go to `foundation/capability`.

(`standards/architecture/07-non-slice-families.md:32`, `standards/architecture/07-non-slice-families.md:46`)

For UI/runtime specifically, low-level browser wrappers belong in drivers with `/browser`; thin product-agnostic React hooks/components belong in `foundation/ui-system`; product-specific browser state belongs in slice `client` or `ui` (`standards/architecture/07-non-slice-families.md:179`, `standards/architecture/07-non-slice-families.md:195`). `ui-system` may depend on `foundation/primitive` and `foundation/modeling` but does not depend on `foundation/capability` by default (`standards/architecture/07-non-slice-families.md:165`, `standards/architecture/07-non-slice-families.md:181`).

### Option (i): `packages/drivers/graph-3d`

Legal path: `@beep/ontology-ui -> @beep/ontology-client -> @beep/graph-3d/browser`; the client bridge owns mounting, updates, selection-to-atom adaptation, and cleanup, while the driver remains ontology-unaware and consumes technical projection/config contracts (`standards/architecture/03-driver-boundaries.md:57`, `standards/architecture/03-driver-boundaries.md:59`, `standards/architecture/03-driver-boundaries.md:75`, `standards/architecture/03-driver-boundaries.md:85`). This satisfies the external-engine/browser-wrapper route if the package wraps Three/R3F/another engine behind a small technical boundary, and it strains doctrine if it imports ontology models, community semantics, workbench atoms, or exposes only a root browser surface instead of `/browser` (`standards/architecture/03-driver-boundaries.md:36`, `standards/architecture/03-driver-boundaries.md:37`, `standards/architecture/03-driver-boundaries.md:139`, `standards/architecture/03-driver-boundaries.md:141`).

The existing Cosmos path is useful precedent but not a perfect template for the new boundary rule: `@beep/ontology-client` directly imports the `@beep/cosmos` root, while the root calls itself browser-safe and no `/browser` export exists (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:9`, `packages/drivers/cosmos/src/index.ts:1`, `packages/drivers/cosmos/package.json:32`, `packages/drivers/cosmos/package.json:35`). Copying that root-only shape would reproduce an existing exception/strain against the explicit `/browser` rule (`standards/architecture/03-driver-boundaries.md:57`, `standards/architecture/03-driver-boundaries.md:59`).

### Option (ii): React component in `foundation/ui-system/ui`

Legal path: `@beep/ontology-ui -> @beep/ui/components/<graph-3d>` with ontology data converted to product-agnostic props at the slice boundary; the component must remain a thin UI primitive rather than know ontology IRIs, fold levels, or workbench atoms (`standards/architecture/07-non-slice-families.md:165`, `standards/architecture/07-non-slice-families.md:178`, `standards/architecture/07-non-slice-families.md:187`, `standards/architecture/07-non-slice-families.md:189`). This satisfies the product-agnostic React-component route, but placing a substantial third-party-engine wrapper, worker protocol, layout runtime, or low-level browser capability inside `@beep/ui` strains the preceding rule that external engines/frameworks/browser wrappers route to drivers (`standards/architecture/07-non-slice-families.md:37`, `standards/architecture/07-non-slice-families.md:46`, `standards/architecture/07-non-slice-families.md:183`, `standards/architecture/07-non-slice-families.md:191`).

`orb.tsx` is precedent for a thin product-agnostic R3F component in `@beep/ui`: it imports Drei, Fiber, and Three directly and exposes an ordinary React component (`packages/foundation/ui-system/ui/src/components/orb.tsx:9`, `packages/foundation/ui-system/ui/src/components/orb.tsx:17`, `packages/foundation/ui-system/ui/src/components/orb.tsx:71`, `packages/foundation/ui-system/ui/src/components/orb.tsx:125`). The package directly declares those engine dependencies (`packages/foundation/ui-system/ui/package.json:26`, `packages/foundation/ui-system/ui/package.json:44`, `packages/foundation/ui-system/ui/package.json:69`). That makes a thin graph visual primitive precedent-backed and consistent with the React-component clause, but it does not make a full force-layout engine/worker wrapper doctrine-clean under the external-engine routing clause (`standards/architecture/07-non-slice-families.md:40`, `standards/architecture/07-non-slice-families.md:44`, `standards/architecture/07-non-slice-families.md:183`, `standards/architecture/07-non-slice-families.md:188`).

### Option (iii): hybrid

A doctrine-legal hybrid cannot be `@beep/ui -> @beep/graph-3d`, because `ui` may not directly import drivers (`standards/architecture/03-driver-boundaries.md:75`, `standards/architecture/03-driver-boundaries.md:85`). The legal split is `@beep/ontology-client -> @beep/graph-3d/browser` for engine ownership plus `@beep/ontology-ui -> @beep/ui` for a driver-neutral container/control/toggle primitive; the ontology UI also consumes the client atoms, as it already does for Cosmos (`packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:26`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:56`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:481`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:482`). This satisfies platform-first routing and keeps product-specific state in the slice, at the cost of two coordinated surfaces and a props/container contract between UI and client (`standards/architecture/07-non-slice-families.md:183`, `standards/architecture/07-non-slice-families.md:195`). A hybrid where the foundation component imports the driver directly strains the direct-import law even if it is ergonomically attractive (`standards/architecture/03-driver-boundaries.md:75`, `standards/architecture/03-driver-boundaries.md:85`).

## 6. Storybook

The exact Storybook glob is:

```ts
stories: ["../../../packages/foundation/ui-system/*/stories/**/*.stories.@(ts|tsx)"]
```

(`apps/storybook/.storybook/main.ts:25`, `apps/storybook/.storybook/main.ts:28`)

For option (ii), a story under `packages/foundation/ui-system/ui/stories/**` needs no glob change; the Orb story proves that location is already discovered (`packages/foundation/ui-system/ui/stories/components/orb.stories.tsx:1`, `packages/foundation/ui-system/ui/stories/components/orb.stories.tsx:13`). For option (i), a story colocated under `packages/drivers/graph-3d/stories/**` is not matched and requires an additional driver stories glob, because the current pattern is rooted only at `packages/foundation/ui-system/*/stories` (`apps/storybook/.storybook/main.ts:25`, `apps/storybook/.storybook/main.ts:28`). For option (iii), a driver-neutral foundation shell/toggle story needs no change, while a story that imports and exercises the actual driver needs either an explicit driver glob or a separately approved integration-story host; putting that driver import into the foundation story would strain the `ui`-cannot-import-drivers rule (`standards/architecture/03-driver-boundaries.md:75`, `standards/architecture/03-driver-boundaries.md:85`).

## 7. Build constraints

Professional Desktop excludes `@cosmos.gl/graph` and `oxigraph` from Vite dependency optimization and explicitly includes `seedrandom` (`apps/professional-desktop/vite.config.ts:40`, `apps/professional-desktop/vite.config.ts:49`). The recorded reason for Cosmos is CJS/UMD dependency interop: Cosmos stays un-prebundled, `seedrandom` is interop-wrapped, and `gl-bench` is aliased to its ESM build because the optimizer otherwise selects a default-less UMD main (`apps/professional-desktop/vite.config.ts:41`, `apps/professional-desktop/vite.config.ts:48`, `apps/professional-desktop/vite.config.ts:60`, `apps/professional-desktop/vite.config.ts:70`). A new Three/R3F engine has no repo-recorded optimizeDeps exception; adding one requires an observed bundling failure rather than copying the Cosmos workaround (`apps/professional-desktop/vite.config.ts:40`, `apps/professional-desktop/vite.config.ts:49`).

Both graph-worker paths use Vite's module-worker form: `new Worker(new URL("...worker.ts", import.meta.url), { type: "module" })` (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1121`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1123`, `apps/professional-desktop/src/spikes/CosmosSpike.tsx:161`, `apps/professional-desktop/src/spikes/CosmosSpike.tsx:165`). The app also aliases a DOM-free dependency build because Vite resolves worker imports with browser conditions and a browser build that touches `document` at module top level kills a module worker (`apps/professional-desktop/vite.config.ts:64`, `apps/professional-desktop/vite.config.ts:70`). Any 3D layout moved into the existing worker must keep its import graph DOM-free (`packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:11`, `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:14`).

The desktop shell is Tauri v2 by configuration and Cargo dependency (`apps/professional-desktop/src-tauri/tauri.conf.json:1`, `apps/professional-desktop/src-tauri/tauri.conf.json:10`, `apps/professional-desktop/src-tauri/Cargo.toml:13`, `apps/professional-desktop/src-tauri/Cargo.toml:20`). The repo names the Cosmos spike as a WebKitGTK viability spike and offers 1k/10k/100k element presets, so the intended Linux-webview proof surface exists (`apps/professional-desktop/src/spikes/CosmosSpike.tsx:41`, `apps/professional-desktop/src/spikes/CosmosSpike.tsx:46`, `apps/professional-desktop/src/spikes/CosmosSpike.tsx:113`, `apps/professional-desktop/src/spikes/CosmosSpike.tsx:118`, `apps/professional-desktop/src/spikes/CosmosSpike.tsx:282`, `apps/professional-desktop/src/spikes/CosmosSpike.tsx:310`). The repo does not record a pass/fail result or WebKitGTK version in the inspected sources, so compatibility is not established by the spike's existence (`apps/professional-desktop/src/spikes/CosmosSpike.tsx:282`, `apps/professional-desktop/src/spikes/CosmosSpike.tsx:295`).

The packaged CSP is `default-src 'self'` with only connection allowances, so a production graph should not assume arbitrary remote textures/fonts/assets are available (`apps/professional-desktop/src-tauri/tauri.conf.json:12`, `apps/professional-desktop/src-tauri/tauri.conf.json:24`). The Orb's remote Perlin texture is therefore a component precedent, not evidence that remote 3D assets are admitted by the Tauri policy (`packages/foundation/ui-system/ui/src/components/orb.tsx:152`, `packages/foundation/ui-system/ui/src/components/orb.tsx:159`, `apps/professional-desktop/src-tauri/tauri.conf.json:22`, `apps/professional-desktop/src-tauri/tauri.conf.json:24`).

Professional Desktop renders under React `StrictMode` (`apps/professional-desktop/src/main.tsx:5`, `apps/professional-desktop/src/main.tsx:57`, `apps/professional-desktop/src/main.tsx:64`). WebGL acquisition must therefore tolerate development mount/cleanup/remount and release animation frames, workers, observers, event listeners, controls, geometries/materials, and GPU contexts through a complete cleanup path; the existing handle contract documents renderer ownership, and both bridge atoms register finalizers (`packages/drivers/cosmos/src/Cosmos.renderer.ts:545`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:550`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1225`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1228`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1334`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1337`). The workbench also records that an unstable ref callback caused repeated container detach/attach and renderer teardown, so the 2D/3D toggle must preserve stable ref identity and explicit destroy semantics (`packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:653`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:665`).

## 8. Dependency table

Versions below are the exact resolved versions in `bun.lock`; the root catalog constraints and declaring package manifests identify who owns each dependency (`bun.lock:3541`, `bun.lock:7255`).

| Dependency | Resolved version | Root catalog declaration | Declaring package(s) in scope |
| --- | --- | --- | --- |
| `three` | `0.185.1` | `^0.185.1` (`package.json:243`) | `@beep/ui` dependency (`packages/foundation/ui-system/ui/package.json:69`) |
| `@react-three/fiber` | `9.6.1` | `^9.6.1` (`package.json:106`) | `@beep/ui` dependency (`packages/foundation/ui-system/ui/package.json:44`) |
| `@react-three/drei` | `10.7.7` | `^10.7.7` (`package.json:105`) | `@beep/ui` dependency (`packages/foundation/ui-system/ui/package.json:43`) |
| `react` | `19.2.7` | `19.2.7` (`package.json:219`) | `@beep/ui` peer `^19` (`packages/foundation/ui-system/ui/package.json:86`); Professional Desktop dependency (`apps/professional-desktop/package.json:80`) |
| `react-dom` | `19.2.7` | `19.2.7` (`package.json:222`) | `@beep/ui` peer `^19` (`packages/foundation/ui-system/ui/package.json:86`); Professional Desktop dependency (`apps/professional-desktop/package.json:81`) |
| `effect` | `4.0.0-beta.97` | `4.0.0-beta.97` (`package.json:170`) | `@beep/ui` (`packages/foundation/ui-system/ui/package.json:53`), `@beep/cosmos` (`packages/drivers/cosmos/package.json:59`), Professional Desktop (`apps/professional-desktop/package.json:79`) |
| `@effect/atom-react` | `4.0.0-beta.97` | `4.0.0-beta.97` (`package.json:32`) | `@beep/ui` (`packages/foundation/ui-system/ui/package.json:30`), Professional Desktop (`apps/professional-desktop/package.json:74`) |
| `@cosmos.gl/graph` | `3.3.0` | `3.3.0` (`package.json:27`) | `@beep/cosmos` (`packages/drivers/cosmos/package.json:58`) |
| `sigma` | `3.0.3` | `3.0.3` (`package.json:232`) | `@beep/cosmos` (`packages/drivers/cosmos/package.json:61`) |
| `graphology` | `0.26.0` | `0.26.0` (`package.json:184`) | `@beep/cosmos` (`packages/drivers/cosmos/package.json:60`) |

The corresponding lock entries confirm Three `0.185.1`, Fiber `9.6.1`, Drei `10.7.7`, React/React DOM `19.2.7`, Effect/Atom React `4.0.0-beta.97`, Cosmos `3.3.0`, Sigma `3.0.3`, and graphology `0.26.0` (`bun.lock:3541`, `bun.lock:3737`, `bun.lock:4517`, `bun.lock:4519`, `bun.lock:5613`, `bun.lock:5895`, `bun.lock:6863`, `bun.lock:6873`, `bun.lock:7067`, `bun.lock:7255`).

## 9. Selection

Current selection is atom-centered. `selectedOntologyResourceIriAtom` stores `Option<string>`, and `selectedOntologyResourceAtom` resolves that IRI against the current snapshot (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:750`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:763`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:942`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:965`). The tree is controlled by `selectedIri`; its `onSelectedItemsChange` writes the selected IRI atom (`packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:448`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:463`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:795`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:800`). Validation focus uses the same setter, so tree/validation/inspector already converge on one selection source (`packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:648`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:651`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:840`, `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:863`).

That atom flows into `OntologyGraphProjectionOptions.focusIri`; `focusDepth` remains the default `1` because the client overrides only view mode, fold level, and focus IRI (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:987`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1007`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:202`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:214`). The options enter the worker request, and projection filters resources to the selected hierarchy neighborhood out to that depth (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1026`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1030`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1187`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1223`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:636`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:689`). Selection therefore currently changes projection membership/focus; it is not merely a renderer highlight/dimming flag (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:673`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:689`).

Canvas-click to atom sync needs a new hit-test/event surface because `CosmosRenderHandle`, `renderCosmosGraph`, and the declared graph instance expose no click callback (`packages/drivers/cosmos/src/Cosmos.renderer.ts:67`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:82`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:315`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:328`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:576`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:587`). The slice-client bridge is the legal adaptation point: it has the full ontology projection, can translate a renderer node index/ID to `projection.nodes[index].iri` or an ID lookup, and can write `selectedOntologyResourceIriAtom`; the technical driver should not know ontology IRIs or atoms (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1258`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1261`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1279`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1297`, `standards/architecture/03-driver-boundaries.md:36`, `standards/architecture/03-driver-boundaries.md:37`).

For bidirectional sync without feedback ambiguity, the design gate must separate (a) selected node identity sent into the renderer for visual dimming from (b) `focusIri` sent to the worker for neighborhood filtering, or explicitly accept that every canvas click reprojects to depth one (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1000`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1007`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:673`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:689`). The current renderer projection has no selected-node field, so selection dimming is a new projection/config/update input regardless of placement (`packages/drivers/cosmos/src/Cosmos.projection.ts:42`, `packages/drivers/cosmos/src/Cosmos.projection.ts:58`).

## Sources

| id | title | upstream (repo) | location (`file:line`) | theme | disposition |
| --- | --- | --- | --- | --- | --- |
| g3d-f-01 | Cosmos renderer adapter and handle | beep-effect6 | `packages/drivers/cosmos/src/Cosmos.renderer.ts:20` | handle, config, labels, colors, lifecycle | extend |
| g3d-f-02 | Cosmos typed-array projection | beep-effect6 | `packages/drivers/cosmos/src/Cosmos.projection.ts:42` | renderer projection schema | extend |
| g3d-f-03 | Cosmos browser-safe root facade | beep-effect6 | `packages/drivers/cosmos/src/index.ts:1` | driver export surface | reference |
| g3d-f-04 | Cosmos package manifest | beep-effect6 | `packages/drivers/cosmos/package.json:32` | dependencies, driver family, exports | reference |
| g3d-f-05 | Ontology visualizer projection | beep-effect6 | `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:167` | options, LOD, folding, positions, deltas | extend |
| g3d-f-06 | Ontology worker protocol | beep-effect6 | `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:73` | encoded message shapes | extend |
| g3d-f-07 | Ontology graph worker | beep-effect6 | `packages/ontology/client/src/aggregates/Session/Session.visualizer.worker.ts:20` | structured-clone response path | extend |
| g3d-f-08 | Ontology client graph atoms | beep-effect6 | `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:987` | worker/render bridges and selection | extend |
| g3d-f-09 | Ontology workbench | beep-effect6 | `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:419` | mount, badges, tree selection | extend |
| g3d-f-10 | Orb R3F component | beep-effect6 | `packages/foundation/ui-system/ui/src/components/orb.tsx:9` | Three/R3F and theme precedent | reference |
| g3d-f-11 | Shared UI manifest | beep-effect6 | `packages/foundation/ui-system/ui/package.json:26` | Three/R3F ownership | reference |
| g3d-f-12 | Shared theme tokens | beep-effect6 | `packages/foundation/ui-system/ui/src/styles/globals.css:20` | CSS custom properties | reuse |
| g3d-f-13 | Desktop theme overrides | beep-effect6 | `apps/professional-desktop/src/styles/globals.css:25` | workbench graph palette source | reuse |
| g3d-f-14 | Desktop theme provider | beep-effect6 | `apps/professional-desktop/src/theme/WorkbenchThemeProvider.tsx:13` | MUI light/dark schemes | reuse |
| g3d-f-15 | Storybook configuration | beep-effect6 | `apps/storybook/.storybook/main.ts:25` | stories discovery glob | reference |
| g3d-f-16 | Professional Desktop Vite config | beep-effect6 | `apps/professional-desktop/vite.config.ts:37` | optimizer and worker import constraints | reference |
| g3d-f-17 | Cosmos WebKitGTK spike | beep-effect6 | `apps/professional-desktop/src/spikes/CosmosSpike.tsx:161` | module worker and runtime proof surface | reuse |
| g3d-f-18 | Professional Desktop root | beep-effect6 | `apps/professional-desktop/src/main.tsx:52` | StrictMode and providers | reference |
| g3d-f-19 | Tauri v2 configuration | beep-effect6 | `apps/professional-desktop/src-tauri/tauri.conf.json:1` | webview and CSP constraints | reference |
| g3d-f-20 | Driver boundaries doctrine | beep-effect6 | `standards/architecture/03-driver-boundaries.md:75` | legal direct imports | reference |
| g3d-f-21 | Non-slice family doctrine | beep-effect6 | `standards/architecture/07-non-slice-families.md:32` | platform-first placement | reference |
| g3d-f-22 | Root dependency catalog | beep-effect6 | `package.json:27` | dependency versions | reuse |
| g3d-f-23 | Resolved dependency lock | beep-effect6 | `bun.lock:3541` | exact installed versions | reference |

## Unresolved

- The repo does not record the outcome of running the Cosmos spike in a packaged Linux Tauri/WebKitGTK webview, the WebKitGTK version tested, GPU/driver matrix, or a measured 2,500-node frame-time result; the source only defines the viability surface (`apps/professional-desktop/src/spikes/CosmosSpike.tsx:282`, `apps/professional-desktop/src/spikes/CosmosSpike.tsx:310`).
- The repo does not choose whether xyz is an interleaved replacement for `pointPositions`, a parallel 3D buffer, or renderer-internal state; all current schemas and strides are 2D (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:973`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:987`).
- The repo does not define which nodes qualify as `key`, their importance metric, proportional font-size mapping, distance-fade curve, label occlusion policy, or 3D label technology; `key` currently forwards all labels and the renderer truncates the first 300 (`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1251`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1256`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:84`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:110`).
- The repo does not carry a per-node community ID/color. L3 folding hashes resources into synthetic community buckets only when folding is enabled above the threshold, and cluster metadata has no color (`packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:732`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:738`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:319`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:329`).
- The repo does not define curved-edge geometry, 2D/3D camera-state preservation, selection-dimming opacity, or whether selection should continue to trigger depth-one focus filtering (`packages/drivers/cosmos/src/Cosmos.projection.ts:42`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:673`, `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:689`).
- The current Cosmos adapter declarations expose no hit-test or click event, so the exact engine event payload and node-ID-to-IRI lookup contract remain undetermined (`packages/drivers/cosmos/src/Cosmos.renderer.ts:67`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:82`).
- The repo contains placement rules and precedents but no accepted architecture decision choosing driver, foundation component, or hybrid for this graph-3D engine (`explorations/graph-3d-navigation/ops/manifest.json:7`, `standards/architecture/07-non-slice-families.md:183`, `standards/architecture/07-non-slice-families.md:195`).
- The repo does not state whether Storybook must execute the low-level driver itself; that requirement determines whether the stories glob must expand beyond `foundation/ui-system` (`apps/storybook/.storybook/main.ts:25`, `apps/storybook/.storybook/main.ts:28`).
