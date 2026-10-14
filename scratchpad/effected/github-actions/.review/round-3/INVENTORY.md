# github-actions — round-3 merged inventory

Seats read: all nine reports (`grok.md`, `sol.md`, `fable.md` in `part-1`, `part-2`, `part-3`), all three adjacent `BRIEF.md` files and all three `BRIEF.grok3.md` route briefs. Seat ids below include the part because report-local ids repeat. The Fable-named reports identify the independent Grok medium fallback route.

Counts: 58 input findings; REQUIRED: 52  BACKLOG: 2  CODEMOD: 0  REJECTED: 0  GROUPS: 8. Umbrella schema findings are split by file; same-file orchestration defects are merged. Counts refer to merged records, not original seat totals.

Binding: the entire operator revision block, including both 2026-10-09 rulings, D1–D20, sections 12.5 and 14, and the task-specific write/stage restrictions. Brief claims about completed S2/S3 do not override the task's instruction to defer documentation, coverage and vitest-canon findings. Reported green gates are seat provenance, not checks rerun by this merger. All accepted law/schema findings identify source patterns that those gates left intact.

Provenance: reviewed commit `a67fdb1f52f7bd981bd8345a5f3ba4ef3bd6cd56`; current checkout `@lab/effected-2`, HEAD `9922dd42e1786c7154eb11d67858975ff95a8c8c` (task names `@lab/effected`). Module source/tests have no current dirty edits. Relevant history includes `7929b1f529` (squashed port/law work), `1935b10342` (S3), and `f5006b3e9c` (round-2 fixes). The supplied findings establish bugs in both lab and pinned oracle or cited idiom/schema violations; none claims an unforced lab-only change requiring an upstream restore. No scratch diagnostic copies or writing checks were run.

Allowlist: the full current `standards/effect-laws.allowlist.jsonc` was read and parsed: 27 entries total, zero for `scratchpad/effected/github-actions/**` and zero for any `scratchpad/effected/**` path. Therefore there are no current entries from which to generate `allow-<n>` findings. Historical removed entries are not recreated.

Write ownership: `required.json` assigns every required source/test file exactly once; each group has at most six source files. `internal/spawn.test.ts` is a proposed new focused contract test. The two broad schema reports are decomposed into file-specific defects, so no lane owns their entire cross-module list. No root manifests, lockfile, shared config, ledger, README Port notes or sibling module is assigned. `index.ts` can retain its existing type re-exports; schema value additions live in the owning file. Central bookkeeping for verified bug deviations and law-forced additions stays with the orchestrator/codemod and is not a required group edit. All regression tests are focused behavior/contract checks; full coverage and schema property-floor work is b2.

## Required

