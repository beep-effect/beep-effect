# xdg — round-2 merged inventory

Read all three seats (`grok.md`, `sol.md`, `fable.md`) and their shared `BRIEF.md`;
there are no part subdirectories. Review target: `a12bef261998d2ad92153dada46373be06950692`.
17 reported findings become 16 records after deduplication: **1 required, 14 backlog,
1 handled by the deviation codemod, 0 rejected; 1 required group**.

The live checkout is `@lab/effected-2` at `d859bbb583cb93239781137b5c7aa0637141ed19`,
rather than the requested `@lab/effected`. The tracked xdg source and tests have no
diff from the review target. The current `standards/effect-laws.allowlist.jsonc`
contains **zero entries** for `scratchpad/effected/xdg/**`; no `allow-<n>` finding
is needed. No gates, tests, scratch-copy diagnostics, or ledger commands were run.

Disposition follows the full operator revision block, D1–D20, sections 12.5 and
14, and this merge assignment's docs/coverage/canon deferral. The reports' claims
that S2/S3 ran do not override that deferral. Historical inspection used per-file
`git log --format=%h:%s -- <file>` and `git log --all` to recover pre-squash commits,
then read the step-2 and law diffs: `7f67982f77`, `e8fcdf5884`, `35f64403cf`,
`03bf79d41b`, `47cb8e678b`, and the round-1 fix `f03214a75c`. These establish the
diagnostic-forced helper/guard changes and native-error replacement; the latter
and its added export are not candidates for upstream restoration. `d34abedf9c`
attributes the assertion-helper rewrites to the S3 canon migration, whose merits
remain backlog here. None of the submitted findings establishes an unforced
public/runtime divergence requiring restoration.

## Required

### fable-2-2 — Decode the platform schema instead of branching on its guard

- file: scratchpad/effected/xdg/Xdg.ts:62
- class: effect-idiom   severity: required
- standard: D11; `standards/effect-laws-v1.md` authoritative short law 12; short law 13 supports a schema-based fallback.   evidence: `detectPlatform` returns `S.is(XdgPlatform)(platform) ? platform : "linux"`. This is a Boolean branch in runtime code. The seat identifies that the four green law gates and the configured tsgo checks do not enforce this branch; round 1 treated the same mandatory law at `AppDirs.resolveAll` as required. `Xdg.coverage.test.ts:20–33` already pins absent process, unknown platform, and darwin.
- failure: The platform default thunk still violates the mandatory Boolean-branching law; green diagnostics do not establish compliance with this ungated law.
- fix: Replace the return with `O.getOrElse(S.decodeUnknownOption(XdgPlatform)(platform), () => "linux")`. Keep the platform domain, default thunk, and existing behavior assertions unchanged. `O` and `S` are already imported. Only `Xdg.ts` must change; the existing coverage test is validation, not an assigned test edit.
- seats: fable-2-2

## Backlog

### grok-2-1 — Preserve literal empty strings in the environment regression fixtures

- file: scratchpad/test/xdg/Xdg.test.ts:22; scratchpad/test/xdg/AppDirs.test.ts:160
- class: test   severity: backlog
- standard: D9; section 14; section 11.4; D11 and the assignment's test/coverage deferral.   evidence: Both fixtures call `ConfigProvider.fromUnknown` without `preserveEmptyStrings`. The Effect reference `ConfigProvider.ts:798–801,844–850` confirms that this defaults to false and converts `""` to a missing node. Consequently the optional-directory and empty-HOME cases at `Xdg.test.ts:99–120` and the application-resolution case at `AppDirs.test.ts:157–179` never deliver empty values to the implementation's normalization. `f03214a75c` introduced the normalization and these regression cases together.
- failure: The tests cannot distinguish empty-value normalization from provider-level absence. No present runtime defect is shown; the claim is insufficient regression strength.
- fix: Add `{ preserveEmptyStrings: true }` to `fromUnknown` in the `env` helper and in the empty-environment application-resolution fixture. Preserve the existing absent-key, typed `XdgEnvError`, fallback, runtime, and darwin assertions, and leave unrelated search-path and `layerFrom` cases unchanged.
- seats: grok-2-1, grok-2-2
- disposition: Deduplicated by the shared provider-default root cause across two files; test-strengthening/coverage work stays backlog.

### grok-2-3 — Assert complete Windows native-directory Option payloads

