### fable-1-1
- file: scratchpad/effected/github-actions/DetachedProcess.ts:21
- class: law   severity: required
- standard: standards/effect-laws-v1.md Allowlist Contract ("Do not add entries for scanner misses or cleanup convenience ... remediate the module"); NoNativeRuntime.ts:87 NODE_RUNTIME_IMPORTS = node:fs, node:path, node:child_process; tsconfig.base.json:184 nodeBuiltinImport: error; EFFECTED_PORT_GOAL.md section 16 (never weaken a test), D9, 2026-10-09 rulings (native-runtime sites that cannot move carry an allowlist entry with a reason; `Object.defineProperties` rejected because it "only evades the law")   evidence: DetachedProcess.ts:21-22 `const { spawn: spawnChild } = process.getBuiltinModule("node:child_process"); const { closeSync, openSync } = process.getBuiltinModule("node:fs");` replace upstream's static `import { spawn } from "node:child_process"` / `import { closeSync, openSync } from "node:fs"`. Neither the `native-runtime` law (import-declaration scan) nor the `nodeBuiltinImport` diagnostic sees a `getBuiltinModule` call, so the gates are green with no allowlist entry (standards/effect-laws.allowlist.jsonc has no DetachedProcess row) and no directive. The same mechanism in internal/digest.ts:9 and internal/sigv4.ts:8 (`node:crypto`) blinded the oracle's bundle walker: upstream __test__/reachability.test.ts pins `node:crypto` in four exact edge sets (:172, :179, :254, :287, "`node:crypto` is the sanctioned import"); the lab copy scratchpad/test/github-actions/reachability.test.ts deleted all four entries while keeping the comments (:172, :251). Precedent: scratchpad/test/jsonc/JsoncFingerprint.test.ts:2 uses the documented `// @effect-diagnostics-next-line nodeBuiltinImport:off` directive.
- failure: A native-runtime boundary (core ChildProcess cannot route detached output to file descriptors, per the file's own comment) is hidden from both gates instead of being an auditable exception, and the upstream reachability contract that the sanctioned `node:crypto` edge stays confined to the digest helpers no longer exists: a stray `node:*` reached through `getBuiltinModule` anywhere in the light half now passes the "exact edge set" tests. The oracle suite was weakened without a recorded deviation.
- fix: Restore the static builtin imports under `// @effect-diagnostics-next-line nodeBuiltinImport:off` and add `beep-laws/no-native-runtime` allowlist rows for DetachedProcess.ts (reason: detached fd stdio has no Effect counterpart) and the two `node:crypto` helpers; restore the four `node:crypto` entries in scratchpad/test/github-actions/reachability.test.ts. If the operator keeps `getBuiltinModule`, record it as a `law:` deviation (native-runtime replacements class) citing the four adjusted assertions.

### fable-1-2
- file: scratchpad/effected/github-actions/BlobStore.ts:240
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-9 (time is effectful: prefer `Clock`/`DateTime.now`); effect-tsgo rule globalDateInEffect (tsconfig.base.json:154, error) whose stated remedy is `Clock`   evidence: `now: DateTime.toDateUtc(DateTime.nowUnsafe())` replaces upstream `now: new Date()` inside `request`, a sync helper called from the `send` Effect at :252-260. `DateTime.nowUnsafe` (DateTime.d.ts:886, `LazyArg<Utc>`) reads the global wall clock; `DateTime.now` (DateTime.d.ts:842, `Effect<Utc>`) reads the fiber's Clock. The diagnostic is satisfied syntactically while the signing time still bypasses the Clock. BlobStore.test.ts asserts only the `AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/` prefix (:156) and signed-header names (:106-111), so a Clock-driven date is test-neutral; under the live Clock the bytes are identical to upstream.
- failure: The S3 layer's SigV4 timestamp cannot be controlled by TestClock and the port keeps the exact `new Date()` semantics the rule exists to remove, renamed.
- fix: In `send`, read the time effectfully and thread it in: `DateTime.now.pipe(Effect.flatMap((now) => { const { url, headers } = request(method, key, body, DateTime.toDateUtc(now)); ... }))`, with `request` taking `now: Date` as a parameter.

### fable-1-3
- file: scratchpad/effected/github-actions/CacheKey.ts:392
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native `Array.prototype.sort`; `A.sort` with an explicit `Order`); EF-5; sbom round-1 INVENTORY r1 (same gate miss, required)   evidence: `const ordered = [...HashSet.fromIterable(files)].sort();` (:392) and `.filter((candidate) => set.matches(candidate)).sort().map(...)` (:515-518). NoNativeRuntime.ts:463 only flags `.sort` on an identifier receiver inside a hotspot scope, so spread and chained receivers pass the green `native-runtime --check`. Both arrays are `string[]`; default `.sort()` compares UTF-16 code units, exactly what `Order.String` (effect/Order.d.ts:127) does, so the digest fold order and `matchingFiles` order are unchanged.
- failure: Native sort survives the law in the two places that define cache-key determinism (the per-file digest fold and the sorted match list).
- fix: `const ordered = pipe([...HashSet.fromIterable(files)], A.sort(Order.String));` and `pipe([...candidates], A.filter((candidate) => set.matches(candidate)), A.sort(Order.String), A.map((candidate) => path.join(workspace, candidate)))` with `A` from effect/Array and `Order` from effect/Order.

