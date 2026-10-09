### fable-1-1
- file: scratchpad/effected/git/internal/run.ts:29
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-14; standards/effect-laws-v1.md law 22; standing rule: functions returning effect generators use Effect.fn/fnUntraced   evidence: runCollected is an exported, reused function (Git.ts:616, run.ts:67) whose body is Effect.scoped(Effect.gen(function* () {...})). The effect-fn gate is green only because its scanner matches a direct Effect.gen return (packages/tooling/tool/cli/src/commands/Laws/EffectFn.ts:227-242 getDirectReturnOwner); the Effect.scoped wrapper hides the generator from it. Effect.fn in installed 4.0.2 accepts trailing pipeline functions (fn.Traced overloads with a: (_: Effect<...>) => A).
- failure: The module's one spawn primitive carries no span and sits outside the beep Effect.fn idiom every other reusable generator in the lab follows; the gate cannot see it.
- fix: export const runCollected = Effect.fn("runCollected")(function* (command: ChildProcess.Command) { ...same body... }, Effect.scoped); signature and available() unchanged.

### fable-1-2
- file: scratchpad/effected/git/GitCommand.ts:308
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 19; AGENTS.md Code Laws (named LiteralKit internal domains); standards/schema-first-development-prompt.md (LiteralKit for a reusable discriminator domain)   evidence: export type GitConfigScope = "local" | "global" | "system" | "worktree" is a hand-rolled, named, exported literal domain referenced by name in scopeArgs (:311) and four Git.ts option bags (:2433, :3269, :4115, :4426). No gate checks LiteralKit adoption (gates: tsgo, oxlint, effect-imports, effect-fn, terse-effect, native-runtime).
- failure: No runtime guard, no annotations, no .is/.Enum; the scope domain cannot be validated at the service boundary or exported to JSON Schema.
- fix: const $I = $ScratchpadId.create("effected/git/GitCommand"); export const GitConfigScope = LiteralKit(["local","global","system","worktree"]).annotate($I.annote("GitConfigScope", { description: ... })); export type GitConfigScope = typeof GitConfigScope.Type; drop the `type` modifier on the index.ts:35 re-export; record the value export under README Added exports and ledger exportsAdded (D2).

### fable-1-3
- file: scratchpad/effected/git/Gitmodules.ts:98
- class: law   severity: required
- standard: standards/effect-laws-v1.md laws 17 and 19; standards/schema-first-development-prompt.md (prefer LiteralKit .is over duplicate literal arrays and literal predicates); AGENTS.md (derived S.is guards over ad-hoc predicate helpers)   evidence: IGNORE_VALUES = ["all","dirty","untracked","none"] as const (:98) duplicates the ignore field's S.Literals([...]) (:51) verbatim, and :206 IGNORE_VALUES.find((candidate) => candidate === folded) is a hand-rolled literal guard.
- failure: Two copies of one domain can drift silently; the guard is not derived from the schema that defines the field.
- fix: const SubmoduleIgnore = LiteralKit(["all","dirty","untracked","none"]); field ignore: S.optionalKey(SubmoduleIgnore).annotateKey(...); replace :205-208 with `if (!S.is(SubmoduleIgnore)(folded)) return Result.fail(invalid("ignore", ignoreRaw)); ignore = folded;` and delete IGNORE_VALUES.

### fable-1-4
- file: scratchpad/effected/git/internal/config.ts:25
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 19; standards/schema-first-development-prompt.md (duplicate literal arrays)   evidence: RawDiagnosticCode (:25-31) is a named six-literal union repeated verbatim as GitConfigDiagnostic.code: S.Literals([...]) at GitConfig.ts:41-48; the GitConfig.ts:32 JSDoc names a `GitConfigErrorCode` union that does not exist anywhere.
- failure: The scanner's diagnostic vocabulary and the public schema's vocabulary are maintained in two places with no type link; adding a code to one side does not fail the other.
- fix: In internal/config.ts: export const GitConfigDiagnosticCode = LiteralKit([...the six codes...]); export type RawDiagnosticCode = typeof GitConfigDiagnosticCode.Type; (the file still imports nothing from GitConfig.ts, so the :5 no-cycle note holds). In GitConfig.ts: code: GitConfigDiagnosticCode.annotateKey({...}).

