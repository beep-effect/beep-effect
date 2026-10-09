I'll review the SPDX port against the pinned upstream oracle and the binding decisions, and report findings only. First I'm loading the decision record, port notes, and both trees.The surface is small. Next I’ll read the binding decisions, the recorded deviations, and both source trees.Port notes and the ledger show no recorded deviations. I’ll diff the port against the pinned oracle and read the law-sensitive source.The SPDX parser, catalogs, and upstream tests match the pinned oracle. One law miss is required. Documentation, JSDoc, and test-canon gaps are backlog because S2 and S3 have not run.

### grok-1-1
- file: scratchpad/effected/spdx/License.ts:104
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6; D5 (HashMap/HashSet only); standards/effect-first-development.md collections rule. evidence: `License.catalog`, `LicenseException.catalog` (`LicenseException.ts:58`), and `LICENSE_META` (`internal/licenseMeta.ts:780`) are `MutableHashMap` `.backing` native `Map`s. `readonlyIdSet` walks that map directly (`internal/licenseIds.ts:758`, `internal/exceptions.ts:104`). `NoNativeRuntime.ts` flags only `new Map` / `new Set` (`MAP_SET_CTORS` in `detectNewExpressionViolation`), so the green native-runtime gate does not see `.backing`. String keys are simple keys, so insertion order still matches upstream `Map`/`Set`; this is not a parse or catalog-order bug.
- failure: Domain code publishes live native maps. `catalog.get` / `LICENSE_META.has` hit a `Map`, and a caller can mutate the catalog through that object.
- fix: Keep the `MutableHashMap` and project the existing `ReadonlyMap` / set surface through `MutableHashMap.get`, `has`, `size`, `keys`, and `values` (unwrap `Option` so `.get` still returns `V | undefined`). Stop reading `.backing`. Order stays insertion order for these string keys. `instanceof Map` becomes false; nothing in-tree asserts it. Record `law:effect-laws-v1#6` only if a caller depends on that.

### grok-1-2
- file: scratchpad/effected/spdx/README.md:92
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §10.3; effect-laws-v1 law 2 (no root `effect` barrel in Markdown examples). evidence: Attribution bullets from line 92 through 158 are source-line dumps (`License.ts:2 import …`), not the vendored-engine notices (spdx-license-ids, spdx-exceptions, license-list-data). The body still has the npm/Node/TypeScript badges, the pre-1.0 block, the Install section, and `import { Effect } from "effect"` (line 48).
- failure: Port notes do not carry the SPDX dataset notices, and the README still documents the npm package rather than the lab port.
- fix: Replace the dump with the four §10.3 subsections. Attribution lists upstream package `0.11.0`, commit `af7566a9da2eff169cb74955efcc5ede1e5de9f8`, `LICENSE`, and those three dataset notices. Drop badges, Install, and the pre-1.0 block. Point examples at `../../effected/spdx/index.ts` and `effect/Effect`.

### grok-1-3
- file: scratchpad/effected/spdx/License.ts:138
- class: jsdoc   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §10.2; `.patterns/jsdoc-documentation.md`. evidence: Exported blocks still use `@example` (`License.ts:62`), `@remarks` (`License.ts:138`, `LicenseException.ts:81`), `@param`, `@returns`, and `@public`, and they have no `@category` or `@since`. The same carriers remain on `LicenseException`, `SpdxExpression`, and `index.ts`.
- failure: Docgen S2 will reject the upstream tags, and the blocks are not on the beep section grammar yet.
- fix: Move `@remarks` into `**Details**` or `**Gotchas**`, `@example` into `**Example** (Title)`, and add `@category` plus `@since 0.0.0`. Keep every upstream sentence and example.

### grok-1-4
- file: scratchpad/test/spdx/SpdxExpression.test.ts:226
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §11.2 and §11.4 (D10); `.patterns/testing-patterns.md`. evidence: Primary-license checks use `assert.deepStrictEqual(..., O.some(...))` and `O.isNone` (`SpdxExpression.test.ts:226`, `:241`). `License` and `LicenseException` have no `Arbitrary.schema` encode/decode property, and the expression property does not go through `fcRuns`. Sync `it` blocks match upstream and are fine.
- failure: Option and Result results are not asserted with the vitest-canon helpers, and the schema property floor is not in place.
- fix: Use `assertSome` / `assertNone` / `assertSuccess` / `assertFailure` from `@effect/vitest/utils` without weakening payloads. Add `fcRuns` round-trips for `License`, `LicenseException`, and `InvalidSpdxExpressionError`. Keep the constrained expression arbitrary; `Arbitrary.schema(SpdxExpression.Schema)` draws ids the grammar rejects.

REQUIRED: 1
BACKLOG: 3
