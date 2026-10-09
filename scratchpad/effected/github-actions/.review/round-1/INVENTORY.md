# github-actions — round-1 merged inventory

Seats read: 9 reports and 3 adjacent briefs (part-1/part-2/part-3 × grok.md, sol.md, fable.md); 89 seat records. Seat SHA: `3fa5876691901fccf3d1cd29e9324564df134b56`; branch: `@lab/effected`.

Required: 30 · Backlog: 12 · Codemod: 12 · Rejected: 2 · Groups: 15.

The complete operator revision block, D1–D20, §12.5 and §14 govern disposition. Seat ids include the part/report path because numbering restarts; part-1 sol.md uses codex ids. Mixed records are split into actual defects, central bookkeeping and deferred work where needed. Counts describe merged records, not seat votes. Every seat record contributes to at least one disposition. Lines are seat-era evidence locations except explicitly identified live additions.

History was read before considering upstream restores: 294ef4fa7c, 6787f85c81, c817c154ea, 03bf79d41b and 1c1cb85670 (step-2/laws), plus c4f461a6cc diffs and the live lazyEffect/schemaNumber rules and configuration. Forced changes go to the deviation codemod; demonstrated wrong implementations and gate misses remain required. No unforced restore survives this merge. No scratch-copy compiler check, fix, test execution, ledger update or Port-notes edit was performed.

Central work owns allowlist deletion, deviations and exportsAdded/README bookkeeping. allow-1 and allow-2 retain each entry's exact kind and assign only module implementation/tests. required.json owns every required id exactly once; all source/test paths are non-overlapping and the largest group has four source files. Test-only groups and new module-local Exports.test.ts, runnerFile.test.ts and sigv4.test.ts are intentional. All fixes stay inside the module source/test surface.

## Required

### r1 — Buffer decoding violates the envelope body-copy guarantee
- file: scratchpad/effected/github-actions/BlobEnvelope.ts:223
- class: bug   severity: required
- standard: D11; section 14’s verified-upstream-bug route; the ownership contract at lines 190 and 221–222 and the retained “does not alias the frame’s buffer” test.   evidence: Read-only probes against both the port and pinned oracle encoded body `[1, 2, 3]`, wrapped the frame with `Buffer.from(frame)`, decoded it, and assigned `decoded.body[0] = 99`. The original frame’s first body byte also became `99`. The same probe with an ordinary `Uint8Array` left the frame unchanged.
- failure: `Buffer` is a valid `Uint8Array` input, but its overridden `slice()` returns a view. The returned body therefore aliases the frame for common Node inputs, allowing a caller to corrupt the stored envelope despite the explicit copy guarantee.
- fix: Copy the body without invoking the input's overridden slice, e.g. Uint8Array.from(bytes.subarray(HEADER_BYTES + metaLength)). Add the Buffer-input ownership regression to BlobEnvelope.test.ts. The verified upstream bug is recorded centrally.
- seats: part-1/sol.md#codex-1-2

### r2 — Accepted __proto__ input pair disappears
- file: scratchpad/effected/github-actions/ActionInput.ts:402
- class: bug   severity: required
- standard: D11; section 14’s verified-upstream-bug route; `ActionInput.pairs`’ accepted-key contract at lines 360–380.   evidence: Read-only probes against both the port and pinned oracle parsed `__proto__=value\nnormal=ok`. Both succeeded with `{"normal":"ok"}`, and `Object.hasOwn(result, "__proto__")` returned `false`. The key passes every validation check.
- failure: A valid, non-empty input key disappears silently because assignment to `__proto__` on `{}` invokes the inherited prototype setter instead of creating a data property. The successful result does not contain all accepted pairs.
- fix: Use R.assignProperty for accepted keys and preserve the plain-record public shape. Add an own-property/fidelity regression for __proto__ to ActionInput.test.ts. Record the verified upstream bug centrally.
- seats: part-1/sol.md#codex-1-3

### r3 — Environment lookups inherit functions and shadow configured strings
- file: scratchpad/effected/github-actions/ActionEnvironment.ts:199
- class: type-safety   severity: required
- standard: D11; section 14’s verified-upstream-bug route; `ActionEnvironmentShape.get` and `getOptional` at lines 150–153.   evidence: A read-only probe of `layerFrom({})` returned `Some(function)` for `getOptional("toString")` in both the port and pinned oracle. A second port probe using `layerFrom({ toString: "configured" })` returned a function from both `getOptional("toString")` and `get("toString")`.
- failure: The default overrides object inherits `Object.prototype`. Its inherited `toString` wins the nullish fallback before the configured base value is read. Missing variables can appear present, configured values can be shadowed, and APIs typed to return strings actually return functions.
- fix: Use own-property R.get lookups for both overrides and base, followed by O.getOrUndefined and the existing nullish fallback/empty-string rule. Add absent and configured prototype-name cases to ActionEnvironment.test.ts. Record the verified upstream bug centrally.
- seats: part-1/sol.md#codex-1-4

### r4 — Malformed artifact response numbers cross the boundary as NaN
- file: scratchpad/effected/github-actions/Artifact.ts:249
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data” and “Effect owns fallibility and runtime boundaries”; D11 and section 14.   evidence: `ArtifactItem` is an interface, and `toItem` normalizes unknown response fields without validating the result. A read-only probe supplied a mocked `ListArtifacts` response containing `{ databaseId: "not-a-number", name: "logs", size: "not-a-number" }`. Listing succeeded with one item; both `Number.isNaN(item.id)` and `Number.isNaN(item.size)` were `true`. The pinned oracle contains the same unchecked conversions.
- failure: Malformed backend data crosses the service boundary as a successful artifact with an unusable database id and byte size. Consumers receive no typed failure; downloading that returned id subsequently searches for `NaN`, which cannot match even itself.
- fix: Define an identity-annotated ArtifactItem runtime schema with finite id/size, derive its type, and decode normalized rows. Map invalid rows to the existing ArtifactError malformed-response policy, retaining both response spellings. Add malformed numeric-row regressions to Artifact.test.ts. Record the verified upstream bug centrally.
- seats: part-1/sol.md#codex-1-5

### r5 — ActionEnvironment throws codec Results only to catch them
- file: scratchpad/effected/github-actions/ActionEnvironment.ts:263
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 ("Do not `throw` ... in production domain logic") and the Schema section lines 101-104 / 491-492 ("Prefer Effect codecs by default ... map them into the boundary's typed error with `Effect.mapError`"; "Use `S.decodeResult` ... only for deliberately synchronous, non-throwing local paths")   evidence: `payload` does `Effect.try({ try: () => Result.getOrThrowWith(S.decodeResult(Json)(raw), (error) => error), catch: ... })`: a non-throwing `Result` is unwrapped by throwing the `SchemaError` so that `Effect.try` can catch it again. Probe: `String(cause)` is now `SchemaError(Expected a valid JSON string)` where upstream rendered `SyntaxError: ...`, so the `detail` text also changed (ActionEnvironment.test.ts:216-222 asserts only `reason`/`name`). The tsgo `preferSchemaOverJson` rule forced dropping `JSON.parse`, not this throw-to-catch shape.
- failure: Domain code throws on the happy path of an Effect codec; the SchemaError round-trips through the JS exception channel instead of the typed channel, and the error detail diverges from upstream without a ledger entry.
- fix: Use S.decodeEffect(Json)(raw) with Effect.mapError to ActionEnvironmentError. Preserve reason/name and the existing detail text using String(cause), rather than changing it again via cause.message. Retain the malformed-payload regression; the law-forced diagnostic-text bookkeeping is c4.
- seats: part-1/fable.md#fable-1-3

### r6 — ActionInput uses throwing Result unwraps for control flow
- file: scratchpad/effected/github-actions/ActionInput.ts:337
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 (no `throw` in domain logic); Schema section lines 101-104 and 491-492 (Effect codecs + `Effect.mapError`; Result codecs only for non-throwing paths)   evidence: `ActionInput.list` (:335-343) and `ActionInput.schema` (:428-432) both do `try { parsed = Result.getOrThrowWith(S.decodeResult(Json)(x), (error) => error) } catch { return Effect.fail(configError(...)) }` — a `Result` is thrown to be caught by a native `try/catch` inside `Config.mapEffect`. Upstream had `JSON.parse` here; `preferSchemaOverJson` forced the codec, not the throw.
- failure: Two production paths rely on a synchronous throw/catch of a SchemaError to branch, the exact pattern EF-1 and the Result-codec guidance forbid; the failure never enters the typed channel.
- fix: Branch on Result.isFailure in the deliberately synchronous Config.mapEffect callbacks, or use Effect codecs with mapError. Preserve the existing list/schema failure messages and policies and retain focused ActionInput.test.ts regressions. Do not restore JSON.parse.
- seats: part-1/fable.md#fable-1-4

