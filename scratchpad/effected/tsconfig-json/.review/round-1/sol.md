### sol-1-1
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:251
- class: schema   severity: required
- standard: D5; operator step 4; `standards/effect-first-development.md` EF-12.   evidence: A read-only Bun probe printed `CompilerOptions.ast.annotations === undefined`, `TsconfigJson.ast.annotations === undefined`, and `Target.ast.annotations === undefined`. `ProgrammaticCompilerOptions` uses a bare `"ProgrammaticCompilerOptions"` identifier at `TsEnumCodec.ts:303`. The other compiler-option enum schemas, watch-option enum schemas, `Reference`, `WatchOptions`, `TypeAcquisition`, and both exported codecs likewise lack canonical identity annotations.
- failure: The exported schema surface does not meet the required `$ScratchpadId` identity contract. Most object-schema fields also lack the field annotations required by step 4. Green compilation and the four law gates have not established this metadata.
- fix: Add file-local `$ScratchpadId` composers and apply `$I.annote(...)` to each exported schema or codec, with meaningful field annotations on object schemas. Preserve the existing decoding and passthrough behavior.

### sol-1-2
- file: scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:34
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `ResolvedTsconfig` declares its complete data shape as an interface, merged with a static facade; a read-only probe printed `ResolvedTsconfig.ast === undefined`. The same pattern occurs for `PortableTsconfig` at `PortableTsconfig.ts:196`. `PortableTsconfigOptions`, `FindNearestOptions`, and `ProgrammaticRecord` also define plain configuration or record shapes.
- failure: These domain and configuration shapes have no schema source of truth from which to derive their types, guards, or arbitraries. They are pure data rather than service contracts or overload machinery.
- fix: Define schemas for these shapes and derive their public types from the schemas. Preserve the existing helper names, plain-object results, optional-key semantics, and unknown-key passthrough. Keep the function-bearing `SyncFileSystem` and `SyncPath` ports as interfaces.

### sol-1-3
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:34
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b.   evidence: Both `caseInsensitiveLiterals` helpers build the named compiler and watch domains with `S.Literals`. `IgnoreDeprecations` is another named `S.Literals` domain at `CompilerOptions.ts:232`, while the nine-family `EnumFamily` domain exists only as a handwritten union at `TsEnumCodec.ts:57`.
- failure: Named literal domains remain outside the required `LiteralKit` modeling convention; `EnumFamily` additionally has no runtime schema corresponding to its type.
- fix: Define the named domains with `LiteralKit`, derive `EnumFamily` from its kit, and retain the case-insensitive transformations around the compiler and watch domains so accepted spellings and canonical encoding remain unchanged.

### sol-1-4
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:396
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-3; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `CompilerOptions` exposes only the namespace companions `.Type` and `.Encoded`. `Reference`, `WatchOptions`, and `TypeAcquisition` use the same pattern. The exported enum schemas and codecs have no same-name runtime type aliases.
- failure: The required `export type Name = typeof Name.Type` companion is absent for these non-class schemas. For example, consumers cannot use the exported `Target` identifier directly as its decoded value type.
- fix: Add same-name type aliases for the non-class schema and codec exports. Retain existing `.Type` and `.Encoded` namespace companions to preserve upstream contracts, and record the added type exports under D2.

### sol-1-5
- file: scratchpad/effected/tsconfig-json/JsxConfig.ts:28
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 20; `standards/effect-first-development.md` EF-13.   evidence: Read-only probes returned `Success` for both `S.decodeUnknownResult(JsxConfig)({ runtime: "automatic" })` and `S.decodeUnknownResult(JsxConfig)({ runtime: "classic", importSource: "x" })`.
- failure: The schema accepts an automatic configuration without its import source and a classic configuration carrying an automatic-only field. The single optional-field bag does not express the case-specific invariants that `fromCompilerOptions` implements.
- fix: Model automatic and classic configurations as variants discriminated by `runtime`, using the prescribed literal domain and tagged-union construction. Require `importSource` for automatic configurations. Preserve the projection’s current outputs and record the law-driven schema acceptance change under section 14.

### sol-1-6
- file: scratchpad/effected/tsconfig-json/TsconfigJson.ts:238
- class: law   severity: required
- standard: AGENTS.md cause-carrying error rule; `standards/effect-first-development.md`, “Tagged error with Identity composer.”   evidence: The field uses `S.Defect()` without `{ includeStack: true }`. A read-only encoding probe with an `Error("inner")` cause produced `{ name: "Error", message: "inner" }`, omitting the cause’s stack.
- failure: Encoding `TsconfigParseError` discards the diagnostic stack that the explicit cause-field contract requires.
- fix: Use `S.Defect({ includeStack: true })` while retaining the field annotation. Record the law-driven encoded-shape deviation and add a focused stack-preservation assertion.

### sol-1-7
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:372
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-18; AGENTS.md exported-helper dual-form rule.   evidence: The public static `encode` and `decode` methods expose only their two-argument implementations. The public `ResolvedTsconfig.absolutize`, `.merge`, and `.substituteConfigDir` helpers likewise have no pipeable overloads. A read-only probe attempting the corresponding curried `TsEnumCodec.encode` form failed because the one-argument call returned an `Option`, not a function.
- failure: These reusable public combinators cannot be used in the required data-last form. Their placement behind static class properties leaves this obligation unmet despite the green exported-function diagnostic gate.
- fix: Add typed data-first/data-last overloads backed by `dual` to these fixed-arity helpers, preserving every existing data-first call and result.

