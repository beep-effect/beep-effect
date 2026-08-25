# @beep/codegen-kit

`@beep/codegen-kit` runs deterministic OpenAPI and JSON Schema code generation for workspace packages.

## Pipeline

```text
fetch -> patch -> generate(onEnter) -> postProcess -> format -> write | drift
```

`fetch` reads the committed cache by default. A URL source still requires `cachePath` and `pin`; the network is used only with `--refresh`. Check mode is offline and compares generated outputs, never the cached source bytes.

Refreshes parse the upstream JSON, serialize it with two-space indentation, and run the pinned repository Biome binary. This matches the pre-commit JSON format, so refreshing an unchanged release does not dirty the cache.

The `schemas` format uses `JsonSchemaGenerator.make()`, `addSchema`, and `generate`. The upstream schema generator accepts only `openapi-3.0` and `openapi-3.1` as importer modes, so the kit lowers `json-schema-2020-12` and `swagger-2.0` schema documents through its `openapi-3.1` importer after extracting their native definition containers. The other formats call `OpenApiGenerator.generate` directly.

## Consumer entrypoint

```ts
import { GenerateConfig, runGenerateCli } from "@beep/codegen-kit"

const config = GenerateConfig.make({
  packageName: "@beep/example",
  name: "ExampleApi",
  identity: { composer: "$ExampleId", moduleId: "_generated/schema.gen" },
  source: {
    _tag: "url",
    url: "https://example.com/v1/schema.json",
    pin: "v1",
    cachePath: `${import.meta.dirname}/../spec/schema.json`
  },
  dialect: "json-schema-2020-12",
  transforms: ["nullableTypeArray"],
  format: "schemas",
  output: { path: `${import.meta.dirname}/../src/_generated/schema.gen.ts` }
})

runGenerateCli(config)
```

Run the consumer package's generate script normally to use the cache. Pass `--refresh` to replace and format URL caches. Pass `--check` to fail when generated output is missing or changed. `--check` and `--refresh` cannot be combined.

`name` is optional and defaults to the package-derived generator name. OpenAPI warnings fail generation by default; set `onWarning: "log"` to print them and continue. `--check` prints a unified diff for each missing or changed output.

Schema output uses `schemaStyle: "struct"` by default. Set `schemaStyle: "class"` to render object schemas as `S.Class` models with `.make(...)` and a static schema-derived `is` guard. Non-object schemas keep the struct-style schema declaration.

Package-specific files use `extraModules` entries with renderer names and output paths. Supply their implementations through `runGenerateCli(config, { extraRenderers })`.

## Registered transforms

- `nullableTypeArray`
- `flattenAllOfRefVariants`
- `distributeUnionSiblings`
- `openObjects`
- `stripExamples`

## Development

```bash
bun run beep:check
bunx --bun vitest run --pool=threads --maxWorkers=1
bun run beep:lint
bun run docgen
```

Tests import package source through `@beep/codegen-kit`. Relative test imports are reserved for local helpers, fixtures, and snapshots.

## License

MIT