### r7 — ActionState serialization bypasses the typed Effect channel
- file: scratchpad/effected/github-actions/ActionState.ts:143
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 (no `throw`); Schema section lines 101-104 and 491-492 (prefer `S.encodeEffect`/`S.decodeEffect` + `Effect.mapError`; Result codecs only for non-throwing helpers)   evidence: `save` (:141-147) wraps two `Result.getOrThrowWith(S.encodeResult(Json)(...))` / `S.decodeResult(Json)(...)` calls in `Effect.try` so the thrown `SchemaError` can be re-caught as `notPlainJson`; `saveSecret` (:163) calls `Result.getOrThrowWith(S.encodeResult(Json)(secret), ...)` inside a plain `Effect.flatMap` callback, a throw site in pure code. Upstream used `JSON.stringify`/`JSON.parse`; `preferSchemaOverJson` forced the codec, not the throw-to-catch idiom. ActionState.test.ts:171-177 / :204-206 assert only `reason`/`key`.
- failure: The notPlainJson round-trip and the secret serialisation route through JS exceptions instead of the typed channel; `saveSecret` carries a latent throw in a non-generator callback.
- fix: Use S.encodeEffect/S.decodeEffect with mapError to the existing notPlainJson policy in save; serialize within the Effect channel before write in saveSecret, preserving writeFailed, masking and write ordering. Retain ActionState.test.ts assertions; drop throwing Result unwraps.
- seats: part-1/fable.md#fable-1-5

### r8 — Artifact invalidOptions quoting unwraps a Result by throwing
- file: scratchpad/effected/github-actions/Artifact.ts:379
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 (no `throw` in domain logic); Schema section line 491-492 (Result codecs only for non-throwing synchronous helpers)   evidence: Inside the `zip` generator the error detail is built as `${Result.getOrThrowWith(S.encodeResult(Json)(unrepresentable), (error) => error)}` — a throwing unwrap of a Result inside an Effect generator, used only to JSON-quote a string. Upstream used `JSON.stringify(unrepresentable)`; `preferSchemaOverJson` forced the codec, not the throw.
- failure: A throw site sits on the invalidOptions path of `Artifact.upload`; the quoting step bypasses the Effect channel the generator already provides.
- fix: Yield S.encodeEffect(Json)(unrepresentable) with Effect.orDie for total string encoding, then construct the unchanged invalidOptions detail. Retain the line-break-path regression in Artifact.test.ts.
- seats: part-1/fable.md#fable-1-6

### r9 — S3 object-path encoding and normalization break signatures and alias keys
- file: scratchpad/effected/github-actions/BlobStore.ts:235; scratchpad/effected/github-actions/BlobStore.ts:249; scratchpad/effected/github-actions/internal/sigv4.ts:134
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated by a failing signing property); `internal/sigv4.ts` requires the canonical URI to encode each path segment.   evidence: Reserved-character probes show a#b and a?b becoming fragment/query data and a%2Fb being signed differently from the outgoing URL. A distinct-key storage probe shows a//b and a/b sharing one URL and overwriting each other. Both port and oracle canonicalize /bucket/folder/ to /bucket/folder and /bucket/a//b to /bucket/a/b by filtering empty segments.
- failure: Requests sign different resources than they send, while slash collapsing aliases distinct accepted object keys.
- fix: Join bucket/prefix/key without collapsing slash runs in the key. Percent-encode each raw path segment for the outgoing URL; pass the raw path to signing. Canonicalize only the initial slash, preserving empty interior/trailing segments and encoding each segment once. Add #, ?, %, repeated/trailing-slash and distinct-key regressions in BlobStore.test.ts and new sigv4.test.ts. Record the verified upstream bugs centrally.
- seats: part-2/sol.md#sol-1-1; part-2/sol.md#sol-1-2; part-3/sol.md#sol-1-2

### r10 — Literal cache includes wrongly reject names beginning with two dots
- file: scratchpad/effected/github-actions/CacheKey.ts:486
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated by inconsistent literal and wildcard matching); `CacheKey.matchingFiles` promises to exclude paths outside the workspace.   evidence: A read-only pinned-oracle probe seeded `/ws/..lock`. With `workspace: "/ws"`, `patterns: ["..lock"]` returned `[]`, while `patterns: ["..*"]` returned `["/ws/..lock"]`. The reviewed source’s `relative.startsWith("..")` rejects the valid relative filename `..lock`.
- failure: Literal includes silently omit legitimate files whose first path component begins with two dots. `hashMatching` can consequently return an empty result or derive a cache key without an explicitly requested file.
- fix: Reject exactly the parent component or a parent component plus the platform separator, retaining the absolute-path guard. Add ..lock literal/wildcard consistency regressions in CacheKey.test.ts. Record the verified upstream bug centrally.
- seats: part-2/sol.md#sol-1-3

### r11 — Stamp runId ordering loses large-integer precision
- file: scratchpad/effected/github-actions/CheckDocument.ts:140
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated by a failing ordering property); `CheckDocumentStamp.isAtLeastAsRecent` specifies that a strictly older incoming stamp returns `false`.   evidence: For equal `at: "2024-01-01T00:00:00Z"`, both the reviewed implementation and pinned oracle return `true` when incoming `runId` is `"9007199254740992"` and existing `runId` is `"9007199254740993"`. Converting both strings to `Number` rounds them to the same value.
- failure: The staleness guard treats different numeric run IDs as equal beyond the safe-integer range. An older run can therefore pass the overwrite check against a newer run with the same timestamp.
- fix: Compare decimal integer runId strings without lossy Number conversion, retaining existing fallback behavior for other spellings. Add adjacent large-integer ordering cases in both directions to CheckDocument.test.ts. Record the verified upstream bug centrally.
- seats: part-2/sol.md#sol-1-4

### r12 — Sentinel adoption deletes unmanaged document bytes
- file: scratchpad/effected/github-actions/ManagedDocument.ts:385
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated by a failing preservation property); `ManagedDocument` promises that every byte outside managed regions survives regeneration.   evidence: A pinned-oracle probe called `parseResult(...).withRegionsResult([])`. Input `"human\n\n\n"` became `"human\n\n<!-- tool:doc -->\n"`, losing an existing newline. Input `" \t\n"` became `"<!-- tool:doc -->\n"`, losing all existing whitespace. The reviewed implementation retains the same whitespace-only replacement and trailing-newline stripping.
- failure: Adopting a document without a sentinel modifies unmanaged content, even when no regions are declared. The byte-preservation guarantee fails for trailing blank lines and whitespace-only text.
- fix: Append the missing sentinel without stripping existing trailing newline runs or replacing whitespace-only content. Insert only a necessary separator. Add no-region preservation regressions to ManagedDocument.test.ts. Record the verified upstream bug centrally.
- seats: part-2/sol.md#sol-1-5

### r13 — Named CheckState domain must use LiteralKit
- file: scratchpad/effected/github-actions/CheckState.ts:30
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (`LiteralKit` for named internal literal domains, especially annotation-bearing ones); standards/schema-first-development-prompt.md "Derive behavior instead of duplicating truth"; D5 (kit substitutions land in S4); port precedent scratchpad/effected/env/Audience.ts:21 and github-references/KeywordFamily.ts:22   evidence: `export const CheckState = S.Literals([...7 literals]).pipe($I.annoteSchema("CheckState", {...}))` is a named, exported, annotation-bearing literal domain, referenced by name as a type (:45), as a field (CheckDocument.ts:34 `CheckState.annotateKey(...)`), through `.literals` (scratchpad/test/github-actions/CheckState.test.ts:10) and by the seven-way `Match.value(state)` in `projectCheckState` (:88-100). @beep/schema LiteralKit keeps `.literals`, `.annotate`, `.annotateKey` and adds `.Enum`/`.is`/`$match` (LiteralKit.schema.ts:320-356).
- failure: The vocabulary is spelled with the anonymous-union constructor the law reserves for inline, never-named unions; consumers get no `.Enum`/`.is`/`$match` and the module is below the D5 end-state bar every other reviewed module was held to.
- fix: Use LiteralKit with all seven literals, the identity annotation and derived type, retaining annotateKey/literals support and projection behavior. Retain CheckState.test.ts vocabulary and projection assertions; existing CheckDocument consumers need no source edit.
- seats: part-2/fable.md#fable-1-4; part-2/sol.md#sol-1-6

