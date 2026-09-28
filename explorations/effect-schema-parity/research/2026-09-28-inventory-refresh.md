# Inventory refresh: `51d4a2f08a` → `e5f7d12af9` (2026-09-28)

Lane A of the 2026-09-28 reopen. The `schema-inventory/v1` snapshot moved from
the hard-coded `51d4a2f08a` pin to the repo's own catalog commit (D4). The
generator and verifier were repaired together so neither reads the reference
working tree again.

| Pin | Value |
| --- | --- |
| `inventoryPin` | `e5f7d12af9abef188f7dc39b0207af1801b03ffd`, the sha after `effect@` in the root `package.json` catalog entry for `effect` |
| describe | `effect@4.0.0-rc.118-1-ge5f7d12af9` |
| `git -C .repos/effect cat-file -t <pin>` | `commit` |
| previous pin | `51d4a2f08a5c7691dc876415bc9fc0ecf467e153` (`effect@4.0.0-rc.115-3-g51d4a2f08a`) |
| `referenceHead` (2026-09-28) | `e5f7d12af9abef188f7dc39b0207af1801b03ffd`, equal to the pin |
| TypeScript parser | `6.0.3`, stamped on `inventory/INDEX.md:3` beside the full pin |

Every `file:line` below was read at the named pin with
`git -C .repos/effect show <pin>:<path>`. Old-snapshot rows came from
`git show HEAD:explorations/effect-schema-parity/research/inventory/<file>`
before the old files were deleted.

## Totals

| | Rows | Modules | JSONL bytes |
| --- | ---: | ---: | ---: |
| `51d4a2f08a` snapshot | 2,105 | 14 | 853,360 |
| `e5f7d12af9` snapshot | 2,232 | 24 | 998,009 |

Of the 144,649-byte growth, 66,960 bytes come from widening every row's `sha`
from 10 to 40 characters (30 bytes × 2,232 rows, D4), not from new rows. With a
10-character `sha` the same rows total 931,049 bytes.

Reconciliation, by identity `(module, symbol, kind)` after mapping old module
paths to their new homes (`effect/unstable/schema/*` → `effect/schema/*`,
`effect/unstable/arbitrary/Arbitrary` → `effect/Arbitrary`):

| Bucket | Rows |
| --- | ---: |
| Surviving identities | 1,984 |
| Removed | 121 |
| Added | 248 |
| Check | 1,984 + 121 = 2,105; 1,984 + 248 = 2,232 |

Removed rows split into upstream API changes (21 rows: six Schema filters, six
revivers, seven SchemaGetter rows, two SchemaTransformation rows) and the barrel
dedupe (100 rows: 72 expanded `Model.*`/`VariantSchema.*` rows under the old
`effect/unstable/schema` barrel plus the 28-row `effect/unstable/arbitrary`
barrel). Added rows split into upstream additions to already-inventoried
modules (137) and modules newly in scope (111).

Surviving rows mostly moved: 1,598 of 1,984 changed `line`. Content drift on
surviving rows is small:

| Field | Rows | Rows affected |
| --- | ---: | --- |
| `signature` | 8 | `SchemaAST` `Arrays.getParser`, `Objects.getParser`, `Union.getParser` (param `compileConstructorDefault` → `compileField`); `SchemaAST` `Context` and `Context.constructorDefault` (`Link \| undefined` → `Effect.Effect<unknown, SchemaIssue.Issue> \| undefined`); `SchemaRepresentation` `ToJsonSchema.Check` (returns the new `CheckOutput`); `SchemaTransformation` `Transformation` and `Middleware` (now `extends Pipeable.Pipeable`) |
| `summary` | 1 | `SchemaRepresentation` `ToJsonSchema` namespace |
| `hasExample` | 1 | `Schema.toJsonSchemaDocument` gained an example |

## Per-module counts

