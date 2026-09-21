# Schema inventory index

Pin: `51d4a2f08a5c7691dc876415bc9fc0ecf467e153`. TypeScript parser: `6.0.3`. Counts include direct public members at one level and barrel namespace members.

Regenerate from repo root (offline):

```sh
bun run explorations/effect-schema-parity/research/tools/schema-inventory.ts
```

## Module totals

Count verification: `rg --no-ignore --no-heading -F -c '"sha":' explorations/effect-schema-parity/research/inventory/*.jsonl` (sum file counts). Bytes are UTF-8 JSONL bytes from Buffer.byteLength, excluding Markdown and tools; byte sizes are not line counts.

| Module | Rows | Bytes |
| --- | ---: | ---: |
| [effect/Schema](effect-Schema.jsonl) | 1026 | 406535 |
| [effect/SchemaAST](effect-SchemaAST.jsonl) | 310 | 110509 |
| [effect/SchemaGetter](effect-SchemaGetter.jsonl) | 57 | 24760 |
| [effect/SchemaParser](effect-SchemaParser.jsonl) | 37 | 18511 |
| [effect/SchemaIssue](effect-SchemaIssue.jsonl) | 65 | 25693 |
| [effect/SchemaRepresentation](effect-SchemaRepresentation.jsonl) | 219 | 87214 |
| [effect/SchemaTransformation](effect-SchemaTransformation.jsonl) | 61 | 28681 |
| [effect/StandardSchema](effect-StandardSchema.jsonl) | 30 | 11825 |
| [effect/JsonSchema](effect-JsonSchema.jsonl) | 27 | 10576 |
| [effect/unstable/schema](effect-unstable-schema.jsonl) | 74 | 38777 |
| [effect/unstable/schema/VariantSchema](effect-unstable-schema-VariantSchema.jsonl) | 47 | 21113 |
| [effect/unstable/schema/Model](effect-unstable-schema-Model.jsonl) | 55 | 29172 |
| [effect/unstable/arbitrary](effect-unstable-arbitrary.jsonl) | 28 | 12832 |
| [effect/unstable/arbitrary/Arbitrary](effect-unstable-arbitrary-Arbitrary.jsonl) | 69 | 27162 |
| **Total** | **2105** | **853360** |

## Per-module kinds and categories

Every cell verified with `rg --no-ignore --no-heading -F -c '"kind":"<kind>"' <module.jsonl>` or `rg --no-ignore --no-heading -F -c '"category":"<category>"' <module.jsonl>`; untagged uses `'"category":null'`. The generator runs these exact commands for every group.

| Module | Kinds | Categories |
| --- | --- | --- |
| effect/Schema | accessor: 1; call: 8; class: 1; const: 165; constructor: 5; function: 149; interface: 193; method: 17; namespace: 10; property: 453; type: 24 | (untagged): 499; annotations: 3; branding: 3; combinators: 9; constructors: 43; converting: 13; decoding: 24; encoding: 15; error handling: 4; errors: 1; filtering: 3; formatting: 2; getters: 2; guards: 4; instances: 2; models: 175; options: 4; schemas: 123; transforming: 20; utility types: 16; validation: 61 |
| effect/SchemaAST | const: 83; function: 47; interface: 30; method: 74; property: 70; type: 6 | (untagged): 204; annotations: 5; constants: 2; constructors: 38; guards: 22; models: 32; options: 2; predicates: 1; transforming: 4 |
| effect/SchemaGetter | const: 2; function: 50; interface: 1; method: 2; property: 1; type: 1 | (untagged): 3; combining: 1; constructors: 9; converting: 7; decoding: 10; encoding: 7; filtering: 1; models: 1; splitting: 2; transforming: 13; utility types: 1; validation: 2 |
| effect/SchemaParser | call: 2; const: 12; function: 21; interface: 2 | (untagged): 12; constructors: 3; decoding: 10; encoding: 10; guards: 2 |
| effect/SchemaIssue | const: 14; function: 7; interface: 12; property: 28; type: 4 | (untagged): 32; constructors: 11; formatting: 7; guards: 2; models: 13 |
| effect/SchemaRepresentation | const: 81; function: 14; interface: 45; namespace: 2; property: 67; type: 10 | (untagged): 69; annotations: 2; configuration: 1; constructors: 8; decoding: 2; encoding: 2; models: 52; schemas: 30; transforming: 6; validation: 47 |
| effect/SchemaTransformation | const: 29; function: 20; interface: 2; method: 3; property: 7 | (untagged): 12; constructors: 6; converting: 4; decoding: 3; encoding: 5; guards: 1; models: 2; transforming: 28 |
| effect/StandardSchema | interface: 16; namespace: 3; property: 3; type: 8 | (untagged): 30 |
| effect/JsonSchema | const: 4; function: 10; interface: 4; property: 7; type: 2 | (untagged): 11; constants: 3; decoding: 4; encoding: 3; models: 6 |
| effect/unstable/schema | const: 42; interface: 22; namespace: 5; type: 5 | (untagged): 5; accessors: 1; constructors: 9; converting: 1; getters: 1; guards: 2; models: 7; schemas: 44; transforming: 1; type IDs: 1; utility types: 2 |
| effect/unstable/schema/VariantSchema | const: 7; constructor: 1; interface: 5; method: 1; namespace: 3; property: 20; type: 10 | (untagged): 25; accessors: 1; constructors: 2; guards: 2; models: 12; schemas: 2; type IDs: 1; utility types: 2 |
| effect/unstable/schema/Model | const: 35; interface: 17; type: 3 | constructors: 7; converting: 1; getters: 1; models: 3; schemas: 42; transforming: 1 |
| effect/unstable/arbitrary | const: 6; function: 6; interface: 11; namespace: 1; type: 4 | (untagged): 1; constructors: 3; converting: 1; errors: 1; filtering: 2; guards: 1; mapping: 1; models: 13; running: 2; sequencing: 1; type IDs: 2 |
| effect/unstable/arbitrary/Arbitrary | call: 4; const: 6; function: 6; interface: 11; property: 38; type: 4 | (untagged): 42; constructors: 3; converting: 1; errors: 1; filtering: 2; guards: 1; mapping: 1; models: 13; running: 2; sequencing: 1; type IDs: 2 |

## Largest Schema.ts category groups

Verification: `rg --no-ignore --no-heading -F -c '"category":"<category>"' explorations/effect-schema-parity/research/inventory/effect-Schema.jsonl`; same independently verified groups above, ranked by count, lexical tie-break. Untagged members excluded.

| Category | Rows |
| --- | ---: |
| models | 175 |
| schemas | 123 |
| validation | 61 |
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