### r14 — ProcessId schema and reusable filter lack canonical metadata
- file: scratchpad/effected/github-actions/DetachedProcess.ts:165
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18 / standards/effect-first-development.md EF-12c (reusable `S.makeFilter` must carry `identifier`, `title`, `description`); law 17 and schema-first prompt "Prefer built-in schemas and checks before custom filters"; npm round-1 INVENTORY (reusable checks without metadata, required)   evidence: ProcessId at DetachedProcess.ts:165-177 is exported and branded but has no schema identity annotation; S.makeFilter receives undefined annotations. Its positive-integer filter aborts before the redundant finite check. Both reports show these omissions despite the green gates.
- failure: The one schema a pid crosses the phase boundary through has no identifier/title/description for JSON Schema, docs or issue formatting, and carries a dead check that reads as if NaN/Infinity needed a second guard.
- fix: Add canonical $I annotations to the exported ProcessId schema and identifier/title/description metadata to its reusable filter, preserving its user-facing error string. Remove the redundant finite check only while preserving failure-order equivalence. Retain ProcessId tests in DetachedProcess.test.ts.
- seats: part-2/fable.md#fable-1-5; part-2/sol.md#sol-1-7

### r15 — GitHubMarkdown violates the S namespace alias law
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:18
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (`A/O/P/R/S` aliases only; `import * as S from "effect/Schema"`); config-file round-1 INVENTORY fable-1-4 (same alias, required; explains why the alias-preserving `effect-imports` gate misses it)   evidence: `import * as Schema from "effect/Schema";` (:18) and `Schema.Constraint` (:47), `Schema.Struct.Fields` (:57, :101, :119), `Schema.encodeUnknownResult(Schema.make<Schema.Codec<unknown, unknown>>(field.ast))` (:326), `Schema.decodeUnknownResult(Schema.String)` (:331). Every other file in the module uses `S`, and this file's own JSDoc example at :301-306 already uses `S`. EffectImports.ts rewrites specifiers but preserves whatever alias it finds (specifier records carry `alias`, :804/:884), so the green gate is not evidence of compliance.
- failure: The authoritative alias law is broken in one file of the module, and the file's public types (`GitHubRowSchema`, `GitHubSchemaTableColumns`) are spelled with the forbidden namespace in docgen output.
- fix: Rename effect/Schema to S and update Schema.* references, renaming the conflicting generic parameter if needed. Keep SchemaAST unchanged. The effect-imports gate rewrites paths but preserves aliases, so the reports demonstrate a gate miss.
- seats: part-2/fable.md#fable-1-7; part-2/sol.md#sol-1-8

### r16 — S3 signing bypasses the Effect Clock
- file: scratchpad/effected/github-actions/BlobStore.ts:240
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-9 (time is effectful: prefer `Clock`/`DateTime.now`); effect-tsgo rule globalDateInEffect (tsconfig.base.json:154, error) whose stated remedy is `Clock`   evidence: `now: DateTime.toDateUtc(DateTime.nowUnsafe())` replaces upstream `now: new Date()` inside `request`, a sync helper called from the `send` Effect at :252-260. `DateTime.nowUnsafe` (DateTime.d.ts:886, `LazyArg<Utc>`) reads the global wall clock; `DateTime.now` (DateTime.d.ts:842, `Effect<Utc>`) reads the fiber's Clock. The diagnostic is satisfied syntactically while the signing time still bypasses the Clock. BlobStore.test.ts asserts only the `AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/` prefix (:156) and signed-header names (:106-111), so a Clock-driven date is test-neutral; under the live Clock the bytes are identical to upstream.
- failure: The S3 layer's SigV4 timestamp cannot be controlled by TestClock and the port keeps the exact `new Date()` semantics the rule exists to remove, renamed.
- fix: Read DateTime.now inside send and thread that UTC time into request/sign instead of DateTime.nowUnsafe. Preserve live-Clock signature bytes and add a TestClock signing-date regression to BlobStore.test.ts; introduce no native Date constructor.
- seats: part-2/fable.md#fable-1-2

### r17 — Native string sorting survives the scanner
- file: scratchpad/effected/github-actions/CacheKey.ts:392; scratchpad/effected/github-actions/CacheKey.ts:515; scratchpad/effected/github-actions/internal/sigv4.ts:127
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native `Array.prototype.sort`; `A.sort` with an explicit `Order`); EF-5; sbom round-1 INVENTORY r1 (same gate miss, required)   evidence: The report identifies spread/chained .sort() receivers in CacheKey.hashFiles and matchingFiles which evade the identifier-receiver scan. Live-source inspection finds the same root cause in internal/sigv4.ts:127, [...MutableHashMap.keys(lowered)].sort(). All three arrays contain strings and use default code-unit order.
- failure: Native sort survives the law in the two places that define cache-key determinism (the per-file digest fold and the sorted match list).
- fix: Replace all three native sorts with A.sort(Order.String). Preserve deterministic code-unit order and CacheKey.test.ts digest/match ordering plus canonical-header/signature assertions in sigv4.test.ts. The signing file shares r9 ownership.
- seats: part-2/fable.md#fable-1-3

### r18 — CacheKey reusable constraints lack identity metadata
- file: scratchpad/effected/github-actions/CacheKey.ts:91
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18 / EF-12c (reusable filters carry `identifier`, `title`, `description`); SCHEMA.md "Filter error messages and schema identifiers" (filter label = `message`, then `expected`, then `<filter>`; `identifier` never names a failed filter, so adding it leaves issue text unchanged)   evidence: `Segments` (:91-95) is `S.NonEmptyArray(Segment).check(S.makeFilter(..., { title: "a cache key of at most 512 characters" }))` — title only; the class-level cross-field filter (:153-159) `S.makeFilter((key) => ... ? undefined : "every restore depth must be ...")` has no annotations at all. Both sit on the exported `CacheKey` class schema that `ActionCache.restore`, `ActionState` and the JSON Schema export (CacheKey.test.ts:555-562) consume.
- failure: Two reusable constraints that define the cache-key grammar are anonymous in JSON Schema, docgen and issue trees; the port added field-level `annotateKey` descriptions everywhere else and left the two filters bare.
- fix: Add identity-derived identifier/title/description metadata to the Segments and cross-field restore-depth filters, retaining their messages and grammar. Retain CacheKey.test.ts JSON Schema path assertions; forced key bookkeeping is central.
- seats: part-2/fable.md#fable-1-6

### r19 — Production identity lambdas duplicate Result.getOrThrow
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:327; scratchpad/effected/github-actions/GitHubMarkdown.ts:331; scratchpad/effected/github-actions/OidcTokenIssuer.ts:261
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 21 / EF-5 (direct helper refs over trivial wrapper lambdas); sbom round-1 INVENTORY r9 (source sites required, test sites deferred to S3)   evidence: `Result.getOrThrowWith((error) => error)` at GitHubMarkdown.ts:327 and :331 and OidcTokenIssuer.ts:261; node_modules/effect/dist/Result.js:850 defines `getOrThrow = getOrThrowWith(identity)` and Result.d.ts:1934 exports it, so the lambda is the identity helper respelled. The `terse-effect` gate passed this commit, so it does not catch this form. Ten more sites exist in the module's tests (S3 canon work).
- failure: A trivial wrapper lambda stands in for the direct helper in three production sites, contrary to the tersest-form law the gate claims to enforce.
- fix: Use Result.getOrThrow instead of the three getOrThrowWith((error) => error) forms, preserving the existing synchronous boundary behavior. The green terse-effect gate misses this concrete form. Test-only occurrences stay deferred to S3.
- seats: part-2/fable.md#fable-1-8

