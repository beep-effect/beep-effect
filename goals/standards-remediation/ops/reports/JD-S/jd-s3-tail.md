# JD-S3 — `@beep/schema` Graph + long-tail shard

Wave: `JD-S`, lane: `jd-s3-tail`. File fence: everything in `src/` except the
sibling-owned directories `src/HttpStatus/`, `src/PermissionsPolicy/`,
`src/FrameGuard/`, `src/NoSniff/`, `src/ReferrerPolicy/`, `src/XssProtection/`,
`src/CrossOriginOpenerPolicy/`, `src/CrossOriginEmbedderPolicy/`,
`src/CrossOriginResourcePolicy/`, `src/ExpectCt/`, `src/ForceHttpsRedirect/`,
`src/PermittedCrossDomainPolicies/`, `src/StrictTransportSecurity/`, `src/Csp/`,
`src/Color/`, `src/FilePath/`, `src/Model/`, `src/EntitySchema/`. No commits
made; `standards/*.jsonc` and `ops/progress.json` were never opened for
writing — the inventory was read once via a one-time Python `json.load`,
filtered to this shard's files by excluding the sibling-owned prefixes above.

## Findings: 150 open → 0 open (51 files)

Before (from `standards/jsdoc-documentation.inventory.jsonc`, filtered to
non-excluded `src/` files with a non-empty finding): 150 findings across 51
files. After (self-verified by re-deriving the same repoPath:line:symbolName
coordinates against current file content, plus a full `turbo run docgen`
pass — see Verify section): 0.

## Recipe reused from JD-1 / JD-S1, applied at scale

Most of the 150 findings were the familiar `missingExportExamples` shape on
bare `export type X = typeof X.Type;` aliases (own name or `{@inheritDoc}`
companions) — fixed by adding a compiling example that decodes/constructs a
value and type-annotates the result as `X` (schema-backed) or shows named
function-signature/`satisfies` evidence for pure type-level exports
(`RawEdgeEncoded`, `EdgeIso`, `GraphIso`, `EdgeEncodedSchema`,
`GraphEncodedSchema`, the four `Graph.transforms.ts` interfaces).

## New pattern found this shard: alias-of-`LiteralKit`/`Union` schemaGap

Confirmed the JD-S1 finding generalizes beyond the header families:
`schemaAnnotationGaps: missing-schema-runtime-type-alias` fires on a
`export { LongName as ShortName }` re-export **only** when `LongName` is built
from `LiteralKit(...)` or `S.Union(...)` (never `S.declare`/`S.brand` alone) —
confirmed by contrasting `CardinalDirection`/`HttpProtocol`/`Sex`/
`Duration.input.ts`'s `Input` (all flagged) against `Age`/`DomDragEvent`-family/
`SecureHeader` (structurally identical alias pattern, never flagged). A
sibling `export type ShortName = ...` cannot be added next to the rename
(duplicate-export conflict), so each was pulled out of the barrel into its own
`export const ShortName = LongName; export type ShortName = LongName;` pair
with fresh `@example`/`@category`/`@since` — same runtime value and type,
zero behavior change. Plain own-name gaps with no matching type alias at all
(`Jsonc`/`Jsonl`/`Toml`/`Xml`/`Yaml`'s `*TextToUnknown`, `PosixPath`'s
`NativePathToPosixPath`) got the ordinary sibling-type-alias fix.

## Trap hit and self-caught: `unnecessaryTypeofType`

