### sol-2-1
- file: scratchpad/effected/cli/CliRuntime.ts:741
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14’s verified-upstream-bug exception; `CliRuntime.reportFailures` documents rendering a failure and re-failing with a marked error that preserves the chosen exit code.   evidence: A read-only `bun --no-cache -e` probe ran both the port and the pinned oracle with `Effect.fail({ toString() { throw thrown; } })`, `reportFailures({ exitCode: 23 })`, and a capturing logger. Both wrote `[FAIL] [unprintable value]`, then returned `Die(thrown)` with `Runtime.getErrorReported(...) === true` and exit code `1`. The green suite misses the contract failure because `scratchpad/test/cli/CliRuntime.coverage.test.ts:26` explicitly expects this secondary defect.
- failure: After successfully rendering the fallback diagnostic, `reported` performs an unguarded second string conversion. An unprintable failure therefore replaces the original failure with a new defect, loses the requested exit code, and remains eligible for the platform runtime’s duplicate report.
- fix: Guard conversion of non-Error values in `reported`; on conversion failure, construct the existing `CliRuntimeError` with a fixed fallback message, then apply both runtime marks. Retarget the existing regression to require a marked typed failure, `errorReported === false`, and the requested exit code. Record the verified upstream bug under §14.

### sol-2-2
- file: scratchpad/effected/cli/CliLinks.ts:32
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/effect-first-development.md EF-12b; standards/effect-laws-v1.md laws 17 and 19.   evidence: `EditorLinks` is an erased four-member literal union. Lines 91–94 separately enumerate its members in `MODES` and implement membership through `find`. The named domain, enumeration, and runtime parser are independent declarations; there is no schema or LiteralKit for this domain. This semantic modeling requirement is not established by the four green mechanical laws.
- failure: A named, reused, runtime-validated literal domain lacks the required annotation-bearing schema source of truth. Its public type, accepted settings, and warning vocabulary can drift independently.
- fix: Define an identity-annotated `EditorLinks` LiteralKit with the existing member order, derive the type from it, and derive enumeration and membership from the kit. Preserve the existing trim/case normalization, defaults, and warning text; list the added value export under D2.

### sol-2-3
- file: scratchpad/effected/cli/CliTest.ts:18
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33.   evidence: `Sandbox` at line 18, `RunOptions` at line 37, and `RunResult` at line 63 are handwritten interfaces containing only strings, numbers, records, optional fields, and another plain-data model. `sandbox` and `run` return plain objects at lines 139 and 192. These are executable input/result payloads, including the explicitly documented “what a spawned bin did, as data”; they are neither service contracts nor type-level machinery. No corresponding schemas exist.
- failure: The subprocess helper’s configuration and result models remain outside the required schema contract. Their runtime validation, metadata, codecs, and schema-derived arbitraries cannot be derived from a source of truth despite all mechanical gates passing.
- fix: Define identity-annotated structural schemas for `Sandbox`, `RunOptions`, and `RunResult`, and derive the existing types. Preserve plain-object results, optional-key semantics, and subprocess behavior. Register the added value exports and add the D10 round-trip properties.

### sol-2-4
- file: scratchpad/effected/cli/CliLog.ts:182
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/effect-first-development.md EF-12b and EF-33.   evidence: `CliLogFile` is a named, handwritten union of `{ envVar: string }` and `{ path: string }`, reused by `CliLogFileOptions.file` and interpreted at lines 623–628. It is a plain configuration payload with runtime case selection, and has no executable schema. The green syntax and diagnostic gates do not establish schema ownership of this payload.
- failure: The two file-sink configuration cases have only an erased TypeScript contract. Runtime decoding, case schemas, identity metadata, and schema-derived generation are unavailable for this named model.
- fix: Define an identity-annotated union of structural schemas for the existing `envVar` and `path` forms and derive `CliLogFile` from it. Preserve the public object shapes, current branch precedence, and unset/empty-variable behavior. Register the added schema export and its D10 properties.

### sol-2-5
- file: scratchpad/effected/cli/CliPrompt.ts:21
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/effect-first-development.md EF-12b and EF-33.   evidence: `CliPromptTarget` is a named, handwritten payload union of `{ flag: string }` and `{ argument: string }`. It is reused in `CliPromptFallbackOptions<A>` and passed to `answerWithoutPerson` to choose the missing-parameter error. Both target variants are directly representable by structural schemas, but no target schema exists. The generic `otherwise` value does not prevent schema ownership of this non-generic target model.
- failure: The missing-parameter target domain is modeled only through an erased declaration, so its variants, metadata, validation, and generated test data have no executable schema source of truth.
- fix: Define an identity-annotated structural union for the existing flag and argument forms, derive `CliPromptTarget`, and retain the generic fallback-options composition. Preserve public keys and missing-parameter behavior; register the added value export and add the D10 target properties.

REQUIRED: 5
BACKLOG: 0