- file: scratchpad/test/xdg/NativeDirs.test.ts:55; scratchpad/test/xdg/NativeDirs.test.ts:66; scratchpad/test/xdg/NativeDirs.test.ts:79
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; section 11.2; assignment's vitest-canon deferral.   evidence: These Windows cases unwrap with `O.getOrThrow` and assert fields individually; the darwin case already uses `assertSome` with a complete `NativeDirs` payload. The reported EV006 detector does not cover this form.
- failure: A `None` result throws during unwrapping and the expected variant/payload is not asserted together; no incorrect runtime result is established.
- fix: Replace the three unwrap-and-field sequences with `assertSome(native, NativeDirs.make({ ... }))`, retaining every existing expected path string.
- seats: grok-2-3
- disposition: Deferred vitest-canon work.

### grok-2-4 — Use the finite-number schema in the README configuration example

- file: scratchpad/effected/xdg/README.md:75
- class: docs   severity: backlog
- standard: Operator numeric-domains ruling; tsgo `schema-number`; assignment's docs deferral.   evidence: The README still shows `port: S.Number`, while the corresponding save-path fixture uses `S.Finite` at `XdgConfig.test.ts:198`. The README fence is outside the cited JSDoc docgen check.
- failure: The example teaches a broader numeric domain than the adapted integration fixture.
- fix: Change the example field to `port: S.Finite`. Leave README Port notes and central numeric-domain bookkeeping to the deviation codemod.
- seats: grok-2-4
- disposition: A substantive example edit, not merely a request to record a forced change; deferred documentation work.

### sol-2-1 — Give the explicit fallback a path distinct from the default floor

- file: scratchpad/test/xdg/AppDirs.test.ts:266
- class: test   severity: backlog
- standard: D11; optional test strengthening.   evidence: The fallback-precedence case uses `namespace: "myapp"` and `fallbackDir: ".myapp"`, making the explicit fallback and default dot-directory produce identical paths at `AppDirs.ts:340–341`. The decoded `".fallback"` option elsewhere is not resolved. This blind spot is inherited from the pinned oracle.
- failure: Removing explicit-fallback precedence could leave the current assertions satisfied; no implementation bug is shown.
- fix: Retain the upstream cases and add a resolution case with `namespace: "myapp"`, `fallbackDir: ".other"`, and no higher-precedence inputs. Assert `/home/ada/.other` for config, data, cache, and state.
- seats: sol-2-1
- disposition: Outside D11's required definition; regression-strengthening backlog.

### fable-2-3 — Consider match-based native-platform dispatch

- file: scratchpad/effected/xdg/NativeDirs.ts:89
- class: effect-idiom   severity: backlog
- standard: AGENTS.md preference for match helpers; short laws 19 and 21; D11.   evidence: `NativeDirs.resolve` uses sequential darwin/win32 equality branches and returns `O.none()` for other platforms despite the `XdgPlatform` LiteralKit surface.
- failure: The dispatch does not use the preferred match idiom; no incorrect result, diagnostic, or mandatory exhaustiveness failure is demonstrated.
- fix: If adopted, use `Match.value(platform)` with darwin and win32 cases building the same `NativeDirs` payloads and an `O.none()` fallback; import `effect/Match`. Keep all native-directory expectations unchanged.
- seats: fable-2-3
- disposition: Preference-only improvement outside D11.

### fable-2-4 — Consider Option helpers for optional runtime-directory plumbing

- file: scratchpad/effected/xdg/AppDirs.ts:505; scratchpad/effected/xdg/AppDirs.ts:373; scratchpad/effected/xdg/AppDirs.ts:524
- class: effect-idiom   severity: backlog
- standard: Short law 21; `standards/effect-first-development.md` EF-5; D11.   evidence: Runtime-directory selection and creation use undefined checks and ternaries. The seat identifies `Effect.transposeOption` as a shorter equivalent for `ensureRuntime`; the `Effect.asSome` form itself was forced by step-2 commit `e8fcdf5884`.
- failure: Optional-value plumbing remains explicit; there is no demonstrated behavior bug or measured performance regression.
- fix: If adopted, map `O.fromNullable(dirs.runtime)` through `makeDir` and transpose it for `ensureRuntime`; use `O.orElse`/`O.getOrUndefined` for runtime selection and `Effect.forEach` over the optional runtime for `ensure`. Preserve the current span, paths, error mapping, and runtime absence semantics.
- seats: fable-2-4
- disposition: Preference-only improvement; do not restore a diagnostic-forced helper form.

### fable-2-5 — Consider one built-in namespace-component pattern