Two of the plain schemaGap fixes (`BufferEncoding`'s `BuffEncoding`,
`Timestamp.schema.ts`'s `ToIsoStr`) landed a **second** type alias with the
literal same `typeof X.Type` expression as a pre-existing, differently-named
alias (`BufferEncoding`, `ToIsoString`) already had. `npx tsgo -p .` caught
this immediately as `effect(unnecessaryTypeofType)` — fixed by pointing the
older alias at the new one (`export type BufferEncoding = BuffEncoding;`,
`export type ToIsoString = ToIsoStr;`) instead of repeating the `typeof`
query; both names stay exported, zero behavior change.

## Trap hit and self-caught: `Graph.shared.ts`/`Graph.rebuild.ts` are not barrel-exported

`packages/foundation/modeling/schema/src/Graph/index.ts` only re-exports
`Graph.edge.ts`, `Graph.encoded.ts`, `Graph.from-self.ts`, `Graph.guards.ts`,
`Graph.primitives.ts`, and `Graph.transforms.ts` — **not**
`Graph.shared.ts` or `Graph.rebuild.ts` (both marked `@internal`, 18 findings
combined). First-draft examples imported their symbols from
`"@beep/schema/Graph"` like every other Graph file, which failed 14 examples
with `TS2305`/`TS2724` (module has no such export) plus cascading
implicit-`any` errors. Caught via `turbo run docgen`, fixed by importing
those two files' own symbols from their relative source path
(`"../../src/Graph/Graph.shared.ts"`, `"../../src/Graph/Graph.rebuild.ts"`) —
the same convention already used by the pre-existing (untouched)
`Http.headers.shared.ts` examples — while keeping barrel imports
(`"@beep/schema/Graph"`) for the symbols that genuinely live there
(`GraphEncoded`, `NodeIndex`).

## Other findings

- `Http.headers.shared.ts`: 2 `exampleImportViolations`
  (`wrong-required-namespace-alias`) — `Option` → `O` token swap.
- `LocalDate.schema.ts`, `MappedLiteralKit.schema.ts`: 4
  `unsafeExampleViolations` (`no-type-assertions-in-examples`). The
  `LocalDateFromString` type/namespace examples used `console.log({} as
  {...})` — replaced with real `S.decodeUnknownSync`/`S.encodeSync`
  round-trips. `MappedLiteralKit`'s interface/function examples used `as
  const` on the literal-pair array — removed entirely since the factory's
  `<const M extends MappedPairs>` type parameter already infers literal types
  without a caller-side `as const` (TS 5.0 const type parameters), and
  dropped an unnecessary `type X as XType` import rename in favor of the
  merged const+interface import already carrying both meanings.
- `LiteralKit.schema.ts`: 2 findings on the un-documented 2nd overload
  signature and the implementation signature of the overloaded `LiteralKit`
  function (only the 1st overload had inherited the file's top JSDoc block) —
  each overload got its own `@example`/`@category`/`@since`.
- `Timestamp.schema.ts` `ToIsoStr` namespace: 1 `unsafeExampleViolations` —
  `type EncodedTimestamp = ToIsoStr.Encoded; console.log({} as {...})`
  replaced with a real decode-then-`S.encodeSync` round-trip.

## Verify

- `turbo run docgen --filter=@beep/schema` (full package, force, no cache):
  **succeeded** — 1243 examples found and typechecked, zero errors. Two
  intermediate runs during this session surfaced transient failures entirely
  in `src/EntitySchema/EntitySchema.{shape,persist,shared}.ts` (confirmed via
  `git status`/`git diff --stat` to have uncommitted, in-flight sibling
  changes at the time) — outside this shard's fence and gone by the final
  run once the sibling's edit settled.
- `npx tsgo -p . --noEmit` (scoped to `@beep/schema`): clean, no output,
  after the two `unnecessaryTypeofType` fixes above.
- `bunx biome check --write` on exactly the 54 touched files (via a file-list
  `xargs`, not package-wide): checked 54 files, no issues, no fixes applied.

## Files touched (54, no commits)

`src/Age/Age.schema.ts`, `src/ArrayOf.ts`, `src/BufferEncoding.ts`,
`src/CardinalDirection/CardinalDirection.schema.ts`,
`src/CryptoTxnHash/CryptoTxnHash.schema.ts`,
`src/CryptoWalletAddress/CryptoWalletAddress.schema.ts`,
`src/Csv/Csv.schema.ts`,
`src/{DomDragEvent,DomEvent,DomHtmlElement,DomMouseEvent,DomReactNode}/*.schema.ts`,
`src/Duration/Duration.input.ts`, `src/EthAmount/EthAmount.schema.ts`,
`src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts`,
`src/EvmAddress/EvmAddress.schema.ts`, `src/FileDiff.schema.ts`,
`src/Float{16,32,64}Array.ts`, `src/Fn/Fn.schema.ts`,
`src/Glob/Glob.schema.ts`,
`src/Graph/{Graph.edge,Graph.encoded,Graph.primitives,Graph.rebuild,Graph.shared,Graph.transforms}.ts`,
`src/Http/Http.headers.shared.ts`, `src/HttpMethod/HttpMethod.schema.ts`,
`src/HttpProtocol/HttpProtocol.schema.ts`, `src/Json.ts`, `src/Jsonc.ts`,
`src/Jsonl.ts`, `src/LiteralKit/LiteralKit.schema.ts`,
`src/LocalDate/LocalDate.schema.ts`, `src/Logs.ts`,
`src/MappedLiteralKit/MappedLiteralKit.schema.ts`, `src/Markdown.ts`,
`src/MutableHashMap.ts`, `src/MutableHashSet.ts`,
`src/NoOpen/NoOpen.schema.ts`,
`src/ParserOptions/{ParserOptions.schema,ParserOptions.types}.ts`,
`src/PosixPath.ts`, `src/SecureHeader/SecureHeader.schema.ts`,
`src/SecureHeaderError/SecureHeaderError.errors.ts`,
`src/Sex/Sex.schema.ts`, `src/Slug.ts`,
`src/Timestamp/Timestamp.schema.ts`, `src/Timezone.ts`, `src/Toml.ts`,
`src/Xml.ts`, `src/Yaml.ts`.