### r20 — Added public tagged errors are missing from the barrel
- file: scratchpad/effected/github-actions/index.ts:62; scratchpad/effected/github-actions/index.ts:88; scratchpad/effected/github-actions/index.ts:99
- class: law   severity: required
- standard: D2; D5; EF-1 public named failures; section 12.5. Bookkeeping and deferred documentation/coverage portions are c3/b1/b3.   evidence: InvalidActionStateNameError, InvalidDigestLengthError, UnhandledCheckStateError, MissingProcessIdError and RejectedRegionDialectError are exported from source files but absent from index.ts. The documented CacheKey throw must be deep-imported in its test. This is an actual entrypoint omission, distinct from the exportsAdded record.
- failure: Consumers cannot name the existing public errors through the module entrypoint.
- fix: Re-export the five already-exported error classes beside their owning APIs in index.ts, retaining names/value kinds. Add a module-local Exports.test.ts entrypoint assertion. Leave exportsAdded and Port notes to the codemod, and JSDoc/cause coverage to S2/S3.
- seats: part-2/fable.md#fable-1-9; part-1/fable.md#fable-1-13

### r21 — Installer bin names escape the shim directory
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:639
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); the containment invariant documented at lines 540–545.   evidence: A read-only probe ran the installer with filesystem and download stubs, supplying `{"bin":{"../../outside":"bin/cli.js"}}`. Both the pinned oracle and the port returned `Success("tool-cache")` and attempted `writeFileString("/memory/extracted/outside", ...)`, outside `/memory/extracted/package`. The stub recorded the attempted path in memory; no file was written.
- failure: Manifest validation checks each bin’s **target**, but the bin **name** becomes a shim filename without containment validation. An archive can therefore cause shim writes outside `.bin` and outside the extracted package, or overwrite other package files.
- fix: Validate every bin name and resolved shim destination before any shim write; reject a path escaping .bin with the existing layoutUnexpected error. Retain target validation and add an escaping-bin-name regression to PackageManagerInstaller.test.ts. Record the verified upstream bug centrally.
- seats: part-3/sol.md#sol-1-1

### r22 — Runner-file delimiter selection has quadratic complexity
- file: scratchpad/effected/github-actions/internal/runnerFile.ts:19
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: For `value = "EFFECTED_EOF" + "_".repeat(n)`, the loop tries `n + 1` progressively longer delimiters and compares their prefixes, giving quadratic work. A read-only Bun probe measured approximately `17.56 ms`, `48.16 ms`, and `188.58 ms` for 10,000, 20,000, and 40,000 underscores. A single scan finding the longest underscore run after any `EFFECTED_EOF` occurrence produced identical delimiters in approximately `0.24 ms`, `0.04 ms`, and `0.03 ms`. Equality also held for absent, multiple, and embedded delimiter occurrences. This is an algorithmic improvement over behavior inherited from upstream, rather than a claimed port regression.
- failure: Runner-file formatting can spend quadratic CPU time on a value consisting of the base delimiter followed by a long underscore run.
- fix: Scan base-delimiter occurrences and their following underscore runs once; return one more underscore than the maximum run, or the unchanged base when absent. Preserve delimiters for multiple/embedded occurrences. Add behavioral and long-run regressions in new runnerFile.test.ts and keep runnerFile.ts package-free.
- seats: part-3/sol.md#sol-1-4

### r23 — IeeeNumber and its named literal domain lack required schema identity/kit
- file: scratchpad/effected/github-actions/internal/ieeeNumber.ts:16
- class: schema   severity: required
- standard: D5; `standards/effect-first-development.md` EF-12 and EF-12b; `standards/effect-laws-v1.md` law 19.   evidence: IeeeNumber at internal/ieeeNumber.ts:16 has no identity annotations; NonFiniteSpelling at :5 is a named reused S.Literals domain. c817c154ea (effected-port step 2) introduces the S.declare representation while removing diagnostic directives. Thus its representation is forced, while missing identity/kit remains a schema-law violation.
- failure: The new schema falls outside the identity and annotation requirements already required before this review, and its named literal domain violates the binding literal-domain convention. These are schema requirements, independent of the deferred JSDoc conversion.
- fix: Retain the diagnostic-forced S.declare(P.isNumber) representation and non-finite codec behavior. Add a file-local $ScratchpadId composer and canonical IeeeNumber annotations; use an annotated LiteralKit for NonFiniteSpelling. Preserve JSON/string-tree/arbitrary links and DetachedProcess.test.ts non-finite cases. Do not replace it with bare S.Number and reintroduce schemaNumber. The property-floor portion is b3.
- seats: part-3/sol.md#sol-1-5; part-3/fable.md#fable-1-11

### r24 — Ambient-read test holds stale exact-line entries
- file: scratchpad/test/github-actions/ambientReads.test.ts:146; scratchpad/test/github-actions/ambientReads.test.ts:161; scratchpad/test/github-actions/ambientReads.test.ts:169
- class: law   severity: required
- standard: D9 (upstream tests are the contract; every deviation cites the adjusted upstream test), §14; tsgo processEnv (the forcing law)   evidence: Upstream __test__/ambientReads.test.ts keys ALLOWED on exact (file, line-text) pairs and asserts set equality both ways ("allowlisted site(s) no longer present — remove them from the allowlist"). The port rewrote three of those lines: ToolInstaller.ts:510-513 (`testRoot` now goes through Config.String("RUNNER_TOOL_CACHE")…ConfigProvider.fromEnv, no process.env text), PackageManagerInstaller.ts:414 (`O.match(found, { onNone: (): string => process.arch, … })`), ActionEnvironment.ts:334 (`Effect.sync(() => ({ ...process.env })),`). scratchpad/test/github-actions/ambientReads.test.ts:146,161,171 still carry the upstream texts. TESTS_NOT_PASSING.md records the suite failing at import (typescript/unstable/ast needs TS 7), so the gate never evaluates the allowlist.
- failure: A latent red in an upstream contract test hidden by an environment failure: once the suite loads it fails with three stale entries plus one unlisted read (PMI:414); the law:processEnv move has no deviation record.
- fix: Update the ActionEnvironment and PackageManagerInstaller exact-line entries to their current read spellings; remove ToolInstaller testRoot whose ambient read is gone. Retain bidirectional equality. The reported environment/import failure means this contract was not evaluated by the stated green gate. Do not edit root dependency/config files; bookkeeping is c12.
- seats: part-3/fable.md#fable-1-2

### r25 — Reachability oracle ignores getBuiltinModule runtime edges
- file: scratchpad/test/github-actions/reachability.test.ts:46; scratchpad/test/github-actions/reachability.test.ts:176; scratchpad/test/github-actions/reachability.test.ts:254; scratchpad/test/github-actions/reachability.test.ts:315
- class: test   severity: required
- standard: D9; `nodeBuiltinImport` (TS377057)   evidence: runtimeSpecifiers sees only static import/export specifiers. Crypto still loads in digest.ts/sigv4.ts, but four affected expected sets dropped node:crypto, retaining comments about its confinement. The green oracle therefore misses runtime dependencies introduced by getBuiltinModule.
- failure: The exact-edge oracle no longer sees `node:crypto`, and a further `getBuiltinModule("node:…")` does not fail the confinement test. Hashing behaviour is unchanged.
- fix: Collect literal process.getBuiltinModule("node:...") calls as runtime edges alongside static imports/exports. Restore node:crypto in all affected pinned expectations, retaining the forced Effect subpath edges and confinement assertions. Do not restore rejected static imports or add allowlist/config entries. The record portions are c9 and the contradictory alternative is x2.
- seats: part-3/grok.md#grok-1-6; part-3/fable.md#fable-1-1; part-2/fable.md#fable-1-1

### r26 — Compound object predicate duplicates its stock equivalent
- file: scratchpad/effected/github-actions/internal/fsProbe.ts:33; scratchpad/effected/github-actions/internal/actionsResults.ts:95; scratchpad/effected/github-actions/internal/twirp.ts:169; scratchpad/effected/github-actions/Action.ts:171
- class: effect-idiom   severity: required
- standard: AGENTS.md tersest-equivalent-helper law; standards/effect-laws-v1.md law 21; D11. Reclassified from seat backlog: concrete production equivalence and gate miss.   evidence: node_modules/effect/dist/Predicate.js:687 `isObjectOrArray = typeof input === "object" && input !== null`; :782 `isObjectKeyword = (typeof object && !null) || isFunction`. So `P.isObjectKeyword(x) && !P.isFunction(x)` ≡ `P.isObjectOrArray(x)`, which is also exactly upstream's predicate. Sites: fsProbe.ts:33, internal/actionsResults.ts:95, internal/twirp.ts:169, Action.ts:171.
- failure: Longer spelling of a stock predicate; semantically fine.
- fix: Use P.isObjectOrArray at all four P.isObjectKeyword(x) && !P.isFunction(x) sites, keeping surrounding checks and behavior. These concrete helper forms survive the green terse-effect gate.
- seats: part-3/fable.md#fable-1-7