### r1 — Reject runner PATH line breaks
- file: scratchpad/effected/github-actions/ActionOutputs.ts:415
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`); round-2 r2 (newline-delimited runner/tool file).
- evidence: Live `addPath` is `append(RUNNER_FILE.addPath, `${path}\n`)` with no LF/CR check. The pinned oracle is the same write at `ActionOutputs.ts:255`. `GITHUB_PATH` is one directory per line (`echo "{path}" >> "$GITHUB_PATH"`). `addPath("a\nb")` therefore appends `a\nb\n` — two directory lines from one call. `File.ReadAllLines` also splits on a bare CR. `ActionOutputs.recording` at line 682 journals the raw string and does not reject it. `ActionOutputs.test.ts` only covers `addPath("/opt/bin")`. Heredoc names already go through `isUsableName`; this member does not. `addPath` appends `` `${path}\n` `` with no break check. `set`, `exportVariable`, and `ActionState` already refuse CR/LF via `isUsableName`. The pinned oracle uses the same template string. A path `"/opt/a\n/opt/b"` is two runner PATH entries.
- failure: One `addPath` call publishes extra `PATH` entries for later steps when the directory contains LF or CR. The recording double accepts that input, so a test can pass while the runner file is split.
- fix: Reject CR and LF in live and recording addPath through the existing typed ActionOutputError channel before append or journal mutation. Add ActionOutputs.test.ts regressions proving no file write and no recording entry.
- seats: part-1/grok-3-1, part-1/fable-3-3

### r2 — Validate artifact retention before creating or uploading
- file: scratchpad/effected/github-actions/Artifact.ts:489
- class: bug   severity: required
- standard: standards/effect-first-development.md EF-1 and EF-31; EFFECTED_PORT_GOAL.md D11 and section 14’s verified-upstream-bug route.
- evidence: A read-only differential probe used a no-op filesystem, stubbed process handle, recording RPC client, and counting transport. With `retentionDays` equal to `NaN`, `Infinity`, or `1e20`, both the lab and pinned oracle uploaded once and called `CreateArtifact`, then failed through the defect channel without calling `FinalizeArtifact`. The lab defect was `IllegalArgumentError: Invalid date`; the oracle defect was `RangeError: Invalid Date`. The `<= 0` guard admits all three values. `retentionDays <= 0` does not reject `NaN` or `Infinity` (`NaN <= 0` and `Infinity <= 0` are both false). The expiry is then `Clock.currentTimeMillis + retentionDays * 86_400_000`, and `DateTime.makeUnsafe` at line 539 calls `new Date(input)` and throws `IllegalArgumentError` on a non-finite or out-of-range epoch (`effect` `internal/dateTime.ts` `fromDateUnsafe`). The pinned oracle does the same with `new Date(...).toISOString()` after `transfer.uploadFile`. The throw sits in the `FinalizeArtifact` body thunk, which runs only after the zip upload at line 523, and `Effect.gen` turns it into a defect.
- failure: Invalid caller options fail after the artifact has been created and its bytes uploaded. Callers expecting `ArtifactError` cannot recover through that typed channel, and the upload remains unfinalized.
- fix: Validate positive finite retention and a representable expiration before scratch/archive, CreateArtifact or transfer; return ArtifactError invalidOptions for invalid values or overflow. Preserve omitted and valid retention. Add Artifact.test.ts cases for NaN, Infinity and overflowing finite retention with zero archive, RPC and transfer calls.
- seats: part-1/sol-3-1, part-1/fable-3-1

### r3 — Refuse blob metadata that cannot decode its own serialized frame
- file: scratchpad/effected/github-actions/BlobEnvelope.ts:330
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D10’s codec fidelity requirement, D11, and section 14; BlobEnvelope’s typed metadata encode/decode contract.
- evidence: A read-only `bun --eval` differential probe called `encodeResult(O.some("hello"), new Uint8Array([42]), S.Option(S.String))`, then decoded the successful frame with the same schema. Both the lab and pinned oracle returned `encode: Success`, followed by `decode: Failure` with `BlobMetadataDecodeError`. The current properties exercise JSON-compatible struct metadata and miss this case.
- failure: Encoding can report success for a frame that its own metadata codec cannot subsequently read. `GitHubCacheBlobStore.put` can therefore publish an immutable cache entry successfully while every corresponding `get` fails.
- fix: Decode the serialized metadata through the caller codec before returning framed bytes; map failure to BlobMetadataEncodeError without changing supported wire bytes. Add the S.Option(S.String) failure regression and retain S.OptionFromNullOr(S.String) success in BlobEnvelope.test.ts.
- seats: part-1/sol-3-2

### r4 — Refuse lossy non-JSON action state before append
- file: scratchpad/effected/github-actions/ActionState.ts:185
- class: bug   severity: required
- standard: ActionStateShape.save’s documented plain-JSON preservation guarantee at ActionState.ts:111; EFFECTED_PORT_GOAL.md D9, D11, and section 14.
- evidence: A read-only differential probe captured runner-file output in memory. In both the lab and pinned oracle, `save("payload", NaN, S.Unknown)` succeeded, wrote JSON `null`, and a later `get("payload", S.Unknown)` returned `null`. The current check only verifies that the parsed value is accepted by the schema; it never establishes that the encoded value survived serialization. An installed-Effect probe confirmed that `S.decodeUnknownResult(S.Json)(NaN)` fails.
- failure: A successful save silently changes the state value across the phase boundary despite the documented promise to reject encoded values that do not survive JSON. Permissive codecs also allow undefined object fields to disappear undetected.
- fix: Validate the encoded value with S.Json before serialization and map rejection to notPlainJson; retain the subsequent caller-schema decode check. Add ActionState.test.ts cases for NaN and undefined object members proving no append.
- seats: part-1/sol-3-3

### r5 — Use own environment entries in the input provider
- file: scratchpad/effected/github-actions/ActionInput.ts:717
- class: bug   severity: required
- standard: ActionInput.provider’s supplied-environment lookup contract; EFFECTED_PORT_GOAL.md D11 and section 14’s verified-upstream-bug route.
- evidence: A read-only differential probe supplied `Object.create({ INPUT_TOKEN: "prototype-token" })` to `ActionInput.provider` and loaded `Config.String("token")`. Both the lab and pinned oracle returned `"prototype-token"`, although the supplied record contained no own environment entries. The alias map enumerates own entries through `R.toEntries`, but the direct lookup reads inherited entries through `env[name]`. The recorded ActionEnvironment deviation fixes a separate lookup implementation and does not cover this provider.
- failure: An absent input can become present through the environment object’s prototype. An inherited runner-prefixed value can also override a legitimate own bare-name entry.
- fix: Use O.getOrUndefined(R.get(env, name)) for the direct lookup, preserving direct-entry precedence, aliases and empty-string handling. Add ActionInput.test.ts inherited-only and inherited runner-name shadowing regressions.
- seats: part-1/sol-3-4

### r6 — Reject NaN artifact compression before archiving
- file: scratchpad/effected/github-actions/Artifact.ts:498
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug). `UploadOptions.compressionLevel` says out-of-range values are clamped to `0..9`.
- evidence: `options?.compressionLevel ?? 6` keeps `NaN`. `clampLevel` is `Math.min(9, Math.max(0, Math.trunc(level)))`, and every `Math` step preserves `NaN`. POSIX argv becomes `"-NaN"`. On Windows, `dotnetCompressionLevel(NaN)` falls through every `<=` test and selects `SmallestSize`. The proposed blanket non-finite check is narrowed: Math.min/Math.max already clamp infinities to 9/0; NaN is the demonstrated cross-platform failure.
- failure: `NaN` is not clamped. POSIX fails the archive; Windows silently packs at `SmallestSize`.
- fix: Reject an explicitly supplied NaN compressionLevel with ArtifactError invalidOptions before scratch or zip. Keep the existing clamping of finite values and positive/negative infinity unless a cited schema law separately forces a restriction. Add Artifact.test.ts regression proving no zip spawn.
- seats: part-1/fable-3-2

### r7 — Preserve POSIX backslash filenames until typed archive refusal
- file: scratchpad/effected/github-actions/ActionCache.ts:452
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug). Resolved tar paths must name the files that were matched.
- evidence: `posix` is `replaceAll("\\", "/")` and is applied to every `readDirectory` entry. On POSIX, `\` is a legal filename character, and Node `readdir({ recursive: true })` returns that name. `foo\bar` becomes `foo/bar` before `set.matches`, the line-break guard, and the manifest. GNU `tar -T` also unescapes `\` unless `--verbatim-files-from` is set, and that flag is GNU-only (the file’s own note). The pinned oracle has the same `posix(entry)` call.
- failure: A matched file whose name contains `\` is archived as a different path, dropped, or turned into an extra manifest line by tar’s escape parser.
- fix: Normalize backslashes only on Windows. On POSIX retain entry bytes and refuse backslash-containing resolved paths with archiveFailed before writing the manifest or spawning tar. Add ActionCache.test.ts backslash-filename regression.
- seats: part-1/fable-3-4

### r8 — Match Action debug and exit orchestration
- file: scratchpad/effected/github-actions/Action.ts:172; scratchpad/effected/github-actions/Action.ts:350
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11. Round 2 r12: a boolean that chooses which effect to run is not caught by the green tsgo, oxlint, or four beep-law gates.
- evidence: `stepDebug && LogLevel.isGreaterThan(minimum, "Debug") ? Effect.provideService(program, References.MinimumLogLevel, "Debug") : program`. `Exit.isSuccess(exit) ? Effect.void : Effect.gen(...)` selects the failure renderer.
- failure: The step-debug level drop is boolean orchestration instead of `Bool.match`.
- fix: Use lazy Bool.match for the lower-only step-debug override and Exit.match for the success/failure renderer. Preserve original program, Console.log, debug dump and process.exitCode behavior.
- seats: part-1/fable-3-5, part-1/fable-3-6

### r9 — Match the runner heredoc name gate
- file: scratchpad/effected/github-actions/ActionOutputs.ts:278
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.
- evidence: `isUsableName(name) ? effect : Effect.fail(InvalidOutputNameError.make({ file, name }))`.
- failure: The heredoc name gate chooses an effect with a boolean ternary.
- fix: Use lazy Bool.match for withUsableName; preserve the success effect and InvalidOutputNameError payload.
- seats: part-1/fable-3-7

### r10 — Match finite runner-number parsing
- file: scratchpad/effected/github-actions/ActionEnvironment.ts:350
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.
- evidence: `Number.isFinite(parsed) ? Effect.succeed(parsed) : Effect.fail(ActionEnvironmentError.make(...))`.
- failure: `GITHUB_RUN_ID` and `GITHUB_RUN_ATTEMPT` parsing is boolean effect selection.
- fix: Use lazy Bool.match on Number.isFinite(parsed), preserving GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT values and malformed details.
- seats: part-1/fable-3-8

### r11 — Match literal acceptance and flat input lookup
- file: scratchpad/effected/github-actions/ActionInput.ts:331; scratchpad/effected/github-actions/ActionInput.ts:830
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.
- evidence: `S.is(S.Literals(allowed))(raw) ? Effect.succeed(raw) : Effect.fail(configError(...))`. `P.isString(name) ? ambient.load([inputVariable(name)]) : Effect.as(Effect.void, undefined)`.
- failure: Literal-input acceptance chooses an effect with a boolean ternary.
- fix: Use lazy Bool.match for the schema literal guard and P.isString(name) lookup branch. Preserve allowed-set messages, raw actual values, inputVariable mapping and the undefined miss.
- seats: part-1/fable-3-9, part-1/fable-3-10

### r12 — Match the logger buffering decision
- file: scratchpad/effected/github-actions/ActionLogger.ts:413
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.
- evidence: `if (stepDebug || LogLevel.isLessThanOrEqualTo(minimum, "Debug")) return yield* effect`, otherwise the buffer is built.
- failure: Whether a step is buffered is a boolean orchestration branch.
- fix: Use lazy Bool.match for debug bypass versus buffer setup. Preserve warn passthrough and onSuccess flush policy.
- seats: part-1/fable-3-11

### r13 — Escape unmatched trailing link-label backslashes
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:190
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream bug; `GitHubMarkdown.link`’s documented link-construction contract.
- evidence: Read-only differential probes call `link("abc\\", "https://example.test")` and parse the result with the pinned oracle’s Markdown parser. Both implementations emit `[abc\](https://example.test)`, and the parsed child-node types are `["text"]`, with no link. The new `escapeLinkLabel` handles unmatched brackets but leaves an unmatched trailing backslash intact. This input is separate from the closed round-2 bracket cases and is absent from their regression matrix. `escapeLinkLabel` only rewrites unmatched `[`/`]`; its `\\[\s\S]` alternative needs a character after the backslash, so a final odd run stays put. `link` then wraps that string in a passthrough `Html` child. `stringify.ts:748` emits `[${children}](${destination(url)})` and `stringify.ts:703` writes `Html` verbatim, so `GitHubMarkdown.link("foo\\", "https://example.test")` is `[foo\](https://example.test)`. `escape.ts:48-52` consumes `\` plus escapable punctuation (`]` is in `ESCAPABLE`, `unescape.ts:32`) as literal text before `makeLinkCloseConstruct` (`link.ts:240`, trigger `]`). The pinned parser therefore never closes one link around the label. Upstream `GitHubMarkdown.ts:342` passes the label through raw and emits the same string.
- failure: A label ending in an odd number of backslashes escapes the closing bracket supplied by the writer. The result becomes literal text instead of a hyperlink.
- fix: After bracket escaping, append a backslash only for an odd trailing backslash run. Preserve existing escape pairs and inline Markdown. Add parser-backed GitHubMarkdown.test.ts cases for lone, odd and even trailing backslashes.
- seats: part-2/sol-3-3, part-2/grok-3-1

### r14 — Keep bare-CR list continuations in the same item
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:524
- class: bug   severity: required
- standard: D11; D9 / section 14 (upstream-bug); `GitHubMarkdown.list` continuation-indent contract (same text upstream at GitHubMarkdown.ts:369). Distinct from the recorded table `<br>` deviation.
- evidence: List items are raw `Html`. `stringify.ts:1021` indents only on `\n`. `preprocess.ts:127-129` treats a bare CR as a line break, and its own example `preprocessLines("foo\r").length === 2` is at preprocess.ts:110. `GitHubMarkdown.list(["a\rb"])` therefore stringifies as `- a\rb`, which the parser splits into a one-line item `a` and a following paragraph `b`. Upstream `GitHubMarkdown.ts:378` uses the same passthrough. `hangingIndent` splits only on `"\n"` (`scratchpad/effected/markdown/internal/stringify.ts:1021-1028`) and an HTML passthrough leaf is emitted raw (`stringify.ts:1273-1275`). `preprocessLines` treats a bare CR as a line ending (`preprocess.ts:127-129`). List continuation then requires `scanner.indent >= markerOffset + padding` (`blocks/list.ts:235-238`). Upstream `list` (`packages/github-actions/src/GitHubMarkdown.ts:372-380` in the pinned oracle) passes the item through the same way. `GitHubMarkdown.list(["a\rb"])` therefore serializes as `- a` plus an unindented `b`. CRLF already survives because `split("\n")` leaves the CR on the first line and the continuation stays indented.
- failure: A bare carriage return in a list item ends the bullet. The following text is outside the list. LF items stay indented, so CR and LF of the same item disagree.
- fix: Normalize CRLF and bare CR to LF in each list item before passthrough/ListItem construction, so hanging indentation applies. Add parser-backed GitHubMarkdown.test.ts regression for a\rb as one item.
- seats: part-2/grok-3-2, part-2/fable-3-1

### r15 — Sign the exact custom-endpoint S3 resource
- file: scratchpad/effected/github-actions/BlobStore.ts:376; scratchpad/effected/github-actions/BlobStore.ts:385
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream bug; the custom endpoint’s documented `<endpoint>/<bucket>/<key>` addressing contract and the existing “signs the resource sent” regression in `scratchpad/test/github-actions/BlobStore.test.ts`.
- evidence: A read-only recording `HttpClient` probe used `endpoint: "https://example.test/gateway"`, `bucket: "cache"`, and `has("key")`, with synthetic credentials and no network execution. Both the lab and pinned oracle produce `url: "https://example.test/gateway/cache/key"`, `signatureMatchesSentPath: false`, and `signatureMatchesPathWithoutEndpoint: true`. Expected signatures were reconstructed with the pinned oracle signer using the captured signing timestamp. `request` signs only the bucket/prefix/key path, while URL construction prepends the complete endpoint. `makeS3` signs `objectPath` (`BlobStore.ts:371-376`), which is `bucket`, optional `prefix`, and `key`. `canonicalize` (`sigv4.ts:183-193`) encodes that path and puts an empty canonical query in the signature. The request URL is the raw `endpoint` string plus the encoded object path (`BlobStore.ts:385`). `new URL(endpoint).host` (`BlobStore.ts:363`) drops pathname, search, and hash from the signed host. For `https://minio.local:9000/s3` the signature covers `/bucket/key` while the client requests `/s3/bucket/key`. For `https://h.example/s3?x=1` the key is appended inside the query. `new URL` on an unparseable endpoint throws `TypeError` out of `Effect.fn`, so the failure is a defect rather than `BlobStoreError` reason `misconfigured`. Upstream oracle `BlobStore.ts:217` and `:242` do the same join. Recorded deviations cover segment encoding and empty segments only. Tests use origin endpoints (`BlobStore.test.ts:43`).
- failure: A custom endpoint with a pathname sends a different canonical URI from the URI covered by its SigV4 signature. GET, PUT, and HEAD requests through such an endpoint are rejected by signature-verifying storage services.
- fix: Parse endpoints fallibly and return BlobStoreError misconfigured before HTTP for malformed endpoints or unsupported search/hash. Include the endpoint pathname in the signed and transmitted object path, preserving its encoding without double encoding and retaining object-segment validation. Add recording-client BlobStore.test.ts regressions for /s3 and an encoded endpoint path, invalid URLs, search and hash.
- seats: part-2/sol-3-2, part-2/grok-3-3

### r16 — Use a kit for the named dot-segment domain
- file: scratchpad/effected/github-actions/BlobStore.ts:20
- class: schema   severity: required
- standard: effect-laws-v1 law 19; schema-first-development-prompt “Use LiteralKit for a reusable discriminator domain”.
- evidence: `const DotSegment = S.Literals([".", ".."])` is referenced by name at `S.is(DotSegment)` (`BlobStore.ts:390`). Law 19 reserves `S.Literals` for anonymous inline unions never referenced by name. The green gates are `effect-imports`, `effect-fn`, `terse-effect`, and `native-runtime` (`EFFECTED_PORT_GOAL.md` lint row). None of those rewrites a named `S.Literals` binding. `terse-effect` finding kinds in `TerseEffect.ts` stop at nested `Bool.match`, helper refs, and object-spread shapes. `DotSegment` is a named internal literal domain defined as `S.Literals([".", ".."])` and consumed through `S.is(DotSegment)` at line 390. Law 19 reserves `S.Literals` for anonymous inline unions and requires `LiteralKit` for named internal literal domains. This declaration remains on the supplied green commit.
- failure: The named `.` / `..` domain stays an `S.Literals` schema, so it has no `LiteralKit` `.is`, `.$match`, or `.Enum` and drifts from the named-literal rule already applied to `CheckState`.
- fix: Define DotSegment with LiteralKit([".", ".."]) and file-local identity annotations; preserve S.is(DotSegment) rejection behavior.
- seats: part-2/grok-3-4, part-2/sol-3-5

### r17 — Match BlobStore optional and HTTP orchestration
- file: scratchpad/effected/github-actions/BlobStore.ts:338; scratchpad/effected/github-actions/BlobStore.ts:369; scratchpad/effected/github-actions/BlobStore.ts:408
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; EF-2; D11.
- evidence: `O.isNone(stored) ? Effect.succeed(O.none()) : decode…` chooses which effect runs. `terse-effect --check` does not report raw conditionals (finding kinds in `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts` are helper-ref, thunk-helper, flow-candidate, option-object-compaction, conditional-optional-object-spread, nested-option-match, nested-bool-match, dual-overload). The same gate miss was required for `DryRun.ts` in round 2; that site is now `Bool.match` and these branches remain. `config.sessionToken === undefined ? undefined : yield* Secret.forSigning(config.sessionToken)` is a boolean orchestration branch. Same `terse-effect` gap as grok-3-5. `status < 200 || status >= 300 ? Effect.fail(BlobStoreError.make(...)) : Effect.void` chooses the effect. Same `terse-effect` gap as grok-3-5.
- failure: Memory `get` branches on a boolean instead of matching the stored `Option`.
- fix: Use O.match for stored bytes and the optional session token, and lazy Bool.match for HTTP status acceptance. Preserve declassification timing, none results and BlobStoreError payloads.
- seats: part-2/grok-3-5, part-2/grok-3-6, part-2/grok-3-7

### r18 — Match document read selection and stale logging
- file: scratchpad/effected/github-actions/CheckDocument.ts:564; scratchpad/effected/github-actions/CheckDocument.ts:589
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-2; D11.
- evidence: `sink.read === undefined ? yield* Ref.get(writtenRef) : yield* sink.read.pipe(...)` chooses which effect reads the document. Same `terse-effect` gap as grok-3-5. `Effect.timeout` still fails rather than returning null; keep the `?? ""` on the success value only. `(alreadyLogged ? Effect.logDebug : Effect.logInfo)(...)` chooses the log effect. Same `terse-effect` gap as grok-3-5.
- failure: Reconcile selects the live read versus the shadow ref with a boolean ternary.
- fix: Match O.fromUndefinedOr(sink.read) for shadow-ref versus timed live read; keep timeout failure and success-only empty fallback. Use lazy Bool.match for stale log level with unchanged fields.
- seats: part-2/grok-3-8, part-2/grok-3-9

### r19 — Match token revocation on release
- file: scratchpad/effected/github-actions/GitHubToken.ts:300
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.
- evidence: `Exit.isSuccess(exit) ? Effect.void : Effect.ignore(app.revoke(minted.token))` is the `acquireUseRelease` release decision. Same `terse-effect` gap as grok-3-5.
- failure: Token revocation-on-failure is a boolean effect ternary.
- fix: Use Exit.match (or lazy Bool.match) for success versus failure release, preserving failure-only ignored revocation.
- seats: part-2/grok-3-10

### r20 — Match ESRCH handling in detached reap
- file: scratchpad/effected/github-actions/DetachedProcess.ts:755
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.
- evidence: `isErrno(cause, "ESRCH") ? Effect.succeed(false) : Effect.fail(DetachedSignalFailedError.make(...))` chooses the effect inside `reap`. Same `terse-effect` gap as grok-3-5.
- failure: ESRCH handling is a boolean effect ternary.
- fix: Use lazy Bool.match for ESRCH versus DetachedSignalFailedError, preserving pid, cause and false success.
- seats: part-2/grok-3-11

### r21 — Prepend the actual case-sensitive POSIX PATH
- file: scratchpad/effected/github-actions/ChildEnv.ts:174
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream bug; `ChildEnv.prependPath`’s documented PATH-prepending contract.
- evidence: Read-only `bun -e` differential probes with `platform: "linux"`, `dirs: ["/opt/tool"]`, and `base: { Path: "/ignored", PATH: "/usr/bin" }` return `{ env: { Path: "/opt/tool:/ignored" }, extendEnv: true }` in both the lab and pinned oracle. A child `/usr/bin/env` given the merged synthetic environment confirms `Path=/opt/tool:/ignored` while `PATH=/usr/bin`. The case-insensitive lookup is applied on every platform.
- failure: On POSIX, an unrelated `Path` or `path` variable can redirect the addition away from the actual, case-sensitive `PATH`. The requested tool directory is consequently absent from executable lookup, and an existing `PATH` is not prepended.
- fix: Use exact PATH on non-win32 platforms and pathKeyOf(base) only on win32; preserve the public case-insensitive pathKeyOf API. Add ChildEnv.test.ts cases containing both Path and PATH and only path.
- seats: part-2/sol-3-1

### r22 — Keep heading line breaks inside the heading
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:435
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`); class Details at `GitHubMarkdown.ts:240-242` (the writer owns structure wherever a fragment can break the construct). ATX headings are one line.
- evidence: `heading` interpolates `text` with no line-ending normalization. `preprocessLines` splits `\n`, `\r\n`, and bare `\r`, so `heading("a\nb")` and `heading("a\rb")` parse as a heading plus a following paragraph. Upstream `heading` (oracle `GitHubMarkdown.ts:337-338`) is the same interpolation. `table` already maps those three endings to `<br>` (`GitHubMarkdown.ts:313`).
- failure: A line ending in heading text closes the ATX heading and emits the remainder as a separate block.
- fix: Normalize CRLF, CR and LF to <br> before heading interpolation, matching the existing table policy. Add parser-backed GitHubMarkdown.test.ts LF and bare-CR cases.
- seats: part-2/fable-3-2

### r23 — Ignore inherited PATH values in child environments
- file: scratchpad/effected/github-actions/ChildEnv.ts:175
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`); `ChildEnv.prependPath` Details (`ChildEnv.ts:136-140`) require the base's own `PATH` spelling and treat an absent inherited value as empty. The recorded own-property deviation cites only `ActionEnvironment.test.ts:73,88`; that lookup is `R.get` at `ActionEnvironment.ts:360`.
- evidence: `pathKeyOf` (`ChildEnv.ts:123`) uses `R.keys`, which is `Object.keys`, so a prototype key is invisible and the fallback key is `"PATH"`. The next line reads `options.base[key]`, which walks the prototype. A base whose only `PATH` is inherited therefore contributes that value. A prototype key spelled `Path` is dropped and the child key becomes `PATH`. Upstream `prependPath` (oracle `ChildEnv.ts:137`) uses the same bracket read. `R.get` (`effect/Record.ts:465-471`) is own-property only.
- failure: An inherited `PATH` is prepended into the child environment even though it is not an own property of `base`.
- fix: Read the selected key with O.getOrUndefined(R.get(options.base, key)), preserving own-key platform behavior. Add ChildEnv.test.ts inherited PATH and inherited Path cases.
- seats: part-2/fable-3-3

