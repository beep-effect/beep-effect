# Schema inventory index

Pin: `df77fff9396fe31de72d1947ecb5b74f8cee89e1` (inventoryPin: root package.json catalog `effect`; sources read with `git -C .repos/effect show <pin>:<file>`). TypeScript parser: `6.0.3`. Counts include direct public members at one level; barrel namespace re-exports are one row each and are not expanded. Module list: `explorations/effect-schema-parity/research/tools/modules.ts`.

Regenerate from repo root (offline):

```sh
bun run explorations/effect-schema-parity/research/tools/schema-inventory.ts
```

## Module totals

Count verification: `rg --no-ignore --no-heading -F -c '"sha":' explorations/effect-schema-parity/research/inventory/*.jsonl` (sum file counts). Bytes are UTF-8 JSONL bytes from Buffer.byteLength, excluding Markdown and tools; byte sizes are not line counts.

Importable `no` marks provenance-only modules whose path effect's exports map nulls (`./internal/*`); their rows carry `"importable":false`.

| Module | Importable | Rows | Bytes |
| --- | --- | ---: | ---: |
| [effect/Schema](effect-Schema.jsonl) | yes | 1109 | 494031 |
| [effect/SchemaAST](effect-SchemaAST.jsonl) | yes | 315 | 127436 |
| [effect/SchemaParser](effect-SchemaParser.jsonl) | yes | 37 | 20288 |
| [effect/SchemaIssue](effect-SchemaIssue.jsonl) | yes | 65 | 28813 |
| [effect/SchemaGetter](effect-SchemaGetter.jsonl) | yes | 72 | 34142 |
| [effect/SchemaTransformation](effect-SchemaTransformation.jsonl) | yes | 62 | 32475 |
| [effect/SchemaRepresentation](effect-SchemaRepresentation.jsonl) | yes | 223 | 99730 |
| [effect/Arbitrary](effect-Arbitrary.jsonl) | yes | 77 | 31141 |
| [effect/JsonSchema](effect-JsonSchema.jsonl) | yes | 27 | 11872 |
| [effect/Equivalence](effect-Equivalence.jsonl) | yes | 20 | 9316 |
| [effect/StandardSchema](effect-StandardSchema.jsonl) | yes | 30 | 13265 |
| [effect/ChannelSchema](effect-ChannelSchema.jsonl) | yes | 8 | 5134 |
| [effect/schema](effect-schema.jsonl) | yes | 5 | 1878 |
| [effect/schema/Model](effect-schema-Model.jsonl) | yes | 55 | 30822 |
| [effect/schema/VariantSchema](effect-schema-VariantSchema.jsonl) | yes | 47 | 22524 |
| [effect/schema/SchemaCompiler](effect-schema-SchemaCompiler.jsonl) | yes | 19 | 8686 |
| [effect/schema/SchemaCompiler/runtime](effect-schema-SchemaCompiler-runtime.jsonl) | yes | 1 | 386 |
| [effect/schema/SchemaJITCompiler](effect-schema-SchemaJITCompiler.jsonl) | yes | 2 | 847 |
| [effect/schema/SchemaJITCompiler/enable](effect-schema-SchemaJITCompiler-enable.jsonl) | yes | 0 | 0 |
| [effect/schema/SchemaAOTCompiler](effect-schema-SchemaAOTCompiler.jsonl) | yes | 5 | 2269 |
| [effect/schema/SchemaAOTCompiler/Build](effect-schema-SchemaAOTCompiler-Build.jsonl) | yes | 14 | 6744 |
| [effect/internal/schema/codegen](effect-internal-schema-codegen.jsonl) | no | 11 | 4352 |
| [effect/internal/schema/compilerRegistry](effect-internal-schema-compilerRegistry.jsonl) | no | 25 | 10464 |
| [effect/internal/schema/interpreter](effect-internal-schema-interpreter.jsonl) | no | 3 | 1487 |
| **Total** | | **2232** | **998102** |

## Per-module kinds and categories

Every cell verified with `rg --no-ignore --no-heading -F -c '"kind":"<kind>"' <module.jsonl>` or `rg --no-ignore --no-heading -F -c '"category":"<category>"' <module.jsonl>`; untagged uses `'"category":null'`. The generator runs these exact commands for every group.

