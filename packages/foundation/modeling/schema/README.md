# @beep/schema

Reusable Effect Schema substrate for the repo.

`@beep/schema` is a `foundation/modeling` package. It owns domain-agnostic
schemas, codecs, schema combinators, typed schema errors, and schema-adjacent
modeling helpers that slices, shared-kernel packages, drivers, and tooling may
reuse without taking product-domain dependencies.

## Upstream First

Upstream Effect comes first. Before adding a schema, codec, or helper here,
check the public API in the installed `effect` declarations, and do not add a
concept upstream already covers. Where upstream covers a `foundation/modeling`
concept's intent, its covered facets retire in the same PR that migrates their
consumers, with no alias; the whole concept retires unless the lines reading
its uncovered members outnumber the lines using its covered facets (ADAPT, per
the facet census). Retirement leaves no shim or compat module. LiteralKit is
ADAPT: it keeps `Enum`, `is`, `$match`, `toTaggedUnion` and `LiteralToKey`.
Persisted and served encodings stay byte-identical.

Decision: `standards/architecture/DECISIONS.md`, "Upstream-First
Foundation/Modeling". Operational rules:
`standards/architecture/11-evolution-and-deprecation.md`, "Upstream-first
retirement in `foundation/modeling`".

## Topology

Canonical schema concept imports are namespace-first:

```ts
import * as Color from "@beep/schema/Color"
import * as Glob from "@beep/schema/Glob"

Color.HexColor
Color.HexToRgb
Glob.Schema
```

The package root remains a curated flat facade:

```ts
import { Glob, HexColor } from "@beep/schema"
```

Root flat exports are convenience and compatibility, not the canonical home for
full concept namespaces.

Leaf concept modules use small role files:

```txt
src/Color/
  Color.adjust.ts
  Color.hex.ts
  Color.oklch.ts
  Color.rgb.ts
  Color.scale.ts
  Color.shared.ts
  Color.transforms.ts
  Color.ts
  index.ts
```

Only `@beep/schema/<Concept>` is public for concept modules. Role files are
source topology. Utility namespaces such as `SchemaUtils` may expose helper
leaves when direct helper imports are the intended API.

Public package subpaths are explicit. `SchemaUtils` helper leaves such as
`@beep/schema/SchemaUtils/collectAnnotationsAt` remain intentional public imports, but concept
role files such as `@beep/schema/Color/Color.hex` are private source
topology.

Former topical families are represented by PascalCase leaf concept modules and
canonical public subpaths:

```ts
import * as Color from "@beep/schema/Color"
import * as Csv from "@beep/schema/Csv"
import * as HttpHeaders from "@beep/schema/HttpHeaders"
```

Do not create broad suite aggregators such as `@beep/schema/Blockchain`,
`@beep/schema/Dom`, `@beep/schema/Http`, `@beep/schema/Location`, or
`@beep/schema/Person`. Lowercase topical source and public paths such as
`src/color/`, `src/http/`, `@beep/schema/color`, and
`@beep/schema/http/headers` are retired.

`Csv` is a same-concept schema module; parser, formatter, option, and error
helpers live in their own leaf modules such as `@beep/schema/CsvParser` and are
not re-exported from `@beep/schema/Csv`.

Package-local tests may use source-only test seams such as
`@beep/schema/test/Markdown`. Parser internals
under `src/internal/` are not public package subpaths, and the test seam
implementations live under `src/internal/test`.

Topology is enforced by:

```bash
bun run beep lint schema-topology
```

See `goals/beep-schema-topology` and `standards/ARCHITECTURE.md` for the
canonical migration plan and doctrine.

## Installation

```bash
bun add @beep/schema
```

## Usage

```ts
import * as Color from "@beep/schema/Color"
import * as S from "effect/Schema"

const decodeHexColor = S.decodeUnknownEffect(Color.HexColor)
console.log(decodeHexColor)
```

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Lint
bun run lint:fix
```

## License

MIT
