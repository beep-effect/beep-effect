# xdg round-3 merged inventory

Read all three seats (`grok.md`, `sol.md`, `fable.md`), shared `BRIEF.md`, and
`BRIEF.grok3.md`. There are no part subdirectories. Five submitted findings
remain five records after deduplication: **2 required, 3 backlog, 0 handled by
the deviation codemod, 0 rejected; 2 required groups**.

Review target: `3ad7b305790c7f0903f6d55766c55186745ba2d1`. The live checkout is
`@lab/effected-2` at `9f73185dd8517933985c39c9a3ba6f9765480185`, rather than the
requested `@lab/effected`; xdg source and tests have no diff from the review
target. The pinned upstream oracle is revision
`af7566a9da2eff169cb74955efcc5ede1e5de9f8` in the local upstream cache.

Disposition follows the entire operator revision block, D1–D20, sections 12.5
and 14, and this assignment's deferral of docs, JSDoc, coverage, and vitest-canon
work. The briefs' S2/S3 completion claims do not override that deferral. The
current `standards/effect-laws.allowlist.jsonc` has **zero entries** for
`scratchpad/effected/xdg/**`, so there are no `allow-<n>` findings.

Per-file `git log --format=%h:%s -- <file>` and `git log --all` recovered the
pre-squash history. The diff for step-2 commit `e8fcdf5884` proves that
`Effect.asSome` replaced `Effect.map(..., Option.some)` to clear diagnostics;
S1/law commit `47cb8e678b` proves the tagged namespace error replaced a native
error. Neither change is an unforced divergence to restore. Round-2 commit
`97b97980e3` changed only `detectPlatform` in `Xdg.ts`; the new `splitDirs`
finding is a separate site. No submitted finding requests new bookkeeping for
those forced changes, and previous-round codemod records are not counted again.

Required groups own one source file each and no test edits. Existing
`AppDirs.test.ts:413` validates the absent-runtime result, and
`Xdg.test.ts:179–215` plus `Xdg.property.test.ts:47–57` validate splitting,
fallback, and order. These are validation surfaces, not required write surfaces.
No tests, gates, scratch-copy diagnostics, cache-refresh commands, or
closeout/ledger commands were run during this merge.

## Required

### grok-3-1 — Use the dedicated successful-None effect

- file: scratchpad/effected/xdg/AppDirs.ts:507
- class: effect-idiom   severity: required
- standard: D11; configured tsgo `preferSucceedSomeOrNone` (`tsconfig.base.json:193`, error-level TS377117).   evidence: The branch is `Effect.succeed(O.none<string>())`. The reference rule's `isOptionNoneCall` at `internal/rules/prefer_succeed_some_or_none.go:124–131` explicitly rejects calls with type arguments, while `AnalyzePreferSucceedSomeOrNone:59–79` relies on that predicate. Thus the seat shows why the green gate misses this equivalent form. The seat cites `Effect.succeedNone`'s `Effect<Option<never>>` type and the covariant Effect/Option parameters establishing compatibility with `Effect<Option<string>, AppDirsError>`.
- failure: The absent-runtime branch retains the noncanonical successful-None construction targeted by the configured diagnostic; its explicit type argument bypasses detection. No wrong runtime result is claimed.
- fix: Replace only `Effect.succeed(O.none<string>())` with `Effect.succeedNone`. Preserve the `Effect.asSome` branch, error channel, directory paths, and `AppDirs.ensureRuntime` span. Retain all upstream test lines; no test edit is needed.
- seats: grok-3-1
- disposition: Normalize the seat's `tsgo` class to `effect-idiom`: this is a demonstrated detector blind spot, not a diagnostic emitted by a new run. The rule-backed fix is required under D11. The broader round-2 `transposeOption` suggestion remains backlog. Group `g1` owns only `AppDirs.ts`.

### fable-3-1 — Match the empty/non-empty search-path array

- file: scratchpad/effected/xdg/Xdg.ts:203
- class: law   severity: required
- standard: D11; `standards/effect-laws-v1.md:23`, authoritative short law 12; `standards/effect-first-development.md` EF-7 for the array-specific replacement.   evidence: `splitDirs` returns `parts.length === 0 ? fallback : parts`. The law requires helper-based Boolean branching in runtime code. `packages/tooling/tool/cli/test/terse-effect.test.ts:591–624` explicitly expects clean results for broad Boolean ternary/if shapes, so a green terse-effect gate does not enforce this site. The earlier required platform-branch finding was fixed separately by `97b97980e3`.
- failure: The search-path fallback still violates the mandatory branching law at a site outside gate coverage. The current returned values are correct; the defect is law compliance.
- fix: Import `effect/Array` as `A` and replace the final length ternary with `A.match(parts, { onEmpty: () => fallback, onNonEmpty: () => parts })`. Keep the `raw === undefined` fallback, empty-entry filtering, exact defaults, and original array/order semantics. Retain all upstream test lines; no test edit is needed.
- seats: fable-3-1
- disposition: The seat demonstrates the green gate's blind spot. EF-7 supplies the specialized array helper rather than a general Boolean match. Group `g2` owns only `Xdg.ts`.