### r27 — Repeated optional-field spreads duplicate getSomesStruct
- file: scratchpad/effected/github-actions/ActionLogger.ts:70; scratchpad/effected/github-actions/GitHubToken.ts:217; scratchpad/effected/github-actions/GitHubToken.ts:292
- class: effect-idiom   severity: required
- standard: AGENTS.md tersest-equivalent-helper law; standards/effect-laws-v1.md law 21; D11. Reclassified from seat backlog: concrete production equivalence and gate miss.   evidence: ActionLogger spreads six one-key getSomesStruct records. GitHubToken uses two consecutive one-key spreads at :217-218 and four at :292-295. The existing helper accepts the entire OptionStruct, producing the same result in one call per block.
- failure: Six record builds and spreads where one suffices; readers must verify six identical shapes.
- fix: Consolidate each optional block into one O.getSomesStruct call with the same fields/options, retaining order and omission semantics. Retain ActionLogger.test.ts annotation and GitHubToken.test.ts option assertions.
- seats: part-1/fable.md#fable-1-11; part-2/fable.md#fable-1-15

### r28 — CheckDocument exposes native maps via MutableHashMap.backing
- file: scratchpad/effected/github-actions/CheckDocument.ts:388
- class: effect-idiom   severity: required
- standard: D5; standards/effect-laws-v1.md law 6; later public-collection ruling; D9. Reclassified: public collection API changes are authorized; backing-field bridging misses the gate.   evidence: render at CheckDocument.ts:243 and checks at :306 expose ReadonlyMap, reached through checks.backing at :446/:518. The checks contract explicitly promises first-report order.
- failure: The law-6 boundary is moved one field inward rather than resolved: the public surface still speaks native `ReadonlyMap` and the implementation depends on MutableHashMap's representation.
- fix: Expose Effect HashMap values and stop reading MutableHashMap.backing. Carry explicit first-report order alongside the registry through checks/render snapshots; replacing a check must retain its position. Retarget CheckDocument.test.ts map reads/spreads and assert order. Record the public-collection deviation centrally.
- seats: part-2/fable.md#fable-1-17

### allow-1 — Replace the allowlisted Logger.CurrentLoggers native Set
- file: scratchpad/effected/github-actions/ActionLogger.ts:282
- class: new-map-set   severity: required
- standard: standards/effect-laws.allowlist.jsonc:341-348; later 2026-10-09 Logger.CurrentLoggers ruling; D5.   evidence: Entry EFFECTED-GHA-CURRENT-LOGGERS names ActionLogger.ts, kind new-map-set, and cites strictEffectProvide as blocking Logger.layer. The later ruling explicitly supplies the scoped layer/context route and retires the exception.
- failure: The retired native Set exception remains.
- fix: Use Logger.layer through Effect.scopedWith + Layer.buildWithScope + Effect.provideContext. Preserve buffer logger composition and scope lifetime; retarget ActionLogger.test.ts logger/buffering assertions as needed. Central work removes the allowlist row and records the deviation; this group edits only module source/tests.
- seats: allowlist:EFFECTED-GHA-CURRENT-LOGGERS; operator grilling, 2026-10-09

### allow-2 — Replace allowlisted Date.parse stamp ordering
- file: scratchpad/effected/github-actions/CheckDocument.ts:122
- class: date-static   severity: required
- standard: standards/effect-laws.allowlist.jsonc:349-356; later 2026-10-09 Date.parse ruling; D5.   evidence: compareAt calls Date.parse(left/right). Entry EFFECTED-GHA-LOCAL-TIME-PARSE documents local-time versus UTC behavior; the operator chose DateTime.make plus DateTime.Order and accepted zone-less timestamps as UTC.
- failure: The retired date-static exception remains.
- fix: Use DateTime.make and DateTime.Order for valid parsed stamps, retaining the existing string-order fallback for invalid inputs. Retarget/add zone-less and invalid-order cases in CheckDocument.test.ts. Central work removes the allowlist entry and records the UTC deviation; no standards file belongs to this group.
- seats: part-2/fable.md#fable-1-10; allowlist:EFFECTED-GHA-LOCAL-TIME-PARSE

## Backlog

### b1 — Legacy JSDoc carriers and broken examples await S2
- file: scratchpad/effected/github-actions/Action.ts:25; scratchpad/effected/github-actions/BlobStore.ts:137; scratchpad/effected/github-actions/Secret.ts:40; scratchpad/effected/github-actions/ActionState.ts:18
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md “Hard requirements” and “Carrier policy”; explicitly deferred S2 in the review brief.   evidence: All three Sol parts show legacy carriers, missing metadata and undefined program/theToken examples. The state-name error lacks a visibility marker.
- failure: The carried documentation does not yet satisfy the canonical section grammar or self-contained example contract. S2 cannot close on these blocks as written.
- fix: During S2 preserve carried prose, convert to titled Example and Details/Gotchas sections, add canonical metadata, make examples self-contained and mark visibility. The barrel/cause/record portions are r20/b3/c3.
- seats: part-1/sol.md#codex-1-6; part-2/sol.md#sol-1-9; part-3/sol.md#sol-1-6; part-1/fable.md#fable-1-13

### b2 — Effectful fixture ownership and assertion canon await S3
- file: scratchpad/test/github-actions/ActionEnvironment.test.ts:47; scratchpad/test/github-actions/CheckDocument.test.ts:66; scratchpad/test/github-actions/PackageManagerInstaller.test.ts:81
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5 and D14; explicitly deferred S3 in the review brief.   evidence: The three surfaces use per-test provision of effectful/scoped layers; ActionEnvironment also manually inspects Options. No failed behavioral assertion is shown.
- failure: The suite retains the resource-provision and assertion patterns that the requested S3 canon migration must replace.
- fix: During S3 move effectful/scoped fixtures into isolated it.layer suites, retaining finalizers, TestClock, scratch-root cleanup and all upstream assertions; use canonical Option/Result/Exit assertions.
- seats: part-1/sol.md#codex-1-7; part-2/sol.md#sol-1-12; part-3/sol.md#sol-1-7

### b3 — Schema/codec property floor and run counts await S3
- file: scratchpad/test/github-actions/BlobEnvelope.test.ts:132; scratchpad/test/github-actions/PackageManagerInstaller.test.ts:1814; scratchpad/effected/github-actions/internal/ieeeNumber.ts:16
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10; goals/effect-vitest-canon/SPEC.md property-run guidance; explicitly deferred S3 in the review brief.   evidence: BlobEnvelope properties lack fcRuns; all three parts identify exported schemas without schema-derived round trips. IeeeNumber non-finite links and the state-name cause need S3 checks.
- failure: The focused suites do not yet meet the explicit property floor for exported schemas/codecs or the required repository-controlled property run counts.
- fix: During S3 retain upstream examples/properties and add Arbitrary.schema encode/decode properties across the named schemas/codecs, including non-finite spellings and the tagged-cause assertion, with fcRuns-controlled counts.
- seats: part-1/sol.md#codex-1-8; part-2/sol.md#sol-1-11; part-3/sol.md#sol-1-8; part-3/fable.md#fable-1-11; part-1/fable.md#fable-1-13

### b4 — Literal-input schema guard could be hoisted
- file: scratchpad/effected/github-actions/ActionInput.ts:244
- class: perf   severity: backlog
- standard: AGENTS.md Code Laws (prefer named schema building blocks; derived `S.is(...)` guards) — no measurement taken, so backlog under D11   evidence: `Config.mapEffect((raw) => S.is(S.Literals(allowed))(raw) ? ...)` constructs a new `S.Literals` union and compiles an `is` guard on every config read; upstream used `allowed.includes(raw)` with an `as L[number]` cast that D15 removed. `allowed` is fixed per `literals` call (signature at :238 is `readonly [string, ...Array<string>]`), so the schema is loop-invariant.
- failure: Each read of a literal input rebuilds and compiles a schema; harmless for one read, wasteful for inputs read repeatedly.
- fix: Hoist the fixed allowed-domain guard once per literals call. No measured regression or algorithmic-class win is provided, so this stays performance backlog under D11.
- seats: part-1/fable.md#fable-1-9

