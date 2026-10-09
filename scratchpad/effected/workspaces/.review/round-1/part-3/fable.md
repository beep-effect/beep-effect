### fable-1-1
- file: scratchpad/effected/workspaces/README.md:589
- class: law   severity: required
- standard: D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol); 2026-10-09 ruling (EFFECTED_PORT_GOAL.md:79-82, commit a8a7f89a30): one ledger plus README deviation entry per module per systemic class, listing sites and adjusted upstream tests   evidence: README 'Port notes -> Deviations: None' and PORT_LEDGER.json w4-workspaces `deviations: []`, while the module carries five law/diagnostic-forced systemic classes with rewritten upstream tests: (1) tsgo `lazyEffect` (tsconfig.base.json:165, at error) turned every zero-arg service member into an Effect value: upstream `readonly set: () => Effect...` (upstream WorkspaceCatalogs.ts:460,479,497,510,522,542; WorkspaceDiscovery.ts:188,190,192,241; WorkspaceSnapshots.ts:148) -> lab WorkspaceCatalogs.ts:490,509,527,540,552,572, WorkspaceDiscovery.ts:210,212,214,263, WorkspaceSnapshots.ts:161 (landed in c4f461a6cc 'chore: saving progress'); upstream tests rewritten (`catalogs.set()`->`catalogs.set`, `discovery.listPackages()`->`.listPackages` across WorkspaceCatalogsPmAware/doubles/WorkspaceDiscovery/WorkspaceDiscoveryPerRoot/WorkspaceRoot/WorkspaceSnapshots tests; `listPackages: () => Effect.succeed(PACKAGES)` -> `Effect.suspend(...)` in WorkspaceLayering.test.ts and WorkspaceDiscoveryPerRoot.test.ts); README prose still says `WorkspaceCatalogs.set()` (README.md:211) and `releaseAgeGate()` (:550, :557). (2) law 7 tagged errors replacing `new Error(...)` causes/defects (WorkspaceCatalogsDefect :54, WorkspaceDiscoveryCause :37, WorkspaceRootManifestError :23, WorkspaceSnapshotsTestDoubleError :256); S1 commit e9cdd3ec83 body: 'Tests that asserted a native error class now assert the tagged error' (doubles.test.ts:32, WorkspaceDiscovery.test.ts:433). (3) `JSON.parse` SyntaxError causes -> SchemaError via `S.fromJsonString` (WorkspaceCatalogs.ts:185, WorkspaceDiscovery.ts:341, WorkspacePackage.ts:375): a different `cause` value on `invalidJson`/`decode`. (4) `S.Finite` for LayeringReport.edgeCount (WorkspaceLayering.ts:75; upstream Schema.Number): different accepted input. (5) identity-derived schema identifiers (commit 285e63275a: 'JSON Schema export tests name the new identity-derived definition keys').
- failure: The ledger is the goal's truth (section 17) and the README port notes are what later rounds read to avoid re-raising; both claim nothing deviated, so every seat re-derives these from diffs and promotion later cannot separate deliberate deviations from accidents.
- fix: Add one `deviations` entry per class to PORT_LEDGER.json w4-workspaces (causes `law:tsgo/lazyEffect`, `law:effect-laws-v1#7`, `law:effect-laws-v1#13`, `law:S.Finite`, `law:identity`), each listing its sites and the adjusted upstream test lines, and mirror them under README 'Port notes -> Deviations'; update README.md:211, :550, :557 to the value spelling (`catalogs.set`, `releaseAgeGate`).