- file: scratchpad/effected/xdg/AppDirs.ts:401
- class: schema   severity: backlog
- standard: Short law 17's preference for built-in checks before custom filters; D11.   evidence: `NamespaceComponent` combines a separator-exclusion pattern with an `S.makeFilter` rejecting exactly `.` and `..`; the seat supplies an equivalent combined pattern and identifies the accepted newline cases at `AppDirs.test.ts:501`.
- failure: Two checks express one component constraint; no incorrect accepted input or mandatory-law violation is shown.
- fix: If adopted, use `S.isPattern(/^(?!\.\.?$)[^/\\]*$/)` with identifier, title, and description metadata. Keep `NonEmptyNamespace`, both `badNamespace` messages, and all current acceptance/rejection cases unchanged.
- seats: fable-2-5
- disposition: Preference-only consolidation outside D11.

### fable-2-6 — Put synchronous global-stubbing coverage in the appropriate test runner

- file: scratchpad/test/xdg/Xdg.coverage.test.ts:22
- class: test   severity: backlog
- standard: Effect resource-finalization idioms; vitest-canon D14; assignment's coverage/canon deferral.   evidence: The process-stubbing case is an `it.effect` generator with no yields and JS `try/finally` cleanup. The cited `tryCatchInEffectGen` rule covers catch blocks, so the report does not establish a missed diagnostic.
- failure: A synchronous assertion uses an Effect runner without Effect work; cleanup remains plain JS rather than an Effect finalizer.
- fix: Use plain `it` with the existing `try/finally`, or wrap the assertions in `Effect.sync` and add `Effect.ensuring(Effect.sync(() => vi.unstubAllGlobals()))`. Preserve all three platform assertions and cleanup on failure.
- seats: fable-2-6
- disposition: Deferred coverage/vitest-canon work.

### fable-2-7 — Avoid self-referential expected causes in failure assertions

- file: scratchpad/test/xdg/Xdg.test.ts:79; scratchpad/test/xdg/AppDirs.test.ts:470
- class: test   severity: backlog
- standard: Vitest-canon meaningful assertion guidance; `assertExitFailure` expected-Cause contract; assignment's canon deferral.   evidence: Both calls pass the exit's own extracted cause as its expected cause. Commit `d34abedf9c` replaced the oracle Option-presence/unwrapping assertions with this canon helper and retained the subsequent fail/die reason assertions.
- failure: Cause equality is tautological, although failure narrowing and the subsequent reason checks still assert the relevant behavior. No changed runtime contract or lost fail/die check is established.
- fix: Use `assert(Exit.isFailure(exit))` and retain the subsequent `exit.cause.reasons` assertions; remove unused `assertExitFailure` imports.
- seats: fable-2-7
- disposition: Deferred assertion/canon quality; historical evidence does not support a required runtime restoration.

### fable-2-8 — Remove upstream installation prose from the lab README

- file: scratchpad/effected/xdg/README.md:12
- class: docs   severity: backlog
- standard: Section 10.3; D13; assignment's docs deferral.   evidence: Lines 12–14 retain exports-map/CJS installation guidance and tell readers to install `@effected/walker` and `@effected/config-file` peers, whereas lab implementation imports use relative sibling modules.
- failure: The README's installation instructions do not describe the lab checkout.
- fix: Delete the two installation paragraphs at lines 12–14; preserve the FileSystem/Path provision paragraph and the carried API prose.
- seats: fable-2-8 (report heading: scratchpad/effected/xdg/README.md:12)
- disposition: Normalized the seat's missing numbered id to fable-2-8; deferred documentation adaptation.

### fable-2-9 — Track relative-XDG-path filtering as a separate behavior change

- file: scratchpad/effected/xdg/Xdg.ts:275
- class: bug   severity: backlog
- standard: D9; section 14's upstream-bug/deviation protocol; D11; required write-surface boundary.   evidence: The seat cites XDG Base Directory Specification v0.8 section 3 and shows that relative single-directory values and search-path entries remain accepted in both the lab and pinned oracle. The recorded round-1 deviations address empty values only. The report leaves Windows-style absolute-value handling unresolved and proposes a new ledger deviation before implementation.
- failure: Relative XDG paths depend on the process working directory despite the cited absolute-path convention; this is inherited behavior, not an unforced lab divergence.
- fix: In a separately recorded upstream-bug wave, settle the cross-platform contract, then filter the five XDG single-directory variables and `splitDirs` entries using that absolute-path policy, leaving APPDATA/LOCALAPPDATA unchanged. Add regressions in Xdg.test.ts and AppDirs.test.ts. The orchestrator must own any ledger/Port-notes record; a local group cannot edit them.
- seats: fable-2-9
- disposition: Backlog: outside the port's write surface for the requested prerequisite ledger change, with an unresolved platform policy. Do not silently add this inherited behavior change to the present required fix.