### b5 — Artifact expiry has an unreachable epoch-zero fallback
- file: scratchpad/effected/github-actions/Artifact.ts:461
- class: effect-idiom   severity: backlog
- standard: crispen rubric (absorb invariants; no dead fallback branches); standards/effect-first-development.md Option guidance (model absence as Option, not a sentinel)   evidence: :452 `const now = options?.retentionDays === undefined ? undefined : yield* Clock.currentTimeMillis;` then :461 `DateTime.makeUnsafe((now ?? 0) + retentionDays * 86_400_000)`. The `?? 0` branch is unreachable today (it only runs when `retentionDays` is defined, which is exactly when `now` was read) but if the two conditions ever drift it silently files an `expiresAt` in January 1970 instead of failing. The `globalDateInEffect` rule forced `Clock`, not the sentinel.
- failure: A latent epoch-zero expiry hides behind a nullish fallback that exists only to satisfy the type checker.
- fix: Compute expiry and the Clock read in one retentionDays branch and use an Option/optional-field projection. The report states the fallback is unreachable today and proves no current bug; this is maintainability backlog.
- seats: part-1/fable.md#fable-1-10

### b6 — Local JSON aliases could use the stock codec
- file: scratchpad/effected/github-actions/internal/jwt.ts:19
- class: schema   severity: backlog
- standard: Discovery/reuse preference; D11: equivalent stock construction, no demonstrated defect.   evidence: node_modules/effect/dist/Schema.js:6222 `export const UnknownFromJsonString = fromJsonString(Unknown)`. `rg 'S\.fromJsonString\(S\.Unknown\)'` → 16 declarations of `const Json = S.fromJsonString(S.Unknown)`: jwt.ts:19, PackageManagerInstaller.ts:27, Artifact.ts:32, ActionState.ts:22, ActionEnvironment.ts:12, ActionInput.ts:16 and 10 test files (results.ts:17, PackageManagerInstaller.test.ts:33, …).
- failure: A stock Effect codec is re-declared sixteen times under a local name; readers cannot tell it from a bespoke codec and the stock schema's identity and annotations are lost.
- fix: Consolidate local Json aliases to S.UnknownFromJsonString when convenient, with tests deferred to S3. The report says the stock codec is exactly fromJsonString(Unknown), so it does not prove lost annotations or different behavior. Reclassified outside D11.
- seats: part-3/fable.md#fable-1-3

### b7 — Dropped crypto rationale and stale attribution/exception docs await S2
- file: scratchpad/effected/github-actions/internal/digest.ts:1; scratchpad/effected/github-actions/internal/sigv4.ts:19; scratchpad/effected/github-actions/README.md:326; scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md:21
- class: docs   severity: backlog
- standard: D4 (carried prose is converted, never dropped); README Port notes and DIAGNOSTIC_EXCEPTIONS.md must describe the live code   evidence: Carried crypto rationale was dropped/shortened; README attribution contains stale source-line grep residue. DIAGNOSTIC_EXCEPTIONS.md describes superseded directives.
- failure: Three documentation surfaces describe code that is no longer there.
- fix: During S2 restore carried rationale and clean attribution using live evidence. Track DIAGNOSTIC_EXCEPTIONS.md cleanup centrally: outside the port's write surface. This is not module-lane permission to edit central files or Port-notes bookkeeping.
- seats: part-3/fable.md#fable-1-8; part-3/grok.md#grok-1-7; part-2/fable.md#fable-1-19

### b8 — Formatting and import placement need cosmetic cleanup
- file: scratchpad/effected/github-actions/ToolInstaller.ts:365
- class: docs   severity: backlog
- standard: Module formatting consistency (not gated: the runner has no formatter step)   evidence: ToolInstaller.ts:365-368 is codemod residue — `return yield * fs.makeTempDirectory({` with 6-space indentation in a tab-indented file; internal/twirp.ts:172 carries a stray extra tab; internal/fsProbe.ts:1, internal/pnpmExe.ts:1 and internal/unstubbed.ts:1-2 insert new imports above the file header comment, splitting the import block; Secret.ts:5 and internal/actionsResults.ts:14 append effect imports after local ones.
- failure: Cosmetic only; the next formatter run will churn these files.
- fix: Normalize indentation/import placement in a later module formatting pass. No D11-required behavioral defect is shown.
- seats: part-3/fable.md#fable-1-9

### b9 — Third-party dependency replacement candidate is absent
- file: scratchpad/effected/github-actions/README.md:339
- class: law   severity: backlog
- standard: D3; scope restriction: outside the port's write surface.   evidence: Ledger row w5-github-actions: newDeps `[{"name":"@azure/storage-blob","kind":"runtime","spec":"^12.33.0","replacement":null}]`, backlog: []; README.md:339-341 "Dependency backlog: None".
- failure: The one third-party runtime dependency has no replacement candidate recorded, so the D3 decision point cannot be scheduled.
- fix: Track @azure/storage-blob and an Effect HttpClient/Azure Blob REST replacement candidate centrally, then generate dependency Port notes. PORT_LEDGER.json is outside the port's write surface and must never be assigned to a module group.
- seats: part-3/fable.md#fable-1-10

### b10 — Action context widening and lost memoization rationale merit follow-up
- file: scratchpad/effected/github-actions/Action.ts:260
- class: type-safety   severity: backlog
- standard: D11; D15; strictEffectProvide:error. No admitted caller counterexample proves a D15-defined assertion.   evidence: Upstream: `Effect.provide(composed as Layer.Layer<ActionServices | R>)`. Lab: `Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(composed, scope), (context) => Effect.provideContext(leveled, Context.makeUnsafe<ActionServices | R>(context.mapUnsafe))))`, which is exactly `provideLayer` in node_modules/effect/dist/internal/layer.js:6 plus an asserted type. The comment admits it ("trusts the caller's layer for R"). The upstream rationale comment about memoization ("Both halves name the same layer value...") was deleted with it.
- failure: The port passes the D15 gate while keeping the same unchecked widening of the context type; a caller omitting a service still defects at use with no type signal, and a reader loses the memoization rationale.
- fix: Investigate typed Layer.empty-based composition while keeping the strictEffectProvide-compliant scoped build/provideContext route, and restore memoization rationale during S2. Do not use the proposed Effect.provide(layer) route. D15 enumerates as/!/angle/any syntax, not Context.makeUnsafe; keep as backlog without a proven counterexample.
- seats: part-1/fable.md#fable-1-8

### b11 — Closed-union fallbacks could state Match exhaustiveness explicitly
- file: scratchpad/effected/github-actions/CheckState.ts:97
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 11 (`Match`, exhaustive); effect/Match `exhaustive` (Match.d.ts:1944); D9 (unreachable-path message would still be a recorded deviation)   evidence: `Match.orElse((unhandled: never) => { throw UnhandledCheckStateError.make(...) })` reproduces upstream's `default: never` arm with a lab-only error class; `Match.exhaustive` gives the same compile-time guarantee and throws on the unreachable input without the extra export. OidcTokenIssuer.ts:47 and BlobStore.ts:48 use `Match.orElse` for the last literal of a closed union, so adding a literal to `reason` would compile silently.
- failure: Exhaustiveness is enforced by a typed-`never` callback trick in one place and not at all in two `message` getters.
- fix: Consider explicit final-literal branches plus Match.exhaustive, preserving in-domain behavior. These paths already use Match; future-literal risk is not a current bug or a violation of the cited no-switch law. Any invalid-input defect change needs central bookkeeping.
- seats: part-2/fable.md#fable-1-16

### b12 — Per-cell string decoder could be hoisted
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:331
- class: perf   severity: backlog
- standard: D11 (perf is required only with a measurement or algorithmic class); the file's own invariant at :322-324 ("Built once per column, not per cell — this is the one path that renders in a loop")   evidence: `project` now runs `Schema.decodeUnknownResult(Schema.String)(rendered)` on every cell, constructing the decoder per call, where upstream only called the once-per-column `encode`/`format`. Constant-factor per-cell allocation; not measured.
- failure: The per-column build invariant the comment promises is broken on the one hot path of the writer.
- fix: Hoist the string decoder once per module/column if measured useful. No measured regression or algorithmic-class improvement is supplied; this stays performance backlog under D11.
- seats: part-2/fable.md#fable-1-14

## Handled by the deviation codemod

