### fable-1-1
- file: scratchpad/effected/workspaces/PeerCheck.ts:400
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Object/Map/Set/Date in domain logic); EFFECTED_PORT_GOAL D5 and section 16 (effect/HashMap|MutableHashMap only, never native Set/Map)   evidence: PeerCheck.ts:400, :972 and :1169 take `byId: ReadonlyMap<string, ResolvedPackage>` and call native `.get` at :413, :865, :1058, :1172. The maps come from internal/roots.ts:30, which reaches into the MutableHashMap implementation field: `return { byId: byId.backing, workspaceByPath: workspaceByPath.backing }` (same trick at WorkspaceStateSnapshot.ts:222). `backing: Map<K, V>` is the installed implementation detail (node_modules/effect/dist/MutableHashMap.d.ts:59). The gate missed it: packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts only reports `new Map`/`new Set` constructors (`mapSetCtor`, line 397); no allowlist entry names roots.ts or PeerCheck.ts. The 10-09 grilling rejected exactly this kind of evasion ("not Object.defineProperties, which only evades the law").
- failure: The module's half-conversion leaves native Map lookups and a native ReadonlyMap public type inside PeerCheck while appearing law-clean; any change to MutableHashMap's internal `backing` representation breaks roots.ts and every PeerCheck walk silently (the field is not part of the documented API surface).
- fix: Make `InstanceIndex.byId`/`workspaceByPath` `MutableHashMap.MutableHashMap<string, ResolvedPackage>` in internal/roots.ts (drop the `.backing` extraction, return the maps), and in PeerCheck.ts read them through `O.getOrUndefined(MutableHashMap.get(byId, id))` at :413, :865, :1058, :1172 (update the three `byId` parameter types).

### fable-1-2
- file: scratchpad/effected/workspaces/PackedInstall.ts:759
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native Array.prototype.sort; use A.sort with an explicit Order)   evidence: PackedInstall.ts:759 `for (const name of [...MutableHashMap.keys(wanted)].sort())` and :1347 `${[...names].sort().join(", ")}`. Not one of the four gated laws, so the gate did not see it; VersioningStrategy.ts:148 was converted to `A.sort(..., Str.Order)` in the same S1 pass, so the module is inconsistent. Default string sort is UTF-16 code-unit order, identical to `Str.Order` (`order.String`, node_modules/effect/dist/String.js:76), so the change is behaviour-preserving.
- failure: Law 10 violation in module source; a reviewer or future lint hardening (`A.sort` rule) fails the module.
- fix: `A.sort(A.fromIterable(MutableHashMap.keys(wanted)), Str.Order)` at :759 and `A.sort(names, Str.Order).join(", ")` at :1347 (import `* as A from "effect/Array"` and `* as Str from "effect/String"`).

### fable-1-3
- file: scratchpad/effected/workspaces/SourceBoundary.ts:618
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native Array.prototype.sort; use A.sort with an explicit Order)   evidence: SourceBoundary.ts:618 `.sort((a, b) => a.offset - b.offset)`; :706-709 `files.sort(byCodeUnit)`, `allowed.sort(byCodeUnit)`, `offences.sort(byPosition)`, `waived.sort(byPosition)` with hand-rolled comparators at :195-197. Not covered by the four gated laws. `A.sort` returns a new array; the sorted values are identical (stable sort, same comparison), so the `SourceScan` output is unchanged.
- failure: Law 10 violation in module source with ad-hoc comparator helpers that `Order.mapInput`/`Order.combine` already express.
- fix: Define `const byCodeUnit = Str.Order; const byPosition = Order.combine(Order.mapInput(Str.Order, (o: Offence) => o.file), Order.combine(Order.mapInput(Num.Order, (o) => o.line), Order.mapInput(Num.Order, (o) => o.column)))` and use `A.sort(found, Order.mapInput(Num.Order, (f) => f.offset))` at :618 and `A.sort(files, byCodeUnit)` etc. at :706-709.

### fable-1-4
- file: scratchpad/test/workspaces/SourceBoundary.test.ts:103
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D9 (upstream tests and fixtures are the contract) and section 11.1 (rewrites per section 5.2 only; no test weakened); section 5.2 covers import specifiers of the test file, not source-text fixtures inside string literals   evidence: diff against the oracle __test__/SourceBoundary.test.ts: the inputs to `SourceBoundary.importSpecifiers` were rewritten from `'import { a } from "./a.js"'` etc. to `"./a.ts"` (lab :103-108, :110-111 and the expected list :114-121), `'// import x from "./gone.js"'`/`'obj.require("./not.js")'` to `.ts` (:147-148), while the template-literal case `"const f = await import(`./f.js`)"` (:109) was left as `.js`, so the fixture is now a mixed `./a.ts … ./f.js … ./g.ts` list, the signature of an over-applied `.js`→`.ts` codemod. Line :140 also changed `require("./y/" + name)` to `require("./y" + name)`, a content change with no section 5.2 basis. No README Port notes or ledger `deviations` entry records any of it (README.md:589 `None`).
- failure: The upstream test no longer proves that `.js` specifiers (the form every upstream consumer scans) are extracted, and a fixture was silently altered; the suite passes but its meaning drifted, which is what D9 forbids.
- fix: Restore the upstream string literals at :103-108, :110-111, :114-121, :140, :147-148 (`.js` and `"./y/"`); the scanner is extension-agnostic so the test stays green.