| Module | Kinds | Categories |
| --- | --- | --- |
| effect/Schema | accessor: 1; call: 8; class: 1; const: 192; constructor: 5; function: 152; interface: 220; method: 17; namespace: 10; property: 479; type: 24 | (untagged): 525; annotations: 3; branding: 3; combinators: 9; constructors: 43; converting: 13; decoding: 24; encoding: 15; error handling: 4; errors: 1; filtering: 3; formatting: 2; getters: 2; guards: 4; instances: 2; models: 202; options: 4; schemas: 150; transforming: 20; utility types: 16; validation: 64 |
| effect/SchemaAST | const: 86; function: 49; interface: 30; method: 74; property: 70; type: 6 | (untagged): 209; annotations: 5; constants: 2; constructors: 38; guards: 22; models: 32; options: 2; predicates: 1; transforming: 4 |
| effect/SchemaParser | call: 2; const: 12; function: 21; interface: 2 | (untagged): 12; constructors: 3; decoding: 10; encoding: 10; guards: 2 |
| effect/SchemaIssue | const: 14; function: 7; interface: 12; property: 28; type: 4 | (untagged): 32; constructors: 11; formatting: 7; guards: 2; models: 13 |
| effect/SchemaGetter | call: 3; const: 4; function: 49; interface: 5; property: 9; type: 2 | (untagged): 12; combining: 2; constructors: 8; converting: 8; decoding: 10; encoding: 7; filtering: 1; mapping: 1; models: 6; splitting: 2; transforming: 12; utility types: 1; validation: 2 |
| effect/SchemaTransformation | call: 1; const: 30; function: 20; interface: 2; method: 2; property: 7 | (untagged): 12; combining: 1; constructors: 6; converting: 4; decoding: 3; encoding: 5; guards: 1; models: 2; transforming: 28 |
| effect/SchemaRepresentation | const: 84; function: 14; interface: 45; namespace: 2; property: 67; type: 11 | (untagged): 69; annotations: 2; configuration: 1; constructors: 8; decoding: 2; encoding: 2; models: 53; schemas: 30; transforming: 6; validation: 50 |
| effect/Arbitrary | call: 4; const: 8; function: 6; interface: 13; property: 42; type: 4 | (untagged): 46; configuration: 1; constructors: 4; converting: 1; errors: 1; filtering: 2; guards: 1; mapping: 1; models: 15; running: 2; sequencing: 1; type IDs: 2 |
| effect/JsonSchema | const: 4; function: 10; interface: 4; property: 7; type: 2 | (untagged): 11; constants: 3; decoding: 4; encoding: 3; models: 6 |
| effect/Equivalence | call: 2; const: 10; function: 5; interface: 1; property: 1; type: 1 | (untagged): 3; combinators: 4; combining: 2; constructors: 3; instances: 5; mapping: 1; models: 1; utility types: 1 |
| effect/StandardSchema | interface: 16; namespace: 3; property: 3; type: 8 | (untagged): 30 |
| effect/ChannelSchema | call: 2; const: 6 | (untagged): 2; combinators: 2; constructors: 4 |
| effect/schema | namespace: 5 | (untagged): 5 |
| effect/schema/Model | const: 35; interface: 17; type: 3 | constructors: 7; converting: 1; getters: 1; models: 3; schemas: 42; transforming: 1 |
| effect/schema/VariantSchema | const: 7; constructor: 1; interface: 5; method: 1; namespace: 3; property: 20; type: 10 | (untagged): 25; accessors: 1; constructors: 2; guards: 2; models: 12; schemas: 2; type IDs: 1; utility types: 2 |
| effect/schema/SchemaCompiler | call: 5; const: 3; interface: 6; property: 5 | (untagged): 10; models: 6; registry: 1; symbols: 2 |
| effect/schema/SchemaCompiler/runtime | const: 1 | (untagged): 1 |
| effect/schema/SchemaJITCompiler | const: 1; function: 1 | (untagged): 1; compilation: 1 |
| effect/schema/SchemaJITCompiler/enable |  |  |
| effect/schema/SchemaAOTCompiler | const: 1; interface: 1; property: 2; type: 1 | (untagged): 2; compilation: 1; models: 2 |
| effect/schema/SchemaAOTCompiler/Build | call: 1; class: 1; const: 1; interface: 3; property: 7; type: 1 | (untagged): 8; compilation: 1; errors: 1; models: 4 |
| effect/internal/schema/codegen | const: 3; function: 1; interface: 2; property: 4; type: 1 | (untagged): 11 |
| effect/internal/schema/compilerRegistry | const: 2; function: 7; interface: 1; property: 9; type: 6 | (untagged): 25 |
| effect/internal/schema/interpreter | const: 1; function: 2 | (untagged): 3 |

## Largest Schema.ts category groups

Verification: `rg --no-ignore --no-heading -F -c '"category":"<category>"' explorations/effect-schema-parity/research/inventory/effect-Schema.jsonl`; same independently verified groups above, ranked by count, lexical tie-break. Untagged members excluded.

| Category | Rows |
| --- | ---: |
| models | 202 |
| schemas | 150 |
| validation | 64 |
| constructors | 43 |
| decoding | 24 |
| transforming | 20 |
| utility types | 16 |
| encoding | 15 |
| converting | 13 |
| combinators | 9 |
| error handling | 4 |
| guards | 4 |
| options | 4 |
| annotations | 3 |
| branding | 3 |