### sol-1-8
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:302
- class: law   severity: required
- standard: D9, D15, and section 14; pinned upstream `__test__/TsEnumCodec.assignability.test.ts`.   evidence: Upstream’s `ProgrammaticCompilerOptions` index signature uses `ProgrammaticCompilerOptionsValue`; the port changes it to `unknown`. The port also replaces the two upstream assignments to `CompilerOptionsReplica` with assignments to `ProgrammaticRecord` at `scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts:19` and `:27`. The ledger’s `deviations` array is empty, and README “Deviations” says `None`.
- failure: The upstream public assignability guarantee is removed: an unknown-valued index signature cannot be assigned to the compiler replica’s narrower value union, even for ordinary encoded options. The revised tests no longer exercise that guarantee. Removing the upstream unsafe assertion supplies a D15 reason for a deviation, but the required deviation protocol has not been followed.
- fix: Record the D15-driven public type change in the ledger and README, explicitly citing both adjusted assignability tests and the downstream validation requirement. Do not restore the unsafe assertion to recover the old signature.

### sol-1-9
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:385
- class: law   severity: required
- standard: D9 and section 14; Effect tsgo rule `schemaNumber` (`TS377098`).   evidence: Against the pinned oracle, read-only probes for `{ maxNodeModuleJsDepth: Infinity }` and `{ maxNodeModuleJsDepth: NaN }` printed `upstream Success` and `port Failure`. The port replaces upstream `Schema.Number` with `S.Finite`, but the ledger and README record no deviation.
- failure: The port changes the public schema’s accepted inputs without recording the rule that forces the change or pinning the changed behavior in a test.
- fix: Retain `S.Finite` and record a `law:schemaNumber` deviation citing a focused test for non-finite rejection. Add the corresponding README deviation entry.

### sol-1-10
- file: scratchpad/effected/tsconfig-json/TsconfigDiscovery.ts:33
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`; canonical categories in `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`; operator deferral of S2.   evidence: This export still uses `@example`; `TsconfigLoaderSync.ts:219` uses `@remarks`; most exported schemas and static methods lack the required titled examples, categories, and `@since` tags. The newly converted `CompilerOptionsFromProgrammatic` block uses `@category codecs` at line 88, which is absent from the canonical category list.
- failure: The JSDoc surface is not ready for the required documentation rubric. The converted codec block introduces an unsupported category.
- fix: During S2, convert the remaining carriers, add meaningful examples and required tags, and replace `codecs` with a supported category such as `schemas`.

### sol-1-11
- file: scratchpad/test/tsconfig-json/CompilerOptions.test.ts:138
- class: test   severity: backlog
- standard: D10; section 11.4; `goals/effect-vitest-canon/SPEC.md` property-run configuration; operator deferral of S3.   evidence: The round-trip property generates a separate three-field `Subset` schema. The programmatic codec properties similarly generate a limited `Canonical` schema. Only these two test files register properties, and neither supplies `fcRuns(n)`.
- failure: The existing properties do not satisfy the per-export schema/codec property floor or exercise the complete modeled domains. Repository-configured run floors are absent.
- fix: During S3, retain these upstream properties and add schema-derived round-trip, normalization, and fidelity properties for the exported schemas and codecs, with explicit `fcRuns(n)` configuration. Handle lossy enum aliases through their documented canonicalization semantics.

### sol-1-12
- file: scratchpad/test/tsconfig-json/TsconfigLoader.test.ts:21
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; section 11.2; operator deferral of S3.   evidence: Effect tests compare complete `Option` values with `assert.deepStrictEqual(result, O.some(...))`. `CompilerOptions.test.ts:47` checks a `Result` through its `_tag` rather than the public assertion helper.
- failure: Option and Result assertions remain outside the pinned test-canon helper convention.
- fix: During S3, use `assertSome`, `assertNone`, `assertSuccess`, and `assertFailure` from `@effect/vitest/utils`, preserving the current expected payloads and subsequent plain-value assertions.

### sol-1-13
- file: scratchpad/effected/tsconfig-json/README.md:117
- class: docs   severity: backlog
- standard: D2 and D4; operator deferral of documentation work; current `TsEnumCodec.ts` public signature.   evidence: Lines 117 and 161 still promise that the encoder’s result can be passed to a `ts.CompilerOptions` API without a cast. That promise conflicts with the new unknown-valued return type. “Added exports” at line 183 says `None`, although `ProgrammaticCompilerOptions` is now also exported as a runtime schema through `index.ts:41`.
- failure: The adapted README describes the old compiler assignability contract and omits the added runtime export, giving consumers incorrect guidance about the port.
- fix: Update the compiler-integration prose to describe the required downstream validation or selection, and list the new `ProgrammaticCompilerOptions` runtime schema under “Added exports.”

REQUIRED: 9
BACKLOG: 4