| Module | Old rows | New rows | Added | Removed | Note |
| --- | ---: | ---: | ---: | ---: | --- |
| `effect/Schema` | 1,026 | 1,109 | 89 | 6 | renames + Ip/Mac families + code points |
| `effect/SchemaAST` | 310 | 315 | 5 | 0 | parse/step helpers |
| `effect/SchemaParser` | 37 | 37 | 0 | 0 | |
| `effect/SchemaIssue` | 65 | 65 | 0 | 0 | |
| `effect/SchemaGetter` | 57 | 72 | 22 | 7 | `Getter` became a union type |
| `effect/SchemaTransformation` | 61 | 62 | 3 | 2 | `make` → `makeTransformation` |
| `effect/SchemaRepresentation` | 219 | 223 | 10 | 6 | reviver renames + code points |
| `effect/Arbitrary` | 69 | 77 | 8 | 0 | old `effect/unstable/arbitrary/Arbitrary` |
| `effect/JsonSchema` | 27 | 27 | 0 | 0 | |
| `effect/Equivalence` | — | 20 | 20 | — | newly in scope (existed at old pin) |
| `effect/StandardSchema` | 30 | 30 | 0 | 0 | |
| `effect/ChannelSchema` | — | 8 | 8 | — | newly in scope (existed at old pin) |
| `effect/schema` | 74 | 5 | 3 | 72 | old `effect/unstable/schema` barrel; dedupe |
| `effect/schema/Model` | 55 | 55 | 0 | 0 | path move only |
| `effect/schema/VariantSchema` | 47 | 47 | 0 | 0 | path move only |
| `effect/schema/SchemaCompiler` | — | 19 | 19 | — | new upstream (#7908) |
| `effect/schema/SchemaCompiler/runtime` | — | 1 | 1 | — | new upstream |
| `effect/schema/SchemaJITCompiler` | — | 2 | 2 | — | new upstream |
| `effect/schema/SchemaJITCompiler/enable` | — | 0 | 0 | — | side-effect-only subpath, empty file |
| `effect/schema/SchemaAOTCompiler` | — | 5 | 5 | — | new upstream |
| `effect/schema/SchemaAOTCompiler/Build` | — | 14 | 14 | — | new upstream |
| `effect/internal/schema/codegen` | — | 11 | 11 | — | provenance only, `importable:false` |
| `effect/internal/schema/compilerRegistry` | — | 25 | 25 | — | provenance only, `importable:false` |
| `effect/internal/schema/interpreter` | — | 3 | 3 | — | provenance only, `importable:false` |
| `effect/unstable/arbitrary` (retired) | 28 | — | — | 28 | barrel deleted upstream (#8382) |

The `effect/schema` barrel now carries five `namespace` rows. Two survive from
the old barrel (`Model`, `VariantSchema`) and three are new
(`SchemaAOTCompiler`, `SchemaCompiler`, `SchemaJITCompiler`).

## Renames

Upstream `4e4fa8b184` (#8378, "Rename Schema checks for grammatical
consistency") renamed six filters. Each has a same-named reviver twin in
`SchemaRepresentation.ts`. All are `export function` in `Schema.ts`, so an
`export const is…` grep finds none of them.

| Old name | Old `Schema.ts` line | New name | New `Schema.ts` line | Old reviver line | New reviver line |
| --- | ---: | --- | ---: | ---: | ---: |
| `isStartsWith` | 6867 | `isStartingWith` | 6933 | 867 | 919 |
| `isEndsWith` | 6898 | `isEndingWith` | 6966 | 887 | 939 |
| `isIncludes` | 6930 | `isIncluding` | 7000 | 907 | 959 |
| `isLengthBetween` | 8150 | `isBetweenLength` | 8247 | 1203 | 1255 |
| `isSizeBetween` | 8272 | `isBetweenSize` | 8523 | 1264 | 1362 |
| `isPropertiesLengthBetween` | 8398 | `isBetweenProperties` | 8655 | 1325 | 1423 |

Reviver names follow the filter: `isStartsWithReviver` → `isStartingWithReviver`
and so on.

`SchemaTransformation`:

- `make` (`SchemaTransformation.ts:279` at the old pin) became `makeTransformation` (`:327` at the pin).
- The `Transformation.compose` method (old `:178`) became the free function `composeTransformation` (`:245`), which is a new export.

`SchemaGetter`:

- Removed `onNone` (old `:402`) and `onSome` (old `:475`).
- `Getter` changed from an interface plus a class-like const (old `:65`, `:80`) to a union type (`:128`). Its `compose`, `map` and `run` members became the free functions `run` (`:181`), `compose` (`:234`) and `map` (`:314`).
- The union members are new interfaces: `Passthrough` (`:37`), `Transform` (`:47`), `TransformOptional` (`:58`), `TransformEffect` (`:69`) and `TransformOptionalEffect` (`:83`). The constructor `transformOptionalEffect` (`:788`) is also new.

In row terms, SchemaGetter loses seven identities (`Getter:const`,
`Getter:interface`, `Getter.compose`, `Getter.map`, `Getter.run`, `onNone`,
`onSome`) and gains 22.

## Pure additions (not renames)

| Module | Addition | Pin line |
| --- | --- | --- |
| `Schema` | `isMinCodePoints`, `isMaxCodePoints`, `isBetweenCodePoints` (#8364) | `:8307`, `:8345`, `:8383` |
| `SchemaRepresentation` | `isMinCodePointsReviver`, `isMaxCodePointsReviver`, `isBetweenCodePointsReviver` | `:1271`, `:1286`, `:1301` |
| `SchemaRepresentation` | `ToJsonSchema.CheckOutput` type (#8482) | `:98` |
| `Schema` | 13 `Ip*`/`Mac*` address schemas, each with a `…FromString` twin: 26 schemas, each a const, an interface and a quoted `"Rebuild"` member, so 78 rows (#8323) | `:12159` (`IpLinkLocalAddress`) to `:12463` (`MacUniversallyAdministeredAddressFromString`) |
| `Schema` | `StringForLiteralAutocomplete` const + interface (#8366) | `:2998`, `:3042` |
| `SchemaAST` | `stepArray`, `parseArray`, `stepProperty`, `parseProperties`, `parameterFromPropertyKey` | `:2440`, `:2478`, `:3135`, `:3177`, `:4765` |
| `Arbitrary` | `ArrayOptions`, `GlobalOptions`, `configureGlobal`, `array` (#8221, #8367) | `:90`, `:211`, `:233`, `:490` |

The 13 bases are `IpLinkLocal`, `IpLoopback`, `IpMulticast`, `IpUnicast`,
`IpUnspecified`, `Ipv4Broadcast`, `Ipv4Private`, `Ipv6UniqueLocal`,
`MacBroadcast`, `MacLocallyAdministered`, `MacMulticast`, `MacUnicast` and
`MacUniversallyAdministered`, each suffixed `Address`.

Arithmetic check for the 89 Schema additions: 6 renamed filters + 3 code-point
filters + 2 `StringForLiteralAutocomplete` rows + 78 address rows = 89.

## `Schema.ts` export count

Counted with the same grep at both pins, on the bytes from `git show`:

```sh
git -C .repos/effect show <pin>:packages/effect/src/Schema.ts \
  | grep -oE '^export (declare )?(const|function|class|interface|type|namespace|abstract class) [A-Za-z_$][A-Za-z0-9_$]*' \
  | sort -u | wc -l
```

| Measure | `51d4a2f08a` | `e5f7d12af9` |
| --- | ---: | ---: |
| Unique `(declaration kind, name)` pairs (the command above) | 541 | 598 |
| Top-level export declaration lines (`grep -c`, no `sort -u`) | 549 | 606 |
| Distinct names (kind dropped) | 362 | 392 |
| Inventory rows for `effect/Schema` (adds members and export-list aliases) | 1,026 | 1,109 |

The grounding report's "541 → 598" is the first measure.

## Role A / Role B remap (CAPTURE.md paths at the pin)

`CAPTURE.md` lists 55 paths: 16 Role A (14 `.ts`, plus `packages/effect/SCHEMA.md`
and `migration/schema.md`) and 39 Role B. Every one resolved at the pin with
`git -C .repos/effect cat-file -e e5f7d12af9abef188f7dc39b0207af1801b03ffd:<new path>`.
`migration/schema.md` is relative to the effect repo root. Rule: drop
`unstable/` from the path.

| Old path (under `packages/effect/`) | Role | New path | How |
| --- | --- | --- | --- |
| `src/{Schema,SchemaAST,SchemaGetter,SchemaParser,SchemaIssue,SchemaRepresentation,SchemaTransformation,StandardSchema,JsonSchema}.ts` | A (9) | unchanged | exists |
| `SCHEMA.md`; `migration/schema.md` (effect repo root) | A (2) | unchanged | exists |
| `src/unstable/schema/index.ts` | A | `src/schema/index.ts` | rule; `1b4461ec3a` (#8354) `R085` |
| `src/unstable/schema/VariantSchema.ts` | A | `src/schema/VariantSchema.ts` | rule; #8354 `R095` |
| `src/unstable/schema/Model.ts` | A | `src/schema/Model.ts` | rule; #8354 `R094` |
| `src/unstable/arbitrary/index.ts` | A | deleted; folded into `src/Arbitrary.ts` | exception: #8354 `R085` to `src/arbitrary/index.ts`, then `061b9611d4` (#8382) `D` |
| `src/unstable/arbitrary/Arbitrary.ts` | A | `src/Arbitrary.ts` | exception: #8354 `R095` to `src/arbitrary/Arbitrary.ts`, then #8382 `R097` to root |
| `src/unstable/ai/{McpSchema,AnthropicStructuredOutput,Prompt,Tool,Toolkit,Response}.ts` | B (6) | `src/ai/…` | rule |
| `src/unstable/devtools/DevToolsSchema.ts` | B | `src/devtools/DevToolsSchema.ts` | rule |
| `src/unstable/encoding/{Yaml,Toml,SchemaBinary,Ini,Ndjson}.ts` | B (5) | `src/encoding/…` | rule |
| `src/unstable/http/{Mime,HttpStatus,HttpIncomingMessage,HttpClientError,HttpServerRespondable,HttpBody,HttpTraceContext,Multipart,HttpServerRequest,HttpClientRequest,HttpStaticServer,HttpMethod,MultipartParser,HttpServerError,Headers,HttpServerResponse,HttpClientResponse,Template,Url,UrlParams}.ts` | B (20) | `src/http/…` | rule |
| `src/unstable/httpapi/HttpApiSchema.ts` | B | `src/http-api/HttpApiSchema.ts` | exception: #8354 `R095` to `src/httpapi/`, then `62b2ea97fe` (#8365) `R097` to `src/http-api/` |
| `src/unstable/net/{NetAddress,IpInterface,IpNetwork}.ts` | B (3) | `src/net/…` | rule |
| `src/unstable/observability/OtlpSerialization.ts` | B | `src/observability/OtlpSerialization.ts` | rule |
| `src/unstable/rpc/RpcSchema.ts` | B | `src/rpc/RpcSchema.ts` | rule |
| `src/unstable/sql/SqlSchema.ts` | B | `src/sql/SqlSchema.ts` | rule |

Tally: 55 of 55 resolve (15 Role A `OK` via `cat-file`, `migration/schema.md`
also `OK` in the effect repo, 39 Role B `OK`). `git ls-tree <pin>
packages/effect/src/unstable` prints nothing. Neither
`src/unstable/arbitrary/index.ts` nor `src/arbitrary/index.ts` exists at the pin.

## Upstream commits `51d4a2f08a..e5f7d12af9`

Pathspec, quoted for zsh:

```sh
git -C .repos/effect log --format='%h %ad %s' --date=short 51d4a2f08a..e5f7d12af9 -- \
  'packages/effect/src/Schema*.ts' packages/effect/src/schema packages/effect/src/internal/schema \
  packages/effect/src/unstable/schema packages/effect/SCHEMA.md
```

This gives 27 commits. Dropping `packages/effect/SCHEMA.md` gives 26, because
`b5404c92eb` touches only `SCHEMA.md` among these paths. Dropping
`packages/effect/src/unstable/schema` as well still gives 26.

| Commit | Date | Subject |
| --- | --- | --- |
| `64093976e9` | 2026-09-26 | Optimize schema construction (#8536) |
| `16623c7d30` | 2026-09-25 | Fix JSON Schema export of built-in checks (#8482) |
| `18bb92a005` | 2026-09-24 | docs: clarify JSON Schema decoding with the canonical codec (#8492) |
| `c2e810cc7a` | 2026-09-24 | Compile a recursive Schema equivalence once instead of once per value level (#8429) |
| `8d27554650` | 2026-09-24 | Stop Schema compilation re-analysing every sub-schema for each enclosing schema (#8451) |
| `2575fcc12b` | 2026-09-24 | Stop rebuilding the parser wrappers on every SchemaParser.asserts call (#8440) |
| `2cf4e43f02` | 2026-09-24 | Add Schema.StringForLiteralAutocomplete (#8366) |
| `5521209a76` | 2026-09-24 | Stop compiled Schema structs retaining an unused parse traversal (#8435) |
| `b808b5d0c0` | 2026-09-24 | Stop Schema array and tuple decoding running a generator it never needs (#8441) |
| `b442528ddf` | 2026-09-24 | Stop a recursive Schema formatter holding one compiled body per level (#8436) |
| `3036241e1e` | 2026-09-24 | Stop Schema unions rebuilding their candidate list on every decode (#8428) |
| `0860c0c125` | 2026-09-24 | Stop Schema code generation re-proving emittability for every property (#8430) |
| `477394deb6` | 2026-09-23 | Stop Schema allocating on every rest-tuple equivalence or formatter call (#8434) |
| `34e09becb6` | 2026-09-23 | Fix Unicode semantics in JSON Schema imports (#8459) |
| `35ecbb9864` | 2026-09-23 | Fix onExcessProperty "error" rejecting non-enumerable own properties (#8423) |
| `32baabcf80` | 2026-09-23 | Migrate unstable JSDoc tags to stability annotations (#8406) |
| `4e4fa8b184` | 2026-09-22 | Rename Schema checks for grammatical consistency (#8378) |
| `287273cf55` | 2026-09-22 | Add Schema code point length checks, closes #8178 (#8364) |
| `d426feb658` | 2026-09-22 | Split encoding formats into dedicated modules (#8356) |
| `1b4461ec3a` | 2026-09-22 | Move unstable Effect modules to top-level paths (#8354) |
| `1b21e0df6a` | 2026-09-20 | Add branded NetAddress classifications (#8323) |
| `4d4c4e8a44` | 2026-09-18 | Fix Schema.Redacted inner transformations, closes #8295 (#8298) |
| `0beded04f5` | 2026-09-18 | Improve BigInt and BigDecimal arbitrary generation (#8296) |
| `b5404c92eb` | 2026-09-18 | docs: consolidate Schema migration guidance (#8294) |
| `c19c63fb71` | 2026-09-18 | Optimize Effect Schema and add experimental JIT and AOT compilers (#7908) |
| `9ad9891e24` | 2026-09-17 | Expose HttpApi.ParseOptions for schema decoding and encoding (#8269) |
| `755e863a79` | 2026-09-12 | Restrict ByteSize string inputs to canonical integer quantities (#8212) |

Commits that touch the other inventoried root modules (`Arbitrary.ts`, the old
`unstable/arbitrary`, `JsonSchema.ts`, `StandardSchema.ts`, `Equivalence.ts`,
`ChannelSchema.ts`) but not the pathspec above: `061b9611d4` (#8382, Arbitrary
to root), `f75468a135` (#8367, Arbitrary global defaults) and `8f420bb3dc`
(#8221, `Arbitrary.array`).

## `referenceHead` lookahead

None at 2026-09-28. `git -C .repos/effect rev-parse HEAD` is
`e5f7d12af9abef188f7dc39b0207af1801b03ffd`, equal to `inventoryPin`.
`git rev-list --count e5f7d12af9..HEAD` is 0, and the lookahead log over
`'packages/effect/src/Schema*.ts' packages/effect/src/schema packages/effect/src/internal/schema`
is empty. The inventory never pins to `referenceHead` (D4).

## Tool changes

| File | Change |
| --- | --- |
| `research/tools/modules.ts` (new) | Owns the 24-file module list, the `importable` flag per file, `moduleOf`/`slugOf`, `readInventoryPin` (catalog parse plus `cat-file -e <pin>^{commit}`), and `showPinned` (`git show <pin>:<file>`). Both tools import it. |
| `research/tools/schema-inventory.ts` | Deleted the hard-coded `pinnedSha`, the HEAD-equals-pin assert and the working-tree byte assert. Reads the pin from the catalog and every source through `git show`. Drops the CAPTURE regex and the `files.length !== 14` guard in favor of a uniqueness check on `modules.ts`. Drops the TypeScript fallback into the reference clone. Barrels emit one `namespace` row per `export * as` and throw when the target is missing from `modules.ts`. Rows gain `importable`. INDEX gains an Importable column and records the pin source. |
| `research/tools/verify-schema-inventory.ts` | Same pin and read path. Line bounds come from `git show` bytes. It checks `importable` per row and per INDEX line against `modules.ts`, accepts an empty JSONL for a zero-export module, and treats `rg` exit 1 as a zero count. |
| `research/inventory/effect-unstable-*.jsonl` (5 files) | Deleted with `git rm`. |
| `research/inventory/*.jsonl`, `INDEX.md` | Regenerated: 24 JSONL files, 15 of them new names. |
| `research/inventory/README.md` | Rewritten by hand for the new pin, inputs, barrel rule and `importable` field. |

The row contract gains one boolean field, `importable`. Row `sha` widened from
`inventoryPin.slice(0, 10)` to the full 40-character pin, which also appears on
`INDEX.md:3` (D4). The widening accounts for 66,960 of the JSONL bytes.

Verifier tail, identical on two consecutive runs, exit 0:

```text
PASS: inventoryPin e5f7d12af9abef188f7dc39b0207af1801b03ffd read from root package.json catalog; sources read via git show <pin>:<file>
PASS: 24 modules; 2232 rows; Schema.ts 1109 rows; JSONL 998009 bytes; INDEX and ripgrep counts agree
PASS: (module, symbol, kind) identities unique; all fields/types, preview bounds and defining-file line bounds valid
PASS: regenerated JSONL and INDEX.md byte-identical from research cwd; temporary directory deleted
```

## Frontier answer: can the planned lint avoid the reference working tree?

Yes, and the prototype now does it. Both tools read `inventoryPin` from the
root `package.json` catalog. Both read every source byte through
`git -C .repos/effect show <inventoryPin>:<file>`. Neither calls
`rev-parse HEAD` or reads a file under `.repos/effect/` directly. A nightly
`pull --ff-only` that moves `referenceHead` past the pin therefore leaves
regeneration byte-identical. Only one precondition remains: the pin commit must
exist in the reference object store. The tools check it with
`cat-file -e <pin>^{commit}` and fail with a "nightly pull has not reached it"
message instead of reading stale bytes.

The planned `effect-schema-inventory` lint can take `modules.ts` semantics
unchanged. A hosted run without `.repos/effect` would still need committed
fixture rows, as the README's fixture section recommends.