### c1 — Artifact.list is forced by lazyEffect
- file: scratchpad/effected/github-actions/Artifact.ts:194
- class: bug   severity: backlog
- standard: D9; TS377091 lazyEffect; tsconfig.base.json:165 error; later forced-change ruling.   evidence: git log -G list locates c4f461a6cc:chore: saving progress. Its diff changes the signature, implementation and makeTest to an Effect value and rewrites five Artifact.test.ts calls. Despite the generic commit title, lazy-effect.md explicitly diagnoses this zero-argument service-member shape and lazyEffect is error in the root config.
- failure: A diagnostic-forced callable-to-Effect change needs provenance, not an upstream restore.
- fix: Codemod records law:lazyEffect, the three source sites and five adjusted upstream calls per module/class. Keep the Effect-valued API. The other portions of part-1 fable-1-12 are c2/c3/c4/c11.
- seats: part-1/grok.md#grok-1-1; part-1/sol.md#codex-1-1; part-1/fable.md#fable-1-12

### c2 — Finite numeric-domain changes need one systemic record
- file: scratchpad/effected/github-actions/ToolInstaller.ts:41; scratchpad/effected/github-actions/BlobStore.ts:36; scratchpad/effected/github-actions/ActionEnvironment.ts:78; scratchpad/effected/github-actions/Artifact.ts:62; scratchpad/effected/github-actions/DetachedProcess.ts:89
- class: schema   severity: backlog
- standard: D9, section 14, tsgo `schemaNumber`   evidence: The reports enumerate S.Finite narrowing of statuses, run numbers, token count, document line, pid and envelope version. 7f67982f77 (step 2) includes the numeric quick-fixes; schemaNumber is error at tsconfig.base.json:208. The ruling names this systemic codemod class.
- failure: Direct construction or decode with `NaN` or `Infinity` now fails on those fields. The live HTTP and JSON paths do not produce those values. `RestoreDepth` still rejects the same depths; only the issue text for a non-finite depth may differ.
- fix: Codemod records the module's schemaNumber/S.Finite sites and adjusted tests, preserving the finite schemas. The contrary restore proposal is x1.
- seats: part-2/grok.md#grok-1-5; part-3/grok.md#grok-1-4; part-3/fable.md#fable-1-4; part-1/fable.md#fable-1-12

### c3 — Tagged-error and added-export records are centrally owned
- file: scratchpad/effected/github-actions/ActionState.ts:113; scratchpad/effected/github-actions/CacheKey.ts:366; scratchpad/effected/github-actions/CheckState.ts:98; scratchpad/effected/github-actions/ManagedDocument.ts:291; scratchpad/effected/github-actions/DetachedProcess.ts:346; scratchpad/effected/github-actions/internal/unstubbed.ts:31
- class: docs   severity: backlog
- standard: D9, D2, section 14; effect law 7   evidence: Reports show native Error/RangeError replacements with preserved messages, retargeted CacheKey tests, and missing deviation/exports records. 1c1cb85670 (effected-port laws) explicitly records native-error replacement and assertion retargeting.
- failure: A bad `GITHUB_STATE` name still fails as `ActionStateError` / `writeFailed`, but `cause` is an `InvalidActionStateNameError` value with its own `_tag`, and that class is an unlisted addition.
- fix: Codemod emits the module's tagged-errors class entry with source/test sites and exportsAdded after r20 repairs the actual barrel omission. Keep tagged errors; JSDoc/cause coverage stay b1/b3. No module lane edits ledger or Port notes.
- seats: part-1/grok.md#grok-1-3; part-1/fable.md#fable-1-12; part-1/fable.md#fable-1-13; part-2/grok.md#grok-1-1; part-2/grok.md#grok-1-2; part-2/grok.md#grok-1-3; part-2/grok.md#grok-1-4; part-2/sol.md#sol-1-10; part-2/fable.md#fable-1-9; part-2/fable.md#fable-1-11; part-3/grok.md#grok-1-5; part-3/sol.md#sol-1-9

### c4 — Schema JSON codecs change diagnostics and cause identity by law
- file: scratchpad/effected/github-actions/ActionEnvironment.ts:268; scratchpad/effected/github-actions/internal/jwt.ts:43; scratchpad/effected/github-actions/PackageManagerInstaller.ts:532
- class: docs   severity: backlog
- standard: D9, section 14; effect-first “Never use JSON.parse”   evidence: Differential probes show SchemaError replacing native SyntaxError/TypeError and changing ActionEnvironment detail text. 294ef4fa7c (step 2) replaces JSON parse/stringify with codecs under preferSchemaOverJson.
- failure: A payload such as `{ not json` still fails as `reason: "malformed"`, `name: "GITHUB_EVENT_PATH"`, but `.detail` and `.message` become `not valid JSON: SchemaError(Expected a valid JSON string)` and drop the syntax position. The suite only asserts `reason` and `name` (`ActionEnvironment.test.ts:219-221`).
- fix: Codemod records the preferSchemaOverJson class with affected detail/cause identity and adjusted tests. Keep schema codecs; r5-r8 independently fix wrong throwing unwrap usage. Do not restore native JSON.parse with a suppression.
- seats: part-1/grok.md#grok-1-2; part-1/fable.md#fable-1-3; part-1/fable.md#fable-1-12; part-3/grok.md#grok-1-3; part-3/sol.md#sol-1-9; part-3/fable.md#fable-1-5

### c5 — Identity-derived JSON Schema keys need a class record
- file: scratchpad/effected/github-actions/CacheKey.ts:141
- class: law   severity: backlog
- standard: D9 / section 14; 2026-10-09 ruling (identity-keys systemic class, codemod-generated); semver round-1 INVENTORY codemod-1 (same finding, disposition codemod)   evidence: `S.Class<CacheKey>($I`CacheKey`)` and `S.Class<ManagedDocument>($I`ManagedDocument`)` change the JSON Schema definition names; scratchpad/test/github-actions/CacheKey.test.ts:559 was retargeted from `definitions.CacheKeyEncoded...` to `definitions.@beep/scratchpad/effected/github-actions/CacheKey/CacheKeyEncoded...`, and ManagedDocument.test.ts likewise (`definitions.@beep/scratchpad/effected/github-actions/ManagedDocument/ManagedDocumentEncoded`). README/ledger report no deviations.
- failure: Law-forced identity-key changes with retargeted oracle assertions are unrecorded for this module.
- fix: Codemod records the identity-derived schema definition keys and adjusted CacheKey.test.ts/ManagedDocument.test.ts assertions. Preserve the step-4 identities.
- seats: part-2/fable.md#fable-1-12

### c6 — Forced Effect.fn conversions introduce trace frames
- file: scratchpad/effected/github-actions/Action.ts:134; scratchpad/effected/github-actions/ActionLogger.ts:299; scratchpad/effected/github-actions/ActionCache.ts:186; scratchpad/effected/github-actions/BlobStore.ts:267; scratchpad/effected/github-actions/Secret.ts:73
- class: law   severity: backlog
- standard: D9 (behaviour-preserving; deviation only when a law forces it); standards/effect-laws-v1.md law 22 and standards/effect-first-development.md EF-14 both accept `Effect.fnUntraced`   evidence: 294ef4fa7c (step 2) converts withBuffer/call/archive/zip to Effect.fn; 1c1cb85670 (laws) converts withStepDebugLogLevel and records 31 fn/fnUntraced changes. Reports demonstrate new Cause.pretty frames and bare span names, but law 22 explicitly permits fn or fnUntraced and does not mandate the suggested span names. History therefore establishes forced conversions, not unforced restore work.
- failure: Observable trace differences from lawful forced conversions need a systemic record; naming preference does not prove a forbidden implementation.
- fix: Codemod records the effect-fn/diagnostic conversion sites and tracing differences per module/class. Retain the lawful conversions; do not assign restore/renaming solely because upstream had no span.
- seats: part-1/fable.md#fable-1-1; part-1/fable.md#fable-1-2; part-1/fable.md#fable-1-7; part-2/fable.md#fable-1-13; part-3/fable.md#fable-1-6

### c7 — Installer unknown-JSON guards are forced cast removal
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:529; scratchpad/effected/github-actions/PackageManagerInstaller.ts:754
- class: bug   severity: backlog
- standard: D9, section 14   evidence: c817c154ea (step 2) removes asserted manifest/packument shapes and replaces their property reads with P.hasProperty. The diff causes the reported null outcome differences. Non-null primitives already take missing-bin/SRI arms upstream; the broader primitive-divergence assertion in fable is unsupported.
- failure: Null outcomes changed during diagnostic-forced narrowing and need provenance, not restoration.
- fix: Codemod records the D15/unknown-boundary class and changed null outcomes. Keep guarded typed paths. Do not recreate native TypeError or add an allowlist entry; focused coverage goes to S3. r21 separately repairs bin-name containment.
- seats: part-3/grok.md#grok-1-1; part-3/grok.md#grok-1-2; part-3/fable.md#fable-1-13

