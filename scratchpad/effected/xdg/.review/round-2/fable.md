### fable-2-1
- file: scratchpad/effected/xdg/README.md:159
- class: law   severity: required
- standard: D2 (superset export rule: additions are listed under Port notes → Added exports); section 10.3 (Added exports subsection present and accurate); round-1 inventory codemod-added-exports (assigned the record to the central codemod).   evidence: At a12bef26 `scratchpad/effected/xdg/AppDirs.ts` exports three symbols the oracle does not: `AppDirsNamespaceError` (AppDirs.ts:36, value+type), `AppDirOverrides` (AppDirs.ts:189, runtime S.Struct; upstream `interface` only) and `AppDirsOptions` (AppDirs.ts:232, runtime S.Struct; upstream `interface` only). README.md:157-159 still reads `### Added exports` / `None.` and the xdg ledger row has `"exportsAdded": []` (PORT_LEDGER.json:10683). Round 1 explicitly deferred this record to the central codemod; the codemod wrote the 11 `deviations` entries but never populated `exportsAdded`, so the parity record is now false at the commit under review. The three test files import these values directly (AppDirs.test.ts:14, AppDirs.property.test.ts:7).
- failure: The parity record that D2 exists to make checkable claims zero additions while three exported values exist; a later promotion or parity audit reading README/ledger will miss them.
- fix: Record the three additions in both places: README `### Added exports` → `AppDirsNamespaceError` (value+type, `./AppDirs.ts`), `AppDirOverrides` (value; the upstream type is kept), `AppDirsOptions` (value; the upstream type is kept); ledger `exportsAdded` → the same three rows with kind/entry. No source change.

### fable-2-2
- file: scratchpad/effected/xdg/Xdg.ts:62
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md short law 12 (use Bool.match for boolean branching in domain/runtime code) and short law 13 (prefer schema transformations over ad-hoc fallback logic); round-1 disposition of fable-1-10, which promoted the identical ternary class to required under D11.   evidence: `return S.is(XdgPlatform)(platform) ? platform : "linux";` is a boolean ternary in runtime code (the `CurrentPlatform` default-value thunk). No tsgo rule covers it (`~/YeeBois/references/effect/effect-tsgo/docs/rules/` has no Bool.match/ternary rule; `strict-boolean-expressions` is off and would not fire on a boolean guard), and round 1 recorded that none of the four laws checks boolean branching, so the green gate cannot have caught it. `Bool.match` is not the right fix here because the guard narrowing is lost inside the callbacks; the installed Effect exposes `S.decodeUnknownOption` (Schema.d.ts:1323), which expresses the same selection as a schema decode with a fallback.
- failure: Boolean branching remains in runtime code after the fix wave that removed the same class at AppDirs.ts:351; the only other ternary of this kind in the module.
- fix: `return O.getOrElse(S.decodeUnknownOption(XdgPlatform)(platform), () => "linux");` (`O` is already imported in Xdg.ts). Behaviour identical: Xdg.coverage.test.ts:20-33 pins the undefined/unknown/darwin cases.

### fable-2-3
- file: scratchpad/effected/xdg/NativeDirs.ts:89
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws (prefer match helpers over conditional chains); short law 19 (LiteralKit domains carry `$match`); short law 21.   evidence: `NativeDirs.resolve` branches on the `XdgPlatform` LiteralKit with `if (platform === "darwin") … if (platform === "win32") … return O.none()` (NativeDirs.ts:89-114). The domain now owns `$match` (pinned at Xdg.test.ts:139) yet the only consumer still uses an equality chain. Preference wording in the cited laws, so backlog.
- failure: A conditional chain over a named literal domain, outside the match-helper idiom the repo prefers; adding a platform later is not exhaustiveness-checked.
- fix: `Match.value(platform).pipe(Match.when("darwin", () => O.some(NativeDirs.make({…}))), Match.when("win32", () => O.some(NativeDirs.make({…}))), Match.orElse(() => O.none()))` with `import * as Match from "effect/Match"`; every NativeDirs.test.ts case stays unchanged.

### fable-2-4
- file: scratchpad/effected/xdg/AppDirs.ts:505
- class: effect-idiom   severity: backlog
- standard: short law 21 (tersest equivalent Effect helper form); standards/effect-first-development.md EF-5 (Effect helpers over hand-rolled nullish branching).   evidence: Three nullish ternaries/ifs survive the fix wave: `runtimeDir === undefined ? Effect.succeed(O.none<string>()) : Effect.asSome(makeDir("runtime", runtimeDir))` (AppDirs.ts:505-509), `paths.runtimeDir !== undefined ? path.join(…) : undefined` (373-375) and `if (dirs.runtime !== undefined) yield* makeDir(…)` (524). The installed Effect has `Effect.transposeOption` (Effect.d.ts:2499), which is the exact shape of ensureRuntime. Nullish rather than boolean-domain branching, and round 1 passed these sites, so backlog.
- failure: Hand-rolled Option/undefined plumbing where a one-call helper exists; no behavioural defect.
- fix: ensureRuntime: `Effect.transposeOption(O.map(O.fromNullable(dirs.runtime), (dir) => makeDir("runtime", dir))).pipe(Effect.withSpan("AppDirs.ensureRuntime"))`; runtime: `O.getOrUndefined(O.orElse(O.fromNullable(options.dirs?.runtime), () => O.map(O.fromNullable(paths.runtimeDir), (dir) => path.join(dir, options.namespace))))`; ensure: `yield* Effect.forEach(O.fromNullable(dirs.runtime), (dir) => makeDir("runtime", dir))`. AppDirs.test.ts:301-325 and 395-430 pin the behaviour.