### r24 — Append OIDC audience to the URL query
- file: scratchpad/effected/github-actions/OidcTokenIssuer.ts:253
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`); `token` Details (`OidcTokenIssuer.ts:191-193`) match `@actions/core.getIDToken` on the audience parameter. The comment at `251-252` assumes `&` is safe because the runner URL already has a query.
- evidence: The request URL is `` `${base}&audience=${encodeURIComponent(audience)}` ``. Under the URL grammar, a base with no `?` keeps `&audience=` in the path, and a base with a `#` keeps it in the fragment, so neither sends a query parameter. `OidcTokenIssuer.test.ts:18,95` locks the `&` form only for `https://token.actions.example/?api-version=2.0`. Upstream `issue` (oracle `OidcTokenIssuer.ts:183`) concatenates the same way. `URL.searchParams.set` would encode the space locked at `OidcTokenIssuer.test.ts:109-112` as `+`.
- failure: An audience supplied with a request URL that has no query, or that has a fragment, is not sent as the `audience` query parameter, so the token service issues its default audience.
- fix: When audience is present, parse base fallibly, append the encodeURIComponent-encoded audience to search using ? or &, and retain the fragment separately. Return OidcTokenError requestFailed for parse failure. Preserve the existing %20 fixture and add no-query and fragment regressions in OidcTokenIssuer.test.ts.
- seats: part-2/fable-3-4