### c8 — heredocBlock object parameter is law/diagnostic-forced
- file: scratchpad/effected/github-actions/internal/runnerFile.ts:59
- class: effect-idiom   severity: backlog
- standard: Consistency with the module's missingPipeableSignature workaround (ledger note 2026-10-07: fixed-arity exports get a dual data-last overload)   evidence: 6787f85c81 (step 2) adds a handwritten arity overload under the package-free reachability constraint. 1c1cb85670 (laws) replaces it with { name, value } and explicitly explains it needs neither a hand-written overload nor dual and must import nothing.
- failure: An upstream symbol changed shape by a different mechanism than the rest of the module, without a Port notes mention.
- fix: Codemod records the missingPipeableSignature/law-driven shape change and adjusted ActionOutputs/ActionState calls. Keep the object parameter and package-free helper. r22 preserves formatting bytes while improving complexity.
- seats: part-3/fable.md#fable-1-12

### c9 — Builtin loading and import-edge changes need central provenance
- file: scratchpad/effected/github-actions/internal/digest.ts:9; scratchpad/effected/github-actions/internal/sigv4.ts:8; scratchpad/effected/github-actions/DetachedProcess.ts:21
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL §5.2.6 (node: imports stay verbatim at S0; the law decides moves at S1 and each move is recorded in the ledger), D9 + §14 (ledger deviations entry first, adjusted upstream test cited, README Port notes row), §11.1 (test rewrites per 5.2 only; no test weakened)   evidence: Step-2 diagnostic remediation changes builtin imports to process.getBuiltinModule. Step-3/law commits rewrite Effect subpaths and Predicate/identity/Option reachability. Reports find no corresponding records; actual runtime-edge blindness remains r25.
- failure: The node: moves and the import-graph contract change are unrecorded and unauditable; the upstream invariant "node:crypto reaches exactly these modules" was deleted instead of carried (the walker is now blind to a runtime dependency that still exists), which is a weakened upstream test with no §14 cause on file.
- fix: Codemod records nodeBuiltinImport/runtime-loading and law-driven import/reachability adjustments per class, citing retained assertions after r25. Keep the diagnostic-forced loading route; no ledger, Port notes or allowlist edits belong to a module group.
- seats: part-3/fable.md#fable-1-1; part-2/fable.md#fable-1-1

### c10 — CheckDocument error generic is diagnostic-forced
- file: scratchpad/effected/github-actions/CheckDocument.ts:207
- class: docs   severity: backlog
- standard: D2 / README Port notes (additions and shape changes listed); tsconfig.base.json:115 anyUnknownInErrorContext: error (the forcing diagnostic)   evidence: `CheckDocumentSink<E = unknown>`, `CheckDocumentOptions<E = unknown>` and `CheckDocument.layer<E>` add a type parameter upstream's `Effect.Effect<unknown, unknown>` shape did not have; README.md Port notes (:319-341) do not mention it.
- failure: A public type-shape change forced by a diagnostic is invisible in the port record.
- fix: Codemod records anyUnknownInErrorContext-driven CheckDocumentSink<E>, CheckDocumentOptions<E> and CheckDocument.layer<E> type-shape changes. Keep the generics; assign no module-lane README/ledger edits.
- seats: part-2/fable.md#fable-1-18

### c11 — Artifact retention now follows Clock by diagnostic
- file: scratchpad/effected/github-actions/Artifact.ts:452
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14 (ledger `deviations` entry first, then README *Port notes → Deviations*, citing the adjusted upstream test) and the 2026-10-09 ruling (one ledger + README entry per module per systemic class: S.Finite, tagged errors, native-runtime replacements)   evidence: 294ef4fa7c (step 2) changes native Date.now/new Date retention calculation to Clock.currentTimeMillis/DateTime and adjusts the upstream expiry test to Clock, under globalDateInEffect.
- failure: The ledger row cannot truthfully close (`ledger --verify` reads these entries) and a later reviewer or promoter has no record that `Artifact.list` and the numeric constructors changed contract.
- fix: Codemod records the Clock/native-runtime class and adjusted Artifact.test.ts expiry assertion. Keep effectful time; unreachable-fallback cleanup is b5.
- seats: part-1/fable.md#fable-1-12

### c12 — processEnv-driven ambient-read movement needs a class record
- file: scratchpad/effected/github-actions/ToolInstaller.ts:510; scratchpad/effected/github-actions/ActionEnvironment.ts:334
- class: law   severity: backlog
- standard: D9 (upstream tests are the contract; every deviation cites the adjusted upstream test), §14; tsgo processEnv (the forcing law)   evidence: Step-2 remediation moves ambient reads into Config/Effect paths; exact-line assertions did not follow, as r24 shows.
- failure: A latent red in an upstream contract test hidden by an environment failure: once the suite loads it fails with three stale entries plus one unlisted read (PMI:414); the law:processEnv move has no deviation record.
- fix: Codemod records law:processEnv and the adjusted ambientReads assertions after r24. Keep compliant source paths and centrally own ledger/Port-notes bookkeeping.
- seats: part-3/fable.md#fable-1-2

## Rejected

### x1 — Restore ToolInstaller status to S.Number
- file: scratchpad/effected/github-actions/ToolInstaller.ts:41
- class: bug   severity: backlog
- standard: Later operator S.Finite ruling; tsconfig.base.json:208 schemaNumber:error.   evidence: A read-only differential probe decoded `{_tag:"ToolInstallerError", reason:"downloadFailed", subject:"probe", status}` through both error schemas. For `NaN`, `Infinity`, and `-Infinity`, the oracle returned `Success` and the port returned `Failure`; both returned `Success` for `503`. Upstream uses `Schema.Number`; the port uses `S.Finite`. Neither the README nor the ledger records this narrowing.
- failure: The exported error schema rejects values accepted by the upstream schema, changing its construction and decoding contract. The supplied green gates do not establish parity for these inputs.
- fix: Reject: restoring S.Number contradicts the operator S.Finite ruling and reintroduces schemaNumber; retain S.Finite and handle provenance in c2.
- seats: part-3/sol.md#sol-1-3

### x2 — Restore static builtins with new allowlist entries
- file: scratchpad/effected/github-actions/DetachedProcess.ts:21
- class: law   severity: backlog
- standard: Later no-effected-allowlist ruling; module/test write-surface restriction.   evidence: DetachedProcess.ts:21-22 `const { spawn: spawnChild } = process.getBuiltinModule("node:child_process"); const { closeSync, openSync } = process.getBuiltinModule("node:fs");` replace upstream's static `import { spawn } from "node:child_process"` / `import { closeSync, openSync } from "node:fs"`. Neither the `native-runtime` law (import-declaration scan) nor the `nodeBuiltinImport` diagnostic sees a `getBuiltinModule` call, so the gates are green with no allowlist entry (standards/effect-laws.allowlist.jsonc has no DetachedProcess row) and no directive. The same mechanism in internal/digest.ts:9 and internal/sigv4.ts:8 (`node:crypto`) blinded the oracle's bundle walker: upstream __test__/reachability.test.ts pins `node:crypto` in four exact edge sets (:172, :179, :254, :287, "`node:crypto` is the sanctioned import"); the lab copy scratchpad/test/github-actions/reachability.test.ts deleted all four entries while keeping the comments (:172, :251). Precedent: scratchpad/test/jsonc/JsoncFingerprint.test.ts:2 uses the documented `// @effect-diagnostics-next-line nodeBuiltinImport:off` directive.
- failure: A native-runtime boundary (core ChildProcess cannot route detached output to file descriptors, per the file's own comment) is hidden from both gates instead of being an auditable exception, and the upstream reachability contract that the sanctioned `node:crypto` edge stays confined to the digest helpers no longer exists: a stray `node:*` reached through `getBuiltinModule` anywhere in the light half now passes the "exact edge set" tests. The oracle suite was weakened without a recorded deviation.
- fix: Reject: adding new effected native-runtime exceptions contradicts the operator ruling and requires repo files outside the port's write surface. Keep forced builtin loading; r25 fixes the weakened oracle and c9 records the moves.
- seats: part-2/fable.md#fable-1-1