### fable-1-2
- file: scratchpad/effected/workspaces/WorkspaceRoot.ts:143
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-31 (reserve Effect.die for invariant violations) and rule 29 (defects are reserved for invariants); .patterns/error-handling.md 'Effect.try pattern' (throwing code is confined to Effect.try); D9   evidence: `if (parsed === null) throw WorkspaceRootManifestError.make({ message: "Cannot read properties of null (reading 'workspaces')" })` is a raw `throw` inside an `Effect.fn` generator carrying a hand-transcribed V8 message, reconstructing a TypeError that upstream only reached through its `JSON.parse(content) as Record<string, unknown>` cast (upstream WorkspaceRoot.ts). No upstream or lab test covers it (no 'reading workspaces'/null-manifest case in WorkspaceRoot.test.ts). Probe (bun, FileSystem.layerNoop with /ws/pnpm-workspace.yaml present and /ws/packages/a/package.json = `null`, `roots.find("/ws/packages/a/src")`): `EXIT DIE: Cause([Die(...WorkspaceRootManifestError: Cannot read properties of null (reading 'workspaces'))])`.
- failure: The generator depends on the runtime converting a thrown value into a Die, the one error path the standards forbid, and the tagged error class exists solely to mimic an engine-specific message string.
- fix: Behaviour-preserving: `if (parsed === null) return yield* Effect.die(WorkspaceRootManifestError.make({ message: ... }))` (keep the message). If the deviation in fable-1-15 is recorded instead, delete the branch so `null` reads as 'not a root' like every other malformed manifest.

### fable-1-3
- file: scratchpad/effected/workspaces/WorkspaceCatalogs.ts:356
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Object in domain logic); gate miss: packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts OBJECT_METHODS = keys/values/entries/fromEntries/assign/hasOwn/freeze/seal/create (no `defineProperty`), and standards/effect-laws.allowlist.jsonc has no WorkspaceCatalogs.ts entry   evidence: Port-introduced: upstream `validCatalogs = catalogs as Record<string, Record<string, string>>` (no copy); the lab copies every validated catalog into `checked` through `Object.defineProperty(checked, name, {...})` only so that TypeScript gets a narrowed record and a `__proto__` catalog name stays an own key.
- failure: A native Object call in domain logic that neither the checker nor the allowlist can see; the per-entry copy exists purely to satisfy narrowing.
- fix: Narrow instead of copying: `const isCatalogsRecord = (v: Record<string, unknown>): v is Record<string, Record<string, string>> => R.values(v).every(isStringRecord);` keep the per-name error loop (minus the defineProperty line), then `if (isCatalogsRecord(catalogs)) validCatalogs = catalogs;` (same reference as upstream, nothing rewritten, so `__proto__` remains an own key).

