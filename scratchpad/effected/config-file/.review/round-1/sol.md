### sol-1-1
- file: scratchpad/effected/config-file/ConfigMigration.ts:22
- class: bug   severity: required
- standard: D9, D11; `.patterns/error-handling.md` structured recoverable failures   evidence: A read-only differential probe constructed a migration with `{ version: Infinity, name: "fails", up: () => Effect.fail("step failure") }` and parsed `{"version":0}`. The pinned oracle returned a `Fail` containing `ConfigMigrationError`; the port returned a `Die` containing `Error: Schema validation failed`. The public migration contract still accepts `version: number`, but `ConfigMigrationError.make` at line 111 validates that value against `S.Finite`.
- failure: A declared migration failure becomes an unrecoverable defect when the migration’s version is non-finite. `Effect.catchTag("ConfigMigrationError")` no longer handles it, and the original failure is obscured by error-construction validation.
- fix: Give the error’s `version` field an annotated compatibility schema accepting the upstream numeric domain, such as `S.declare(P.isNumber)`. This preserves the typed failure without reintroducing `S.Number` diagnostics.

### sol-1-2
- file: scratchpad/effected/config-file/JsonCodec.ts:25
- class: law   severity: required
- standard: D9 and section 14, behavior deviation protocol; `standards/effect-first-development.md` EF-3/EF-19   evidence: Read-only probes against the pinned oracle showed that malformed JSON changes `ConfigCodecError.cause` from `SyntaxError` to `SchemaError`, and BigInt serialization changes it from `TypeError` to `SchemaError`. The corresponding change in `JsoncCodec.ts:27` produces `JsoncStringifyError` instead of the oracle’s `TypeError`. Both port codecs reject top-level `undefined`, whereas both oracle codecs succeed with `undefined`. At the reviewed commit, the config-file ledger has `deviations: []` and README Port notes says “None.”
- failure: Public failure payloads and accepted serialization inputs changed without the required deviation record. The Schema migration has a law-based justification, but callers cannot discover the compatibility changes, and the green tests do not establish upstream behavior parity for these cases.
- fix: Complete section 14 for both codec changes: record the specific `law:` justification and observable differences in the ledger and Port notes, cite the adjusted cause assertions in `JsonCodec.test.ts`, and add the smallest regression covering top-level unrepresentable values. Retain the required Schema-based implementation.

### sol-1-3
- file: scratchpad/effected/config-file/internal/deepMerge.ts:81
- class: type-safety   severity: required
- standard: D11; D9/section 14 `upstream-bug` exception; `MergeStrategy<A>.resolve` promises `Effect<A>`   evidence: A read-only probe decoded both input documents through `S.Struct({ constructor: S.String, prototype: S.String, port: S.Finite })`, then passed them to `MergeStrategy.layeredMerge`. Both the port and pinned oracle returned only `{"port":3}`; `S.is(schema)(result)` was `false`, and `result.constructor` was the inherited function instead of the validated string. The filtering occurs in both copy loops, at lines 81 and 85.
- failure: Merging valid configuration documents can silently delete required schema fields and return a value outside the declared type `A`. The port’s new generic `deepMerge` overload also promises the target’s type `T` despite deleting those properties.
- fix: Preserve own data fields through the existing `Object.defineProperty` copy helper while retaining own-property checks and prototype-pollution protections. Add the schema-validity regression and record the demonstrated upstream bug under section 14 before adjusting the affected upstream filtering expectations.

### sol-1-4
- file: scratchpad/effected/config-file/ConfigMigration.ts:116
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` short law 10: no native `Array.prototype.sort`; use `A.sort` with explicit `Order`   evidence: The reviewed source still executes `[...options.migrations].sort((a, b) => a.version - b.version)`. There is no config-file exception in `standards/effect-laws.allowlist.jsonc`. This concrete occurrence remains despite the reported green gates.
- failure: Migration ordering uses the native sorting API expressly prohibited by the binding law.
- fix: Replace it with `A.sort(options.migrations, Order.mapInput(Order.Number, (migration) => migration.version))`, preserving ascending version order.

### sol-1-5
- file: scratchpad/effected/config-file/ConfigFile.ts:862
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` hard requirements and carrier policy; operator deferral of S2   evidence: Public APIs retain legacy `@example` and `@remarks` carriers, including `ConfigFile.Service` at line 862 and `ConfigEvents` at `ConfigEvent.ts:117`. Export documentation also lacks the required canonical `@category` and `@since 0.0.0` tags. Some examples depend on undeclared surrounding bindings, such as the `ConfigEvents` example’s `AppConfig`, `schema`, `codec`, `resolvers`, and `strategy`.
- failure: These blocks do not satisfy the final documentation contract and cannot serve as self-contained compilable examples.
- fix: During S2, convert the legacy carriers to titled Example and Details sections, supply complete example bindings, and add canonical categories and since tags. Preserve the upstream explanatory prose.

### sol-1-6
- file: scratchpad/test/config-file/ConfigFile.test.ts:41
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D14; operator deferral of S3   evidence: The test provides `layerFor(...)` inside its individual `it.effect` body. `layerFor` builds `ConfigFile.layer`, whose implementation uses `Layer.effect`; it is not a pure `Layer.succeed` or `Layer.mock` stub. The pattern repeats throughout this suite and the event tests.
- failure: The suites retain per-test construction of effectful layers instead of the required runner-owned `it.layer` lifecycle.
- fix: During S3, move these cases into appropriately isolated `it.layer` blocks, keeping distinct filesystem seeds and fault configurations in separate blocks where needed.

### sol-1-7
- file: scratchpad/test/config-file/ConfigEvent.test.ts:72
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5 and detector rows EV005/EV006; operator deferral of S3   evidence: The tests use `Effect.result` and manually assert `result._tag` at lines 72–81. `JsonCodec.test.ts:53` also manually inspects Exit, Option, and Cause wrappers rather than using the canonical outcome helpers.
- failure: Outcome assertions retain the forms the test-canon migration requires replacing.
- fix: During S3, use `Effect.exit` with `assertExitFailure`/`assertExitSuccess` and the relevant `@effect/vitest/utils` helpers. Retain assertions distinguishing typed failure from defects.

### sol-1-8
- file: scratchpad/test/config-file/JsonCodec.test.ts:21
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL D10 property floor; operator deferral of S3   evidence: Searching the complete config-file test surface found no `it.prop`, `it.effect.prop`, `Arbitrary`, `toArbitrary`, or `fcRuns` use. The codec round-trip check here exercises only the fixed `{ port: 8080 }` example.
- failure: The module has no generated properties satisfying the required schema/codec round trips or parser/formatter fidelity and idempotence floor. Fixed examples leave cases such as unrepresentable top-level values and schema-invalid merged outputs unexamined.
- fix: During S3, add schema-generated round-trip properties and codec fidelity/idempotence properties over explicit supported domains, using the canonical property APIs and `fcRuns`. Keep the upstream example suites.

REQUIRED: 4
BACKLOG: 4