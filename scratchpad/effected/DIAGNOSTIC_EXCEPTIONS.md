# Diagnostic exceptions in the effected lab

Every place where an `@effect/tsgo` rule is switched off instead of satisfied, generated from the
tree on 2026-10-09 after step 2 (zero type, lint and tsgo diagnostics; tests at the recorded baseline).
Each entry is a deliberate choice that the operator can overrule: remove the directive and the
diagnostic comes back.

Totals: 30 in source, 11 in tests beyond the entry-point headers, 1 service annotation(s).

## Source

| File | Line | Scope | Rule | Reason given in the code |
| --- | --- | --- | --- | --- |
| `effected/cli/ui/internal/inkChalk.ts` | 2 | whole file | nodeBuiltinImport | Ink shares its Chalk instance by Node realpath and module resolution; resolving another copy changes colours. |
| `effected/cli/ui/testing/fakeStreams.ts` | 2 | whole file | nodeBuiltinImport | Ink requires Node stream events, raw-mode methods and write-callback barriers in these terminal fakes. |
| `effected/config-file/JsonCodec.ts` | 22 | next line | preferSchemaOverJson | The codec preserves the original SyntaxError in cause; Schema JSON decoding discards that throwable. |
| `effected/config-file/JsonCodec.ts` | 29 | next line | preferSchemaOverJson | The codec preserves native TypeError causes and JSON.stringify returning undefined; Schema encoding changes both. |
| `effected/config-file/JsoncCodec.ts` | 29 | next line | preferSchemaOverJson | The codec preserves native TypeError causes and JSON.stringify returning undefined; Schema encoding changes both. |
| `effected/engine/ProcessGuard.ts` | 2 | whole file | asyncFunction, newPromise, globalTimers | These process guards install and inject native crashes before Effect loads, preserving host uncaught-error timing. |
| `effected/env/internal/osc8/env.ts` | 20 | next line | missingPipeableSignature | A single string can be the env value or the optional spec, so the two call forms are ambiguous. |
| `effected/github-actions/DetachedProcess.ts` | 2 | whole file | nodeBuiltinImport | Detached children must outlive the Effect scope and inherit native log descriptors before unref. |
| `effected/github-actions/DetachedProcess.ts` | 60 | next line | schemaNumber | The error reports the pid it refused, which may be NaN or infinite. |
| `effected/github-actions/DetachedProcess.ts` | 80 | next line | schemaNumber | The error reports the pid it refused, which may be NaN or infinite. |
| `effected/github-actions/DetachedProcess.ts` | 158 | next line | schemaNumber | The integer check in the pipe rejects NaN and the infinities itself, with its own message. |
| `effected/github-actions/internal/digest.ts` | 2 | whole file | nodeBuiltinImport | The synchronous and streaming digests require incremental hashing, which Effect Crypto does not expose. |
| `effected/github-actions/internal/sigv4.ts` | 2 | whole file | nodeBuiltinImport | SigV4 requires synchronous HMAC, which Effect Crypto does not expose. |
| `effected/lockfiles/internal/npm.ts` | 150 | next line | preferSchemaOverJson | Syntax failures retain the original native throwable; Schema JSON decoding discards its identity and details. |
| `effected/markdown/internal/blockParser.ts` | 669 | next line | missingPipeableSignature | The engine's default is the BASE dialect the registries compose on top of — not the public default, which is `"gfm"` and lives in the facade's `dialectOf`. The facade always passes its resolved dialect explicitly, so this default only ever serves engine-level callers (tests, mostly) that mean "the substrate". A dialect string can also be input text, so optional arguments make the two call forms ambiguous. |
| `effected/memfs/NodeSyncFileSystem.ts` | 2 | whole file | nodeBuiltinImport | This adapter preserves synchronous Node filesystem throws and errno metadata; Effect FileSystem is asynchronous. |
| `effected/memfs/internal/errno.ts` | 109 | next line | missingPipeableSignature | String paths overlap method strings, and the optional description makes the two call forms ambiguous. |
| `effected/package-json/EntryPoint.ts` | 178 | next line | missingPipeableSignature | Manifest and options are both optional-field objects, so even an empty object makes the call forms ambiguous. |
| `effected/toml/TomlNode.ts` | 90 | next line | schemaNumber | A TOML float may be `inf` or `nan`, so the finite-only schema would reject valid documents. |
| `effected/workspaces/internal/configDependencyFetch.ts` | 2 | whole file | nodeBuiltinImport | Config-dependency replay reads the real Node module store even when the supplied FileSystem is virtual. |
| `effected/workspaces/internal/configDependencyResolution.ts` | 2 | whole file | nodeBuiltinImport | Config-dependency replay reads the real Node module store even when the supplied FileSystem is virtual. |
| `effected/workspaces/internal/configDependencyShared.ts` | 2 | whole file | nodeBuiltinImport | Config-dependency replay reads the real Node module store even when the supplied FileSystem is virtual. |
| `effected/workspaces/internal/configDependencyShared.ts` | 24 | next line | missingPipeableSignature | A string cause overlaps the path argument, so optional reason makes the two call forms ambiguous. |
| `effected/workspaces/node-sync.ts` | 2 | whole file | nodeBuiltinImport | This synchronous Node binding preserves native filesystem exceptions and the running platform path semantics. |
| `effected/yaml/internal/composer/scalars.ts` | 108 | next line | missingPipeableSignature | Scalar styles and raw values are strings, so optional tag and state make the two call forms ambiguous. |
| `effected/yaml/internal/fold.ts` | 257 | next line | missingPipeableSignature | Content and indentation are both strings, so optional rendering arguments make the two call forms ambiguous. |
| `effected/yaml/internal/fold.ts` | 322 | next line | missingPipeableSignature | Content and indentation are both strings, so optional rendering arguments make the two call forms ambiguous. |
| `effected/yaml/internal/rules/util.ts` | 18 | next line | schemaNumber | The check below rejects NaN and the infinities itself and names the option domain in its message; a finite-only base would answer first with a different message. |
| `effected/yaml/internal/rules/util.ts` | 30 | next line | schemaNumber | Same as above: the check owns the rejection and its message. |
| `effected/yaml/internal/stringifier.ts` | 1947 | next line | missingPipeableSignature | The value accepts every options object too, so a single object cannot distinguish the two call forms. |

