### fable-1-1
- file: scratchpad/effected/workspaces/WorkspacesSync.ts:669
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D9 + section 14 (deviation procedure); 2026-10-09 ruling: one ledger + README deviation entry per module per systemic class, listing sites and adjusted upstream tests   evidence: `throw WorkspaceEnumerationDepthError.make(...)` where upstream throws `new RangeError(...)`; `scratchpad/test/workspaces/WorkspacesSync.test.ts:209-211` was changed from `assert.throws(..., RangeError)` to `WorkspaceEnumerationDepthError` (diff vs oracle `__test__/WorkspacesSync.test.ts`). Same class at WorkspacesSync.ts:284,527,535 (`WorkspaceSyncManifestError` where upstream put `new Error(...)` on the skip `cause`), internal/enumerate.ts:75 (`Effect.die(EnumerationOptionsError)` vs `new Error`), internal/configDependencyResolution.ts:128,414,420,511 (`ConfigDependencyResolutionError` vs `new Error`). Commit e9cdd3ec83 admits it ("Tests that asserted a native error class now assert the tagged error"), yet PORT_LEDGER.json row w4-workspaces has `deviations: []` and README Port notes say `Deviations: None`.
- failure: Observable differences from upstream (thrown class, defect class, `_tag`/`name` on the skip cause) exist with an adjusted upstream test but no ledger or README record, so the oracle contract is weakened silently; section 14 orders ledger entry first, then code, then the smallest test change, then README.
- fix: Add one `deviations` entry (cause `law:effect-laws-v1#7`, class "tagged errors") to the ledger row listing the sites above and `WorkspacesSync.test.ts:209-211` as the adjusted test, and mirror it under README Port notes → Deviations.

### fable-1-2
- file: scratchpad/effected/workspaces/internal/patterns.ts:83
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D9 + section 14; WorkspacesSync.ts:208-211 documents both surfaces performing `JSON.parse` for `invalidJson`   evidence: `S.decodeEffect(JsonValue)(content)` (JsonValue = `S.fromJsonString(S.Unknown)`) replaces upstream `Effect.try({ try: () => JSON.parse(content) ... })`; same at internal/configDependencyShared.ts:96 (`manifestVersion`). The failure `cause` is now a `SchemaError`, not the `SyntaxError` upstream raised. The sync surface still uses `JSON.parse` (WorkspacesSync.ts:276) and the retained test `WorkspacesSync.test.ts:675` pins `assert.instanceOf(cause, SyntaxError)`, so the two surfaces now disagree on the `invalidJson` cause class. Other modules kept `JSON.parse` under a next-line `preferSchemaOverJson` directive with a reason (DIAGNOSTIC_EXCEPTIONS.md: config-file/JsonCodec.ts, lockfiles/internal/npm.ts). Ledger `deviations: []`.
- failure: `WorkspaceDiscoveryError.cause` / `CatalogAssemblyError.cause` for unparseable JSON changes class and message (`messageOf(cause)` splices the SchemaError text into user-facing remediation), the WorkspacesSync.ts doc about the shared five checks is now false, and nothing records the deviation.
- fix: Restore `JSON.parse` inside `Effect.try` at both sites under a next-line `@effect-diagnostics preferSchemaOverJson` directive with the same reason the other modules recorded (the cause must stay the native SyntaxError on both surfaces), or, if the SchemaError cause is wanted, record it as a `law:preferSchemaOverJson` deviation in the ledger and README and update WorkspacesSync.ts:208-211.

### fable-1-3
- file: scratchpad/effected/workspaces/node-sync.ts:30
- class: law   severity: required
- standard: standards/effect-laws-v1.md #8 (no `node:path` in runtime source) and the allowlist contract ("Do not add entries for scanner misses"); tsgo rule `nodeBuiltinImport` at error (tsconfig.base.json); DIAGNOSTIC_EXCEPTIONS.md contract ("remove the directive and the diagnostic comes back")   evidence: `process.getBuiltinModule("node:fs")` / `("node:path")` replace upstream ES imports; same at internal/configDependencyFetch.ts:57-58, internal/configDependencyShared.ts:20-21, internal/configDependencyResolution.ts:59-60 (`node:fs/promises`, `node:path`). Commit 2ac543dbcf removed the `nodeBuiltinImport:skip-file` directives (grep `@effect-diagnostics` in the four files: 0), yet scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md still lists those four whole-file exceptions. The native-runtime checker inspects only `ImportDeclaration` specifiers and only in hotspot scope (NoNativeRuntime.ts:379-385; scratchpad/effected is not a hotspot per NoNativeRuntimeHotspots.ts:50-61), so neither gate can see the sites; the same files still `import { tmpdir|homedir } from "node:os"` directly, showing only the scanned specifiers were rewritten. No `scratchpad/effected/workspaces/*` entry for these files in standards/effect-laws.allowlist.jsonc.
- failure: Four runtime files bind `node:path`/`node:fs` exactly as before but are invisible to the tsgo rule, the beep law and the exception register: the operator can no longer overrule the exception by removing a directive, and the 2026-10-09 fix wave (replace every recorded native-runtime site) will miss them.
- fix: Restore the upstream `import ... from "node:fs" / "node:path" / "node:fs/promises"` lines with the whole-file `@effect-diagnostics nodeBuiltinImport:skip-file` directive and the reason already recorded in DIAGNOSTIC_EXCEPTIONS.md, and add matching `beep-laws/no-native-runtime` allowlist entries (`kind: "node-runtime-import"`) so the sites are tracked for the fix wave.

