### fable-1-1
- file: scratchpad/effected/github-actions/internal/digest.ts:9
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL §5.2.6 (node: imports stay verbatim at S0; the law decides moves at S1 and each move is recorded in the ledger), D9 + §14 (ledger deviations entry first, adjusted upstream test cited, README Port notes row), §11.1 (test rewrites per 5.2 only; no test weakened)   evidence: digest.ts:9 and internal/sigv4.ts:8 replaced `import { createHash|createHmac } from "node:crypto"` with `process.getBuiltinModule("node:crypto")` (tsgo nodeBuiltinImport at error; DetachedProcess.ts:21-22 likewise). Upstream __test__/reachability.test.ts asserts "node:crypto" in the reachable bare-import sets of CacheKey.ts, BlobStore.ts, Artifact.ts and internal/digest.ts; the port's scratchpad/test/github-actions/reachability.test.ts:176-184, 255-262, 315-320 drops it from all four (the comment at :172 still reads "`node:crypto` is the sanctioned import, and it is here"), and :270-335 rewrites the `"effect"` edge sets to effect/<Module> subpaths plus @beep/utils/Option and @beep/identity/packages. `jq '.rows[]|select(.module=="github-actions")' PORT_LEDGER.json` → deviations: [], backlog: []; README.md:335-337 "Deviations: None". The jsonl and jsonc rows show the required {test, upstreamBehaviour, labBehaviour, reason} shape.
- failure: The node: moves and the import-graph contract change are unrecorded and unauditable; the upstream invariant "node:crypto reaches exactly these modules" was deleted instead of carried (the walker is now blind to a runtime dependency that still exists), which is a weakened upstream test with no §14 cause on file.
- fix: Add ledger `deviations` entries to row w5-github-actions: `law:nodeBuiltinImport` for digest.ts/sigv4.ts/DetachedProcess.ts → process.getBuiltinModule, citing reachability.test.ts:176,182,255,315; `law:effect-imports` for the subpath/@beep edge sets, citing :270-335; mirror both under README Port notes → Deviations. To keep the invariant rather than drop it, extend the test's runtimeSpecifiers() to also collect `process.getBuiltinModule("<id>")` literals so "node:crypto" stays asserted.

### fable-1-2
- file: scratchpad/effected/github-actions/ToolInstaller.ts:510
- class: law   severity: required
- standard: D9 (upstream tests are the contract; every deviation cites the adjusted upstream test), §14; tsgo processEnv (the forcing law)   evidence: Upstream __test__/ambientReads.test.ts keys ALLOWED on exact (file, line-text) pairs and asserts set equality both ways ("allowlisted site(s) no longer present — remove them from the allowlist"). The port rewrote three of those lines: ToolInstaller.ts:510-513 (`testRoot` now goes through Config.String("RUNNER_TOOL_CACHE")…ConfigProvider.fromEnv, no process.env text), PackageManagerInstaller.ts:414 (`O.match(found, { onNone: (): string => process.arch, … })`), ActionEnvironment.ts:334 (`Effect.sync(() => ({ ...process.env })),`). scratchpad/test/github-actions/ambientReads.test.ts:146,161,171 still carry the upstream texts. TESTS_NOT_PASSING.md records the suite failing at import (typescript/unstable/ast needs TS 7), so the gate never evaluates the allowlist.
- failure: A latent red in an upstream contract test hidden by an environment failure: once the suite loads it fails with three stale entries plus one unlisted read (PMI:414); the law:processEnv move has no deviation record.
- fix: In scratchpad/test/github-actions/ambientReads.test.ts drop the ToolInstaller `testRoot` entry (:169-173, the read is gone) and replace the texts at :146 and :161 with the port's exact lines; add a `law:processEnv` deviations entry to the ledger row citing those lines and mirror it in README Port notes.

### fable-1-3
- file: scratchpad/effected/github-actions/internal/jwt.ts:19
- class: schema   severity: required
- standard: AGENTS.md Code Laws ("Prefer named schema building blocks … over ad-hoc helpers") and Discovery & Reuse ("Before recreating a shared helper, schema … search live source"); the tsgo preferSchemaOverJson rule text names `Schema.UnknownFromJsonString` as the codec for unknown shapes   evidence: node_modules/effect/dist/Schema.js:6222 `export const UnknownFromJsonString = fromJsonString(Unknown)`. `rg 'S\.fromJsonString\(S\.Unknown\)'` → 16 declarations of `const Json = S.fromJsonString(S.Unknown)`: jwt.ts:19, PackageManagerInstaller.ts:27, Artifact.ts:32, ActionState.ts:22, ActionEnvironment.ts:12, ActionInput.ts:16 and 10 test files (results.ts:17, PackageManagerInstaller.test.ts:33, …).
- failure: A stock Effect codec is re-declared sixteen times under a local name; readers cannot tell it from a bespoke codec and the stock schema's identity and annotations are lost.
- fix: Delete the local `Json` consts and use `S.UnknownFromJsonString` directly (`S.decodeResult(S.UnknownFromJsonString)`, `S.encodeResult(S.UnknownFromJsonString)`) in the two focus files and the other fourteen sites.

