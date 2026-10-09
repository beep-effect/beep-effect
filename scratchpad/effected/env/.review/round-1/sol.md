### sol-1-1

- file: scratchpad/effected/env/internal/osc8/env.ts:23
- class: bug   severity: required
- standard: D11; standards/effect-first-development.md EF-18   evidence: The overload declares `(spec?: TruthySpec) => (value: string | undefined) => boolean`, but the `dual` predicate selects the data-first implementation for every call with at least one argument. A read-only Bun probe assigned `envIsTruthy` to that declared data-last function type: `typeof dataLast("no-color")` printed `boolean`, and `dataLast("no-color")("0")` threw `TypeError`. Both the pinned upstream and the port correctly returned `true` for the existing direct call `envIsTruthy("0", "no-color")`. The retained tests exercise only direct calls, so their green result misses this added overload.
- failure: The declared data-last form with an explicit specification returns a boolean instead of a function. It cannot be composed as its type promises. Arity cannot distinguish a specification string from the existing one-argument environment-value call.
- fix: Narrow the added data-last overload to `(): (value: string | undefined) => boolean`, which the current dispatch actually implements. Preserve both upstream direct forms. Add a regression test for the retained zero-argument curried form.

### sol-1-2

- file: scratchpad/effected/env/Audience.ts:17
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/effect-laws-v1.md laws 17 and 19; standards/effect-first-development.md EF-12b   evidence: `AudienceKind` is a handwritten literal union, and line 45 separately repeats its members in `KINDS` for validation. The same missing schema modeling occurs for `CiName` in `RuntimeEnv.ts:33`, `ColorLevel` in `ColorLevel.ts:6`, `TruthySpec` in `internal/osc8/env.ts:12`, `Osc8Reason` in `internal/osc8/detect.ts:14`, and `KnownTerminal` in `internal/osc8/terminals.ts:6`. `RuntimeEnv.ts:53` repeats the named `CiName` domain in an anonymous `Schema.Literals` declaration. The module’s recorded deviations and backlog are empty.
- failure: Named, reused finite domains lack the required `LiteralKit` schema source of truth. Audience membership and CI schema membership are maintained independently of their named types, instead of deriving types and guards from one definition. Green compilation and upstream examples do not establish this schema-law requirement.
- fix: Define identity-annotated `LiteralKit` values for these domains and derive their same-name types. Derive audience membership and the warning’s member list from `AudienceKind`; reuse `CiName` in `RuntimeEnv.ci`. Preserve existing accepted inputs and output strings, and record added runtime exports and the law-driven changes under D2/D9.

### sol-1-3

- file: scratchpad/effected/env/TerminalEnv.ts:23
- class: schema   severity: required
- standard: D11; standards/ARCHITECTURE.md §5, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md, “Schema owns pure data”   evidence: `StreamEnv` is a pure capability snapshot represented only by an interface. Other pure payloads also remain interface-only: `Osc8Capabilities` and `IdentifyResult` in `internal/osc8/terminals.ts:33` and `:45`, `WrapperInfo` in `internal/osc8/wrappers.ts:5`, and `ProcessSnapshot` and `Osc8Detection` in `internal/osc8/detect.ts:57` and `:160`. These declarations contain data rather than service operations or type-level machinery.
- failure: These payloads have no schema source from which runtime validation, codecs, equivalence, or arbitraries can be derived, contrary to the binding schema-first requirement. The interface declarations disappear at runtime; the existing green gates do not supply the missing models.
- fix: Introduce named, identity-annotated schemas and derive the existing structural types from them. Preserve the current plain-object representation, null/Option semantics, and accepted values; use the documented `S.Struct` boundary exception where introducing class instances would alter upstream behavior. Keep behavioral service contracts and overload machinery as interfaces where appropriate.

### sol-1-4