### r25 — Enforce real package containment before bin mutation
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:707
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`). The containment comment at 701–706. Effect `FileSystem.stat` follows links (`NFS.stat` in `packages/platform/node-shared/src/NodeFileSystem.ts:610`); `makeFileInfo` only reports `SymbolicLink` from an lstat-style result (`NodeFileSystem.ts:581`); `NFS.chmod` (`NodeFileSystem.ts:107`) and `NFS.copyFile` (`NodeFileSystem.ts:97`) follow an existing link. `tarExtractCommand` passes `xzf` with no dereference flag (`archiveCommands.ts:269`).
- evidence: D11; D9 / section 14 (`upstream-bug`). The containment comment at 701–706. Effect `FileSystem.stat` follows links (`NFS.stat` in `packages/platform/node-shared/src/NodeFileSystem.ts:610`); `makeFileInfo` only reports `SymbolicLink` from an lstat-style result (`NodeFileSystem.ts:581`); `NFS.chmod` (`NodeFileSystem.ts:107`) and `NFS.copyFile` (`NodeFileSystem.ts:97`) follow an existing link. `tarExtractCommand` passes `xzf` with no dereference flag (`archiveCommands.ts:269`). D11; D9 / section 14 (`upstream-bug`). The containment comment at 701–706. `FileSystem.stat` follows links (`NFS.stat` in `packages/platform/node-shared/src/NodeFileSystem.ts:608–614`); `makeFileInfo` reports `SymbolicLink` only from an lstat-style result (`NodeFileSystem.ts:581`). `NFS.chmod` (`NodeFileSystem.ts:105–111`) and `NFS.copyFile` (`NodeFileSystem.ts:94–100`) follow an existing link. `tarExtractCommand` uses `xzf` (`archiveCommands.ts:269`). Upstream lexical check: `PackageManagerInstaller.ts:539–544`.
- failure: `path.relative` is lexical, and `typeAt` (`fsProbe.ts:33`) uses `fs.stat`. A tarball whose `package/` entry is a symlink to a directory passes the directory check at `PackageManagerInstaller.ts:1102`. A bin whose lexical path stays inside `package/` but is a symlink, or sits under a symlink directory, passes the check at 707–713, then `assertFile` sees a file. `chmod` at 1041 and `copyFile` at 1028 and 1034 follow that link and change a file outside the extract tree. The shim then execs the link. Cache hits use the same `readPackageManifest`. Upstream `PackageManagerInstaller.ts:539–544` has the same lexical check; round 2 did not cover it.
- fix: Reject a symlink package root and require real bin/overlay destination paths to remain inside the real package root before assertFile, overlay copy or chmod. Handle not-yet-created destinations through their resolved existing parent. Allow internal symlinks. Add PackageManagerInstaller.test.ts symlink-bin, symlink-ancestor and symlink-root regressions for install/cache hits.
- seats: part-3/grok-3-1, part-3/fable-3-1

### r26 — Terminate Node options in generated shims
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:466
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`). Node’s CLI treats an argv that begins with `-` as an option until `--`; `-e` evaluates the rest of that argv. Round-2 r13 made the full shim target, including cache-root bytes, part of the literal-invocation contract. `WindowsShimTarget` (`PackageManagerInstaller.ts:48`) still admits `-`.
- evidence: D11; D9 / section 14 (`upstream-bug`). Node’s CLI treats an argv that begins with `-` as an option until `--`; `-e` evaluates the rest of that argv. Round-2 r13 made the full shim target, including cache-root bytes, part of the literal-invocation contract. `WindowsShimTarget` (`PackageManagerInstaller.ts:48`) still admits `-`. D11; D9 / section 14 (`upstream-bug`). Node treats an argv that begins with `-` as an option until `--`; `-e` evaluates the rest of that argv. Round-2 r13 made the full shim target, including cache-root bytes, part of the literal-invocation contract. `WindowsShimTarget` (`PackageManagerInstaller.ts:48`) still admits `-`. Upstream `posixShim` is `PackageManagerInstaller.ts:323–324`.
- failure: `posixShim` emits `exec node '<target>' "$@"` and `cmdShim` (`PackageManagerInstaller.ts:471`) emits `node "<target>" %*`, with no `--`. `ToolInstaller.cachePath` (`ToolInstaller.ts:682`) interpolates the cache root as the first path segment. A root whose text is `-eprocess.exit(1)//` is one argv. After the round-2 quoting, the shell passes it through and Node evaluates it. Absolute roots that start with `/` or a drive letter stay scripts. Upstream `posixShim` (`PackageManagerInstaller.ts:323–324`) has the same hole. This is the option parse left after r13’s shell quoting, which the snapshots at `PackageManagerInstaller.test.ts:347` still pin.
- fix: Insert -- after node in POSIX and Windows node-script shim branches, keeping direct-exec branches unchanged. Update PackageManagerInstaller.test.ts shim expectations and add a dash-leading cache-root regression.
- seats: part-3/grok-3-2, part-3/fable-3-3