### fable-1-4
- file: scratchpad/effected/github-actions/CheckState.ts:30
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (`LiteralKit` for named internal literal domains, especially annotation-bearing ones); standards/schema-first-development-prompt.md "Derive behavior instead of duplicating truth"; D5 (kit substitutions land in S4); port precedent scratchpad/effected/env/Audience.ts:21 and github-references/KeywordFamily.ts:22   evidence: `export const CheckState = S.Literals([...7 literals]).pipe($I.annoteSchema("CheckState", {...}))` is a named, exported, annotation-bearing literal domain, referenced by name as a type (:45), as a field (CheckDocument.ts:34 `CheckState.annotateKey(...)`), through `.literals` (scratchpad/test/github-actions/CheckState.test.ts:10) and by the seven-way `Match.value(state)` in `projectCheckState` (:88-100). @beep/schema LiteralKit keeps `.literals`, `.annotate`, `.annotateKey` and adds `.Enum`/`.is`/`$match` (LiteralKit.schema.ts:320-356).
- failure: The vocabulary is spelled with the anonymous-union constructor the law reserves for inline, never-named unions; consumers get no `.Enum`/`.is`/`$match` and the module is below the D5 end-state bar every other reviewed module was held to.
- fix: `export const CheckState = LiteralKit(["running", ...]).annotate($I.annote("CheckState", { description: "The kit's check-state vocabulary." }));` with `import { LiteralKit } from "@beep/schema"`; `CheckState.annotateKey` in CheckDocument.ts and `CheckState.literals` in the test keep working unchanged.

### fable-1-5
- file: scratchpad/effected/github-actions/DetachedProcess.ts:165
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18 / standards/effect-first-development.md EF-12c (reusable `S.makeFilter` must carry `identifier`, `title`, `description`); law 17 and schema-first prompt "Prefer built-in schemas and checks before custom filters"; npm round-1 INVENTORY (reusable checks without metadata, required)   evidence: `ProcessId` (exported, `@public`) is `S.Number.pipe(S.check(S.makeFilter((value) => (Number.isInteger(value) && value > 0 ? undefined : "Expected a positive integer process id"), undefined, true), S.isFinite()), S.brand("ProcessId"))`: the filter's annotations argument is the literal `undefined`, and the appended `S.isFinite()` is unreachable as a failure (the preceding filter aborts on anything that is not a positive integer, and every positive integer is finite). No test asserts the issue text (grep of scratchpad/test/github-actions for "positive integer process id" is empty).
- failure: The one schema a pid crosses the phase boundary through has no identifier/title/description for JSON Schema, docs or issue formatting, and carries a dead check that reads as if NaN/Infinity needed a second guard.
- fix: Behaviour-neutral: keep the string-returning filter, pass `$I.annote("ProcessId", { title: "a positive integer process id", description: "A pid read back from GITHUB_STATE: a positive integer; 0 and negatives target a process group." })` as its annotations, and delete `S.isFinite()`. (Using `S.isInt()` + `S.isGreaterThan(0)` instead would change the issue text and needs a `law:17` deviation entry.)

