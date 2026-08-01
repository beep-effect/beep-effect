# @beep/pandoc-ast

Schema-first Pandoc JSON AST mirror, strict and lossless wire codecs, and
compatibility adapters for `@beep/md`.

## Scope

`@beep/pandoc-ast` is a pure modeling package. It does not shell out to
`pandoc`, manage DOCX files, or make document-AST product decisions. It mirrors
enough Pandoc JSON to evaluate `@beep/md` round-trip compatibility and report
common DOCX-origin gaps, including custom style wrappers, notes, math, tables,
raw Markdown/HTML, and task-list state.

The package exposes two intentionally different decode profiles:

- `decodePandocJsonStrict` and `decodePandocJsonStringStrict` require every
  recognized constructor to belong to the semantic subset and have a valid
  payload. A future constructor name is represented by `UnknownBlock`,
  `UnknownInline`, or `UnknownMeta`; malformed supported constructors and
  pinned current constructors outside the semantic subset fail with the typed
  `PandocDecodeError`.
- `decodePandocJsonLossless` and `decodePandocJsonStringLossless` retain the
  complete JSON tree exactly. Known malformed or currently unsupported
  constructors remain unchanged in that raw tree and produce structured issues
  at the nearest constructor path; no synthetic semantic node replaces them.
  The lossless encoders re-emit the retained wire exactly, including future
  top-level fields.

The known-name registry is pinned to the exhaustive constructors in
[`pandoc-types` 1.23.1](https://github.com/jgm/pandoc-types/blob/1.23.1/src/Text/Pandoc/Definition.hs),
matching `DEFAULT_PANDOC_API_VERSION`. It is deliberately broader than this
package's semantic model and includes envelope, citation, table-structure, and
newtype constructor names even when upstream serializes them without a `t`
field. Reserving those names globally prevents malformed values such as
`{ "t": "Row" }` from masquerading as future extensions inside opaque table
slots. `Cite`, `Figure`, and `Row` therefore fail strict decoding until modeled,
while lossless decoding reports them and preserves their exact wire. Only names
absent from the pinned registry become `Unknown*` nodes.

The historical tagged `TableCaption` alias is reserved but unsupported. Pandoc
1.23.1 encodes `Caption`, `TableHead`, and `TableFoot` structurally as
`[Maybe [Inline], [Block]]` and `[Attr, [Row]]`; the strict profile rejects the
tagged alias and malformed shorthand arrays while the lossless profile retains
and reports them.

The shorter `decodePandocJson` and `decodePandocJsonString` names remain aliases
of their strict counterparts.

The matching semantic encoders, `encodePandocJson` and
`encodePandocJsonString`, accept a typed `PandocDocument` and emit its canonical
supported wire form. They do not claim exact retention of unknown top-level
fields; use `encodePandocJsonLossless` or `encodePandocJsonStringLossless` on a
lossless decode when exact wire identity is required.

`pandocToDocument` and `documentToPandoc` return their compatibility reports in
the success channel and expose the typed `PandocMappingError` when a schema
projection cannot be completed.

## Usage

```ts
import * as Effect from "effect/Effect"
import { decodePandocJsonStringStrict, pandocToDocument } from "@beep/pandoc-ast"

const result = Effect.runSync(
  decodePandocJsonStringStrict(`{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[]}`).pipe(
    Effect.flatMap(pandocToDocument)
  )
)

console.log(result.report.profile)
```

Use the lossless profile when accepting content produced by a newer Pandoc
version or when exact re-emission matters:

```ts
import * as Effect from "effect/Effect"
import {
  decodePandocJsonStringLossless,
  encodePandocJsonStringLossless,
} from "@beep/pandoc-ast"

const input =
  `{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[{"t":"FutureBlock","c":{"v":1}}],"future":true}`

const document = Effect.runSync(decodePandocJsonStringLossless(input))
const output = Effect.runSync(encodePandocJsonStringLossless(document))

console.log(document.wire.future) // true
console.log(output.includes('"future":true')) // true
```

## Model invariants

- Metadata is recursive and schema-backed: `MetaBool`, `MetaString`,
  `MetaInlines`, `MetaBlocks`, `MetaList`, `MetaMap`, and `UnknownMeta`.
- `UnknownBlock`, `UnknownInline`, and `UnknownMeta` contain only genuine future
  constructor names outside the pinned Pandoc 1.23.1 registry.
- A `Table` stores one validated six-field `PandocTablePayload`. Its `attr` and
  best-effort `caption` are derived views, so encoded tables cannot contain
  competing copies of the same information.
- Compatibility issue pointers and report profiles are derived from their
  canonical path and issue collections.
- `PandocAttr`, `PandocTarget`, and `PandocDocument` provide safe constructor
  defaults. `DEFAULT_PANDOC_API_VERSION` is available when an explicit Pandoc
  API-version tuple is needed.

## Fixtures

Committed fixtures live in `test/fixtures/`.

- `green-core.pandoc.json` covers the Markdown-origin md-core profile and should
  map with `report.profile === "supported"`.
- `gap-docx-styles.pandoc.json` captures the first DOCX-origin gap constructs
  without requiring a local `pandoc` executable in normal tests.

Later driver and fixture-pipeline goals should replace or augment these with
generated fixtures that record exact command provenance.

## Development

```bash
bun run build
bun run check
bun run test
bun run type-test
bun run test:integration
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/pandoc-ast` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