### fable-2-5
- file: scratchpad/effected/xdg/AppDirs.ts:401
- class: schema   severity: backlog
- standard: short law 17 (prefer built-in schema constructors/checks before `S.makeFilter`).   evidence: `NamespaceComponent` combines a built-in `S.isPattern(/^[^/\\]*$/)` with an `S.makeFilter((value) => value !== "." && value !== "..")`. A single built-in pattern `/^(?!\.\.?$)[^/\\]*$/` rejects exactly the same set: JS `$` without the `m` flag matches only at end of input, so `.` and `..` fail the lookahead while `.\n` and `..\n` still pass (pinned accepted at AppDirs.test.ts:501) and `...` still passes (not equal to `.`/`..` today). `badNamespace` keeps producing both message strings unchanged.
- failure: A custom filter where a built-in check suffices; two checks and two identities where one domain constraint exists.
- fix: Replace the two checks with one `S.isPattern(/^(?!\.\.?$)[^/\\]*$/, { identifier: $I`NamespaceComponentCheck`, title: "Single path component", description: "A namespace contains no path separators and is neither `.` nor `..`." })`; keep `NonEmptyNamespace` and the message logic in `badNamespace`.

### fable-2-6
- file: scratchpad/test/xdg/Xdg.coverage.test.ts:22
- class: test   severity: backlog
- standard: standards/effect-first-development.md (resource safety through Effect combinators, not try/finally inside generators); goals/effect-vitest-canon/SPEC.md D14 lens (Effect code under `it.effect`, plain values under plain `it`).   evidence: The second test wraps three `vi.stubGlobal("process", …)` mutations in `try { … } finally { vi.unstubAllGlobals() }` inside an `Effect.gen` body that yields nothing. The tsgo `tryCatchInEffectGen` rule only reports `catch` blocks (rule doc preview and message), so the green gate did not miss it; this is an idiom gap, not a gate miss. The body contains no Effect, so `it.effect` adds TestServices for no reason.
- failure: Global stubbing is released by a JS `finally` instead of an Effect finalizer, and a pure synchronous assertion runs as an Effect test.
- fix: Either plain `it("…", () => { try { … } finally { vi.unstubAllGlobals(); } })`, or keep `it.effect` and write `Effect.sync(() => { … }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllGlobals())))`.

### fable-2-7
- file: scratchpad/test/xdg/Xdg.test.ts:79
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md 11.4 spirit (vacuous assertions are findings, not coverage); `@effect/vitest/utils` contract `assertExitFailure(exit, expected: Cause<E>)` (utils.d.ts:176).   evidence: `assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow))` at Xdg.test.ts:79 and AppDirs.test.ts:470 passes the exit's own cause as the expected cause, so the equality half of the assertion is tautological; the call survives only because it narrows `exit` to `Exit.Failure` for the following `exit.cause.reasons`. Upstream (oracle Xdg.test.ts:62-64) asserted `Option.isSome(cause)` and read `reasons` from the unwrapped cause.
- failure: A canon helper is used as a type-narrowing device with a self-referential expected value; a reader assumes the cause was checked against something.
- fix: `assert(Exit.isFailure(exit));` (chai `assert` narrows on the guard) then `exit.cause.reasons` as today; drop the `assertExitFailure` import where it becomes unused.

### scratchpad/effected/xdg/README.md:12
- file: scratchpad/effected/xdg/README.md:12
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL section 10.3 (remove the Install section and release boilerplate; keep Why/API prose); round-1 b3 with new evidence.   evidence: The ledger S2 note (2026-10-09T16:20:03Z) records "README adapted (section 10.3)", yet README.md:12-14 still carries the upstream install prose: the ESM-only exports-map/`require()` paragraph and the peer-dependency paragraph telling readers that `@effected/walker` and `@effected/config-file` are peers to add to a manifest. In the lab those are relative sibling modules (`../walker/index.ts`, `../config-file/index.ts` per D13), so the text is wrong for this checkout, not merely boilerplate. Code examples were adapted (no `from "effect"` or `@effected/*` import lines remain).
- failure: The adapted README still instructs lab readers to install npm peers that do not exist here; b3 was marked S2 work and S2 is recorded green.
- fix: Delete README.md:12-14 (the ESM/`require()` and peer-dependency paragraphs); keep line 16 (FileSystem/Path provision) and everything else.