### fable-1-6
- file: scratchpad/effected/github-actions/CacheKey.ts:91
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18 / EF-12c (reusable filters carry `identifier`, `title`, `description`); SCHEMA.md "Filter error messages and schema identifiers" (filter label = `message`, then `expected`, then `<filter>`; `identifier` never names a failed filter, so adding it leaves issue text unchanged)   evidence: `Segments` (:91-95) is `S.NonEmptyArray(Segment).check(S.makeFilter(..., { title: "a cache key of at most 512 characters" }))` — title only; the class-level cross-field filter (:153-159) `S.makeFilter((key) => ... ? undefined : "every restore depth must be ...")` has no annotations at all. Both sit on the exported `CacheKey` class schema that `ActionCache.restore`, `ActionState` and the JSON Schema export (CacheKey.test.ts:555-562) consume.
- failure: Two reusable constraints that define the cache-key grammar are anonymous in JSON Schema, docgen and issue trees; the port added field-level `annotateKey` descriptions everywhere else and left the two filters bare.
- fix: Add `identifier`/`description` beside the existing `title` on the `Segments` filter and give the cross-field filter `{ identifier, title, description }` (via `$I.annote`), keeping the string message the filter already returns; re-run CacheKey.test.ts "JSON Schema export" to confirm the `segments.items.pattern` path is untouched.

### fable-1-7
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:18
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (`A/O/P/R/S` aliases only; `import * as S from "effect/Schema"`); config-file round-1 INVENTORY fable-1-4 (same alias, required; explains why the alias-preserving `effect-imports` gate misses it)   evidence: `import * as Schema from "effect/Schema";` (:18) and `Schema.Constraint` (:47), `Schema.Struct.Fields` (:57, :101, :119), `Schema.encodeUnknownResult(Schema.make<Schema.Codec<unknown, unknown>>(field.ast))` (:326), `Schema.decodeUnknownResult(Schema.String)` (:331). Every other file in the module uses `S`, and this file's own JSDoc example at :301-306 already uses `S`. EffectImports.ts rewrites specifiers but preserves whatever alias it finds (specifier records carry `alias`, :804/:884), so the green gate is not evidence of compliance.
- failure: The authoritative alias law is broken in one file of the module, and the file's public types (`GitHubRowSchema`, `GitHubSchemaTableColumns`) are spelled with the forbidden namespace in docgen output.
- fix: `import * as S from "effect/Schema"` and rename the eleven `Schema.` uses to `S.`; `SchemaAST` stays as is.

### fable-1-8
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:327
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 21 / EF-5 (direct helper refs over trivial wrapper lambdas); sbom round-1 INVENTORY r9 (source sites required, test sites deferred to S3)   evidence: `Result.getOrThrowWith((error) => error)` at GitHubMarkdown.ts:327 and :331 and OidcTokenIssuer.ts:261; node_modules/effect/dist/Result.js:850 defines `getOrThrow = getOrThrowWith(identity)` and Result.d.ts:1934 exports it, so the lambda is the identity helper respelled. The `terse-effect` gate passed this commit, so it does not catch this form. Ten more sites exist in the module's tests (S3 canon work).
- failure: A trivial wrapper lambda stands in for the direct helper in three production sites, contrary to the tersest-form law the gate claims to enforce.
- fix: Replace each with `Result.getOrThrow` (e.g. `flow(Schema.encodeUnknownResult(...), Result.getOrThrow)` and `Result.getOrThrow(Schema.decodeUnknownResult(Schema.String)(rendered))`).