### fable-2-10 — Consider generated resolution-precedence properties

- file: scratchpad/test/xdg/AppDirs.property.test.ts:26
- class: test   severity: backlog
- standard: D10; section 11.4; assignment's property/coverage deferral.   evidence: Existing generated tests cover schema round trips and search-path parsing, but not `resolveAll`/`NativeDirs.resolve` combinations. The seat expressly states that the D10 hard floor is met.
- failure: Precedence and override combinations rely on examples; no failing property or implementation defect is shown.
- fix: Add an `it.effect.prop` over schema-generated overrides, platform values, and a single-component namespace. Check override dominance, own-directory search-path heads and lengths, and runtime presence. Use `fcRuns` and retain all oracle examples.
- seats: fable-2-10
- disposition: Optional property strengthening; deferred test/coverage work.

### fable-2-11 — Consolidate the repeated schema round-trip helper

- file: scratchpad/test/xdg/Xdg.property.test.ts:15; scratchpad/test/xdg/AppDirs.property.test.ts:11; scratchpad/test/xdg/NativeDirs.property.test.ts:11
- class: test   severity: backlog
- standard: Vitest-canon section 6.3; local-helper import guidance; assignment's canon/property deferral.   evidence: Three property files repeat the same `roundTrips` helper. The seat identifies an existing `assertSchemaArbitraryDecodesToSelf` helper and describes this as a wider lab pattern.
- failure: Duplicate helpers can drift; no presently incorrect round trip or required floor violation is demonstrated.
- fix: If adopted, share one helper in `scratchpad/test/xdg/roundTrips.ts` and import it relatively, or use the existing canon helper where its synchronous shape fits, retaining `fcRuns` and all schemas under test. Keep any lab-wide migration outside this module's assigned write surface.
- seats: fable-2-11
- disposition: Deferred canon/test consolidation; a repository-wide sweep is outside the port's write surface.

### fable-2-12 — Consider exposing added schema values through the barrel

- file: scratchpad/effected/xdg/index.ts:13; scratchpad/effected/xdg/index.ts:16
- class: effect-idiom   severity: backlog
- standard: D2 superset export rule; D11; round-1 b7.   evidence: `index.ts` keeps the upstream type-only exports for AppDirOverrides/AppDirsOptions, while `AppDirs.ts` now also exports their runtime schemas. Tests import those schemas directly. All upstream export kinds remain available.
- failure: Barrel consumers cannot access the added schema values through the existing type-only entries; this is an optional API convenience, not a parity defect.
- fix: If adopted, re-export AppDirOverrides/AppDirsOptions as values and add AppDirsNamespaceError to the barrel, adjusting relevant test imports. Delegate Added-exports records to the central codemod.
- seats: fable-2-12
- disposition: Optional public-surface expansion outside D11; no required group owns index.ts.

## Handled by the deviation codemod

### fable-2-1 — Record the three law-forced added exports centrally

- file: scratchpad/effected/xdg/README.md:159; scratchpad/effected/xdg/AppDirs.ts:36; scratchpad/effected/xdg/AppDirs.ts:189; scratchpad/effected/xdg/AppDirs.ts:232
- class: law   severity: backlog
- standard: D2; later 2026-10-09 operator ruling assigning added exports to the per-module/per-class codemod.   evidence: Added exports still says `None.` and the reviewed xdg ledger row has `exportsAdded: []`, despite AppDirsNamespaceError and the AppDirOverrides/AppDirsOptions schema values. `47cb8e678b` establishes the law-forced native-error replacement; round-1 fable-1-3 and `f03214a75c` establish the schema-first runtime options. Round 1 already assigned this bookkeeping to codemod-added-exports.
- failure: The central inventory omits real law-forced additions. No evidence shows the additions themselves are wrong.
- fix: The central codemod records AppDirsNamespaceError (value and type) and the newly added values AppDirOverrides/AppDirsOptions, preserving their existing upstream types, in `exportsAdded` and README Added exports. Do not assign ledger or README Port-notes edits to a local fix group.
- seats: fable-2-1
- disposition: Bookkeeping only; codemod ownership persists even though the earlier codemod missed these rows. Severity backlog denotes non-required central handling, not an additional Backlog-section count.

## Rejected

None. All submitted findings contain evidence and a concrete proposed fix. The
mandatory-law finding identifies the ungated Boolean branch; no other record is
accepted as required merely because a seat called it required. Codemod-only
bookkeeping is routed centrally rather than rejected or assigned locally.
