---
{}
---

No release: refresh the workspace dependency catalog and lockfile through
`bun run deps:update` and `bun run version-sync --write`. The catalog moves
Effect to `4.0.0-rc.117` (with the whole lockstep `@effect/*` family), turbo
to `2.11.2` (every `turbo.json` `$schema` URL is re-pinned by version-sync),
MUI 9 from the betas to stable, knip to 6.37, oxlint to 1.85,
fallow to 3.27, vitest to 5.0.1, and the redis and grafana otel-lgtm compose
images to their current patch releases, with the compatibility updates those
releases require:

- Effect rc.116 made `SchemaGetter` getters plain tagged values, so
  `getter.run(...)` becomes `SchemaGetter.run(getter, ...)` and
  `SchemaGetter.onSome` becomes `SchemaGetter.transformEffect`;
  `SchemaAST.Context.constructorDefault` now stores the bare default Effect;
  `Stream.scan` takes a lazy seed; and `Effect.isEffect` narrows to
  `Effect<unknown, unknown, unknown>` instead of `any`.
- The effect-vitest primitives graph, charter fixtures, and inventory are
  re-pinned to the `@effect/vitest@4.0.0-rc.117` tag: the Effect.ts and
  Arbitrary.ts anchors shifted, and `annotateLogs` is now declared with an
  explicit overload type.
- The `patchedDependencies` keys move to
  `@effect/platform-node-shared@4.0.0-rc.117` and `knip@6.37.0`.
- The `lexical` / `@lexical/*` family joins the syncpack held-back group at
  0.50: 0.51 deprecates `LexicalComposer` (Biome's `noDeprecatedImports`
  fails every composer in `@beep/editor` and `@beep/ui`) in favour of the
  extension-based `LexicalExtensionComposer`, an editor migration that needs
  its own browser-QA campaign.
- `@pulumi/command` 4.x drops the `logging` argument (its default already
  logged stdout and stderr), `@cosmos.gl/graph` 3.4.2 imports gl-bench's ESM
  build directly so the `gl-bench` Vite and Vitest aliases go away, and
  `HttpMethod` gains the `QUERY` method effect added to its own union.