### fable-1-9
- file: scratchpad/effected/github-actions/CacheKey.ts:16
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL.md D2 (every addition is listed under Port notes → Added exports) and the 2026-10-09 ruling ("added exports go to `exportsAdded`"); README.md:331-333 "Added exports: None"; PORT_LEDGER.json row w5-github-actions `exportsAdded: []`   evidence: Four lab-only `export class ... extends S.TaggedError` were introduced to replace `throw new Error`/`RangeError`: InvalidDigestLengthError (CacheKey.ts:16), UnhandledCheckStateError (CheckState.ts:8), MissingProcessIdError (DetachedProcess.ts:16), RejectedRegionDialectError (ManagedDocument.ts:12). None is re-exported from index.ts (:88, :99-104, :106-118, :139). `CacheKey.digest`'s JSDoc (:349) documents the throw and scratchpad/test/github-actions/CacheKey.test.ts:14 has to deep-import `InvalidDigestLengthError` from `../../effected/github-actions/CacheKey.ts` because the entrypoint cannot reach it.
- failure: A documented, tested public throw is not importable from the module entry (no `catchTag`/`instanceof` for consumers), and the entry surface disagrees with what the ledger/README will record: an `exportsAdded` entry with `entry: "."` would be false for names index.ts does not export, while leaving them unlisted breaks D2.
- fix: Re-export `InvalidDigestLengthError` from index.ts beside `CacheKeyReadError`; for the three defect-only guards either re-export them too or drop `export` (module-private), so the entry surface and the codemod-generated `exportsAdded`/README list agree.

### fable-1-10
- file: scratchpad/effected/github-actions/CheckDocument.ts:122
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native `Date` in domain logic); NoNativeRuntime.ts:67 DATE_METHODS includes `parse`; 2026-10-09 grilling ruling: "Date.parse in github-actions CheckDocument? A: `DateTime.make` plus `DateTime.Order` (zone-less stamps read as UTC), recorded as a D9 deviation" and "the allowlist ends with no `scratchpad/effected` entry"   evidence: `compareAt` (:121-125) still calls `Date.parse(left)` / `Date.parse(right)`; the commit is green only through standards/effect-laws.allowlist.jsonc:350-357 (`EFFECTED-GHA-LOCAL-TIME-PARSE`, kind `date-static`), whose reason (local-time vs UTC reading of zone-less stamps) the operator has already ruled on. `DateTime.make` (DateTime.d.ts:797, returns Option) and `DateTime.Order` (DateTime.d.ts:519) exist in the installed Effect.
- failure: The module's stamp ordering keeps the allowlisted native call the ruling retired; the fix wave that must land with round 1 has nothing in this inventory pointing at it.
- fix: `compareAt = (left, right) => O.match(O.all([DateTime.make(left), DateTime.make(right)]), { onNone: () => order(left, right), onSome: ([l, r]) => DateTime.Order(l, r) })`, delete the allowlist row, and record the native-runtime-replacements deviation (zone-less stamps now compare as UTC) citing any CheckDocument.test.ts stamp assertion that shifts.

### fable-1-11
- file: scratchpad/effected/github-actions/CacheKey.ts:366
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 / section 14 (ledger `deviations` entry first, then the adjusted upstream test, then README Port notes → Deviations); 2026-10-09 ruling: one codemod-generated entry per module per systemic class ("tagged errors")   evidence: `throw InvalidDigestLengthError.make({ message: ... })` replaces upstream `throw new RangeError(...)` (law:7 forced). The oracle test was adjusted: upstream __test__/CacheKey.test.ts:237-241 `assert.throws(..., RangeError)` is now scratchpad/test/github-actions/CacheKey.test.ts:245-249 `assert.throws(..., InvalidDigestLengthError)`. README.md:335-337 says "Deviations: None" and the ledger row has `deviations: []`.
- failure: An observable, test-adjusted behaviour change has no record; the tagged-errors systemic class for this module is empty.
- fix: Handled by the deviation codemod: emit the module's tagged-errors deviation entry listing this site and the adjusted test lines (ledger + README).