### fable-2-9
- file: scratchpad/effected/xdg/Xdg.ts:275
- class: bug   severity: backlog
- standard: section 14 `upstream-bug:<evidence>` with a spec citation; XDG Base Directory Specification v0.8 §3: "All paths set in these environment variables must be absolute. If an implementation encounters a relative path in any of these variables it should consider the path invalid and ignore it."   evidence: `read` (Xdg.ts:275-279) now drops empty values but keeps relative ones, so `XDG_CONFIG_HOME=cfg` yields `cfg/myapp` from `resolveDir` (AppDirs.ts:338) and `XDG_CONFIG_DIRS=etc:/etc/xdg` keeps `etc` in `configDirs`. Round-1 grok-1-1 quoted this clause in its evidence, but the fix wave (ledger upstream-bug rows, README.md:174-175) normalized only empty values. Shared with the oracle (oracle Xdg.ts:168-170); no upstream test covers relative values. Backlog rather than required because the ignore rule changes accepted inputs and needs a ledger entry first (section 14 procedure) plus a decision on `C:\`-style absolute values under XDG variables on Windows.
- failure: Relative XDG values resolve application directories relative to the process cwd, which the spec says to ignore; a `cd` changes where the app reads and writes.
- fix: If adopted: write the ledger deviation first, then filter the five `XDG_*` single-directory reads with an absolute-path check (`Str.startsWith("/")` for the POSIX-spec variables, leaving `APPDATA`/`LOCALAPPDATA` untouched) and drop relative entries in `splitDirs`; add one Xdg.test.ts case per variable and one AppDirs resolution regression.

### fable-2-10
- file: scratchpad/test/xdg/AppDirs.property.test.ts:26
- class: test   severity: backlog
- standard: D10 / section 11.4 property floor; round-1 b6 ("suitable resolution/parsing properties") with new evidence from the S3 note.   evidence: S3 is recorded green ("property floor") and landed schema round-trips for every exported schema plus the search-path parsing property (Xdg.property.test.ts:35-60). No property exercises `resolveAll`/`NativeDirs.resolve`: the precedence ladder, override dominance and search-path shape are pinned only by hand-written examples (AppDirs.test.ts:207-351). The D10 hard floor (schemas/codecs, parsers/formatters) is met, so backlog.
- failure: The module's central algorithm has example coverage only; a regression in a rung that the examples do not combine (e.g. per-kind override plus native on win32) is not caught.
- fix: Add one `it.effect.prop` over `Arbitrary.schema(AppDirOverrides)` × `XdgPlatform` × a single-component namespace arbitrary asserting: every present `dirs.<kind>` override equals `resolved.<kind>`; `configSearchPath[0] === config` and `dataSearchPath[0] === data`; `configSearchPath.length === paths.configDirs.length + 1`; `runtime` present iff an override or `runtimeDir` is. Run counts through `fcRuns`.

### fable-2-11
- file: scratchpad/test/xdg/Xdg.property.test.ts:15
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md 6.3 ("Reuse assertSchemaArbitraryDecodesToSelf for round-trip laws where it fits"); AGENTS.md test-import law (relative imports for local helpers).   evidence: `roundTrips` is copied verbatim into Xdg.property.test.ts:15-28, AppDirs.property.test.ts:11-24 and NativeDirs.property.test.ts:11-24. The canon helper exists at packages/tooling/test-kit/test-utils/src/Schema.ts:39 (sync, `Effect.runSync` + `Arbitrary.checkEffect`, takes `CheckOptions`); 0 lab test files use it and 187 hand-roll `roundTrips`, so this is a lab-wide pattern and low priority for xdg alone.
- failure: Three identical helpers drift independently; the module does not use the canon helper the SPEC names.
- fix: Hoist one `roundTrips` into `scratchpad/test/xdg/roundTrips.ts` and import it relatively from the three property files, or switch to `assertSchemaArbitraryDecodesToSelf(schema, { numRuns: fcRuns(100) })` if the sync shape is acceptable under D10; treat lab-wide in one sweep rather than per module.

### fable-2-12
- file: scratchpad/effected/xdg/index.ts:13
- class: effect-idiom   severity: backlog
- standard: D2 (additions allowed, recorded); round-1 b7 (barrel exposure of added exports is a design choice, not forced).   evidence: `index.ts:13,16` re-export `type AppDirOverrides` and `type AppDirsOptions` only, while both names are now runtime `S.Struct` values (AppDirs.ts:189, 232) whose own JSDoc examples import them as values from the module file. A barrel consumer cannot `S.decode(AppDirsOptions)` or pass the schema to `Arbitrary.schema`; the tests reach the values via `../../effected/xdg/AppDirs.ts` (AppDirs.test.ts:14). D2 parity is satisfied (the upstream type kind is present), so this is the same open question as b7 for the two option schemas.
- failure: The public entry hides the schema half of two exported models; consumers of the barrel see interfaces where the module file offers schemas.
- fix: If adopted with b7: change the two `type` re-exports to plain re-exports (`AppDirOverrides, AppDirsOptions`), add `AppDirsNamespaceError`, point the tests at `index.ts`, and list the barrel change under Added exports (fable-2-1).

REQUIRED: 2
BACKLOG: 10