### r27 — Terminate unzip options before its archive operand
- file: scratchpad/effected/github-actions/internal/archiveCommands.ts:232
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`). Info-ZIP treats an operand that begins with `-` as an option until `--`. `-d exdir` is valid before the archive. `-h` prints help and exits 0 (`PK_OK`). Same class as round-2 r18, which inserted `--` for `zip` only.
- evidence: D11; D9 / section 14 (`upstream-bug`). Info-ZIP treats an operand that begins with `-` as an option until `--`. `-d exdir` is valid before the archive. `-h` prints help and exits 0 (`PK_OK`). Same class as round-2 r18, which inserted `--` for `zip` only. D11; D9 / section 14 (`upstream-bug`). Info-ZIP treats an operand that begins with `-` as an option until `--`. `-h` prints help and exits 0. Same class as round-2 r18, which inserted `--` for `zip` only. Upstream `archiveCommands.ts:186` matches this argv. `ToolInstaller.extractZip` (`ToolInstaller.ts:520`) passes the public archive string through, and `extractWith` (`ToolInstaller.ts:364`) treats exit code 0 as a finished extract.
- failure: POSIX argv is `["-oq", source, "-d", destination]`. `ToolInstaller.extractZip` (`ToolInstaller.ts:520`) passes the public archive string through, and `extractWith` (`ToolInstaller.ts:364`) treats exit code 0 as a finished extract. `unzip -oq -h -d <dest>` is help, exits 0, and leaves the destination empty. `archiveCommands.test.ts:195` pins the current argv. Upstream `archiveCommands.ts:186` matches it. The Windows `ExtractToDirectory` branch is quoted and stays as it is.
- fix: Use POSIX unzip argv ["-oq", "-d", destination, "--", source]. Update archiveCommands.test.ts and add source -h. Preserve Windows extraction and tar argv, where f consumes its next operand.
- seats: part-3/grok-3-3, part-3/fable-3-4

### r28 — Match upload reservation and finalization outcomes
- file: scratchpad/effected/github-actions/internal/cacheService.ts:90
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11. Round-2 r12 required this form in `DryRun.ts` because the green law gate does not flag `condition ? Effect : Effect`. These two sites are still on this commit and were not in that inventory.
- evidence: effect-laws-v1 law 12; EF-7b; D11. Round-2 r12 required this form in `DryRun.ts` because the green law gate does not flag `condition ? Effect : Effect`. These two sites are still on this commit and were not in that inventory. effect-laws-v1 law 12; EF-7b; D11. Round-2 r12 required this form in `DryRun.ts` because the green tsgo, oxlint, and four beep-law gates do not flag `condition ? Effect : Effect`. `DryRun.ts:50` is the in-module `Bool.match` shape. These two sites are still on this commit and were not in that inventory.
- failure: `reserveUpload` chooses `Effect.fail` or `Effect.succeedSome` with `!isOk(created) || url === undefined ? … : …` (lines 90–92). `finalizeUpload` chooses `Effect.fail` or `Effect.void` with `finalized === CONFLICT || !isOk(finalized) ? … : …` (lines 133–135). Both are boolean branches in runtime orchestration. Results stay correct.
- fix: Use lazy Bool.match in reserveUpload and finalizeUpload, preserving conflict short-circuit, missing-url refusal, success values and lookupDownload.
- seats: part-3/grok-3-4, part-3/fable-3-7

### r29 — Contain tool binary destinations on misses and hits
- file: scratchpad/effected/github-actions/ToolInstaller.ts:494
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); ToolInstaller’s documented staging invariant.
- evidence: A read-only `bun --eval` differential probe used filesystem stubs that only recorded calls in memory. In both the port and pinned oracle, `cacheFile("/source", "../victim", "tool", "1")` returned `/cache/tool/1/x64` successfully. With staging `/cache/.staging-example`, the recorded copy destination was `/cache/victim`, followed by publication of the staging directory. D11; D9 / section 14 (`upstream-bug`). Staging comment at 371–379. `Path.join` normalizes `..` (`packages/effect/src/Path.ts:505–523`, `normalizeStringPosix` at 270–298). Upstream `ToolInstaller.ts:420` joins the same way. The hit probe uses the same join at `ToolInstaller.ts:545`.
- failure: The accepted filename escapes staging. Installation can overwrite a neighboring file, publish an entry without the requested binary, and leave the escaped write outside staging cleanup.
- fix: Before copyFile or cache-hit typeAt, require the normalized/resolved destination to remain strictly within staging or the published entry. Return cacheFailed for escapes. Add ToolInstaller.test.ts ../victim miss/hit regressions proving no copy or publication.
- seats: part-3/sol-3-1, part-3/fable-3-2

### r30 — Return exactly the normalized headers that SigV4 signs
- file: scratchpad/effected/github-actions/internal/sigv4.ts:164
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); `SigV4Request.headers` accepts names in any case, and `sign` promises headers matching what was signed.
- evidence: A read-only differential probe supplied `Host: stale.example.test` and `X-Amz-Date: 20000101T000000Z`. Both implementations signed `host:example.test` and `x-amz-date:20240101T000000Z`, but retained the differently cased originals in the returned record. `new Headers(sign(...))` produced `host: stale.example.test, example.test` and `x-amz-date: 20000101T000000Z, 20240101T000000Z`. The lowercase map discards duplicates while the returned record retains them. D11; D9 / section 14 (`upstream-bug`). `sign` (`228–231`) says the returned record is what was signed. `SigV4Request.headers` accepts any casing. Upstream `sigv4.ts:95–107` spreads the same way and folds case in a `Map`.
- failure: Transport normalization sends different header values from those covered by the signature. Valid mixed-case input can therefore produce a rejected signed request. Ordinary duplicate names such as `X-Test` and `x-test` have the same mismatch.
- fix: Normalize caller header names into one record, combining ordinary duplicates consistently with transport and replacing generated signing headers. Derive canonical and returned headers from that record. Add sigv4.test.ts Host, X-Amz-Date and ordinary case-collision regressions.
- seats: part-3/sol-3-2, part-3/fable-3-6

### r31 — Validate Windows native bins after exe retargeting
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:873; scratchpad/effected/github-actions/PackageManagerInstaller.ts:872
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); the documented requirement to validate foreign cache-hit layout before returning usable bins.
- evidence: A read-only differential probe modeled a Windows pnpm cache containing the extensionless native `pnpm` file and an existing `pnpm.cmd` shim, but no `pnpm.exe`. Its manifest declared the native optional dependency. Both implementations returned success with `bins.pnpm="/cache/pnpm/pnpm.exe"` while the stub’s existence check returned `false`. Recorded stat calls checked only the extensionless file and existing shim; the retargeted executable was never checked. D11; D9 / section 14 (`upstream-bug`). Cache-hit comment at 876–880 (a missing shim write is `cacheFailed`, a silent hole in the PATH contract). `nativeWindowsBins` (`747–751`) appends `.exe` for `PNPM_NATIVE_BIN_NAMES`. `isPlaceholder` (`761–769`) runs on the pre-retarget path. Upstream `cachedRecord` does the same retarget at `PackageManagerInstaller.ts:689–691` and returns at `699` with no stat of the `.exe`.
- failure: A cache hit can return a nonexistent executable. If the shim needs regeneration, it can also be written to invoke that nonexistent `.exe`, despite installation reporting success.
- fix: Assert every retargeted nativeWindowsBins target exists before shim creation/reuse or return, using layoutUnexpected for missing executables. Add PackageManagerInstaller.test.ts extensionless-pnpm-present/pnpm.exe-absent cache-hit regression.
- seats: part-3/sol-3-3, part-3/fable-3-5

### r32 — Preserve terminal CR through Windows runner framing
- file: scratchpad/effected/github-actions/internal/runnerFile.ts:113; scratchpad/effected/github-actions/ActionOutputs.ts:405; scratchpad/effected/github-actions/ActionState.ts:159
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); runner-file value fidelity; GitHub runner’s [FileCommandManager heredoc parser](https://github.com/actions/runner/blob/main/src/Runner.Worker/FileCommandManager.cs#L371).
- evidence: The runner’s Windows reader recognizes CRLF and excludes the final value line’s newline from the extracted substring. A read-only probe implementing that reader over port and pinned-oracle output produced `input="abc\r", windows="abc"` and `input="\r", windows=""`; POSIX retained the original values. The builder’s appended LF combines with the value’s final CR. The current property test removes fixed framing with `slice`, so it misses this parser behavior.
- failure: Windows `GITHUB_OUTPUT` values ending in a bare carriage return silently lose that byte. The shared framing helper therefore fails its claimed byte-fidelity property.
- fix: Parameterize heredocBlock line endings, use CRLF framing for Windows and LF for POSIX, and pass the runner selection from ActionOutputs and ActionState. Keep payload bytes unchanged. Add runnerFile.test.ts runner-parser regressions for terminal CR, CRLF and LF, plus caller regressions in ActionOutputs.test.ts and ActionState.test.ts.
- seats: part-3/sol-3-4

### r33 — Publish tool-cache completion markers after successful install
- file: scratchpad/effected/github-actions/ToolInstaller.ts:387
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); ToolInstaller’s documented interoperability with the shared runner tool cache; official [tool-cache lookup and completion-marker implementation](https://github.com/actions/toolkit/blob/main/packages/tool-cache/src/tool-cache.ts#L484).
- evidence: `@actions/tool-cache.find` and `findAllVersions` require both the entry directory and its sibling `<arch>.complete` marker. The port and pinned oracle publish by renaming staging and returning immediately; neither creates that marker. The differential cache probe recorded directory creation, copy, removal, and rename, with no marker write. Existing tests verify the directory layout and this module’s own lookup, which does not require the marker.
- failure: A successfully installed tool in a fresh cache is invisible to subsequent actions using `@actions/tool-cache`, contrary to the stated shared-cache contract. Those actions treat the installation as a miss and may download and replace it.
- fix: Invalidate stale sibling <arch>.complete before replacement and create the empty marker only after staging publication succeeds; map marker failures to cacheFailed. Add ToolInstaller.test.ts fresh-entry discoverability and failed-publication/marker regressions using the official lookup predicate.
- seats: part-3/sol-3-5

### r34 — Define executable schemas for PairsOptions
- file: scratchpad/effected/github-actions/ActionInput.ts:74
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: PairsOptions remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the ActionInput.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for PairsOptions and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-1/sol-3-5

### r35 — Define executable schemas for WithBufferOptions and WithStepOptions
- file: scratchpad/effected/github-actions/ActionLogger.ts:176
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: WithBufferOptions and WithStepOptions remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the ActionLogger.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for WithBufferOptions and WithStepOptions and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-1/sol-3-6

### r36 — Define executable schemas for UploadOptions, DownloadOptions and DownloadResult
- file: scratchpad/effected/github-actions/Artifact.ts:157
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: UploadOptions, DownloadOptions and DownloadResult remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the Artifact.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for UploadOptions, DownloadOptions and DownloadResult and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-1/sol-3-7

### r37 — Define executable schemas for CheckRunConclusion and CheckRunProjection
- file: scratchpad/effected/github-actions/CheckState.ts:91
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: CheckRunConclusion and CheckRunProjection remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the CheckState.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for CheckRunConclusion and CheckRunProjection and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-2/sol-3-4

### r38 — Define executable schemas for CheckFlushOutcome
- file: scratchpad/effected/github-actions/CheckDocument.ts:296
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: CheckFlushOutcome remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the CheckDocument.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for CheckFlushOutcome and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-2/sol-3-4

### r39 — Define executable schemas for PathPrependEnv and PathPrependOptions
- file: scratchpad/effected/github-actions/ChildEnv.ts:10
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: PathPrependEnv and PathPrependOptions remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the ChildEnv.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for PathPrependEnv and PathPrependOptions and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-2/sol-3-4

### r40 — Define executable schemas for DetachedSpawnOptions
- file: scratchpad/effected/github-actions/DetachedProcess.ts:371
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: DetachedSpawnOptions remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the DetachedProcess.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for DetachedSpawnOptions and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-2/sol-3-4

### r41 — Define executable schemas for ProvisionOptions and ReadOptions
- file: scratchpad/effected/github-actions/GitHubToken.ts:74
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: ProvisionOptions and ReadOptions remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the GitHubToken.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for ProvisionOptions and ReadOptions and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-2/sol-3-4

### r42 — Define executable schemas for ManagedDocumentSource
- file: scratchpad/effected/github-actions/ManagedDocument.ts:195
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: ManagedDocumentSource remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the ManagedDocument.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for ManagedDocumentSource and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-2/sol-3-4

### r43 — Define executable schemas for GitHubHeadingDepth and GitHubListOptions
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:30
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: GitHubHeadingDepth and GitHubListOptions remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the GitHubMarkdown.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for GitHubHeadingDepth and GitHubListOptions and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-2/sol-3-4

### r44 — Define executable schemas for BackendIds and ResultsBackend
- file: scratchpad/effected/github-actions/internal/actionsResults.ts:26
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: BackendIds and ResultsBackend remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the internal/actionsResults.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for BackendIds and ResultsBackend and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-3/sol-3-6

### r45 — Define executable schemas for PackageManagerInstallOptions
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:169
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: PackageManagerInstallOptions remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the PackageManagerInstaller.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for PackageManagerInstallOptions and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-3/sol-3-6

### r46 — Define executable schemas for ExtractOptions, ProvisionFileOptions and ProvisionedFile
- file: scratchpad/effected/github-actions/ToolInstaller.ts:127
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: ExtractOptions, ProvisionFileOptions and ProvisionedFile remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the ToolInstaller.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for ExtractOptions, ProvisionFileOptions and ProvisionedFile and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-3/sol-3-6, part-3/fable-3-8

### r47 — Define executable schemas for ZipCommandOptions, UnzipCommandOptions and TarExtractCommandOptions
- file: scratchpad/effected/github-actions/internal/archiveCommands.ts:76
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: ZipCommandOptions, UnzipCommandOptions and TarExtractCommandOptions remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the internal/archiveCommands.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for ZipCommandOptions, UnzipCommandOptions and TarExtractCommandOptions and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-3/sol-3-6

### r48 — Define executable schemas for CacheHit
- file: scratchpad/effected/github-actions/internal/cacheService.ts:145
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: CacheHit remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the internal/cacheService.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for CacheHit and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-3/sol-3-6

### r49 — Define executable schemas for JwtPayloadFailure
- file: scratchpad/effected/github-actions/internal/jwt.ts:28
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: JwtPayloadFailure remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the internal/jwt.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for JwtPayloadFailure and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-3/sol-3-6

### r50 — Define executable schemas for SigV4Credentials and SigV4Request
- file: scratchpad/effected/github-actions/internal/sigv4.ts:66
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: SigV4Credentials and SigV4Request remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the internal/sigv4.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for SigV4Credentials and SigV4Request and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-3/sol-3-6

### r51 — Define executable schemas for SpawnOnceResult
- file: scratchpad/effected/github-actions/internal/spawn.ts:30
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: SpawnOnceResult remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the internal/spawn.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for SpawnOnceResult and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-3/sol-3-6

### r52 — Define executable schemas for TwirpFailure
- file: scratchpad/effected/github-actions/internal/twirp.ts:63
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data.
- evidence: TwirpFailure remain TypeScript-only declarations at the cited file on the reviewed commit and current module source; the reports identify these representable data payloads surviving the reported green gates. This is the internal/twirp.ts slice of the contributing finding(s), not a request to remodel service methods or generic overload machinery.
- failure: These representable configuration/result/wire contracts lack the schema source of truth required by EF-33.
- fix: Define identity-annotated structural schemas for TwirpFailure and derive the existing same-name types. Use LiteralKit for named finite domains and structural unions for conditional/discriminated payloads; reuse existing schema blocks. Preserve plain-object construction, brands, field types, optional versus explicit-undefined semantics and current acceptance/default behavior except separately required bug/law fixes. Keep existing root type re-exports; exporting schema values from their owning file does not require an index.ts edit. Add focused contract assertions in the assigned tests; defer the full Arbitrary.schema property floor to b2. Added-export and forced-deviation bookkeeping is central.
- seats: part-3/sol-3-6

## Backlog

### b1 — Correct the managed-region key documentation
- file: scratchpad/effected/github-actions/ManagedDocument.ts:481
- class: docs   severity: backlog
- standard: D9. Upstream `ManagedDocument.ts:261` carries the same gotcha. A behavior change would be a deviation without a new collision.
- evidence: The gotcha says region keys share `NamePart` (`/^[A-Za-z0-9][A-Za-z0-9_-]*$/u`, `ManagedDocument.ts:44`) and throw at construction. `withRegionsResult` (`ManagedDocument.ts:509`) calls `SectionId.make` with `wireKey`, and `SectionKey` (`templates/Section.ts:42`) allows dots. Namespace and key still go through `NamePart` (`ManagedDocument.ts:268-274`), so `ownRegions` (`ManagedDocument.ts:704`) can keep using `startsWith(prefix)` without two documents spelling one marker.
- failure: A dotted region key is accepted and round-trips. Callers who rely on the gotcha expect a throw.
- fix: Describe the construction check as `SectionKey` on the wire key, and state that dots in the region segment stay unambiguous because namespace and key cannot contain them.
- seats: part-2/grok-3-12

### b2 — Complete schema-derived round-trip properties in S3
- file: scratchpad/effected/github-actions/ActionInput.ts:74; scratchpad/effected/github-actions/ActionLogger.ts:176; scratchpad/effected/github-actions/Artifact.ts:157; scratchpad/effected/github-actions/CheckState.ts:91; scratchpad/effected/github-actions/CheckDocument.ts:296; scratchpad/effected/github-actions/ChildEnv.ts:10; scratchpad/effected/github-actions/DetachedProcess.ts:371; scratchpad/effected/github-actions/GitHubToken.ts:74; scratchpad/effected/github-actions/ManagedDocument.ts:195; scratchpad/effected/github-actions/GitHubMarkdown.ts:30; scratchpad/effected/github-actions/internal/actionsResults.ts:26; scratchpad/effected/github-actions/PackageManagerInstaller.ts:169; scratchpad/effected/github-actions/ToolInstaller.ts:127; scratchpad/effected/github-actions/internal/archiveCommands.ts:76; scratchpad/effected/github-actions/internal/cacheService.ts:145; scratchpad/effected/github-actions/internal/jwt.ts:28; scratchpad/effected/github-actions/internal/sigv4.ts:66; scratchpad/effected/github-actions/internal/spawn.ts:30; scratchpad/effected/github-actions/internal/twirp.ts:63
- class: test   severity: backlog
- standard: D10; section 11.3/11.4; user merge instruction deferring coverage and vitest-canon to S3.
- evidence: The schema findings request a new round-trip property for each modeled payload. This is the S3 property-floor portion of those findings, separated from their required EF-33 source fixes.
- failure: The schema property floor remains follow-up work; it does not block this required fix inventory.
- fix: During S3 add schema-derived Arbitrary.schema encode/decode round-trip properties for the retained schema models, with fcRuns(n); keep regression tests for demonstrated bugs in their required groups. Every vitest invocation uses --maxWorkers=2, one at a time; module-wide coverage uses beep-heavy --slot-only.
- seats: part-1/sol-3-5, part-1/sol-3-6, part-1/sol-3-7, part-2/sol-3-4, part-3/sol-3-6, part-3/fable-3-8

## Handled by the deviation codemod

None as a standalone finding (CODEMOD: 0). Several retained schema/bug fixes include ancillary requests to update deviations, Port notes or added exports. Those requests are excluded from lane write surfaces: identity-key, finite-number, tagged-error, native-runtime and added-export recording is central, per module and systemic class. No report here asks only to record an already forced change, so those ancillary clauses do not create extra findings or change required severity.

## Rejected

None as a complete finding (REJECTED: 0). The compression fix in r6 is narrowed to the demonstrated NaN defect; blanket refusal of infinities is not independently justified by its evidence. Duplicate reports contribute seat ids/evidence to their merged record rather than being counted as rejections. No unsupported performance claim, no-evidence/no-fix finding, gate-enforced duplicate or ruling-contradicting standalone finding remains.
