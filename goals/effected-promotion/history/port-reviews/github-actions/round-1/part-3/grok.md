I'll review this github-actions slice against the pinned upstream oracle and the port decisions, starting with the binding rules and the files in scope.Port notes record no deviations. I'll compare the focus files with the pinned upstream sources and look for behaviour or law gaps the gates would miss.The review is still open. I am checking the remaining call sites and the error-message path so the findings match the pinned upstream, then I will report only those.### grok-1-1
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:534
- class: bug   severity: required
- standard: D9, section 14   evidence: Upstream `readPackageManifest` (`packages/github-actions/src/PackageManagerInstaller.ts:523-529`) parses with `JSON.parse` inside `Effect.try` and then reads `manifest.bin`. `JSON.parse("null")` is `null`, and `null.bin` throws, so the catch reports `layoutUnexpected` with subject `unparseable package.json` and that `TypeError` as `cause`. The lab decodes with `S.decodeResult(Json)` (`S.Unknown` accepts `null`) and then `P.hasProperty(manifest, "bin")`. `Predicate.isObjectKeyword(null)` is false (`Predicate.ts:1127`, `1136-1137`), so line 534 takes the missing-bin arm and line 536 reports subject `package.json names no bin` with no `cause`. The message getter interpolates `subject` (`PackageManagerInstaller.ts:99`). Arrays and JSON primitives already take the missing-bin arm on both sides, because property access on them does not throw.
- failure: A package.json whose text is `null` changes the `layoutUnexpected` subject from `unparseable package.json` to `package.json names no bin` and drops the thrown cause. `prefer-schema-over-json` forces the codec. It does not force this classification.
- fix: After a successful decode, fail with subject `unparseable package.json` when the value is `null`, before the `bin` check. Check `=== null` only. A native `TypeError` cause needs a `beep-laws/no-native-runtime` `native-error` allowlist entry. Otherwise record the absent cause as `law:beep-laws/no-native-runtime`.

### grok-1-2
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:754
- class: law   severity: required
- standard: D9, section 14   evidence: Upstream `registryIntegrity` (`PackageManagerInstaller.ts:742-751`) parses inside `Effect.try`, then evaluates `packument.dist?.integrity` outside that try. Optional chaining binds to `dist`, so a JSON `null` packument throws `TypeError` on `null.dist` and the effect dies. The lab uses `P.hasProperty(packument, "dist")`, which is false for `null`, then `expectedFromSri` (`PackageManagerInstaller.ts:727`) returns typed `integrityMismatch` for `packumentUrl` with no `cause`. Non-null values with no string `dist.integrity` already take that typed arm on both sides. Ledger `w5-github-actions.deviations` is `[]` and README Port notes → Deviations is `None`. The function comment (`PackageManagerInstaller.ts:730-733`, same text upstream at `726-729`) says a packument with no usable SRI is that typed arm. No upstream test covers `null`.
- failure: A packument whose body is `null` dies upstream and fails typed in the lab. The deviation is unrecorded.
- fix: Keep the typed failure. Add the ledger and README deviation `upstream-bug:` citing that comment, plus the smallest test that a `null` packument fails `integrityMismatch` on `packumentUrl` and does not die.

### grok-1-3
- file: scratchpad/effected/github-actions/internal/jwt.ts:43
- class: law   severity: required
- standard: `prefer-schema-over-json` (TS377026); `standards/effect-first-development.md` JSON-codec rule; D9, section 14   evidence: Upstream `payloadOf` (`internal/jwt.ts:38-41`) catches `JSON.parse`'s `SyntaxError` and stores it on `JwtPayloadFailure.cause`. The lab throws the `S.decodeResult(Json)` failure (`SchemaGetter.parseJson` maps a parse failure to `SchemaIssue.InvalidValue`, `SchemaGetter.ts:1263-1271`). `OidcTokenIssuer.readClaims` copies that cause onto `OidcTokenError` (`OidcTokenIssuer.ts:112`). The outer `reason` stays `malformedToken` and `message` still uses `detail` only (`OidcTokenIssuer.ts:46`). The same catch-cause swap is at `PackageManagerInstaller.ts:532` (`unparseable package.json`) and `registryIntegrity`'s `unverifiable` (`PackageManagerInstaller.ts:743-750`). `unsignedJwt` (`jwt.ts:60`) encodes with `S.encodeResult(Json)`. `JSON.stringify(undefined)` returns `undefined` and upstream then calls `Base64Url.encode`; a cycle or bigint throws the engine `TypeError`. `stringifyJson` (`SchemaGetter.ts:1328-1341`) fails `InvalidValue` for all three. Deviations is `[]`.
- failure: Invalid JSON still fails with the same detail sentence, and the stored `cause` is a schema issue where upstream stored `SyntaxError` or `TypeError`. `unsignedJwt` throws that schema issue for `undefined`, a cycle, or a bigint. None of this is in the ledger.
- fix: Record one deviation `law:prefer-schema-over-json` covering these sites, with a test that the payload failure's `cause` is the schema issue. Leave the codec in place.

