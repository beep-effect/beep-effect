### sol-1-1
- file: scratchpad/effected/spdx/SpdxExpression.ts:157
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and operator step 4; standards/effect-first-development.md EF-12.   evidence: A read-only `bun -e` probe calling `S.resolveAnnotations(SpdxExpression.Schema)` and `S.resolveAnnotations(SpdxExpression.FromString)` returned `undefined` for both. The union at line 157 and codec at line 236 have no composer annotations, although both are publicly exposed through the facade.
- failure: The exported AST schema and string codec lack their own namespaced identity and descriptive metadata. Annotating the member classes does not annotate either enclosing schema, leaving these two public schema surfaces outside the completed identity requirement.
- fix: Apply distinct `$I.annoteSchema(...)` annotations to `SpdxExpressionUnion` and `FromString`, with descriptions of their AST and string-codec contracts. Preserve their existing types and parsing behavior.

### sol-1-2
- file: scratchpad/effected/spdx/SpdxExpression.ts:37
- class: perf   severity: required
- standard: EFFECTED_PORT_GOAL.md D11, measured regression versus the pinned upstream oracle; standards/effect-laws-v1.md law 11 permits exhaustive Effect matchers.   evidence: A read-only Bun 1.4.2 benchmark parsed an expression containing 80 `MIT` leaves joined by ` OR `, warmed each serializer for 10,000 calls, then measured three batches of 10,000 `.toString()` calls. Local times were **221.75 / 248.32 / 286.63 ms**; pinned upstream times were **11.23 / 11.19 / 10.76 ms**. Each batch produced the same total output length, 7,140,000 characters. An in-memory version using one prebuilt `Match.type().pipe(Match.tagsExhaustive(...))` matcher took **39.17 / 71.38 / 99.68 ms**.
- failure: Serialization is approximately **22 times slower at the median** for this workload. Every recursive visit constructs a new handler object and closures and invokes `Match.valueTags`; the cost affects node `.toString()` and the `FromString` encode path. This regression has direct measurement and is avoidable while retaining Effect dispatch.
- fix: Build the exhaustive serializer matcher once at module scope and reuse it recursively, preserving the existing handlers and formatted bytes. Recheck the same benchmark and oracle output after the change.

### sol-1-3
- file: scratchpad/effected/spdx/License.ts:44
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-12b and EF-35.   evidence: The named, reused license-reference constraint exists only as `LICENSE_REF_PATTERN`. Both `License.isLicenseRef` and `License.parseResult` invoke its `.test(...)` directly; the expression parser also consumes `License.isLicenseRef`. No schema models this constraint.
- failure: A shared domain-string grammar remains an ad-hoc predicate rather than a schema-derived guard, contrary to the explicit schema-first guard requirement. Callers cannot compose the same reference constraint into a schema without rebuilding its validation rule.
- fix: Define a module-local, annotated branded string schema using `S.isPattern` with the existing regular expression, derive its guard with `S.is(...)`, and reuse that guard in both methods. Keep the public signatures, accepted strings, and error behavior unchanged.

### sol-1-4
- file: scratchpad/effected/spdx/License.ts:62
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md hard requirements; EFFECTED_PORT_GOAL.md D4 and S2. S2 is deferred by operator order.   evidence: The module still contains legacy `@example` and `@remarks` carriers—for example here and at `License.ts:138`, `LicenseException.ts:23`, and `SpdxExpression.ts:216`. A targeted scan found no `@category` or `@since` tags in the public source files. Several value exports, including the error and AST node classes, have no Example.
- failure: Public API documentation does not yet satisfy the titled Example grammar, canonical categories, version annotations, and value-export example requirements.
- fix: During S2, convert the existing bodies to titled `**Example** (Title)` and appropriate prose sections without dropping content; add meaningful examples where absent and canonical `@category` / `@since 0.0.0` tags.

### sol-1-5
- file: scratchpad/test/spdx/SpdxExpression.test.ts:207
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10 and sections 11.4; goals/effect-vitest-canon/SPEC.md section 1.3. S3 is deferred by operator order.   evidence: The module has one `it.effect.prop` registration, using the manually constrained `spdxExpressionArb`, and no `fcRuns` import or registration option. The other exported schemas have no schema-derived encode/decode round-trip properties.
- failure: The existing property does not inherit the repository’s configurable run floor, and the per-export schema property floor remains incomplete. Its constrained generator provides useful expression fidelity coverage but does not establish round-trip laws for all exported schemas.
- fix: During S3, add `{ arbitrary: fcRuns(n) }` to the existing property and add own-schema encode/decode round-trip properties derived through `Arbitrary.schema` for the exported schemas. Retain the constrained expression generator and upstream assertions.

### sol-1-6
- file: scratchpad/test/spdx/SpdxExpression.test.ts:226
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5; EFFECTED_PORT_GOAL.md section 11.2. S3 is deferred by operator order.   evidence: This assertion compares an `Option` through `assert.deepStrictEqual(..., O.some(...))`. Similar cases use `assert.isTrue(O.isNone(...))`; `LicenseMetadata.test.ts` repeats these patterns, and the license tests inspect Result/Exit tags or predicates instead of using the canonical outcome helpers.
- failure: Option, Result, and Exit assertions remain outside the prescribed Vitest assertion canon.
- fix: During S3, replace these assertions with the corresponding `@effect/vitest/utils` helpers—`assertSome`, `assertNone`, `assertSuccess`, `assertFailure`, and Exit helpers—supplying the expected payload or cause where required and retaining the existing field checks.

REQUIRED: 3
BACKLOG: 3