- file: scratchpad/effected/env/RuntimeEnv.ts:8
- class: law   severity: required
- standard: D11; standards/effect-laws-v1.md law 1; standards/effect-first-development.md EF-4   evidence: The exact reviewed source imports `effect/Schema` as `Schema` and uses that alias throughout the implementation. Law 1 explicitly requires `import * as S from "effect/Schema"`. This concrete violation remains in the supplied green commit, demonstrating that the reported gates missed this alias requirement.
- failure: The production implementation violates the required canonical Schema import alias.
- fix: Rename the namespace import to `S` and update implementation references. Rename the helper’s generic type parameter if needed to avoid shadowing the namespace.

### sol-1-5

- file: scratchpad/effected/env/Audience.ts:50
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md, “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; EFFECTED_PORT_GOAL.md §10; operator’s S2 deferral   evidence: This block retains `@remarks` and `@example`. The same legacy carriers remain throughout the module. Exported declarations lack canonical `@category` and `@since 0.0.0`; runtime exports such as `RuntimeEnv` and `EnvOverride` lack the required titled Example sections.
- failure: The documentation does not yet satisfy the required carrier grammar, metadata, and example coverage. This belongs to the deferred S2 work.
- fix: Convert the carried prose into Details/Gotchas and titled Example sections, retain upstream behavioral explanations, add canonical categories and versions, and supply compilable examples for runtime exports.

### sol-1-6

- file: scratchpad/effected/env/README.md:46
- class: docs   severity: backlog
- standard: standards/effect-laws-v1.md law 2; AGENTS.md Code Laws; operator’s documentation deferral   evidence: The quick-start examples import `{ Effect, Layer }`, `{ Effect }`, and `{ Layer, Option }` from the root `"effect"` barrel at lines 46, 66, and 80. Law 2 explicitly includes Markdown examples.
- failure: The README teaches import forms forbidden by the port’s binding import convention.
- fix: Rewrite the examples to dedicated Effect module namespace imports, updating `Option` references to `O`, while preserving the examples’ behavior.

### sol-1-7

- file: scratchpad/test/env/RuntimeEnv.test.ts:21
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5; EFFECTED_PORT_GOAL.md §11.2; operator’s S3 deferral   evidence: This effect test compares Options with `assert.deepStrictEqual(..., O.some(...))`. The module contains repeated structural Option assertions and combined `O.isNone` boolean assertions, including `RuntimeEnv.test.ts:36`, instead of the required specialized helpers.
- failure: Option assertions do not follow the pinned test canon or provide its variant-specific assertion and narrowing behavior. This belongs to deferred S3 work.
- fix: Use `assertSome` and `assertNone` from `@effect/vitest/utils` for Option assertions. Retain ordinary assertions for plain values.

### sol-1-8

- file: scratchpad/test/env/Audience.test.ts:32
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14; EFFECTED_PORT_GOAL.md §11.2; operator’s S3 deferral   evidence: `audienceFrom` provides `Audience.layer(...)` and `CurrentRuntimeEnv.layer` inside individual tests. Both production layers use `Layer.effect`. Similar per-test provision occurs for effectful `TerminalEnv` and `CurrentRuntimeEnv.layerFrom` layers.
- failure: Effectful layer construction remains under per-test `Effect.provide`, while D14 requires `it.layer` for these layers. This belongs to deferred S3 work.
- fix: Move effectful layer setup into `it.layer` groups, separating configurations as necessary. Retain per-test provision for pure `Layer.succeed` stubs and preserve tests that intentionally compare layer memoization behavior.

### sol-1-9

- file: scratchpad/test/env/RuntimeEnv.test.ts:71
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10 and §11.4; operator’s S3 property-floor deferral   evidence: `RuntimeEnv` encode/decode tests cover selected snapshots and frozen wire literals. The env test surface contains no property registrations, `Arbitrary.schema` use, or `fcRuns` use for this exported schema.
- failure: The exported `RuntimeEnv` schema lacks the required generated encode/decode round-trip property. Example-based wire compatibility tests do not fulfill D10.
- fix: Retain every frozen literal and example test, then add an `it.effect.prop` round-trip property using `Arbitrary.schema(RuntimeEnv)` and `fcRuns(n)`, asserting that decoding the encoded value succeeds and preserves the value.

REQUIRED: 4
BACKLOG: 5