### fable-1-5
- file: scratchpad/effected/git/Git.ts-E:1
- class: law   severity: required
- standard: scratchpad/EFFECTED_PORT_GOAL.md section 5.1 (only packages/<m>/src/**/*.ts maps into the lab); standards/effect-laws-v1.md law 2 (no root `effect` barrel anywhere in the lab)   evidence: A tracked 172,512-byte stray editor artifact (git ls-files lists it; the upstream oracle carries the same accident) duplicating Git.ts with `import {...} from "effect"` (:1) and `@effected/git` identifiers (:4109, :4169, :4268). Its extension matches no gate glob: tsconfig include ./**/*.ts, oxlint/laws **/*.ts, the runner's isTsFile (scratchpad/effected/runner/Copy.ts:182) — so every gate is green while the file sits inside the surface.
- failure: A stale duplicate of the module's largest file lives beside it unscanned; rg/graft/reviewers get double hits and a codemod or fix lane can edit the wrong copy.
- fix: git rm scratchpad/effected/git/Git.ts-E (it is not a D4 documentation surface; nothing references it).

### fable-1-6
- file: scratchpad/effected/git/README.md:170
- class: docs   severity: backlog
- standard: scratchpad/EFFECTED_PORT_GOAL.md section 10.3 Attribution (vendored-engine notices only)   evidence: Lines 170-171 read `scratchpad/effected/git/GitConfig.ts:23 * derived from the offset.` and `scratchpad/effected/git/internal/config.ts:5 // Never exported from the package...`: scanVendorNotices (scratchpad/effected/runner/Knowledge.ts:132-141) matched ordinary header prose; git vendors no engine.
- failure: The attribution block asserts two non-existent third-party notices.
- fix: Delete the two bullets; tighten the NOTICE pattern in the runner (outside this surface) so prose containing `derived from` / `Never exported` is not a notice.

### fable-1-7
- file: scratchpad/effected/git/README.md:3
- class: docs   severity: backlog
- standard: scratchpad/EFFECTED_PORT_GOAL.md section 10.3 README adaptation   evidence: npm/License/Node/TypeScript badges (:3-6), the pre-1.0 stability block (:10-19), the pnpm-plugin-effect reference (:14), `## Install` (:34) and `@effected/git` imports in every example remain verbatim.
- failure: README is still the npm page, not the lab adaptation; examples import a package that does not exist in the lab.
- fix: Apply the section 10.3 removals and rewrite example imports to `@beep/scratchpad/effected/git/index` during S2.

### fable-1-8
- file: scratchpad/effected/git/README.md:177
- class: docs   severity: backlog
- standard: D9 / section 14 deviation protocol; operator ruling 2026-10-09 (one codemod-generated ledger+README entry per systemic class)   evidence: README Deviations says `None` and ledger row w1-git has deviations: [], yet three systemic classes are live: identity keys (JSON Schema definition key changed; upstream assertion adjusted at scratchpad/test/git/Gitmodules.test.ts:294 to `definitions.@beep/scratchpad/effected/git/Gitmodules/GitmodulesEntryEncoded...`), S.Finite for S.Number (GitConfig.ts:52-58, :145-147, :170-172), and the tagged GitConfigInvariantError (GitConfig.ts:256-278) replacing `throw new Error` (the defect's class is observable).
- failure: A reviewer cannot distinguish recorded from unrecorded deviations, so later rounds will re-raise them.
- fix: Land the three codemod-generated entries in the ledger `deviations` and README Port notes -> Deviations, naming the sites and the adjusted test.

### fable-1-9
- file: scratchpad/effected/git/GitConfig.ts:325
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (`@example` retired; examples with relative imports are never markable); EFFECTED_PORT_GOAL section 10.2   evidence: The `@example` fence imports `from "./index.ts"`; the proven lab shape is `@beep/scratchpad/effected/<m>/index` (scratchpad/effected/jsonl/Journal.ts:114).
- failure: docgen/doctest cannot compile or mark the example once S2 runs.
- fix: Convert to `**Example** (Parse, read and edit a remote)` importing `@beep/scratchpad/effected/git/index` in S2.

### fable-1-10
- file: scratchpad/effected/git/GitCommand.ts:10
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (`@remarks` forbidden; `**Example** (Title)` canonical); EFFECTED_PORT_GOAL section 10.2   evidence: `@remarks` carriers: 45 in GitCommand.ts, 9 in GitConfig.ts, 6 in Gitmodules.ts, 1 in internal/run.ts; `@example` x4 and `@public` tags in GitConfig.ts; no `@category` or `@since` on any export.
- failure: docgen with enforceDescriptions/enforceExamples/enforceVersion fails at S2 (expected; S2 has not run).
- fix: S2 mechanical conversion to **Details** / **Gotchas** / **Example** (Title) plus @category and @since 0.0.0 on every export.

### fable-1-11
- file: scratchpad/effected/git/internal/run.ts:68
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form)   evidence: `Effect.map(() => true)` where `Effect.as` exists in installed 4.0.2 (node_modules/effect/dist/Effect.d.ts:3822).
- failure: Cosmetic only; behaviour identical.
- fix: Effect.as(true).

### fable-1-12
- file: scratchpad/effected/git/Gitmodules.ts:225
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21   evidence: Five consecutive single-key `...O.getSomesStruct({...})` spreads (:225-229) where one call over all five keys suffices; :180 keeps the hand-rolled `...(value !== null ? { value } : {})` beside them.
- failure: Cosmetic; mixed idioms inside one constructor call.
- fix: One `...O.getSomesStruct({ branch: O.fromUndefinedOr(branch), shallow: O.fromUndefinedOr(shallow), update: O.fromUndefinedOr(update), ignore: O.fromUndefinedOr(ignore), fetchRecurseSubmodules: O.fromUndefinedOr(fetchRecurse) })`; :180 -> `...O.getSomesStruct({ value: O.fromNullable(value) })`.

### fable-1-13
- file: scratchpad/effected/git/GitConfig.ts:52
- class: schema   severity: backlog
- standard: standards/schema-first-development-prompt.md (Precision carries invariants: integral numbers, ranges)   evidence: offset/length/line/character (and the GitConfigEntry/GitConfigSection spans at :145-147, :170-172) are non-negative integers by construction yet typed S.Finite; installed 4.0.2 has S.Int (Schema.d.ts:6123) and S.isGreaterThanOrEqualTo (:5998), no NonNegativeInt.
- failure: Decode admits -1 and 1.5 spans that the scanner can never produce.
- fix: S.Int.check(S.isGreaterThanOrEqualTo(0)) on the six span fields; it narrows accepted input, so write the D9 ledger deviation entry first.

### fable-1-14
- file: scratchpad/effected/git/Gitmodules.ts:90
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 13 (schema transformations over ad-hoc parsing)   evidence: parseBool hand-parses git's boolean vocabulary (true/yes/on/1, false/no/off/0, bare key) and signals failure with undefined; it is consumed twice (:198, :216).
- failure: The vocabulary is not a schema, so it cannot be reused by field decoding, annotated, or exported.
- fix: A GitBoolean codec (`S.Literals([...]).pipe(S.decodeTo(S.Boolean, ...))`, lowercase folded on the way in) consumed via S.decodeUnknownResult in fromConfigResult.

### fable-1-15
- file: scratchpad/effected/git/internal/config.ts:103
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 17 (named domain constraints modeled as schemas; guards derived with S.is)   evidence: isValidKey (:103) and isValidSectionName (:106) are bare regex predicates for the named git-config key and section-name domains; Gitmodules.ts:34 already uses the S.String.check(S.isPattern(...)) shape for the same kind of constraint.
- failure: The constraints cannot annotate GitConfigEditError, be reused as schema fields, or be exported.
- fix: const GitConfigKey = S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9-]*$/)); export const isValidKey = S.is(GitConfigKey); same for section names.

### fable-1-16
- file: scratchpad/test/git/GitConfig.test.ts:10
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5/D10; scratchpad/EFFECTED_PORT_GOAL.md sections 11.2 and 11.4   evidence: Sync `it` with hand-rolled ok/failure Result unwrappers (:10-24), `assert.deepStrictEqual(opt, O.some(x))` instead of assertSome, and no Arbitrary.schema round-trip property for GitConfig*, Gitmodules* or the Gitmodules.FromString codec (same shape in Gitmodules.test.ts).
- failure: S3 property floor and canon assertions are absent (expected; S3 has not run).
- fix: S3 canon migration plus a scratchpad/test/git/Properties.test.ts covering every exported schema and the codec with fcRuns(n).

REQUIRED: 5
BACKLOG: 11