### fable-1-4
- file: scratchpad/effected/workspaces/internal/roots.ts:30
- class: law   severity: required
- standard: standards/effect-laws-v1.md #6 (no native Map/Set in domain logic) and the allowlist contract; DependencyGraph.ts allowlist entry EFFECTED-WS-ADJACENCY is the sanctioned shape for a kept ReadonlyMap   evidence: `return { byId: byId.backing, workspaceByPath: workspaceByPath.backing }` builds two `MutableHashMap`s only to hand back their `backing: Map` fields so `InstanceIndex.byId/workspaceByPath` stay `ReadonlyMap<string, ResolvedPackage>` (roots.ts:17-19); the checker flags only `new Map` constructor calls (NoNativeRuntime.ts:69,390-397). Behaviour is preserved today only because `isSimpleKey` routes string keys straight into `backing` (MutableHashMap.js:352), an undocumented representation detail. `InstanceIndex` is internal (consumers: PeerCheck.ts, DuplicateCheck.ts), so no public contract forces the native Map.
- failure: The domain index remains a native Map while the law gate reports the module clean; the code depends on MutableHashMap's internal bucket layout, and the site is absent from the allowlist the fix wave works from.
- fix: Type `InstanceIndex` as `MutableHashMap.MutableHashMap<string, ResolvedPackage>` for both fields, return the maps themselves, and switch `rootInstances` (roots.ts:62,87) and the two consumers to `MutableHashMap.get` + `O.getOrUndefined`; if the ReadonlyMap boundary must stay this round, restore `new Map` with an allowlist entry like DependencyGraph's.

### fable-1-5
- file: scratchpad/effected/workspaces/internal/enumerate.ts:196
- class: law   severity: required
- standard: standards/effect-laws-v1.md #10 (no native Array.prototype.sort; use A.sort with an explicit Order)   evidence: `results.sort((a, b) => (a.relativePath < b.relativePath ? -1 : ...))`; also WorkspacesSync.ts:742 `[...included].sort(([a], [b]) => ...)` and internal/configDependencyResolution.ts:230 `.sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))`. The checker flags `.sort` only `inHotspotScope` (NoNativeRuntime.ts:463) and scratchpad/effected is not a hotspot, so the gate never evaluated these sites. The same lane already converted packedInstallPlan.ts:98 to `A.sort(R.keys(...), Str.Order)`.
- failure: Law 10 violated at three sites with hand-written comparators that re-implement `Str.Order` / `Number.Order`; the law gate is silent only because of scope, not compliance.
- fix: `return A.sort(results, Order.mapInput(Str.Order, (r) => r.relativePath))`; `A.sort([...included], Order.mapInput(Str.Order, ([k]) => k))`; `A.sort(filtered, Order.reverse(Order.mapInput(Num.Order, (v) => Number(v.slice(1)))))` — identical, stable orderings.

### fable-1-6
- file: scratchpad/effected/workspaces/index.ts:140
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D2 (superset export rule: additions listed under README Port notes → Added exports and ledger `exportsAdded`)   evidence: WorkspacesSync.ts:59 exports a new public class `WorkspaceEnumerationDepthError` (thrown by the public `getWorkspacePackagesSync`, WorkspacesSync.ts:669) but the `./WorkspacesSync.ts` export block in index.ts:140-151 omits it; the test imports it from the module file directly (`scratchpad/test/workspaces/WorkspacesSync.test.ts:29`). PORT_LEDGER.json row `exportsAdded: []`; README `Added exports: None`.
- failure: A consumer of the package entry cannot name or `instanceof`-match the error class the public function throws, and the D2 additions inventory is wrong.
- fix: Add `WorkspaceEnumerationDepthError` to the `./WorkspacesSync.ts` export block in index.ts, list it under README Port notes → Added exports, and append it to the ledger row's `exportsAdded`.