## Backlog

### grok-3-2 — Consider namespace validation in the native resolver

- file: scratchpad/effected/xdg/XdgConfig.ts:37; scratchpad/effected/xdg/AppDirs.ts:417
- class: bug   severity: backlog
- standard: D9; section 14's inherited-bug deviation protocol; D11; required write-surface boundary.   evidence: `nativeResolver` passes `options.namespace` directly to `NativeDirs.resolve`, while `AppDirs.layer` invokes `badNamespace` and dies with `AppDirsNamespaceError`. The seat traces darwin's `path.join(home, "Library", "Application Support", "..")` normalization to the parent `Library` directory and then to `/home/ada/Library/rc.json`. The pinned oracle has the same unchecked native-resolver call. README.md:102 describes the namespace restriction for layer construction, not an independently verified native-resolver contract.
- failure: The native resolver can probe outside its application's directory for a namespace such as `..`, unlike `AppDirs.layer`. This is inherited behavior, not an unforced lab divergence; the report does not supply section 14's failing property or specification citation authorizing a behavior change.
- fix: In a separately verified upstream-bug wave, establish and centrally record the native-resolver namespace contract, then share `badNamespace` or its schema validation within xdg and die with `AppDirsNamespaceError` before native resolution. Add invalid-namespace regressions in `XdgConfig.test.ts`; preserve Linux's `None` result and the resolver's `never` error channel. Central ownership must handle any ledger and README Port-notes records.
- seats: grok-3-2
- disposition: Retain the seat's backlog severity. The prerequisite repository-level ledger change is **outside the port's write surface**; no local required group may own it. Do not expand this final fix wave into a new inherited behavior change without the section 14 evidence.

### sol-3-1 — Describe provider failures for optional environment variables

- file: scratchpad/effected/xdg/Xdg.ts:100; scratchpad/effected/xdg/Xdg.ts:118; scratchpad/effected/xdg/Xdg.ts:213
- class: docs   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` Purpose; D9; assignment's docs/JSDoc deferral.   evidence: The seat reports read-only probes against both lab and pinned oracle: a provider supplies valid HOME and then raises `ConfigProvider.SourceError`; both fail with `XdgEnvError`, `variable: "XDG_CONFIG_HOME"`, and `causeTag: "ConfigError"`. `Xdg.ts:263–280` maps residual optional-variable provider errors rather than swallowing them. Prose at lines 100 and 213 says HOME is the only failure, and line 118 describes the variable only as required and missing. Docgen compilation does not verify these claims.
- failure: The documentation understates the existing error channel for custom or filesystem-backed providers. Runtime behavior matches upstream.
- fix: Qualify both prose statements: missing or empty HOME fails, absent optional variables use defaults, and provider failures for any variable propagate as `XdgEnvError`. Describe the `variable` field and its annotation as the variable whose lookup failed. Preserve error types, messages, and runtime behavior.
- seats: sol-3-1
- disposition: Deferred documentation/JSDoc work under this assignment, even though the seat demonstrates a prose inaccuracy outside docgen's checks.

### fable-3-2 — Execute the present-runtime ensureRuntime branch in a test

- file: scratchpad/test/xdg/AppDirs.test.ts:413; scratchpad/effected/xdg/AppDirs.ts:508
- class: test   severity: backlog
- standard: D11; `goals/effect-vitest-canon/SPEC.md` meaningful assertions; assignment's coverage/vitest-canon deferral.   evidence: The existing `ensureRuntime` case supplies no runtime directory and asserts `None`. The present-runtime case at `AppDirs.test.ts:395` executes `appDirs.ensure`, which calls `makeDir` directly. Constructing `Effect.asSome(makeDir("runtime", runtimeDir))` during layer construction can mark its source line covered without executing `ensureRuntime`; the seat shows a missing execution assertion, not an incorrect result.
- failure: The suite does not directly pin the successful `ensureRuntime` result or its mkdir behavior when a runtime directory exists. Source-line coverage alone cannot establish that contract.
- fix: Add a case with a runtime directory that executes `ensureRuntime`, asserts `Some` of the namespaced path with `assertSome`, and asserts that this is the only mkdir recorded. Keep the existing `None` case and upstream assertions unchanged.
- seats: fable-3-2
- disposition: Deferred test-strengthening/coverage work. It is not a demonstrated implementation bug and requires no test edit in the current required groups.

## Handled by the deviation codemod

None in the round-3 reports. Historical diagnostic/law-forced changes remain
eligible for central bookkeeping; they are not new findings in this inventory.
No group owns PORT_LEDGER.json, README Port notes, package manifests, lockfiles,
or repository configuration.

## Rejected

None. Every submitted finding supplies evidence and a concrete fix. Both
required findings explain the relevant gate blind spot; the other three are
retained as backlog under the assignment and section 14. No finding conflicts
with an operator ruling.