### fable-1-12
- file: scratchpad/effected/github-actions/CacheKey.ts:141
- class: law   severity: backlog
- standard: D9 / section 14; 2026-10-09 ruling (identity-keys systemic class, codemod-generated); semver round-1 INVENTORY codemod-1 (same finding, disposition codemod)   evidence: `S.Class<CacheKey>($I`CacheKey`)` and `S.Class<ManagedDocument>($I`ManagedDocument`)` change the JSON Schema definition names; scratchpad/test/github-actions/CacheKey.test.ts:559 was retargeted from `definitions.CacheKeyEncoded...` to `definitions.@beep/scratchpad/effected/github-actions/CacheKey/CacheKeyEncoded...`, and ManagedDocument.test.ts likewise (`definitions.@beep/scratchpad/effected/github-actions/ManagedDocument/ManagedDocumentEncoded`). README/ledger report no deviations.
- failure: Law-forced identity-key changes with retargeted oracle assertions are unrecorded for this module.
- fix: Handled by the deviation codemod: one identity-keys entry listing the schema/error/service sites and the two adjusted JSON Schema assertions.

### fable-1-13
- file: scratchpad/effected/github-actions/BlobStore.ts:267
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-14 (`Effect.fn("Name")` for reusable/public functions, `Effect.fnUntraced` for internals); EF-15 (observable spans); the module's own `Module.member` span convention   evidence: Lab-added spans use bare names: `Effect.fn("get")`, `"put"`, `"has"` (BlobStore.ts:267, :280, :286) beside `"BlobStore.get"` at :196; `Effect.fn("makeS3")` (:216); `Effect.fn("identified")` (GitHubToken.ts:111); `Effect.fn("readClaims")` (OidcTokenIssuer.ts:107). Upstream named every span `Module.member` (`CacheKey.hashFiles`, `DetachedProcess.spawn`, `CheckDocument.report`). The three internals (`makeS3`, `identified`, `readClaims`) had no span upstream; `Effect.fnUntraced` reproduces that exactly while satisfying law 22.
- failure: Traces from the S3 backend and the token/OIDC helpers carry ambiguous span names (`get`, `identified`) that cannot be attributed to a module, and three internal helpers gained spans upstream never emitted.
- fix: Rename to `"BlobStore.get"`/`"BlobStore.put"`/`"BlobStore.has"`, and use `Effect.fnUntraced` for `makeS3`, `identified` and `readClaims` (or name them `"BlobStore.makeS3"` etc.).

### fable-1-14
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:331
- class: perf   severity: backlog
- standard: D11 (perf is required only with a measurement or algorithmic class); the file's own invariant at :322-324 ("Built once per column, not per cell — this is the one path that renders in a loop")   evidence: `project` now runs `Schema.decodeUnknownResult(Schema.String)(rendered)` on every cell, constructing the decoder per call, where upstream only called the once-per-column `encode`/`format`. Constant-factor per-cell allocation; not measured.
- failure: The per-column build invariant the comment promises is broken on the one hot path of the writer.
- fix: Hoist `const asString = Schema.decodeUnknownResult(Schema.String)` (or a `P.isString` guard) to module scope and call it in `project`.

### fable-1-15
- file: scratchpad/effected/github-actions/GitHubToken.ts:217
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 / EF-5 (tersest equivalent helper form)   evidence: Consecutive single-key spreads `...O.getSomesStruct({ installationId: O.fromUndefinedOr(options.installationId) }), ...O.getSomesStruct({ owner: O.fromUndefinedOr(options.owner) })` (:217-218) and four in a row at :292-295; `getSomesStruct` already accepts a multi-key struct (packages/foundation/modeling/utils/src/Option.ts:112).
- failure: Each spread allocates and filters a one-field record where one call expresses the whole optional block.
- fix: `...O.getSomesStruct({ installationId: O.fromUndefinedOr(options.installationId), owner: O.fromUndefinedOr(options.owner) })` and likewise for retry/baseUrl/userAgent/fetch.