### fable-1-7
- file: scratchpad/effected/workspaces/index.ts:24
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D9 + section 14; 2026-10-09 ruling on recording law-forced changes per systemic class; tsgo `lazyEffect` is at error (tsconfig.base.json:165)   evidence: The package doc example now reads `yield* discovery.listPackages` (upstream `listPackages()`), reflecting zero-arg service members turned into Effect values across WorkspaceDiscovery (`info`, `listPackages`, `refresh`; lab WorkspaceDiscovery.ts:212 vs oracle :190), LockfileReader (`read`, `integrity`, `refresh`), WorkspaceCatalogs (`set`, `releaseAgeGate`, `importerVersions`, `refresh`) and WorkspaceSnapshots (`worktree`). Tests in this part were rewritten for it: doubles.test.ts (e.g. `set: () => Effect.succeed(stubbedSet)` → `set: Effect.suspend(...)`), WorkspacesStopAt.test.ts, Workspaces.test.ts, integration/ConfigDependencyResolution.int.test.ts, WorkspacesSync.test.ts:36. The change is forced by `lazyEffect` (an allowed `law:` cause) but it is a public-API deviation with rewritten upstream tests and the ledger row has `deviations: []`.
- failure: A public service-shape change that every consumer must adapt to, with upstream tests rewritten, carries no deviation record; the operator cannot tell it from the un-forced thunk-to-value class the 2026-10-09 ruling ordered restored.
- fix: Add one `deviations` entry (cause `law:tsgo/lazyEffect`, class "zero-arg service members become Effect values") listing the shapes and the rewritten test files, mirrored in README Port notes → Deviations; the integrator should dedupe with the parts that own WorkspaceDiscovery.ts, LockfileReader.ts, WorkspaceCatalogs.ts and WorkspaceSnapshots.ts.

### fable-1-8
- file: scratchpad/effected/workspaces/Workspaces.ts:241
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md #21 (tersest equivalent helper form); tsgo `strictEffectProvide` at error (tsconfig.base.json:217); DIAGNOSTIC_EXCEPTIONS.md is the sanctioned exception route   evidence: `Layer.build(resolverLayer(options)).pipe(Effect.flatMap((context) => manifest.resolve().pipe(Effect.provideContext(context))), Effect.scoped)` replaces upstream `manifest.resolve().pipe(Effect.provide(resolverLayer(options)))` (commit fef6838fd8). The two are the same operation spelled by hand so the `strictEffectProvide` rule does not fire; the per-call resolver layer is the upstream design, which the rule doc says is the entry-point case to disable rather than rewrite.
- failure: Less idiomatic form that hides a deliberate `Effect.provide` from the diagnostic instead of recording the exception; a reader cannot tell it from a scope workaround.
- fix: Restore `Effect.provide(resolverLayer(options))` under a next-line `@effect-diagnostics strictEffectProvide` directive with the reason (the composite builds a fresh resolver layer per call by contract), recorded in DIAGNOSTIC_EXCEPTIONS.md.

### fable-1-9
- file: scratchpad/effected/workspaces/WorkspacesSync.ts:547
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md #21 (tersest equivalent helper form); effect/Predicate: `isObjectOrArray` = `typeof x === "object" && x !== null` (Predicate.js:687), `isObjectKeyword` additionally admits functions (Predicate.js:782)   evidence: `P.isObjectKeyword(publishConfig) && !P.isFunction(publishConfig)`; same spelling at internal/patterns.ts:40 and internal/catalogs.ts:62. Each is exactly `P.isObjectOrArray(x)`, which the same lane already used elsewhere (catalogs.ts:52,55; patterns.ts:30,36).
- failure: Two-call guard where one named Predicate exists; inconsistent within the same files.
- fix: Replace each with `P.isObjectOrArray(x)`.

### fable-1-10
- file: scratchpad/effected/workspaces/internal/catalogs.ts:54
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md #21; crispen (no type-appeasement branches)   evidence: `P.isObject(raw) ? R.toEntries(raw) : R.toEntries<keyof typeof raw & string, unknown>(raw)` (and :57 for `catalog`) exists only to type-check the array branch of `P.isObjectOrArray`; upstream iterated `Object.entries(raw)` once, treating an array as index-keyed. The explicit type argument instantiates `ReadonlyRecord<"length" | "push" | ..., unknown>`, a type-level fiction that happens to accept arrays.
- failure: Unreadable ternary whose second branch depends on an accidental assignability; any tightening of `R.toEntries` breaks it.
- fix: One branch: `const entries = A.isArray(raw) ? A.map(raw, (v, i) => [String(i), v] as const) : R.toEntries(raw)` (same pairs `Object.entries` yields for arrays), or decide arrays are unusable catalogs and keep only `P.isObject` — the latter as a recorded deviation.