### fable-1-5
- file: scratchpad/effected/workspaces/SourceBoundary.ts:106
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D9 + section 14 deviation protocol (ledger entry first, adjusted upstream test cited, README Port notes → Deviations); operator ruling 2026-10-09: one ledger plus README deviation entry per module per systemic class (S.Finite named explicitly)   evidence: `Offence.line`/`Offence.column` moved from upstream `Schema.Number` to `S.Finite` (:106, :108) under tsgo `schema-number` (effect-tsgo docs/rules/schema-number.md, at error in the gate). This is an observable deviation per section 14 (a different accepted input: `Offence.make({ line: Infinity })` / decoding `{line: NaN}` now fails). README.md:589 says `### Deviations` → `None` and the ledger row `w4-workspaces` has `deviations: []`. The jsonc precedent recorded the same class (PORT_LEDGER.json:627-645, jsonc README.md:294/318) and added `rejects a non-finite width` tests; `rg -n "Infinity|NaN|Finite" scratchpad/test/workspaces/SourceBoundary*.test.ts` finds nothing here.
- failure: An unrecorded behaviour deviation: a later reviewer or the promotion re-grill cannot tell a law-forced change from drift, and the new rejection is untested.
- fix: Add a `law:tsgo schema-number` entry to the ledger `deviations` and README Port notes → Deviations listing every `S.Finite` site in the module (SourceBoundary.ts:106,108 at least), and add one test asserting `Offence` rejects a non-finite line/column, as jsonc did.

### fable-1-6
- file: scratchpad/effected/workspaces/VersioningStrategy.ts:179
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D9 + section 14; operator rulings 2026-10-09 (law-forced public API changes are allowed but each systemic class gets a ledger + README deviation entry citing the adjusted upstream tests; non-law-forced thunk→value changes must be restored)   evidence: Upstream `WorkspaceDiscovery` shape has `info: () => Effect` and `listPackages: () => Effect` (oracle src/WorkspaceDiscovery.ts:188,190); the lab made both values (WorkspaceDiscovery.ts:210,212) under tsgo `lazy-effect` (effect-tsgo docs/rules/lazy-effect.md, at error). Call sites in this part: VersioningStrategy.ts:179 `yield* discovery.listPackages`, PackedInstall.ts:724 `discovery.listPackages.pipe(...)` and :740 `discovery.info.pipe(...)`. Upstream tests were rewritten to match (`listPackages()` appears in 5+ oracle test files, 0 in the lab; lab doubles now use `listPackages: Effect.suspend(() => ...)` in PackedInstall.test.ts, PackedInstallPreflight.test.ts, VersioningStrategy.test.ts). README.md:589 records `None`; ledger `deviations: []`.
- failure: A public service-shape change and the test rewrites it forced are undocumented; without the entry the 10-09 ruling's default ("restore the upstream shape") applies and the next fix wave may undo a law-forced change.
- fix: Record one `law:tsgo lazy-effect` deviation entry (ledger + README Port notes → Deviations) naming `WorkspaceDiscovery.info`/`listPackages` and every adjusted upstream test file; no code change.

### fable-1-7
- file: scratchpad/effected/workspaces/PackedInstall.ts:1406
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL D9 + section 14 (a different error shape is an observable deviation and needs a `law:<id>` entry)   evidence: Upstream `binProvenance` parsed the manifest with `Effect.try({ try: () => JSON.parse(text), catch: io(...) })`, so `PackedInstallError.cause` carried the `SyntaxError`; the lab decodes through `S.decodeEffect(JsonValue)` (`JsonValue = S.fromJsonString(S.Unknown)`, :41) and maps the `SchemaError` into `cause` (:1406), forced by tsgo `prefer-schema-over-json` (docs/rules/prefer-schema-over-json.md, at error). The only upstream test (PackedInstall.test.ts:1212-1215) checks `reason` and `message`, not `cause`, so the change is unobserved by the suite but observable to consumers reading `cause`. README.md:589 `None`; ledger `deviations: []`.
- failure: An unrecorded error-shape deviation on a public `S.TaggedError` field.
- fix: Add a `law:tsgo prefer-schema-over-json` deviation entry (ledger + README) naming `PackedInstallError.cause` on the `is not JSON` path and the sites it covers; optionally assert `SchemaIssue.isIssue(error.cause)` in the existing test so the shape is pinned.