### fable-1-4
- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:584
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native Array.prototype.sort; use A.sort with an explicit Order); gate miss: NoNativeRuntime.ts:463 flags `.sort` only `inHotspotScope`, and NoNativeRuntimeHotspots.ts scopes hotspots to scratchpad/effect-ontology/**, not scratchpad/effected/**   evidence: `.sort((a, b) => b.prefix.length - a.prefix.length)` at :584; `[...MutableHashMap.values(seen)].sort((a, b) => a.name.localeCompare(b.name))` at :659 and :788.
- failure: Three native sorts in domain logic that the native-runtime gate never scans in this tree.
- fix: `A.sort(Order.mapInput(Order.Number, (e) => -e.prefix.length))` for :584 (same descending-by-length order, stable); hoist one `const byName = Order.make<WorkspacePackage>((a, b) => { const c = a.name.localeCompare(b.name); return c < 0 ? -1 : c > 0 ? 1 : 0; })` and use `A.sort(byName)` at :659 and :788 (keeps localeCompare semantics exactly).

### fable-1-5
- file: scratchpad/effected/workspaces/WorkspaceLayering.ts:114
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; same gate gap as fable-1-4 (NoNativeRuntime.ts:463 hotspot-only)   evidence: Default-comparator `.sort()` on string arrays at :114, :132, :202, :203, :206 and :219.
- failure: Six native sorts in pure domain logic outside the gate's hotspot scope.
- fix: `A.sort(Order.String)` at each site; ordering is identical (default sort compares UTF-16 code units, which is what `Order.String`'s `<`/`>` comparison does).

### fable-1-6
- file: scratchpad/effected/workspaces/WorkspaceSnapshots.ts:460
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; same gate gap as fable-1-4   evidence: `memberDirs.sort();` after the ls-tree loop.
- failure: Native in-place sort in domain logic outside the gate's hotspot scope.
- fix: Collect into `const collected: Array<string> = []` and `const memberDirs = A.sort(collected, Order.String);` (same code-unit order).

### fable-1-7
- file: scratchpad/effected/workspaces/WorkspaceLayering.ts:49
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains; S.Literals only for anonymous inline unions never referenced by name); D5 (kits land at S4); kit precedent scratchpad/effected/xdg/Xdg.ts:23 `LiteralKit([...])` from `@beep/schema/LiteralKit`   evidence: `type OffenceReason = "upward" | "sameLayer" | "toolingReachesLayer" | "intoUnconstrained" | "intoUnclassified"` (:49) is referenced by name (`offence` :100, `offenders` :191) and duplicated verbatim as `S.Literals([...])` inside `LayeringReport.offenders` (:65).
- failure: Two sources of truth for one named domain; adding a reason to one side type-checks until the schema rejects a report at runtime.
- fix: `const OffenceReason = LiteralKit(["upward", "sameLayer", "toolingReachesLayer", "intoUnconstrained", "intoUnclassified"]); type OffenceReason = typeof OffenceReason.Type;` and `reason: OffenceReason` in the offenders struct.

### fable-1-8
- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:90
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; user rule 'never a hand-rolled union of literals'; D5   evidence: `WorkspacePatternError.kind: S.Literals([5 kinds])` (:90) duplicates the named `EnumerationFailureKind` union (internal/enumerate.ts:34) and the inline four-member return type of `patternKindOf` (:155-157, an identity function that only bridges the duplicates); `WorkspaceDiscoveryError.kind: S.Literals([5 kinds])` (:67) duplicates `PatternReadFailure.kind: "read" | "invalidYaml" | "invalidJson"` (internal/patterns.ts:20).
- failure: The same literal domains are spelled three times across the service and its internals with no shared schema, guard or `.Enum`; `patternKindOf` exists only to paper over the duplication.
- fix: `export const EnumerationFailureKind = LiteralKit([...])` in internal/enumerate.ts and `export const PatternReadFailureKind = LiteralKit([...])` in internal/patterns.ts (types derived from them); in WorkspaceDiscovery.ts `const WorkspacePatternErrorKind = LiteralKit([the five])`, `kind: WorkspacePatternErrorKind`, delete `patternKindOf` (the subset literal type is assignable); likewise `const WorkspaceDiscoveryErrorKind = LiteralKit([the five])` for :67.

### fable-1-9
- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:569
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6; 2026-10-09 ruling EFFECTED_PORT_GOAL.md:59-63 ('identity-keyed sets and WeakMaps? ... caches become fields of our own objects') and :86-87 ('the allowlist ends with no scratchpad/effected entry'). New evidence relative to the allowlist: entry commit 07de688d40 (06:07) predates the ruling commit a8a7f89a30 (07:05); note the ruling also postdates the reviewed commit 3fa5876691 (06:37)   evidence: Three `new WeakMap` caches keyed by package-array identity: `ownerIndexes` :569, `packageIndexes` :599, `versionIndexes` :870, currently allowlisted in standards/effect-laws.allowlist.jsonc ('WorkspaceDiscovery.ts', kind new-map-set).
- failure: Native identity-keyed caches the operator ruled must become fields of the module's own memoized state; the allowlist entry keeping them is one the ruling says must end up removed.
- fix: For :569/:599 compute `owners` and `byName` once in `discoverAt` and carry them in the memoized `{ info, packages, owners, byName }` state (refresh discards it exactly as the WeakMap miss did). For :870, which lives in a separate layer that only sees the array, keep a one-slot identity cache `let last: { readonly all: ReadonlyArray<WorkspacePackage>; readonly index: MutableHashMap.MutableHashMap<string, string | undefined> } | undefined` compared with `===` (the ruling's own ancestor-stack precedent); same hit profile because `listPackages` returns one array until refresh. Then drop the allowlist entry.

### fable-1-10
- file: scratchpad/effected/workspaces/WorkspacePackage.ts:26
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6; 2026-10-09 ruling EFFECTED_PORT_GOAL.md:55-58 ('values stay readonly through types, schema classes and Data ... Rejected: one foundation freeze helper (leaves one allowlist entry)'), :83-85 ('null-prototype dictionaries become HashMap internally and public ones are built with R.fromEntries and read with R.get'), :86-87 (allowlist ends with no scratchpad/effected entry); same chronology note as fable-1-9   evidence: `Object.freeze<Record<string, string>>(Object.create(null))` at :26 (EMPTY) and :31 (EMPTY_MANIFEST), and the same shape at WorkspaceStateSnapshot.ts:30, all allowlisted. Every reader already uses own-property access (`R.has` at :250-266 and :287, spreads at :240-245), and WorkspacePackage.test.ts:221 pins inherited-name lookups through `dependencyVersion`, which stays green under `R.has`; no focus suite asserts `isFrozen` or a null prototype.
- failure: Three native-runtime sites held only by allowlist entries the ruling says must go; the frozen null-prototype default protects nothing the own-property readers do not already protect.
- fix: `const EMPTY: Record<string, string> = R.empty();` and `const EMPTY_MANIFEST: Record<string, unknown> = R.empty();` (same at WorkspaceStateSnapshot.ts:30), readonly through the `Readonly<Record>` types the S.Class fields already expose; if shared mutability worries anyone use `Effect.sync(() => R.empty())` in the two defaults for a fresh object per decode. Remove the two allowlist entries and record the class under fable-1-1 ('native-runtime replacements').

### fable-1-11
- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:214
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 6; D5 (effect/HashMap only); 2026-10-09 ruling :64-66 ('public native collections' -> HashMap/HashSet keeping the insertion-order promise)   evidence: Public `ReadonlyMap` surfaces are manufactured from `MutableHashMap.fromIterable(...).backing`: `importerMap` (:214, :626, :772) and `WorkspaceStateSnapshot.versions` (WorkspaceStateSnapshot.ts:208, :222, :243). `backing` is a public typed `Map<K, V>` (node_modules/effect/dist/MutableHashMap.d.ts:59), so this is legal, but it is a native Map handed to consumers through an Effect-collection escape hatch. The ruling enumerates specific collections (chosen, adjacency, YAML anchors, MarkdownDocument.definitions) and not these two, so this needs an operator call rather than a reviewer mandate.
- failure: Two public contracts stay native while the rest of the kit's public collections move to HashMap; the `.backing` detour is the tell.
- fix: Either convert to `HashMap.HashMap<string, WorkspacePackage>` / `HashMap.HashMap<string, string>` recorded as a D9 `law:` deviation with the adjusted tests (WorkspaceDiscovery.test.ts importerMap assertions, WorkspaceSnapshots.test.ts `versions` reads), or record the `.backing` escape as an accepted exception in the README port notes.

### fable-1-12
- file: scratchpad/effected/workspaces/WorkspaceSnapshots.ts:189
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 13 (prefer schema decoding over ad-hoc parsing); tsgo preferSchemaOverJson (does not fire for a plain function, so the gate is silent)   evidence: `parseJsonObject` uses `JSON.parse` inside try/catch while the four sibling files decode through `const JsonValue = S.fromJsonString(S.Unknown)` (WorkspaceCatalogs.ts:60, WorkspaceDiscovery.ts:35, WorkspacePackage.ts:24, WorkspaceRoot.ts:29).
- failure: One file in the module parses JSON outside the schema path the others settled on; upstream parity, so behaviour is unchanged.
- fix: Decode through the same `JsonValue` schema with `S.decodeResult(JsonValue)(text)` and fold the `Result` (`onFailure: () => ({})`, `onSuccess: (p) => isObject(p) ? p : {}`).

### fable-1-13
- file: scratchpad/effected/workspaces/WorkspaceCatalogs.ts:238
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form)   evidence: `P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value)` is exactly `P.isObject` in effect 4.0.2 (probe: `P.isObject([])` false, `P.isObject(() => 1)` false, `P.isObject(null)` false); same three-clause helper at WorkspaceSnapshots.ts:177-178, and `P.isObjectKeyword(parsed) && !P.isFunction(parsed)` at WorkspaceRoot.ts:144 where an array short-circuits to the same `false`. Not the inline guards at WorkspaceCatalogs.ts:252/:257/:262: there an array-form `catalogs` still spreads index keys exactly as upstream/pnpm do, so `P.isObject` would change that (silly) input's result.
- failure: Hand-rolled guards duplicating a stock predicate; WorkspaceDiscovery.ts:906 already uses the stock form, so the module is inconsistent with itself.
- fix: Replace the three sites with `P.isObject` and delete the local `isObject` helpers in WorkspaceCatalogs.ts and WorkspaceSnapshots.ts; leave :252/:257/:262 alone.

### fable-1-14
- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:320
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (Effect.fn span naming); consistency with WorkspaceCatalogs.ts:633 `Effect.fn("WorkspaceCatalogs.make")` and WorkspaceRoot.ts:285 `Effect.fn("WorkspaceRoot.makeTest")`   evidence: `Effect.fn("make")` here and at WorkspaceSnapshots.ts:304; two services share one anonymous span name while their siblings qualify it.
- failure: Traces from two different service constructors are indistinguishable by span name.
- fix: `Effect.fn("WorkspaceDiscovery.make")` and `Effect.fn("WorkspaceSnapshots.make")`.

### fable-1-15
- file: scratchpad/effected/workspaces/WorkspaceRoot.ts:142
- class: bug   severity: backlog
- standard: D9 / section 14 cause 2 (`upstream-bug:<evidence>`); the function's own contract at :117-118 ('A malformed root package.json is "not a root", not an error; the ascent continues past it') and the header at :4-6 ('one unreadable ancestor must not hide a valid root above it')   evidence: `Walker.findRoot` absorbs only typed failures (scratchpad/effected/walker/Walker.ts:174 `Effect.orElseSucceed(predicate(candidate), () => false)`), so the defect from :143 escapes. Probe: with /ws/pnpm-workspace.yaml present and /ws/packages/a/package.json containing `null`, `find("/ws/packages/a/src")` dies with WorkspaceRootManifestError instead of resolving /ws. Upstream has the same latent bug through its `as Record<string, unknown>` cast; no upstream test covers a null manifest. Reported as backlog because it proposes a deviation; the cause and reproduction are supplied for the operator's decision.
- failure: A stray `package.json` whose content is the JSON literal `null` anywhere between cwd and the real root aborts every service built on WorkspaceRoot (discovery, catalogs, snapshots) with a defect, contradicting the walker absorption contract the module advertises.
- fix: Ledger `deviations` entry `upstream-bug:<probe above>` plus README note; replace the throw branch with `return false` (null is simply not a workspace root); add a new test (not an adjusted upstream one) for a null manifest below a valid root.

### fable-1-16
- file: scratchpad/test/workspaces/WorkspaceDiscovery.test.ts:1
- class: tsgo   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14 (`it.layer`/`layer(...)` composition); tsgo strictEffectProvide (Effect.provide with layers outside application entry points); backlog per the brief because S3/test-canon has not run   evidence: `// @effect-diagnostics strictEffectProvide:skip-file` added to WorkspaceDiscovery.test.ts, WorkspaceRoot.test.ts, WorkspaceSnapshots.test.ts and WorkspaceStateSnapshotSeed.test.ts (and 29 more suites in scratchpad/test/workspaces); the upstream suites carry no directive, so the tsgo gate is green by file-wide suppression rather than by composition.
- failure: The 'every Effect rule at error' gate is silenced per file for the whole module's tests, hiding whichever `Effect.provide` sites the rule objects to.
- fix: At S3 provide through `layer(...)`/`it.layer` scopes and drop the directives; if the rule is genuinely wrong for vitest files, scope it off once for scratchpad/test/** in the shared vitest/tsconfig rather than per file.

### fable-1-17
- file: scratchpad/effected/workspaces/README.md:580
- class: docs   severity: backlog
- standard: D4 (README adapted, release boilerplate not carried); EFFECTED_PORT_GOAL.md 10.3 README adaptation   evidence: Three grep-output lines pasted into 'Port notes -> Attribution': `scratchpad/effected/workspaces/Workspaces.ts:38 * Derived from the option shapes...`, `internal/catalogs.ts:7 // be replaced or vendored...`, `testing.ts:9 * A separate subpath...` (README.md:580-582).
- failure: The attribution block reads as a scraped terminal dump rather than a port note.
- fix: Delete README.md:580-582.

### fable-1-18
- file: scratchpad/effected/workspaces/README.md:595
- class: docs   severity: backlog
- standard: D3 (every third-party runtime dep gets a ledger backlog row naming its Effect-native replacement candidate); EFFECTED_PORT_GOAL.md section 13   evidence: README 'Dependency backlog: None' while the module adds four runtime deps (`@pnpm/catalogs.config`, `@pnpm/catalogs.protocol-parser`, `@pnpm/catalogs.resolver`, `@pnpm/catalogs.types`; ledger `newDeps` each with `replacement: null`, `backlog: []`). internal/catalogs.ts:4-10 names itself the single replacement point for the quartet.
- failure: The D3 ledger contract is unmet for this module and the README states the opposite.
- fix: Four ledger backlog rows naming the candidate (an effect/Schema-modelled catalog grammar and resolver in internal/catalogs.ts, the file's own stated seam) and mirror them under README 'Dependency backlog'.

### fable-1-19
- file: scratchpad/effected/workspaces/internal/catalogs.ts:76
- class: law   severity: backlog
- standard: standards/effect-laws-v1.md law 6 and the allowlist contract (entries must match a live violation); 2026-10-09 ruling :83-85 (R.fromEntries/R.get for dictionaries)   evidence: `Object.defineProperty(target, key, ...)` in the `__proto__`-only `define` helper (upstream parity) escapes the native-runtime gate (OBJECT_METHODS lacks `defineProperty`), so it can be neither flagged nor allowlisted today. Outside the focus list; recorded so the gate gap is fixed once.
- failure: A native Object call the checker cannot see and the allowlist cannot register.
- fix: Add `defineProperty` to NoNativeRuntime.ts OBJECT_METHODS, then either allowlist this one `__proto__`-safety site with a reason or build `entries`/`clean` through `R.fromEntries` (own-property semantics via Object.fromEntries) and retarget the two hostile-`__proto__` cases in WorkspaceCatalogs.test.ts.

### fable-1-20
- file: scratchpad/effected/workspaces/WorkspaceCatalogs.ts:1
- class: docs   severity: backlog
- standard: D4 (carried documentation surfaces, header comments included); .patterns/module-organization.md import grouping   evidence: `import { $ScratchpadId }` and `import { dual }` sit above the carried upstream header comment (:3-8), splitting it from the top of the file; `A`/`P`/`R` imports are appended after the local `./` imports at :47-49 instead of with the other effect modules.
- failure: The upstream file header no longer heads the file and the import block is split in two.
- fix: Move the two imports into the import block below the header and group the effect module imports together.

REQUIRED: 10
BACKLOG: 10