### grok-1-4
- file: scratchpad/effected/github-actions/ToolInstaller.ts:41
- class: schema   severity: required
- standard: `schemaNumber` (TS377098); D9, section 14   evidence: Upstream `ToolInstallerError.status` is `Schema.optionalKey(Schema.Number)` (`ToolInstaller.ts:26`), which accepts `NaN` and `±Infinity`. The lab field is `S.optionalKey(S.Finite)`. `schemaNumber` is an error and tells you to disable the diagnostic where non-finite values are intentional. `retryable` (`ToolInstaller.ts:75`) is unchanged for every finite status: `NaN >= 500` was already false. The same `S.Finite` swap is recorded for jsonc (`scratchpad/effected/jsonc/README.md` deviations 9 and 13). This module's `deviations` is `[]`.
- failure: `ToolInstallerError.make({ status: NaN })` and a decode of that status are rejected. Upstream accepts them.
- fix: Record `law:schemaNumber` in the ledger and README Port notes, and pin it with a test that a non-finite `status` is rejected. Keep `S.Finite`.

### grok-1-5
- file: scratchpad/effected/github-actions/internal/unstubbed.ts:31
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 7; `beep-laws/no-native-runtime` kind `native-error` (`NoNativeRuntime.ts:404-405`); D9, section 14   evidence: Upstream throws `new Error(\`${double}: ${member}() was called but not stubbed — …\`)` inside `Effect.sync` (`internal/unstubbed.ts:21-22`). The lab throws `UnstubbedMemberError.make` with that same string. The effect still dies. `UnstubbedMemberError` is a `Schema.TaggedError` with `_tag` `UnstubbedMemberError` (`unstubbed.ts:16-17`). `new Error` would fail the native-runtime gate. Deviations is `[]`. jsonc records the same native-`Error` to tagged-error swap as `law:7`.
- failure: An unstubbed double dies with a tagged `UnstubbedMemberError` where upstream dies with a plain `Error`. The message matches. The defect tag is unrecorded.
- fix: Keep the tagged error. Record `law:7` and pin the die value's `_tag` in one existing unstubbed-member test.

### grok-1-6
- file: scratchpad/test/github-actions/reachability.test.ts:315
- class: test   severity: required
- standard: D9; `nodeBuiltinImport` (TS377057)   evidence: `runtimeSpecifiers` (`reachability.test.ts:46`) collects only `import`/`export … from` specifiers. Upstream `internal/digest.ts` imports `node:crypto`, and the oracle expects that edge (`__test__/reachability.test.ts:284-288`) and the same transitive edge on `PackageManagerInstaller.ts` (`:247-254`), `CacheKey.ts` (`:172`), and `BlobStore.ts` (`:179`). The lab loads crypto through `process.getBuiltinModule("node:crypto")` at `internal/digest.ts:9` and `internal/sigv4.ts:8`. The lab assertions omit `node:crypto` (`reachability.test.ts:315-320` and `:254-261`; CacheKey `:176-181`, BlobStore `:182-187`). The comments at `:172-173` and `:250-251` still say those sets contain the sanctioned `node:crypto` digest.
- failure: The exact-edge oracle no longer sees `node:crypto`, and a further `getBuiltinModule("node:…")` does not fail the confinement test. Hashing behaviour is unchanged.
- fix: Count `process.getBuiltinModule("node:…")` as a runtime edge and put `node:crypto` back in those four expected sets.

### grok-1-7
- file: scratchpad/effected/github-actions/README.md:327
- class: docs   severity: backlog
- standard: D4   evidence: Port notes quote `digest.ts:4`, `digest.ts:6`, and `sigv4.ts:16` as the node-crypto licence comments. Those lines are imports or blank. The live comments are `digest.ts:8` and `sigv4.ts:7`. Upstream `sigv4.ts:13-17` `@remarks` states the `node:crypto` licence. The lab `@remarks` (`sigv4.ts:13-20`) ends at the HMAC sentence and omits that paragraph. Upstream `digest.ts:1-8` states why `createHash` stays in that module. The lab file drops it.
- failure: The attribution block cites comment text that is not in the files, and the sigv4 and digest licence comments were dropped.
- fix: Point the bullets at the live comments and restore the dropped licence sentences into those comments.

REQUIRED: 6
BACKLOG: 1
