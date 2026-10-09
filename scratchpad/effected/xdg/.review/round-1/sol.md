### sol-1-1

- file: scratchpad/effected/xdg/AppDirs.ts:291
- class: law   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9 and §14; `standards/effect-laws-v1.md` short law 7 permits the necessary replacement of native `Error`, but §14 requires recording the resulting deviation.   evidence: A read-only probe built `AppDirs.layer({ namespace: "" })` against the pinned oracle and the port. Oracle output: `reason="Die", name="Error", tag=null`. Port output: `reason="Die", name="@beep/scratchpad/effected/xdg/AppDirs/AppDirsNamespaceError", tag="AppDirsNamespaceError"`. The message is unchanged. The adjusted assertion is at `scratchpad/test/xdg/AppDirs.test.ts:347`, while README *Port notes → Deviations* says `None` and the commit’s xdg ledger row has `deviations: []`.
- failure: The defect’s observable name and tag changed without the required deviation receipt. Passing the adjusted upstream test does not establish unchanged behavior.
- fix: Record the existing change as `law:7` in the xdg ledger and README deviations, explicitly preserving the defect channel and message and citing the adjusted namespace-guard assertion.

### sol-1-2

- file: scratchpad/effected/xdg/AppDirs.ts:45
- class: schema   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D5; `standards/effect-laws-v1.md` short law 19; `standards/effect-first-development.md` EF-12b.   evidence: `AppDirKind` is a named, exported, annotation-bearing literal domain built with `S.Literals` and reused by `AppDirsError.directory` and `makeDir`. `XdgPlatform` at `scratchpad/effected/xdg/Xdg.ts:21` likewise uses `S.Literals` and supplies the platform guard and native-directory decisions. These are not anonymous inline unions.
- failure: Both named domains bypass the explicitly required `LiteralKit` representation; the green gates have left these concrete schema-law violations in the reviewed source.
- fix: Replace the two `S.Literals(...)` constructors with `LiteralKit(...)` from `@beep/schema`, retaining their literals, identity annotations, export names, and derived types.

### sol-1-3

- file: scratchpad/effected/xdg/AppDirs.ts:289
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` short law 17; `standards/effect-first-development.md` EF-12b.   evidence: `badNamespace` owns the named application-namespace constraint through `namespace.length`, a regular-expression predicate, and explicit `"."`/`".."` comparisons. No schema represents that constraint; `AppDirsOptions.namespace` remains a plain string and the guard does not derive from `S.is(...)`.
- failure: Namespace validity is implemented as an ad-hoc validation helper rather than a schema-owned domain invariant, contrary to the schema-first rule for named or structurally validated concepts.
- fix: Introduce private, annotated string schemas/checks for the non-empty and single-component constraints and derive their guards with `S.is(...)`. Preserve the existing rejection set, distinct messages, and defect channel.

### sol-1-4

- file: scratchpad/effected/xdg/AppDirs.ts:34
- class: docs   severity: backlog
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D2, additions must be listed under *Port notes → Added exports*; documentation work is deferred by the review brief.   evidence: The port adds the exported `AppDirsNamespaceError` class, which does not exist in the pinned oracle. README lines 182–184 still state `Added exports: None`, and the xdg ledger row has `exportsAdded: []`.
- failure: The port’s addition inventory omits a newly exported error model, making its recorded API differences incomplete.
- fix: List `AppDirsNamespaceError` and its current `AppDirs.ts` export location in the README and corresponding ledger inventory.

### sol-1-5

- file: scratchpad/effected/xdg/AppDirs.ts:57
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` hard requirements and carrier policy; S2 is deferred by the review brief.   evidence: Public declarations throughout `AppDirs.ts`, `NativeDirs.ts`, `Xdg.ts`, and `XdgConfig.ts` retain forbidden `@remarks`/`@example` carriers and generally lack canonical `@category` and `@since 0.0.0`. For example, `AppDirsError` has `@remarks` and no Example, category, or since tag; the `AppDirs` example uses `@example` at line 309.
- failure: The carried documentation does not satisfy the required JSDoc grammar or value-export example requirements.
- fix: During S2, retain the upstream prose while converting carriers to the prescribed sections, adding canonical categories and since tags, and supplying useful examples for value-level exports.