### fable-1-4
- file: scratchpad/effected/github-actions/ToolInstaller.ts:41
- class: schema   severity: backlog
- standard: D9/§14 (accepted-input change needs a recorded cause); forcing rule tsgo schemaNumber   evidence: Upstream `status: Schema.optionalKey(Schema.Number)`; port `S.optionalKey(S.Finite)`. S.Finite rejects NaN/±Infinity on decode and on `ToolInstallerError.make`. No upstream test exercises a non-finite status; ledger deviations: [].
- failure: A narrower accepted input with no deviation record; a consumer decoding a persisted error with a non-finite status would now fail where upstream decoded.
- fix: Record a `law:schemaNumber` deviations entry (ToolInstaller.ts:41; same pattern in DetachedProcess.ts) in the ledger and README; no code change.

### fable-1-5
- file: scratchpad/effected/github-actions/internal/jwt.ts:43
- class: effect-idiom   severity: backlog
- standard: D9/§14; precedent DIAGNOSTIC_EXCEPTIONS.md:27 (lockfiles/internal/npm.ts keeps JSON.parse under a next-line preferSchemaOverJson skip because "Syntax failures retain the original native throwable")   evidence: payloadOf: `JSON.parse(json.success)` → `Result.getOrThrowWith(S.decodeResult(Json)(json.success), identity)`, so `JwtPayloadFailure.cause` is now a SchemaError instead of the native SyntaxError; unsignedJwt:60 now throws SchemaError instead of TypeError on unserialisable input. `rg 'failure\.cause|SyntaxError' scratchpad/test/github-actions` → no assertions, so not test-visible.
- failure: The `cause` identity surfaced to callers changed silently; not recorded as a deviation.
- fix: Either record `law:preferSchemaOverJson` as a deviations entry naming the cause-identity change, or keep `JSON.parse` here with the same next-line skip and reason the lockfiles module used.

### fable-1-6
- file: scratchpad/effected/github-actions/Secret.ts:73
- class: effect-idiom   severity: backlog
- standard: D9 (smallest law-satisfying change preserves behaviour); beep effect-fn law accepts fnUntraced (packages/tooling/tool/cli/src/commands/Laws/EffectFn.ts:187); upstream span convention `<Service>.<member>`   evidence: Upstream Secret.forChildEnv/forRunnerFile and actionsResults.resultsBackend were plain Effect.gen with no span; the port wrote `Effect.fn("forChildEnv")` (:73), `Effect.fn("forRunnerFile")` (:91), `Effect.fn("resultsBackend")` (internal/actionsResults.ts:131). `rg -o 'Effect\.fn("[^"]+")'` on upstream src lists only qualified names (ToolInstaller.download, ActionCache.save, …); the port added ~25 bare-named spans module-wide ("make", "call", "tar", "put", "get", …).
- failure: New tracing spans upstream never emitted, with names that collide across services (three different "make"/"call" spans) and break the module's `<Service>.<member>` convention.
- fix: Use `Effect.fnUntraced` for these conversions (behaviour-preserving), or if spans are wanted name them `Secret.forChildEnv`, `Secret.forRunnerFile`, `actionsResults.resultsBackend` and apply the same rule to the other bare spans.

### fable-1-7
- file: scratchpad/effected/github-actions/internal/fsProbe.ts:33
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws: prefer the tersest equivalent helper form   evidence: node_modules/effect/dist/Predicate.js:687 `isObjectOrArray = typeof input === "object" && input !== null`; :782 `isObjectKeyword = (typeof object && !null) || isFunction`. So `P.isObjectKeyword(x) && !P.isFunction(x)` ≡ `P.isObjectOrArray(x)`, which is also exactly upstream's predicate. Sites: fsProbe.ts:33, internal/actionsResults.ts:95, internal/twirp.ts:169, Action.ts:171.
- failure: Longer spelling of a stock predicate; semantically fine.
- fix: Replace with `P.isObjectOrArray(x)` at the four sites.

### fable-1-8
- file: scratchpad/effected/github-actions/internal/digest.ts:1
- class: docs   severity: backlog
- standard: D4 (carried prose is converted, never dropped); README Port notes and DIAGNOSTIC_EXCEPTIONS.md must describe the live code   evidence: Upstream digest.ts opened with an 8-line header explaining the node:crypto licence; the port deleted it (digest.ts:1-9 is imports plus one line). sigv4.ts:19-20 replaced the upstream rationale paragraph with a two-line summary. README.md:326-329 (Port notes → Attribution) still cites `digest.ts:4`, `digest.ts:6`, `sigv4.ts:16` comment lines that no longer exist. DIAGNOSTIC_EXCEPTIONS.md:25-26 records whole-file nodeBuiltinImport skips at digest.ts:2 and sigv4.ts:2 that are not in the files (`sed -n 1,4p` shows none; the code uses getBuiltinModule), and :21-24 lists DetachedProcess.ts skips superseded by internal/ieeeNumber.ts.
- failure: Three documentation surfaces describe code that is no longer there.
- fix: Restore the two upstream comment blocks (reworded for getBuiltinModule), regenerate the README attribution lines from the live files, and drop or correct the stale exception rows.

