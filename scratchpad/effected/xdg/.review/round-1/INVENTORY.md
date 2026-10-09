# xdg — round-1 merged inventory

Read all three seat reports (`grok.md`: 10 records, `sol.md`: 10, `fable.md`: 14) and their shared `BRIEF.md`; no `part-N` reports exist. Review target: `3fa5876691901fccf3d1cd29e9324564df134b56`; pinned oracle: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` in the brief’s immutable cache. The live checkout is on `@lab/effected`.

Binding inputs: the complete operator revision/rulings/grilling block, D1–D20, sections 12.4–12.5 and 14, and `standards/effect-laws.allowlist.jsonc`. There are **zero xdg allowlist entries**, so no `allow-<n>` replacements are synthesized. No reported unforced lab/oracle divergence was established; the documented tagged-error and identity differences are law-forced.

Merged counts: **Required 8 · Backlog 12 · Handled by deviation codemod 3 · Rejected 0 · Groups 1**. These are deduplicated defect/disposition counts, not sums of the seats’ footer counts. Composite records are split where their fixes have different dispositions; every contributing finding id is retained on a `seats:` line. Evidence from seat probes is attributed to the seat, not claimed as newly executed here. The merger independently checked the named standards and the primary XDG specification; no build/test/docgen gates were run or altered.

Required group `g1` owns two source files (`AppDirs.ts`, `Xdg.ts`) and three test files (`AppDirs.test.ts`, `Xdg.test.ts`, `XdgConfig.test.ts`). Shared source/test ownership forces these findings into one group. All writes assigned by `required.json` are within the xdg source/test surfaces; no config, ledger, README Port notes or sibling module is assigned. Only this inventory and `required.json` are written by this merge task.

## Required

### grok-1-1 — Empty environment bases produce relative application directories

- file: scratchpad/effected/xdg/Xdg.ts:177
- class: bug   severity: required
- standard: D9, D11, section 14 (upstream-bug); XDG Base Directory Specification v0.8, sections 2–3.   evidence: grok traces Config.String accepting an empty string, read retaining it via O.getOrUndefined, and the conditional spreads at Xdg.ts:193–199 preserving it. Path.join skips empty segments, so AppDirs.ts:233 joins an empty base to the namespace as a relative path. splitDirs already treats empty search-path variables as absent. The [primary specification](https://specifications.freedesktop.org/basedir/latest/) confirms that empty XDG_DATA_HOME, XDG_CONFIG_HOME, XDG_STATE_HOME and XDG_CACHE_HOME use the unset-variable behavior, and XDG paths must be absolute. The oracle shares the hole; its tests omit these empty inputs.
- failure: Empty home-directory variables and XDG_RUNTIME_DIR become cwd-relative application paths; an empty required HOME also makes fallback paths relative.
- fix: Normalize only environment-loaded empty optional directory strings to absence in read; reject empty HOME with the existing XdgEnvError. Add individual empty-value cases to Xdg.test.ts and an application-resolution regression to AppDirs.test.ts. Preserve the existing absent-key resolution ladder, the defect/error channels, and explicit layerFrom inputs; do not insert new ~/.config defaults into Xdg.layer. This is a spec-supported upstream-bug deviation; its receipt is produced centrally, outside this group.
- seats: grok-1-1

### fable-1-1 — Named literal domains must use LiteralKit

- file: scratchpad/effected/xdg/Xdg.ts:21; scratchpad/effected/xdg/AppDirs.ts:45
- class: schema   severity: required
- standard: D5, D11; standards/effect-laws-v1.md short law 19; standards/effect-first-development.md EF-12b; AGENTS.md named literal domains.   evidence: XdgPlatform and AppDirKind are exported, annotation-bearing S.Literals values reused as named types, S.is(XdgPlatform), AppDirsError.directory and makeDir.kind. fable and sol identify the precise reuse sites; grok confirms none of the four green laws checks this named-domain requirement.
- failure: Both named schemas bypass the LiteralKit representation required by the binding standard.
- fix: Replace both constructors with LiteralKit from @beep/schema/LiteralKit. Retain every literal, export name, derived type, identity annotation and whole-domain guard; use an annotation form that preserves the kit statics, and do not add as const to inline arrays. Add kit-surface checks in the corresponding Xdg/AppDirs tests while retaining upstream behavior cases.
- seats: grok-1-2, grok-1-3, sol-1-2, fable-1-1
- disposition: One systemic root cause across two files; all four contributing records are merged.

### grok-1-4 — Cause schemas drop stack traces during encoding

- file: scratchpad/effected/xdg/Xdg.ts:80; scratchpad/effected/xdg/AppDirs.ts:72
- class: schema   severity: required
- standard: D11; standards/effect-first-development.md tagged-error template: cause-carrying errors explicitly declare S.Defect({ includeStack: true }).   evidence: XdgEnvError.cause and AppDirsError.cause use S.Defect() without options. grok cites Effect Schema.ts:9296–9298: the default encoded defect omits the stack. The current AppDirs.test.ts:322 checks the live Error and cannot detect this encoding loss. The cited repository template explicitly requires includeStack.
- failure: Encoding and decoding a cause-carrying error loses the original cause stack.
- fix: Use S.Defect({ includeStack: true }) for both cause fields. Add encode/decode checks with explicit cause-stack fixtures in Xdg.test.ts and AppDirs.test.ts; preserve tags, messages and live-cause behavior. Any law-forced wire-shape receipt is handled centrally.
- seats: grok-1-4

### fable-1-4 — Application namespace constraints need schema-derived guards

- file: scratchpad/effected/xdg/AppDirs.ts:289
- class: schema   severity: required
- standard: D11; standards/effect-laws-v1.md short laws 17–18; standards/effect-first-development.md EF-12b, EF-12c and EF-35; D9.   evidence: badNamespace implements the named, documented single-path-component constraint with namespace.length, a slash/backslash regex, and dot/dot-dot comparisons. fable cites the repeated documentation and upstream pins at AppDirs.test.ts:351–356; sol independently identifies the missing schema-owned invariant.
- failure: The named namespace domain is represented only by an ad-hoc predicate.
- fix: Introduce private identity-annotated schemas/checks for non-empty and single-component strings, with identifier/title/description on reusable checks, and derive guards through S.is. Preserve the exact rejection set, both existing message strings, the Effect.die channel and the plain-string public input. Keep every upstream namespace assertion; extend only if a schema-boundary regression needs a pin.
- seats: grok-1-6, sol-1-3, fable-1-4
- disposition: grok labelled this backlog, but the independently evidenced named-domain violation falls within D11 and short law 17.

### fable-1-2 — File-wide directives hide strictEffectProvide diagnostics

- file: scratchpad/test/xdg/AppDirs.test.ts:1; scratchpad/test/xdg/Xdg.test.ts:1; scratchpad/test/xdg/XdgConfig.test.ts:1
- class: tsgo   severity: required
- standard: D11; operator Green step; tsconfig.base.json strictEffectProvide:error; cited Quality.command.ts:465–490 directive-exemption policy.   evidence: fable identifies strictEffectProvide:skip-file at the top of three included test files, traces its introduction to 7f67982f77, and counts 7 + 9 + 13 = 29 Layer provision sites. It cites the rule implementation (strict_effect_provide.go:49–72) and the lab runner having no directive check. The single admitted repository path is outside xdg. This is concrete evidence that the green tsgo gate missed the suppressed rule.
- failure: The test surface suppresses diagnostics instead of satisfying the configured error rule.
- fix: Remove the three directives and clear the exposed diagnostics within those tests. Build effectful graphs with Effect.scopedWith plus Layer.buildWithScope and provide the acquired Context via Effect.provideContext (or an equivalent correctly scoped Layer.build); use Effect.provideService for platform-only stubs where appropriate. Preserve all upstream cases, assertions and ordering. Do not modify tsconfig, the runner or any repository configuration. The separate it.layer canon migration remains backlog for S3.
- seats: fable-1-2
- disposition: Required gate-miss finding, distinct from the S3 runner/canon migration; its fix does not depend on it.layer.

### fable-1-3 — Public pure-data options need schema-owned definitions

- file: scratchpad/effected/xdg/AppDirs.ts:121; scratchpad/effected/xdg/AppDirs.ts:144
- class: schema   severity: required
- standard: D5, D11; standards/effect-first-development.md EF-33 and EF-12b; standards/schema-first-development-prompt.md, Schema owns pure data; D2 and D9.   evidence: AppDirOverrides contains five optional strings and AppDirsOptions contains namespace/native/fallbackDir/dirs; neither has effects or methods. Both are exported interfaces consumed by resolution functions. fable distinguishes AppDirsShape as the service port and notes that the exported-interface scanner does not cover scratchpad.
- failure: Named configuration data has parallel interface types without runtime schemas, identity metadata or schema-derived types.
- fix: Define exported identity-annotated S.Struct values for AppDirOverrides and AppDirsOptions, preserving optional-key semantics and field descriptions, and derive the same-named types from them. Keep the public namespace field unbranded, plain object calls accepted, and namespace rejection in its existing defect channel. Leave AppDirsShape as a service interface. Add focused input-schema checks in AppDirs.test.ts; central bookkeeping records the new value exports.
- seats: fable-1-3

### fable-1-10 — Use Bool.match for the native-directory Boolean branch

- file: scratchpad/effected/xdg/AppDirs.ts:246
- class: effect-idiom   severity: required
- standard: D11; standards/effect-laws-v1.md authoritative short law 12: use Bool.match for Boolean branching in domain/runtime orchestration code.   evidence: fable identifies options.native === true ? NativeDirs.resolve(...) : O.none<NativeDirs>() in the domain resolution path. The four gated laws do not check Boolean branching. Although EF-7b uses preference wording, the authoritative short law is imperative.
- failure: This domain branch violates short law 12.
- fix: Import effect/Boolean as Bool and replace the ternary with Bool.match(options.native ?? false, { onTrue: () => NativeDirs.resolve(the same arguments), onFalse: () => O.none<NativeDirs>() }). Preserve true-only activation and all existing native/non-native test behavior.
- seats: fable-1-10
- disposition: Promoted from the seat’s backlog label because the cited authoritative law places this concrete violation inside D11.

### fable-1-9-field — Annotate the namespace-error message field

- file: scratchpad/effected/xdg/AppDirs.ts:36
- class: schema   severity: required
- standard: Operator revision step 4: identity with annotations on fields and schemas; D5 and D11.   evidence: fable-1-9 identifies AppDirsNamespaceError.message as the sole field in the module lacking annotateKey({ description }). The step-4 field-annotation requirement is explicit, independent of the optional annoteError preference in the same record.
- failure: An exported tagged-error field lacks the field annotation required before round 1.
- fix: Add a meaningful description through S.String.annotateKey on AppDirsNamespaceError.message. Preserve the field type, both rejection messages, tag and defect channel. Do not require an annoteError migration to satisfy this finding.
- seats: fable-1-9
- disposition: Split the concrete missing field annotation from the consistency-only error annotation helper suggestion (b10).

## Backlog

### b1 — Convert carried JSDoc grammar during S2

- file: scratchpad/effected/xdg/Xdg.ts:14; scratchpad/effected/xdg/AppDirs.ts:57; scratchpad/effected/xdg/NativeDirs.ts; scratchpad/effected/xdg/XdgConfig.ts; scratchpad/effected/xdg/index.ts:8
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md; goal section 10.2; operator S2 deferral.   evidence: grok and sol identify retained @remarks/@example/@public carriers, missing canonical category/since metadata and value examples. fable identifies mixed carriers and the namespace-error example’s ./AppDirs.ts import.
- failure: The documentation carriers and examples do not yet meet the final JSDoc grammar.
- fix: In S2, preserve every carried upstream sentence, convert carriers to titled Example/Details sections, supply canonical metadata and useful compilable examples. Use the module entry in examples only for symbols actually exported there; the optional barrel addition is b7.
- seats: grok-1-7, sol-1-5, fable-1-13
- disposition: Deferred docs/JSDoc work; S2 has not run.

### b2 — Make the savePath integration example self-contained

- file: scratchpad/effected/xdg/XdgConfig.ts:118
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md compiling examples; operator S2 deferral.   evidence: The example imports XdgConfig/ConfigFile/JsonCodec/MergeStrategy but refers to AppConfig and AppShape without declarations or imports; grok and sol cite this exact unresolved-example defect.
- failure: The example cannot compile independently.
- fix: During S2, define a minimal schema and matching ConfigFile.Service in the example, retaining the defaultPath: XdgConfig.savePath(...) integration and dedicated Effect imports.
- seats: grok-1-7, sol-1-6
- disposition: Specific example defect, separate from carrier conversion; deferred to S2.

### b3 — Adapt the carried README to the lab during S2

- file: scratchpad/effected/xdg/README.md:3; scratchpad/effected/xdg/README.md:51
- class: docs   severity: backlog
- standard: Goal section 10.3; short law 2; D13; operator S2 deferral.   evidence: grok identifies badges, the pre-1.0/install material, pnpm-plugin-effect paragraph and Schema.Number example. sol and fable identify root-effect and @effected/* imports at README.md:51–53, 97–99 and 136–138.
- failure: The carried README still teaches upstream installation and forbidden lab import forms.
- fix: In S2, drop release/install boilerplate, adapt examples to lab-relative and dedicated effect/* imports, and use the intended finite-number schema where appropriate while preserving API prose. Errors-table and Port-notes bookkeeping belongs to the central codemod entries below.
- seats: grok-1-8, sol-1-7, fable-1-14
- disposition: README adaptation is deferred docs work; bookkeeping portions are split out below.

### b4 — Use canonical Option assertion helpers in S3

- file: scratchpad/test/xdg/XdgConfig.test.ts:78; scratchpad/test/xdg/NativeDirs.test.ts:33; scratchpad/test/xdg/AppDirs.test.ts:297
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5; goal section 11.2; operator S3 deferral.   evidence: sol cites deep equality with O.some and O.isNone predicates; grok cites O.isSome/O.getOrThrow/O.isNone pairs. None of the four test files imports the canon helpers.
- failure: Option assertions do not yet use the canonical variant-and-payload helpers.
- fix: During S3, use assertSome(value, expectedPayload) and assertNone(value), preserving the exact upstream payload and absence assertions.
- seats: grok-1-9, sol-1-8
- disposition: Deferred vitest-canon work.

### b5 — Move effectful test fixtures into runner-owned layers in S3

- file: scratchpad/test/xdg/Xdg.test.ts:14; scratchpad/test/xdg/AppDirs.test.ts:67; scratchpad/test/xdg/XdgConfig.test.ts
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14; goal section 11.2; operator S3 deferral.   evidence: sol traces env(...) to acquisition through Xdg.layer and identifies varying environment/fault/volume fixtures; grok cites per-test Path, memory filesystem and Xdg layer provision.
- failure: Effectful fixtures remain outside the canon it.layer ownership pattern.
- fix: During S3, migrate to it.layer blocks, separating blocks when environments, fault handlers or mutable volumes differ; preserve oracle cases and isolation. Do not share mutable volumes across cases unless the runner lifecycle preserves their existing isolation. The present suppression repair is separately required under fable-1-2.
- seats: grok-1-9, sol-1-9
- disposition: Deferred vitest-canon migration, not merged with the distinct diagnostic-suppression defect.

### b6 — Add the exported-schema property floor in S3

- file: scratchpad/test/xdg/Xdg.test.ts:16; scratchpad/test/xdg/AppDirs.test.ts; scratchpad/test/xdg/NativeDirs.test.ts
- class: test   severity: backlog
- standard: D10; goal section 11.4; operator S3/property-floor deferral.   evidence: sol’s search of all four committed tests finds no Arbitrary, .prop, fcRuns or @beep/fc-runs. grok names missing round trips for XdgPaths, ResolvedAppDirs, NativeDirs, XdgPlatform and AppDirKind plus splitDirs/native-resolution properties.
- failure: The schema/codec property floor is absent from the current example-only tests.
- fix: During S3, add Arbitrary.schema encode/decode round trips with the required fcRuns policy for exported schemas, including runtime option schemas added by fable-1-3, and suitable resolution/parsing properties. Retain all upstream example suites.
- seats: grok-1-10, sol-1-10
- disposition: Deferred coverage/property-floor work.

### b7 — Consider exposing the namespace defect through the barrel

- file: scratchpad/effected/xdg/index.ts:11
- class: effect-idiom   severity: backlog
- standard: D2 superset rule and D11; D2 requires upstream exports and recording additions, not a barrel re-export of every new internal export.   evidence: fable and grok identify export class AppDirsNamespaceError in AppDirs.ts and its absence from index.ts; the test imports it directly from AppDirs.ts. No missing upstream export or changed defect behavior is shown.
- failure: Barrel consumers lack a direct named constructor import for this added defect; this is an API convenience gap, not a demonstrated D2 violation.
- fix: If adopted later, add the index.ts re-export and move the test import to index.ts. Keep its existing exported-class inventory in the central added-exports codemod regardless of the barrel decision.
- seats: grok-1-5, fable-1-5
- disposition: Reclassified outside D11: the cited D2 rule does not force this barrel addition. No required group owns index.ts.

### b8 — Prefer Effect helpers or a schema boundary for search-path parsing

- file: scratchpad/effected/xdg/Xdg.ts:132
- class: effect-idiom   severity: backlog
- standard: Short laws 13 and 21 (preferences); standards/effect-first-development.md EF-5 and EF-34; D11.   evidence: fable cites raw.split(":").filter(...) plus inline defaults in splitDirs, called for both search-path variables; Xdg.test.ts:81–119 pins the unchanged behavior.
- failure: Search-path normalization remains hand-written and uses native helper methods; no bug, measured regression or mandatory boundary change is demonstrated.
- fix: Consider the behavior-preserving minimal A.filter(Str.split(raw, ":"), Str.isNonEmpty) form, or a local schema transformation retaining the exact absent/empty defaults. Keep this outside the required fix wave.
- seats: fable-1-7
- disposition: Preference-only improvement outside D11.

### b9 — Qualify the savePath trace span

- file: scratchpad/effected/xdg/XdgConfig.ts:49
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-14 naming guidance; D11.   evidence: fable identifies Effect.fn("savePath") while the adjacent module spans use AppDirs.<member>. The effect-fn conversion itself is law-forced.
- failure: The emitted span lacks a module prefix; no correctness or required diagnostic failure is shown.
- fix: Consider Effect.fn("XdgConfig.savePath") as a tracing naming improvement.
- seats: fable-1-8
- disposition: Naming guidance, not a demonstrated mandatory-law or correctness defect.

### b10 — Consider the declaration-typed error annotation helper

- file: scratchpad/effected/xdg/Xdg.ts:81; scratchpad/effected/xdg/AppDirs.ts:37; scratchpad/effected/xdg/AppDirs.ts:73
- class: effect-idiom   severity: backlog
- standard: D11; identity package annoteError API and earlier-port consistency; .patterns/error-handling.md already permits annote.   evidence: fable identifies $I.annote rather than $I.annoteError<Self> on three tagged errors and explicitly notes that the error-handling pattern shows annote.
- failure: The annotation-helper choice differs from other modules without a binding requirement or behavior bug.
- fix: Consider annoteError<Self> if a concrete benefit warrants the consistency change; the missing message-field annotation is separately required as fable-1-9-field.
- seats: fable-1-9
- disposition: Preference-only portion split from the mandatory step-4 field annotation.

### b11 — Prefer effect/Array for directory mapping helpers

- file: scratchpad/effected/xdg/AppDirs.ts:242; scratchpad/effected/xdg/XdgConfig.ts:20
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-5 and AGENTS.md helper preferences; D11.   evidence: fable identifies systemDirs.map(...) and appDirs.dirs.configSearchPath.map(...); native-runtime does not cover these array methods, and no changed output is shown.
- failure: Two native mapping helpers remain; this preference has no measured regression or correctness evidence.
- fix: Consider A.map with the same path.join callbacks and order, importing effect/Array as A.
- seats: fable-1-11
- disposition: Preference-only helper replacement outside D11.

### b12 — Keep optional-path compatibility until any promotion decision

- file: scratchpad/effected/xdg/Xdg.ts:106; scratchpad/effected/xdg/AppDirs.ts:102
- class: schema   severity: backlog
- standard: EF-17 preference; short law 20 boundary compatibility carve-out; D9 and section 14; later operator ruling forbids unforced port drift.   evidence: fable identifies seven optional XdgPaths fields plus ResolvedAppDirs.runtime and cites oracle absent-key assertions at Xdg.test.ts:48–50 and AppDirs.test.ts:175. The seat explicitly says the optional bag is allowed at this boundary and Option would change the public shape.
- failure: Nullish handling is distributed, but the current boundary shape preserves the upstream contract and is permitted.
- fix: Retain the upstream optional-key representation in this wave. Revisit Option-valued public fields only as a separately authorized promotion/API design with a forcing cause; do not rewrite upstream tests or treat a recorded preference as permission for port drift. Any proposed Port-notes entry is outside this inventory’s assignment.
- seats: fable-1-12
- disposition: Outside D11. The proposed current-port Option deviation is not admitted; only the future design question remains backlog.

## Handled by the deviation codemod

### codemod-tagged-errors — Record law-forced tagged-error deviations centrally

- file: scratchpad/effected/xdg/AppDirs.ts:289; scratchpad/test/xdg/AppDirs.test.ts:347
- class: law   severity: backlog
- standard: D9 and section 14, superseded for bookkeeping by the later 2026-10-09 operator per-module/per-class codemod ruling.   evidence: sol supplies an oracle/port probe: both defects use Die and retain the same message, but the oracle has name Error and no tag while the port has the identity-qualified AppDirsNamespaceError name/tag. The upstream instanceOf(Error) assertion was adjusted at AppDirs.test.ts:347; the existing records still say no deviations.
- failure: The law-forced native-error replacement and adjusted test are absent from the central deviation record; no evidence shows the replacement itself is wrong.
- fix: The central codemod writes one module tagged-error-class ledger/README deviation entry naming the source site and adjusted test, preserving defect channel and messages. Include any additional law-forced error encoding change from grok-1-4 in the appropriate systemic record. Do not assign ledger or README Port-notes edits to a local fix group.
- seats: grok-1-5, sol-1-1, fable-1-6
- disposition: Handled centrally; severity backlog denotes non-required bookkeeping, not a local backlog assignment.

### codemod-identity-keys — Record law-forced identity-key changes centrally

- file: scratchpad/effected/xdg/Xdg.ts:61; scratchpad/effected/xdg/Xdg.ts:76; scratchpad/effected/xdg/Xdg.ts:102; scratchpad/effected/xdg/Xdg.ts:149; scratchpad/effected/xdg/AppDirs.ts:66; scratchpad/effected/xdg/AppDirs.ts:84; scratchpad/effected/xdg/AppDirs.ts:328; scratchpad/effected/xdg/NativeDirs.ts:19
- class: law   severity: backlog
- standard: D5 step 4; D9; later operator per-module/per-class deviation codemod ruling.   evidence: fable lists the schema/service/reference sites whose ids moved to the $I composer; grok identifies identity-qualified error names replacing upstream short names and the moved service keys. README/ledger records still claim no deviations.
- failure: The forced identity-derived schema/error/service key changes have no systemic deviation receipt.
- fix: The central codemod writes one identity-key-class deviation entry listing the sites, JSON Schema/identifier/name differences and any adjusted upstream tests. Preserve tag/message behavior; there is no required local record-writing change.
- seats: grok-1-5, fable-1-6
- disposition: Bookkeeping only; do not undo the law-forced identity change.

### codemod-added-exports — Inventory added exports and matching error documentation centrally

- file: scratchpad/effected/xdg/AppDirs.ts:34; scratchpad/effected/xdg/README.md:182
- class: docs   severity: backlog
- standard: D2; later operator ruling: added exports go to exportsAdded through the central codemod.   evidence: sol, grok and fable identify the new AppDirsNamespaceError export while Added exports and exportsAdded say none. fable additionally identifies the stale README Errors table and native-error prose. fable-1-3 will add runtime schema values for the two existing option type names.
- failure: The recorded addition inventory and associated error documentation do not reflect law-forced exported models.
- fix: The central codemod records AppDirsNamespaceError and, after fable-1-3, the AppDirOverrides/AppDirsOptions value additions with their correct kinds and locations. It handles README added-export/deviation/error-table bookkeeping. The optional barrel re-export is b7 and is not required by this record.
- seats: grok-1-5, sol-1-4, fable-1-5, fable-1-6, fable-1-14
- disposition: Split from substantive schema fixes and the non-required barrel suggestion; no local bookkeeping write surface.

## Rejected

None. Every reported defect has evidence and a concrete fix; non-required suggestions are classified above. The green-gate rejection rule does not remove `fable-1-2`, which supplies a concrete gate miss.