### fable-1-8
- file: scratchpad/effected/workspaces/VersioningStrategy.ts:229
- class: effect-idiom   severity: backlog
- standard: EFFECTED_PORT_GOAL section 11.3 (a branch unreachable by construction is a finding against the source: simplify it); effect-laws-v1 law 21 (tersest equivalent form)   evidence: `tagsFor` returns at :226 when `releases.length === 0`, so `const first = releases[0]; return first === undefined ? [] : [...]` (:228-229) can never take the `[]` arm; it exists only to satisfy `noUncheckedIndexedAccess` on the upstream `releases[0].version`. S3 per-file 100 percent branch coverage will flag the dead arm.
- failure: Dead branch that coverage cannot close without a coverage-ignore comment, which section 11.3 and section 16 forbid.
- fix: `if (!A.isNonEmptyReadonlyArray(releases)) return []; if (this.perPackageTags) {...} return [ReleaseTag.single(A.headNonEmpty(releases).version, options)];` (import `* as A from "effect/Array"`, already present).

### fable-1-9
- file: scratchpad/effected/workspaces/PackedInstall.ts:312
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (direct helper refs over trivial wrapper predicates); installed node_modules/effect/dist/Predicate.js:687 and :782   evidence: `P.isObjectKeyword(x) && !P.isFunction(x)` (PackedInstall.ts:312, :1408; PeerCheck.ts:454) is exactly `P.isObjectOrArray(x)` (`typeof input === "object" && input !== null`; `isObjectKeyword` is that OR `isFunction`). PeerCheck.ts:452 already uses `P.isObjectOrArray(meta)` two lines above the long form.
- failure: Three roundabout predicates that read as if functions were a meaningful case; no behaviour difference.
- fix: Replace each with `P.isObjectOrArray(...)`; the `"code" in`/`"name" in`/`"optional" in` narrowing still applies.

### fable-1-10
- file: scratchpad/effected/workspaces/PeerCheck.ts:240
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (immutable values for module-level constants; prefer the immutable collection when nothing mutates it); upstream typed both as `ReadonlySet`   evidence: `PEER_RESOLVING_FORMATS` (PeerCheck.ts:240) and `STDERR_METHODS` (SourceBoundary.ts:208) are module-scope `MutableHashSet`s that are only ever read (`MutableHashSet.has`). Upstream exposed them as `ReadonlySet<string>`; the port widened the contract to a mutable structure.
- failure: A shared mutable singleton where upstream guaranteed read-only; any accidental `MutableHashSet.add` changes module-wide behaviour.
- fix: `HashSet.make("npm", "pnpm", "bun")` / `HashSet.make("error", "warn", "trace", "assert")` with `HashSet.has` (import `* as HashSet from "effect/HashSet"`).

### fable-1-11
- file: scratchpad/effected/workspaces/VersioningStrategy.ts:148
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form)   evidence: `A.sort(A.fromIterable(MutableHashSet.fromIterable(options.packages)), Str.Order)` builds a hash set only to de-duplicate strings; installed `effect/Array` exports `dedupe` (Array.d.ts:8693), which keeps first occurrences and feeds `A.sort` directly with the same result.
- failure: Extra allocation and an unneeded `MutableHashSet` import for a one-line dedupe.
- fix: `const packages = A.sort(A.dedupe(options.packages), Str.Order);` and drop the `MutableHashSet` import.

### fable-1-12
- file: scratchpad/test/workspaces/PeerCheck.test.ts:1
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL section 11.2/11.3 (S3 canon; D14 memfs double for filesystem reads) and section 12.1 (tsgo diagnostics with every rule at error); brief: test-canon findings are backlog until S3   evidence: File-wide `// @effect-diagnostics nodeBuiltinImport:skip-file` was added to PeerCheck.test.ts:1 (also SourceBoundary.test.ts:1, e2e/PackedInstall.e2e.test.ts:1 with `processEnvInEffect:skip-file`, VersioningStrategy.test.ts:1 with `strictEffectProvide:skip-file`; 20 workspaces test files carry such directives) so the `node:fs`/`node:path` fixture reads pass the gate. Nothing in README Port notes, the ledger row, or TESTS_NOT_PASSING.md records the suppressions.
- failure: "Every Effect rule at error" does not hold for those files: the whole file, not just the fixture loader, is exempt from the named rules, and the exemption is invisible to the next round.
- fix: At S3 route fixture reads through the ported memfs double or `FileSystem.FileSystem` from the platform layer and delete the directive; until then list the directives (file + rules) under the ledger `backlog` so they are tracked.

REQUIRED: 7
BACKLOG: 5
