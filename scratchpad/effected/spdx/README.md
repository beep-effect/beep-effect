# spdx (lab port of @effected/spdx)

[![npm](https://img.shields.io/npm/v/@effected%2Fspdx?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/spdx)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

SPDX license identifiers, exceptions and license expressions as Effect Schema classes. `License.parse` validates a single identifier against the full SPDX License List; `SpdxExpression.parse` validates and parses a whole expression — `(MIT OR Apache-2.0)`, `GPL-2.0-only WITH Classpath-exception-2.0` — into a typed AST rather than a string you re-parse at every call site. Zero runtime dependencies: the SPDX datasets are vendored as generated TypeScript, not read from a CJS package at runtime.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/spdx

Validating a `license` field usually means importing a small CJS parser at runtime and trusting it to keep working across module systems — a foreign dependency for a grammar that rarely changes. This package vendors the SPDX license and exception datasets as real, committed TypeScript instead: 695 active and 26 deprecated license identifiers, plus 66 exceptions, built once from static data with no parsing cost at load time. Validation only runs against actual user input, through `parse` / `parseResult`, never against the ~721 known-good catalog entries.

The grammar itself is hardened the same way: malformed input and an unknown identifier both fail through one typed `InvalidSpdxExpressionError`, never as a thrown exception, and the recursive-descent parser is depth-capped so a hostile or accidentally-nested expression cannot blow the stack. A differential test suite checks the engine against the canonical `spdx-expression-parse` package on all 695 known license ids — if the two ever disagree, the rule is to fix this engine, not the test.

## Install

```bash
npm install @effected/spdx effect
```

```bash
pnpm add @effected/spdx effect
```

Requires Node.js >=24.11.0. `effect` v4 is the only peer dependency, and the only dependency of any kind — no IO, no filesystem, no network.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

Validate a single license identifier:

```ts
import { License } from "@effected/spdx";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const mit = yield* License.parse("MIT");
  return [mit.id, mit.deprecated] as const;
});

console.log(Effect.runSync(program));
// => ["MIT", false]
```

Check a whole license expression synchronously, with no `Effect` runtime needed:

```ts
import { isValidExpression } from "@effected/spdx";

console.log(isValidExpression("(MIT OR Apache-2.0)"));
// => true
console.log(isValidExpression("MIT AND"));
// => false
```

## Features

- `License` — a validated SPDX license identifier (`Schema.Class`), with `parse` (Effect) and `parseResult` (sync `Result`) constructors, an `of(...)` convenience for known-good values, and the static predicates `isKnownId`, `isDeprecatedId` and `isLicenseRef`.
- License metadata from the vendored dataset, as getters on a `License`: `name` and `referenceUrl` (both `Option`, `none` for a `LicenseRef-` identifier the list does not describe) and the `osiApproved` / `fsfLibre` flags, for a UI or a policy gate that needs more than the identifier.
- `LicenseException` — the same pattern over the SPDX exception identifiers, with its own catalog and `parse` / `parseResult` / `of`.
- `SpdxExpression` — the recursive license-expression AST (`LicenseNode`, `LicenseRefNode`, `WithExceptionNode`, `AndNode`, `OrNode`), an Effect `parse`, the sync `isValidExpression` predicate, a `FromString` codec for embedding in your own schemas, and a canonical, fully-parenthesized `.toString()`.
- `SpdxExpression.licensesOf` / `SpdxExpression.primaryLicense` — every license an expression names, in written order and deduplicated, and the single one to display where only one fits. `primaryLicense` is deliberately `none` for an `AND` expression: a conjunction imposes all of its terms at once, so no one of them stands for the whole, and picking a side would misstate the obligations. Reach for `licensesOf` wherever more than one can be shown.
- `InvalidSpdxExpressionError` — the package's single typed error; malformed grammar and an unknown identifier both fail through it, never as a defect.
- Deprecated license and exception identifiers parse successfully and carry `deprecated: true` rather than being rejected outright.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/spdx` 0.11.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/spdx/License.ts:2 import { DEPRECATED_LICENSE_IDS, LICENSE_IDS } from "./internal/licenseIds.ts";
- scratchpad/effected/spdx/License.ts:3 import { LICENSE_META, META_FLAG_FSF_LIBRE, META_FLAG_OSI_APPROVED } from "./internal/licenseMeta.ts";
- scratchpad/effected/spdx/License.ts:7 * unrecognized license or exception identifier, or a malformed
- scratchpad/effected/spdx/License.ts:8 * `LicenseRef-`/`DocumentRef-` reference.
- scratchpad/effected/spdx/License.ts:12 * {@link License.parse} and
- scratchpad/effected/spdx/License.ts:13 * `LicenseException.parse` raise it, and the recursive expression parser reuses
- scratchpad/effected/spdx/License.ts:16 * @see {@link https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/ | SPDX License Expressions}
- scratchpad/effected/spdx/License.ts:31 // A LicenseRef / DocumentRef reference is valid without catalog membership.
- scratchpad/effected/spdx/License.ts:33 //   license-ref = ["DocumentRef-"idstring":"]"LicenseRef-"idstring
- scratchpad/effected/spdx/License.ts:37 const LICENSE_REF_PATTERN = /^(?:DocumentRef-[A-Za-z0-9.-]+:)?LicenseRef-[A-Za-z0-9.-]+$/;
- scratchpad/effected/spdx/License.ts:40 * A validated SPDX license identifier: an Effect `Schema.Class` whose `id` is
- scratchpad/effected/spdx/LicenseException.ts:3 import { InvalidSpdxExpressionError } from "./License.ts";
- scratchpad/effected/spdx/LicenseException.ts:6 * A validated SPDX license-exception identifier: an Effect `Schema.Class` whose
- scratchpad/effected/spdx/LicenseException.ts:10 * Unlike {@link License}, an exception has no reference grammar — an exception
- scratchpad/effected/spdx/LicenseException.ts:12 * through {@link LicenseException.parse} (Effect) or
- scratchpad/effected/spdx/LicenseException.ts:13 * {@link LicenseException.parseResult} (the synchronous `Result` primitive);
- scratchpad/effected/spdx/LicenseException.ts:19 * import { LicenseException } from "./index.ts";
- scratchpad/effected/spdx/LicenseException.ts:23 *   const e = yield* LicenseException.parse("Classpath-exception-2.0");
- scratchpad/effected/spdx/LicenseException.ts:31 * @see {@link https://spdx.org/licenses/exceptions-index.html | SPDX Exceptions List}
- scratchpad/effected/spdx/LicenseException.ts:34 export class LicenseException extends Schema.Class<LicenseException>("LicenseException")({
- scratchpad/effected/spdx/SpdxExpression.ts:2 import type { RawExpression, RawSimpleLicense } from "./internal/parser.ts";
- scratchpad/effected/spdx/SpdxExpression.ts:4 import { InvalidSpdxExpressionError, License } from "./License.ts";
- scratchpad/effected/spdx/SpdxExpression.ts:13 | { readonly _tag: "License"; readonly id: string; readonly plus: boolean }
- scratchpad/effected/spdx/SpdxExpression.ts:14 | { readonly _tag: "LicenseRef"; readonly documentRef?: string; readonly ref: string }
- scratchpad/effected/spdx/SpdxExpression.ts:15 | { readonly _tag: "WithException"; readonly license: SpdxNode; readonly exception: string }
- scratchpad/effected/spdx/SpdxExpression.ts:28 case "License":
- scratchpad/effected/spdx/SpdxExpression.ts:30 case "LicenseRef": {
- scratchpad/effected/spdx/SpdxExpression.ts:32 return `${prefix}LicenseRef-${node.ref}`;
- scratchpad/effected/spdx/SpdxExpression.ts:35 return `${serialize(node.license)} WITH ${node.exception}`;
- scratchpad/effected/spdx/index.ts:2 * SPDX license identifiers, exceptions and license expressions as Effect
- scratchpad/effected/spdx/index.ts:5 * {@link License} and {@link LicenseException} validate an identifier against
- scratchpad/effected/spdx/index.ts:6 * the vendored SPDX catalogs (or, for a license, the `LicenseRef-`/
- scratchpad/effected/spdx/index.ts:8 * {@link SpdxExpression} facade parses a full license expression into a
- scratchpad/effected/spdx/index.ts:9 * tagged-union AST — {@link LicenseNode}, {@link LicenseRefNode},
- scratchpad/effected/spdx/index.ts:22 *   const expr = yield* SpdxExpression.parse("(MIT OR Apache-2.0+)");
- scratchpad/effected/spdx/index.ts:27 * // => ["Or", "(MIT OR Apache-2.0+)"]
- scratchpad/effected/spdx/index.ts:28 * console.log(isValidExpression("MIT AND"));
- scratchpad/effected/spdx/index.ts:32 * @see {@link https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/ | SPDX License Expressions}
- scratchpad/effected/spdx/index.ts:38 export { InvalidSpdxExpressionError, License } from "./License.ts";
- scratchpad/effected/spdx/index.ts:39 export { LicenseException } from "./LicenseException.ts";
- scratchpad/effected/spdx/internal/exceptions.ts:1 // Vendored SPDX license exception identifier lists. The two arrays below are
- scratchpad/effected/spdx/internal/exceptions.ts:5 // Foundation's SPDX workgroup (https://spdx.org/licenses/exceptions-index.html).
- scratchpad/effected/spdx/internal/licenseIds.ts:1 // Vendored SPDX license identifier lists. The two arrays below are
- scratchpad/effected/spdx/internal/licenseIds.ts:2 // machine-generated by `lib/scripts/generate-data.ts` from the `spdx-license-ids`
- scratchpad/effected/spdx/internal/licenseIds.ts:3 // package (https://github.com/jslicense/spdx-license-ids), CC0-1.0. That
- scratchpad/effected/spdx/internal/licenseIds.ts:4 // package republishes the SPDX License List (https://spdx.org/licenses/),
- scratchpad/effected/spdx/internal/licenseIds.ts:10 export const ACTIVE_LICENSE_IDS = [
- scratchpad/effected/spdx/internal/licenseIds.ts:11 // spdx:license-ids:active:start
- scratchpad/effected/spdx/internal/licenseMeta.ts:1 // Vendored SPDX license metadata. The entry array below is machine-generated
- scratchpad/effected/spdx/internal/licenseMeta.ts:3 // catalog, committed at `lib/data/spdx-licenses.json`
- scratchpad/effected/spdx/internal/licenseMeta.ts:4 // (https://github.com/spdx/license-list-data), CC0-1.0, which republishes the
- scratchpad/effected/spdx/internal/licenseMeta.ts:5 // SPDX License List (https://spdx.org/licenses/). Do not edit the array by
- scratchpad/effected/spdx/internal/licenseMeta.ts:10 // same 721 ids the `licenseIds.ts` catalog carries. Repeating three object
- scratchpad/effected/spdx/internal/licenseMeta.ts:12 // information. `reference` is deliberately NOT vendored — every upstream
- scratchpad/effected/spdx/internal/licenseMeta.ts:13 // entry's URL is exactly `https://spdx.org/licenses/<id>.html`, so it is
- scratchpad/effected/spdx/internal/licenseMeta.ts:14 // templated in `License.referenceUrl`; the generator asserts that template
- scratchpad/effected/spdx/internal/licenseMeta.ts:18 /** Bit set in a metadata entry's `flags` when the license is OSI-approved. @internal */
- scratchpad/effected/spdx/internal/licenseMeta.ts:21 /** Bit set in a metadata entry's `flags` when the license is FSF-libre. @internal */
- scratchpad/effected/spdx/internal/licenseMeta.ts:25 * One vendored metadata entry: the SPDX identifier, its full title, and the
- scratchpad/effected/spdx/internal/licenseMeta.ts:30 export type LicenseMetaEntry = readonly [id: string, name: string, flags: number];
- scratchpad/effected/spdx/internal/licenseMeta.ts:33 * One row per license, TAB-separated as `id\tname\tflags`.
- scratchpad/effected/spdx/internal/parser.ts:1 import { License } from "../License.ts";
- scratchpad/effected/spdx/internal/parser.ts:2 import { LicenseException } from "../LicenseException.ts";
- scratchpad/effected/spdx/internal/parser.ts:23 * the trailing `+` ("or later") marker, or a `LicenseRef`/`DocumentRef`
- scratchpad/effected/spdx/internal/parser.ts:30 export type RawSimpleLicense =
- scratchpad/effected/spdx/internal/parser.ts:31 | { readonly kind: "license"; readonly id: string; readonly plus: boolean }
- scratchpad/effected/spdx/internal/parser.ts:32 | { readonly kind: "licenseRef"; readonly documentRef: string | undefined; readonly ref: string };

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — The lab replaces native catalogs/id sets with HashMap/HashSet and license deduplication with MutableHashSet, using Option lookups while retaining ordered datasets and first-appearance license order. (scratchpad/test/spdx/License.test.ts:83; scratchpad/test/spdx/LicenseMetadata.test.ts:11; scratchpad/test/spdx/data.test.ts:7; scratchpad/test/spdx/SpdxExpression.test.ts:307)
- **schema-first** — The lab derives LicenseRef validation from a branded schema using the upstream regex instead of separate direct regex guards. (scratchpad/test/spdx/License.test.ts:23; scratchpad/test/spdx/License.test.ts:48; scratchpad/test/spdx/License.test.ts:63)
- **type-safety** — The lab replaces tuple and test casts with checked types/narrowing and declares recursive encoded children as tagged POJOs instead of decoded class instances. (scratchpad/test/spdx/SpdxExpression.test.ts:219; scratchpad/test/spdx/SpdxExpression.test.ts:271; scratchpad/test/spdx/SpdxExpression.test.ts:152; scratchpad/test/spdx/LicenseMetadata.test.ts:11)
- **tsgo-diagnostics** — The lab uses schema .make, typed string decoding and schema-derived test guards instead of new error construction, unknown-input decoding and instanceof narrowing. (scratchpad/test/spdx/License.test.ts:37; scratchpad/test/spdx/LicenseException.test.ts:16; scratchpad/test/spdx/SpdxExpression.test.ts:120; scratchpad/test/spdx/SpdxExpression.test.ts:133; scratchpad/test/spdx/SpdxExpression.test.ts:165; scratchpad/test/spdx/SpdxExpression.test.ts:207)
- **effect-first** — The lab uses hoisted exhaustive Effect matchers and Array/Option helpers instead of upstream switches and native metadata mapping/lookup checks. (scratchpad/test/spdx/SpdxExpression.test.ts:127; scratchpad/test/spdx/SpdxExpression.test.ts:152; scratchpad/test/spdx/SpdxExpression.test.ts:229; scratchpad/test/spdx/SpdxExpression.test.ts:279; scratchpad/test/spdx/SpdxExpression.test.ts:298)
- **effect-imports** — The lab source, tests and JSDoc examples import dedicated effect/Module paths instead of the upstream effect barrel. (module suite scratchpad/test/spdx/**)
- **identity-annotations** — The lab adds composer-derived identifiers, field descriptions and schema metadata to the upstream classes, AST union and string codec. (module suite scratchpad/test/spdx/**)
- **test-environment** — The lab supplies the upstream oracle ambient declaration beside the lab tests instead of relying on the upstream types-directory layout. (scratchpad/test/spdx/oracle.int.test.ts:43; scratchpad/test/spdx/spdx-expression-parse.d.ts:1)

### Dependency backlog

None.
