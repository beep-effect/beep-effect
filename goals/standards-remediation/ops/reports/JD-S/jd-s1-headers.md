# JD-S1 — `@beep/schema` security-header + HTTP-status shard

Wave: `JD-S`, lane: `jd-s1-headers`. File fence: `src/HttpStatus/`,
`src/CrossOriginEmbedderPolicy/`, `src/CrossOriginOpenerPolicy/`,
`src/CrossOriginResourcePolicy/`, `src/Csp/`, `src/ExpectCt/`,
`src/ForceHttpsRedirect/`, `src/FrameGuard/`, `src/NoSniff/`,
`src/PermissionsPolicy/`, `src/PermittedCrossDomainPolicies/`,
`src/ReferrerPolicy/`, `src/XssProtection/`. No `src/StrictTransportSecurity/`
directory exists — that header is implemented under `ForceHttpsRedirect/`
(file header comment: "Schema for the `Strict-Transport-Security` header").
No commits made; `standards/*.jsonc` and `ops/progress.json` were never opened
for writing (inventory read once via a one-time Python `json.load`, filtered
to this shard's directories).

## Findings: 182 open → 0 open (26 files)

Before (from `standards/jsdoc-documentation.inventory.jsonc`, filtered to this
shard's `repoPath` prefixes, `remediationStatus: "open"`): 182 findings across
26 files (13 `HttpStatus/*.ts` + 12 header-family `*.schema.ts` + `Csp.schema.ts`).
After (self-verified by re-deriving the same repoPath:line:symbolName
coordinates against current file content — see Verify section): 0.

## Root cause found and a wrong assumption corrected mid-flight

The two dominant finding shapes turned out to share root causes across every
file in the shard, which made a single recipe applicable everywhere instead
of one recipe per file:

1. **`missingExportExamples` on bare type aliases** — every
   `export type X = typeof X.Type;` in both families had `@category`/`@since`
   but no `@example`. Fix: add a compiling type-level-evidence example
   (`const value: X = <literal>` for HttpStatus codes and LiteralKit unions;
   `S.decodeUnknownSync`/class-construction for transform and struct types).

2. **`schemaAnnotationGaps: missing-schema-runtime-type-alias` on barrel-renamed
   aliases** (`Header`, `Option`, `Value`, `Mode` exported via a trailing
   `export { LongName as ShortName }` block). Investigated with a throwaway
   `tsc --ignoreConfig` probe: a separate `export type Header = ...`
   declaration alongside `export { X as Header }` is a hard TypeScript
   conflict (`TS2484`/`TS2300`) even when split into `export type { }` — so
   the fix is **not** an additional type-alias statement layered on the
   existing rename. Cross-referencing the 12 header files' finding patterns
   (`git grep` across all `Public aliases for concise namespace roles` sites
   in the package, including files owned by other shards) showed the gap
   fires **only** on aliases of raw `S.Union`/`S.Tuple`/`S.Record`/decodeTo-
   transform consts, **never** on aliases of `LiteralKit(...)`-built consts —
   confirmed by 5 zero-open precedent files (`CsvCodecOptions`,
   `SecureHeaderOptions`, etc.) that alias only classes or `LiteralKit`
   schemas and were already clean. Fix: pull the flagged alias out of the
   barrel into its own `export const Y = LongName; export type Y = typeof
   Y.Type;` pair with fresh, real JSDoc (own `@example`, `@category`,
   `@since`) — same runtime value and type as before, zero behavior change,
   confirmed by a `tsc --ignoreConfig` scratch test before applying at scale.
   Left `LiteralKit`-based aliases (`Mode`, `Value`, and `Option` where
   `LiteralKit`-backed) as simple renames since those were never flagged.

3. **2 `exampleImportViolations` (`wrong-required-namespace-alias`)** in
   `CrossOriginOpenerPolicy.schema.ts` and `NoSniff.schema.ts`: class examples
   imported `effect/Option` as `Option` instead of the required `O` alias.
   Token-swap fix (`Option` → `O`, `Option.some`/`Option.none` → `O.some`/`O.none`).

4. **1 genuine missing type alias** (`Csp.schema.ts` `ReportURI`, a plain
   `S.Union` with no `export type ReportURI = ...` at all) — the ordinary
   JD-1-pilot recipe: add the sibling type alias with its own example.

5. **HttpStatus aggregate/namespace pairs** (`HttpStatus1XX`..`5XX`,
   `HttpStatusUnofficial`, `HttpStatus`) each had a `declare namespace X {
   export type Encoded }` block and an outer `type X = typeof X.Type` both
   missing `@example`. Fix: namespace example decodes a friendly-name string
   via `S.decodeUnknownSync` into the numeric code (confirmed the decode
   direction — From = friendly key, To = numeric code — by reading
   `MappedLiteralKit.schema.ts`'s own doc example rather than guessing);
   outer type example assigns the numeric literal directly.

Individual HTTP status code type aliases (`BadRequest`, `Ok`, `NotFound`, ...,
89 findings across 13 files) were purely mechanical: same `{@inheritDoc X}` +
missing-`@example` shape repeated ~80 times, fixed with one script keyed off
each literal's numeric status code scraped from its own `S.Literal(nnn)`
declaration.

## Trap hit and self-caught

First pass on `ExpectCTEnabled`/`ForceHttpsRedirectEnabled` tuple-type
examples wrote `const enabled: X = [true, XConfig.make({...})]` without
importing `XConfig` in that example's own fence — each `@example` is
typechecked as an **isolated file** by docgen, so imports from a sibling
example in the same doc comment don't carry over. Caught immediately via the
scoped `docgen generate --include` probe (`Cannot find name 'ExpectCTConfig'`
/ `'ForceHttpsRedirectConfig'`), fixed by importing the config class inline
before any other file repeated the mistake.

## Verify

Whole-package `turbo run docgen --filter=@beep/schema` currently fails, but
**not on this shard's files** — two different runs surfaced two different
sibling-owned failures (`Model/Model.variants.ts` missing `@since` tags on a
re-export line, then later `EntitySchema/EntitySchema.shape.ts` referencing
renamed error classes), consistent with concurrent in-flight sibling shards.
Per the driver's brief, verified this shard's files via a scoped probe
instead:

- `bun run beep docgen generate --package @beep/schema --include
  "HttpStatus/**,CrossOriginEmbedderPolicy/**,CrossOriginOpenerPolicy/**,CrossOriginResourcePolicy/**,Csp/**,ExpectCt/**,ForceHttpsRedirect/**,FrameGuard/**,NoSniff/**,PermissionsPolicy/**,PermittedCrossDomainPolicies/**,ReferrerPolicy/**,XssProtection/**"`
  → 39 modules, 333 examples found and typechecked, zero errors, twice in a
  row (before and after the final full-package run above).
- `bunx biome check` on exactly the 26 touched files → checked 26 files, no
  issues, no fixes applied (never ran with `--write` package-wide).
- Static self-audit script (regex over every `export (const|type|class|declare
  namespace)` + preceding JSDoc block in the 13 shard directories): 0 exported
  declarations missing `@example`.
- Targeted greps: 0 remaining `import * as Option from "effect/Option"` in the
  12 header files; each header file has exactly one standalone `export const
  Header` + `export type Header` pair; `Option` split into standalone
  const+type in exactly the 7 files whose `Option` is a raw union
  (`Csp`, `ExpectCt`, `ForceHttpsRedirect`, `FrameGuard`, `PermissionsPolicy`,
  `ReferrerPolicy`, `XssProtection`) and left as a simple rename in the 5
  `LiteralKit`-backed files (`CrossOriginEmbedderPolicy`,
  `CrossOriginOpenerPolicy`, `CrossOriginResourcePolicy`, `NoSniff`,
  `PermittedCrossDomainPolicies`); `Csp.schema.ts` `ReportURI` type alias
  present.

Not run: package-wide `turbo run docgen` (blocked by sibling in-flight files,
not this shard's), `npx tsgo -b` / `npx vitest run` (would also observe
siblings' incomplete edits; the scoped docgen probe plus biome plus the
static self-audit were used instead per the driver's fallback instruction).

## Files touched (26, no commits)

`src/HttpStatus/{HttpStatus.category,HttpStatus.client-error.core,HttpStatus.client-error.extended,HttpStatus.client-error.resource,HttpStatus.client-error,HttpStatus.informational,HttpStatus.redirection,HttpStatus.schema,HttpStatus.server-error.aggregate,HttpStatus.server-error,HttpStatus.shared,HttpStatus.success,HttpStatus.unofficial.aggregate,HttpStatus.unofficial}.ts`,
`src/{CrossOriginEmbedderPolicy,CrossOriginOpenerPolicy,CrossOriginResourcePolicy}/*.schema.ts`,
`src/Csp/Csp.schema.ts`,
`src/{ExpectCt,ForceHttpsRedirect,FrameGuard,NoSniff,PermissionsPolicy,PermittedCrossDomainPolicies,ReferrerPolicy,XssProtection}/*.schema.ts`.