## Service annotations

| File | Line | Annotation | Reason given in the code |
| --- | --- | --- | --- |
| `effected/github/Repo.ts` | 83 | `@effect-leakable-service` | y<RepoRef>; const syncAll = Effect.forEach(targets, (target) => syncOne.pipe(Repo.provide(target)), { concurrency: 4, }); ``` Repo is resolved per operation so Repo.provide can redirect an already built resource service. |

## Tests, beyond the entry-point headers

| File | Line | Scope | Rule | Reason given in the code |
| --- | --- | --- | --- | --- |
| `test/github-actions/results.ts` | 2 | whole file | missingPipeableSignature | This response factory is an internal test helper with a direct-call contract. |
| `test/jsonc/JsoncFingerprint.test.ts` | 2 | next line | nodeBuiltinImport | The synchronous digest callback is tested against Node's real backend. |
| `test/jsonc/Properties.test.ts` | 14 | next line | nodeBuiltinImport | Property floor for the jsonc module (effected-port goal 11.4, D10).  Every exported schema and codec round-trips: encoding then decoding returns the value under the schema's own equivalence, and decoding an encoded value never fails. Every parser and formatter keeps its idempotence and fidelity laws, together with the README's guarantees: comments survive edits, value spans are exact, a formatter pass is a whitespace diff, comment stripping keeps offsets with a replacement character, and fingerprints ignore key order (and line endings when asked). The properties already in Jsonc.test.ts (parse agreeing with stripComments, JsoncFromString over one fixed struct) and JsoncFormatter.test.ts (idempotence on plain JSON) are not repeated here.  The synchronous digest twin is checked against Node's real SHA-256 backend. |
| `test/markdown/e2e/support/span.ts` | 2 | whole file | missingPipeableSignature | These span factories are internal test helpers with direct-call contracts. |
| `test/memfs/FaultInjection.test.ts` | 200 | next line | missingEffectError, globalErrorInEffectFailure | @ts-expect-error -- a bare Error is not a PlatformError This negative type test deliberately supplies a bare Error failure to prove the fault API rejects it. |
| `test/templates/fixtures.ts` | 2 | whole file | missingPipeableSignature | This filesystem factory is an internal test helper with a direct-call contract. |
| `test/toml/oracle.property.test.ts` | 261 | next line | schemaNumber | TOML float round-trip properties must include infinities, as the scalar tests require. |
| `test/walker/fixtures.ts` | 2 | whole file | missingPipeableSignature | These platform factories are internal test helpers with direct-call contracts. |
| `test/workspaces/fixtures.ts` | 2 | whole file | missingPipeableSignature | These test fixtures are internal helpers and preserve their direct-call contract. |
| `test/workspaces/integration/utils/configDependencyFixtures.ts` | 2 | whole file | missingPipeableSignature | These test fixtures are internal helpers and preserve their direct-call contract. |
| `test/yaml/e2e/support/engine.ts` | 2 | whole file | missingPipeableSignature | This engine adapter is an internal test helper with a direct-call contract. |

## Tests, entry-point headers (operator ruling, 2026-10-09)

226 test files carry a first-line `@effect-diagnostics <rule>:skip-file` header for rules that treat a
test like application code. Only the rules a file trips are named.

| Rule | Test files |
| --- | --- |
| strictEffectProvide | 158 |
| nodeBuiltinImport | 85 |
| multipleEffectProvide | 40 |
| asyncFunction | 34 |
| processEnv | 12 |
| processEnvInEffect | 11 |
| newPromise | 9 |
| globalTimers | 8 |
| globalRandom | 1 |