### fable-1-16
- file: scratchpad/effected/github-actions/CheckState.ts:97
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 11 (`Match`, exhaustive); effect/Match `exhaustive` (Match.d.ts:1944); D9 (unreachable-path message would still be a recorded deviation)   evidence: `Match.orElse((unhandled: never) => { throw UnhandledCheckStateError.make(...) })` reproduces upstream's `default: never` arm with a lab-only error class; `Match.exhaustive` gives the same compile-time guarantee and throws on the unreachable input without the extra export. OidcTokenIssuer.ts:47 and BlobStore.ts:48 use `Match.orElse` for the last literal of a closed union, so adding a literal to `reason` would compile silently.
- failure: Exhaustiveness is enforced by a typed-`never` callback trick in one place and not at all in two `message` getters.
- fix: `Match.when("timeout", ...)` + `Match.exhaustive` in `projectCheckState` (drop `UnhandledCheckStateError`), and `Match.when("missingClaims", ...)`/`Match.when("misconfigured", ...)` + `Match.exhaustive` in the two getters; record the unreachable-path message change with the tagged-errors codemod entry.

### fable-1-17
- file: scratchpad/effected/github-actions/CheckDocument.ts:388
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 6 (no native `Map` in domain logic); D2 (beep-idiomatic shape allowed); 2026-10-09 ruling on public native collections (HashMap/HashSet with recorded deviations)   evidence: The registry is a `MutableHashMap` in a `Ref` (:388, copy-on-write at :509-513) but the public `render` callback (:243) and `checks` (:306) keep upstream's native `ReadonlyMap`, bridged by reaching into `checks.backing` (:446, :518). `backing` is a public field (MutableHashMap.d.ts:59) that holds only primitive keys, which is fine for string keys but undocumented at the call sites.
- failure: The law-6 boundary is moved one field inward rather than resolved: the public surface still speaks native `ReadonlyMap` and the implementation depends on MutableHashMap's representation.
- fix: For the S4 crispen pass: decide whether `render`/`checks` become `HashMap<string, CheckReport>` (a `law:6` deviation; CheckDocument.test.ts spreads and reads the map) or stay `ReadonlyMap`; either way add a one-line comment at :446/:518 that `backing` is complete for string keys.

### fable-1-18
- file: scratchpad/effected/github-actions/CheckDocument.ts:207
- class: docs   severity: backlog
- standard: D2 / README Port notes (additions and shape changes listed); tsconfig.base.json:115 anyUnknownInErrorContext: error (the forcing diagnostic)   evidence: `CheckDocumentSink<E = unknown>`, `CheckDocumentOptions<E = unknown>` and `CheckDocument.layer<E>` add a type parameter upstream's `Effect.Effect<unknown, unknown>` shape did not have; README.md Port notes (:319-341) do not mention it.
- failure: A public type-shape change forced by a diagnostic is invisible in the port record.
- fix: Add one line under Port notes (deviations or a type-shape note) naming the three generics and the forcing diagnostic.

### fable-1-19
- file: scratchpad/effected/github-actions/README.md:326
- class: docs   severity: backlog
- standard: D4 / section 10.3 README adaptation; section 7 Port notes format   evidence: The Attribution block (:321-329) carries four stray lines — `scratchpad/effected/github-actions/internal/cacheService.ts:10 // the bytes between the two RPCs ...`, `internal/digest.ts:4`, `internal/digest.ts:6`, `internal/sigv4.ts:16 * licence)` — which are grep hits for "licence" in source comments, not attribution facts.
- failure: The Port notes open with tool residue that reads as if four source lines were licence declarations.
- fix: Delete the four lines (S2 README pass).

REQUIRED: 10
BACKLOG: 9