### fable-1-11
- file: scratchpad/effected/workspaces/WorkspacesSync.ts:548
- class: effect-idiom   severity: backlog
- standard: ~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md (decode unknown input with `decodeUnknown*`); upstream used `Schema.decodeUnknownEffect(PublishConfig)`   evidence: `S.decodeEffect(PublishConfig)(publishConfig)` where `publishConfig` is narrowed only to `object`; `decodeEffect` expects `PublishConfig["Encoded"]` and only compiles because `object` satisfies the weak all-optional type. `Schema.decodeUnknownEffect` exists in effect 4.0.2 (Schema.d.ts:361).
- failure: The call claims the value already has the encoded shape; a future non-weak `PublishConfig` encoded type turns this into a type error, and the intent (validate untrusted manifest data) is obscured.
- fix: `Effect.runSyncExit(S.decodeUnknownEffect(PublishConfig)(publishConfig))`.

### fable-1-12
- file: scratchpad/effected/workspaces/internal/sourceText.ts:46
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md #6 (Effect collections); immutable constants belong in `HashSet`, as internal/limits.ts:32 already does   evidence: `REGEX_AFTER`, `DECLARATIONS` (:64), `CONTROL` (:67), `GLOBAL_OBJECTS` (:70) are module-level constants built with `MutableHashSet.fromIterable`; internal/packedInstallPlan.ts:29 `TRAPS = MutableHashSet.make(...)` likewise. None is mutated after construction.
- failure: Constants are typed mutable, so a stray `MutableHashSet.add` anywhere in the module silently changes lexer/scrub behaviour for every caller; inconsistent with `PRUNED_DIRECTORIES`.
- fix: Use `HashSet.fromIterable` / `HashSet.make` and `HashSet.has` for the five constants (keep `MutableHashSet` for the per-call `controlCloses` and `seen` sets).

### fable-1-13
- file: scratchpad/effected/workspaces/internal/traverse.ts:49
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md (docs must describe the shipped behaviour); S2 not yet run (backlog by operator order)   evidence: traverse.ts:49 still says "a thrown `RangeError`" and WorkspacesSync.ts:247-248 describes the `invalidShape` cause as "an `Error` whose message matches..."; after the tagged-error change the thrown value is `WorkspaceEnumerationDepthError` and the cause a `WorkspaceSyncManifestError`. The new data-last overloads of `findWorkspaceRootSync` (:444-446) and `getWorkspacePackagesSync` (:656-658) are not mentioned by their JSDoc ("The signature is path-first, options second", :405).
- failure: Docs contradict the code on the error classes and omit the added call form.
- fix: Update the two sentences alongside the fable-1-1 deviation entry and add one line per sync entry point naming the `(options)(cwd)` form.

### fable-1-14
- file: scratchpad/effected/workspaces/internal/configDependencyFetch.ts:136
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (span naming); module convention `Effect.fn("Workspaces.resolveManifest")`, `"WorkspaceDiscovery.listPackages"`   evidence: `Effect.fn("expectedIntegrity")`; also internal/patterns.ts:51 `"readPatterns"` and internal/configDependencyResolution.ts:181,208,242,288,394 (`"storesFromLinks"`, `"storesFromEnvironment"`, `"discoverStores"`, `"findInStores"`, `"resolveDirectory"`) use bare span names, while enumerate.ts and resolvePnpmfiles chose `Effect.fnUntraced` for internals.
- failure: Traces from one module mix qualified and bare span names, and internal helpers now emit spans that upstream's `Effect.gen` did not.
- fix: Use `Effect.fnUntraced` for the internal helpers (matching enumerate/resolvePnpmfiles) or qualify the names (`"ConfigDependencyHooks.expectedIntegrity"` etc.).

### fable-1-15
- file: scratchpad/effected/workspaces/WorkspacesSync.ts:539
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md #21; crispen (no helper walls)   evidence: `isStringRecord` (:539-540) exists only to feed `stringRecord` (:542-543), which is the single consumer; upstream had one helper.
- failure: Two helpers for one predicate; the guard name promises reuse that does not exist.
- fix: Inline: `const stringRecord = (value: unknown): Record<string, string> | undefined => P.isObject(value) && R.values(value).every(P.isString) ? value : undefined;` with a local `value is Record<string, string>` refinement only if the narrowing is needed.

REQUIRED: 7
BACKLOG: 8