### sol-1-6

- file: scratchpad/effected/xdg/XdgConfig.ts:118
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, examples must compile; S2 is deferred by the review brief.   evidence: The `savePath` example imports `XdgConfig`, `ConfigFile`, `JsonCodec`, and `MergeStrategy`, then references `AppConfig` and `AppShape` without defining or importing either.
- failure: The example cannot compile independently: `AppConfig` and `AppShape` are unresolved identifiers.
- fix: Define a minimal schema and matching `ConfigFile.Service` inside the example before constructing the layer, retaining the demonstrated `defaultPath: XdgConfig.savePath(...)` integration.

### sol-1-7

- file: scratchpad/effected/xdg/README.md:53
- class: docs   severity: backlog
- standard: `standards/effect-laws-v1.md` short law 2 and AGENTS.md, dedicated Effect imports apply to Markdown examples; documentation work is deferred by the review brief.   evidence: The quick-start example imports `{ Effect, Layer } from "effect"`. The config example repeats the root-barrel pattern at line 99, and the testing example repeats it at line 138.
- failure: The adapted README teaches import forms explicitly forbidden by the repository’s documentation policy.
- fix: Rewrite those README imports to dedicated module paths with the prescribed aliases, preserving each example’s behavior.

### sol-1-8

- file: scratchpad/test/xdg/XdgConfig.test.ts:78
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; `.patterns/testing-patterns.md`, assertions by value; port goal §11.2. S3 is deferred by the review brief.   evidence: Resolver tests compare Option containers through `assert.deepStrictEqual(found, O.some(...))` and test absence with `assert.isTrue(O.isNone(found))`. `NativeDirs.test.ts` and `AppDirs.test.ts` also use predicate assertions followed by `O.getOrThrow`. No xdg test imports `@effect/vitest/utils`.
- failure: Option assertions bypass the canonical variant-and-payload helpers required by the test contract.
- fix: Use `assertSome(value, expectedPayload)` and `assertNone(value)` for Option results, keeping ordinary assertions for the extracted plain values.

### sol-1-9

- file: scratchpad/test/xdg/Xdg.test.ts:14
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D14; port goal §11.2 requires `it.layer` for effectful layers. S3 is deferred by the review brief.   evidence: `env(...)` includes `Xdg.layer`, which reads configuration during acquisition, but tests supply it through per-test `Effect.provide`. `AppDirs.test.ts` and `XdgConfig.test.ts` similarly provide effectful application/filesystem layer graphs directly. All three files carry `strictEffectProvide:skip-file`.
- failure: These effectful fixtures remain outside the canonical runner-owned layer pattern; the file-wide diagnostic skips leave that migration unchecked.
- fix: Move effectful fixtures into `it.layer` blocks, using separate blocks where environment values, fault handlers, or mutable volumes differ. Retain per-test provision for pure stubs and remove the skips once the migration passes.

### sol-1-10

- file: scratchpad/test/xdg/Xdg.test.ts:16
- class: test   severity: backlog
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D10 and §11.4; S3 is deferred by the review brief.   evidence: Searching all four committed xdg test files for `Arbitrary`, `.prop(`, `fcRuns`, and `@beep/fc-runs` returns no matches. The module exports runtime schemas including `AppDirKind`, `XdgPlatform`, `XdgPaths`, `NativeDirs`, and `ResolvedAppDirs`.
- failure: The required per-schema encode/decode round-trip property floor has no implementation; the existing example tests do not provide that proof.
- fix: Add `it.effect.prop` round-trip tests using `Arbitrary.schema` for the exported schemas and the mandated `fcRuns(...)` run-count policy, preserving the upstream example suites.

REQUIRED: 3
BACKLOG: 7