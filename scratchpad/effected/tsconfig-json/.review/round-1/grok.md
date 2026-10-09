I'll review the `tsconfig-json` port against the pinned upstream oracle and the port decisions, and report findings only. First I'm loading the binding decisions, the port ledger, and the module surface.Identity is only on a few errors, and a few shapes diverged from the oracle. I'll read those sites against upstream next.### grok-1-1
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:292
- class: bug   severity: required
- standard: D9, section 11.1, section 14, D15   evidence: Upstream `ProgrammaticCompilerOptions` is a type-only interface whose index value is `ProgrammaticCompilerOptionsValue`, and `encodeCompilerOptions` returns it via one assertion. Upstream `__test__/TsEnumCodec.assignability.test.ts` assigns that result to a structural `ts.CompilerOptions` replica and says a widening back to an unknown-valued record must fail that assignment. The port replaces the interface with `S.StructWithRest` whose rest is `S.Unknown` (`TsEnumCodec.ts:292`), returns the unrefined record (`TsEnumCodec.ts:335`), re-exports it as a value (`index.ts:41`), and rewrites `scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts:10` so the result only assigns to `ProgrammaticRecord`. README lines 117 and 161 still say a `ts.CompilerOptions`-typed API accepts that result with no cast. Ledger `deviations` and Port notes are empty.
- failure: The public type is no longer assignable to `ts.CompilerOptions`. Unknown passthrough such as `{ enabled: true }` is now part of the type, which the upstream replica rejects. The compile-time test that existed to catch this widening no longer does. D15 forbids bringing the assertion back, but the widening is an unrecorded deviation and the README still promises the old contract.
- fix: Keep the widened schema (unknown passthrough cannot inhabit `ProgrammaticCompilerOptionsValue` without an `as`). Record `law:D15` in the ledger and in README Port notes, citing `scratchpad/test/tsconfig-json/TsEnumCodec.assignability.test.ts`. Correct README lines 117 and 161 so they stop promising a no-cast `ts.CompilerOptions` assignment. List the new value export under Added exports.

### grok-1-2
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:50
- class: schema   severity: required
- standard: D5, operator step 4 (Identity), effect-laws-v1 law 19, schema-first `$I.annoteSchema`   evidence: `CompilerOptions.ts` never imports `$ScratchpadId`. Exported schemas `Target` (line 50), `Module`, `ModuleResolution`, `Jsx`, `NewLine`, `ModuleDetection`, `Lib`, and `CompilerOptions` (line 251), plus internal `IgnoreDeprecations` (line 232) and `PluginEntry` (line 239), have no identity annotation. Named literal domains are `S.Literals` inside `caseInsensitiveLiterals` (line 31), not `LiteralKit`.
- failure: Step 4 requires every schema to take its identity from the IdentityComposer. These exported literal domains are named schemas with no `$ScratchpadId` identity and no `LiteralKit` domain.
- fix: Add `$I` for this file. Build each named literal domain with `LiteralKit` inside the existing lowercasing `decodeTo` (`decode: (s) => s.toLowerCase()`), then `$I.annoteSchema` on every schema in the file, including `IgnoreDeprecations`, `PluginEntry`, and `CompilerOptions`. Do not drop the lowercasing transform.

### grok-1-3
- file: scratchpad/effected/tsconfig-json/TsconfigJson.ts:39
- class: schema   severity: required
- standard: D5, operator step 4 (Identity), effect-laws-v1 law 19   evidence: `$I` is applied only to `TsconfigParseError` (line 234). `WatchFile` (line 39), `WatchDirectory`, `FallbackPolling`, `Reference`, `WatchOptions`, `TypeAcquisition`, `TsconfigJson`, and `TsconfigJsonFromString` (line 224) are unannotated. The watch enums use the local `caseInsensitiveLiterals` helper (line 27) over `S.Literals`.
- failure: The document schemas and the three named watch literal domains have no IdentityComposer identity. `TsconfigParseError` is the only schema in the file that meets step 4.
- fix: Pass `LiteralKit` through the same lowercasing `decodeTo`, and `$I.annoteSchema` on `WatchFile`, `WatchDirectory`, `FallbackPolling`, `Reference`, `WatchOptions`, `TypeAcquisition`, `TsconfigJson`, and `TsconfigJsonFromString`. Leave the lowercasing transform in place.

### grok-1-4
- file: scratchpad/effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts:91
- class: schema   severity: required
- standard: D5, operator step 4 (Identity), schema-first `$I.annoteSchema`   evidence: The file does not import `$ScratchpadId`. `CompilerOptionsFromProgrammatic` is an exported codec with no identity annotation.
- failure: The programmatic codec is an exported schema with no IdentityComposer identity.
- fix: Create `$I` in this file and finish the codec with `$I.annoteSchema("CompilerOptionsFromProgrammatic", { description })`. Leave the decode and encode functions as they are.

### grok-1-5
- file: scratchpad/effected/tsconfig-json/CompilerOptions.ts:385
- class: bug   severity: required
- standard: D9, section 14, effect-tsgo `schemaNumber`   evidence: Upstream `CompilerOptions.ts:384` is `Schema.optionalKey(Schema.Number)`. The port is `S.optionalKey(S.Finite)` at line 385. `S.Finite` rejects `NaN`, `Infinity`, and `-Infinity`; `Schema.Number` accepts them. The schema-number rule text says to disable the diagnostic on that line when non-finite values are intentional. No ledger or Port notes deviation records this, and the upstream test only decodes `2`.
- failure: `decode(CompilerOptions)({ maxNodeModuleJsDepth: Number.POSITIVE_INFINITY })` and the same call with `NaN` succeed upstream and fail here. JSON cannot produce those values, so the upstream suite stays green while the accepted input set is narrower. The deviation is not recorded.
- fix: Restore `S.Number` and suppress `schemaNumber` on this field with the rule's own "non-finite is intentional" reason, so the upstream accepted set stays. If a suppression is refused under the all-rules-at-error gate, keep `S.Finite` and record `law:schemaNumber` in the ledger and README Port notes, citing `CompilerOptions.ts:385`.

REQUIRED: 5
BACKLOG: 0
