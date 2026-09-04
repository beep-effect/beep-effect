# @beep/schema Topology Specification

## Status

**ACTIVE**

## Mission

Make `@beep/schema` a consistent reusable schema substrate whose public modules
read like Effect modules while staying small enough for coding agents and humans
to navigate by file path.

## Canonical Public Surface

Reusable schema concepts publish flat concept subpaths:

```ts
import * as Duration from "@beep/schema/Duration"
import * as Glob from "@beep/schema/Glob"

Duration.Input
Duration.FromInput
Glob.Schema
```

The package root remains a curated flat facade:

```text
import { DurationInput, Glob, TaggedErrorClass } from "@beep/schema"
```

Root flat exports are convenience and compatibility. They are not the canonical
home for full concept namespaces.

## Concept Folder Topology

Leaf concept modules live under `src/<Concept>/`:

```txt
src/Duration/
  Duration.schema.ts
  Duration.input.ts
  Duration.transforms.ts
  index.ts
```

Role files are source topology, not public import paths. Public consumers import
the concept index only:

```ts
import * as Duration from "@beep/schema/Duration"
```

Do not make public consumers import role files such as
`@beep/schema/Duration/Input`.

Former topical suites are represented by PascalCase leaf concept modules and
flat exact public subpaths:

```jsonc
"./Color": "./src/Color/index.ts",
"./Csv": "./src/Csv/index.ts",
"./HttpStatus": "./src/HttpStatus/index.ts"
```

Do not create or restore lowercase topical source directories such as
`src/color/`, `src/http/`, `src/csv/`, or `src/person/`. Do not publish
lowercase topical subpaths such as `@beep/schema/color` or nested legacy topical
paths such as `@beep/schema/http/headers`.

Do not publish broad suite aggregators such as `@beep/schema/Blockchain`,
`@beep/schema/Dom`, `@beep/schema/Http`, `@beep/schema/Location`, or
`@beep/schema/Person`. Consumers import leaf concept modules directly, for
example `@beep/schema/EvmAddress`, `@beep/schema/DomReactNode`, and
`@beep/schema/HttpStatus`.

`Csv` is a same-concept schema module. CSV parser, formatter, option, and error
helpers live in sibling leaf modules such as `@beep/schema/CsvParser` and are
not re-exported from `@beep/schema/Csv`.

Do not create a module for every exported symbol. Promote source concepts:
schemas, schema suites, codecs, parser/formatter helpers, and typed errors.
For example, `HttpStatus` is one concept module; individual status literals do
not each get public subpaths.

## Role Suffix Catalog

Core role suffixes:

- `.schema.ts` - primary schema values, brands, and direct schema aliases
- `.input.ts` - boundary input schemas and input models
- `.transforms.ts` - transformation schemas and codecs
- `.constructors.ts` - construction helpers that are part of the schema concept
- `.guards.ts` - derived guards and predicates
- `.errors.ts` - typed schema/local errors
- `.types.ts` - type-level helpers with no runtime owner

Earned semantic roles are allowed when they are clearer than forcing the core
set. Examples include parser, formatter, SQL projection, or color-conversion
roles.

## Naming Grammar

Inside a concept namespace, concise role names are canonical:

```ts
Duration.Schema
Duration.Input
Duration.FromInput
Duration.Object
Duration.Unit
```

Legacy full names may remain as aliases while consumers migrate:

```ts
Duration.DurationInput
Duration.DurationFromInput
```

Simple primary schemas use `Schema` as the canonical role name and may retain a
same-name alias:

```ts
Glob.Schema
Glob.Glob
```

## Closed Compatibility Policy

The migration is closed around the canonical topology:

- Keep the root flat facade for current consumers.
- Keep purposeful repeated names inside canonical modules when they aid
  migration, for example `Duration.DurationInput` beside `Duration.Input`.
- Retire lowercase topical source directories and public subpaths.
- Retire broad suite aggregator public subpaths.
- Retire legacy acronym casing subpaths such as `@beep/schema/ExpectCT` and
  `@beep/schema/XSSProtection`; use `ExpectCt` and `XssProtection`.
- Keep concept role files private and publish only concept indexes.
- Keep parser internals private; source tests use `@beep/schema/test/Markdown`
  and `@beep/schema/test/Yaml` instead of `@beep/schema/internal/*`.
- Keep the broad package wildcard removed.

## Acceptance Criteria

- `@beep/schema/<Concept>` resolves to a concept index for migrated concepts.
- New examples use namespace-first concept imports.
- Existing root imports continue to compile.
- Tests and dtslint cover canonical imports and root compatibility.
- `bun run beep lint schema-topology` passes.
- `standards/ARCHITECTURE.md`, the architecture rationale packet, and this
  package's README agree on the topology.