### fable-1-9
- file: scratchpad/effected/github-actions/ToolInstaller.ts:365
- class: docs   severity: backlog
- standard: Module formatting consistency (not gated: the runner has no formatter step)   evidence: ToolInstaller.ts:365-368 is codemod residue — `return yield * fs.makeTempDirectory({` with 6-space indentation in a tab-indented file; internal/twirp.ts:172 carries a stray extra tab; internal/fsProbe.ts:1, internal/pnpmExe.ts:1 and internal/unstubbed.ts:1-2 insert new imports above the file header comment, splitting the import block; Secret.ts:5 and internal/actionsResults.ts:14 append effect imports after local ones.
- failure: Cosmetic only; the next formatter run will churn these files.
- fix: Run the repo formatter on the module and move the inserted imports below the header comments.

### fable-1-10
- file: scratchpad/effected/github-actions/README.md:339
- class: law   severity: backlog
- standard: D3 (every third-party runtime dep gets a ledger backlog row naming its Effect-native replacement candidate)   evidence: Ledger row w5-github-actions: newDeps `[{"name":"@azure/storage-blob","kind":"runtime","spec":"^12.33.0","replacement":null}]`, backlog: []; README.md:339-341 "Dependency backlog: None".
- failure: The one third-party runtime dependency has no replacement candidate recorded, so the D3 decision point cannot be scheduled.
- fix: Add a ledger backlog row for @azure/storage-blob naming the candidate (effect/unstable/http HttpClient against the Azure Blob REST surface, reusing the signing shape already in internal/sigv4.ts) and mirror it under README Port notes → Dependency backlog.

### fable-1-11
- file: scratchpad/effected/github-actions/internal/ieeeNumber.ts:16
- class: schema   severity: backlog
- standard: D5 (identity annotations on every schema, landing at S4); D10/§11.4 property floor at S3   evidence: New lab-authored schema `IeeeNumber = S.declare(P.isNumber, {...})` has no `$I.annoteSchema` while every other schema added in the port carries one (unstubbed.ts:16, ToolInstaller.ts:31); no round-trip property exists (`rg IeeeNumber scratchpad/test/github-actions` → none). Used only by DetachedProcess.ts:71.
- failure: Identity-less schema and an untested codec (JSON link, string-tree link, arbitrary link) once S3/S4 run.
- fix: Add `$I.annoteSchema("IeeeNumber", { description })` and, at S3, an `Arbitrary.schema` encode/decode round-trip including NaN/±Infinity spellings.

### fable-1-12
- file: scratchpad/effected/github-actions/internal/runnerFile.ts:59
- class: effect-idiom   severity: backlog
- standard: Consistency with the module's missingPipeableSignature workaround (ledger note 2026-10-07: fixed-arity exports get a dual data-last overload)   evidence: `heredocBlock(name, value)` became `heredocBlock({ name, value })` while every sibling helper (typeAt, isErrno, misconfiguredDetail, unsignedJwt, toolCacheRoot, spawnOnce, digestFile, canonicalize, sign, …) took a `Function.dual` overload; call sites ActionOutputs.ts:253 and ActionState.ts:116 were rewritten; no upstream test calls heredocBlock directly.
- failure: An upstream symbol changed shape by a different mechanism than the rest of the module, without a Port notes mention.
- fix: Either give heredocBlock the same dual overload as its siblings and restore the positional call sites, or keep the object parameter and list it under README Port notes.

### fable-1-13
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:529
- class: effect-idiom   severity: backlog
- standard: D9/§14 (an upstream-bug fix is allowed but must be recorded with evidence)   evidence: readPackageManifest: upstream `JSON.parse(raw) as {bin?…}` then `manifest.bin` dies with a TypeError defect on a `null` or primitive package.json; the port reads `P.hasProperty(manifest, "bin") ? manifest.bin : undefined` (:529) and fails typed `layoutUnexpected "package.json names no bin"`. registryIntegrity:745-746 likewise turns a `null` packument from a defect into typed `integrityMismatch`. No upstream test covers these inputs.
- failure: A behaviour improvement on hostile manifests that is unrecorded, so a later reviewer cannot tell it from drift.
- fix: Record an `upstream-bug` deviations entry (hostile/primitive JSON now fails typed instead of dying) with a small test feeding `null` and `"str"` manifests, or restore upstream's shape if the operator prefers strict parity.

REQUIRED: 3
BACKLOG: 10
