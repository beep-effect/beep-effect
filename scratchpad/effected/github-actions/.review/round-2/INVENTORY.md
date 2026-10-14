# github-actions — round-2 merged inventory

Seats read: all 9 reports (part-1/part-2/part-3 × grok.md, sol.md, fable.md) and all 3 adjacent BRIEF.md files; 29 seat records. Fable filenames identify the independent Grok 4.7 medium fallback seat. Seat SHA: `2f515ae2519cc72223c94917019bf7ebfe92a4a5`.

Required: 19 · Backlog: 0 · Codemod: 0 · Rejected: 0 · Groups: 11.

The complete operator revision block (including both 2026-10-09 rulings), D1–D20, section 12.5 and section 14 govern disposition. Counts describe merged defects, not votes; seat ids are qualified by part/report because numbering restarts. Strongest evidence is retained across duplicates. Every seat record contributes to a disposition; part-1/fable.md reports no findings.

The live checkout is `@lab/effected-2` at `5791464f47f34d0ecba80506bbcb91fae1089400`, rather than the requested `@lab/effected`. Source/test diff against the seat SHA is empty for this module. No branch switch, tests, scratch-copy diagnostics, gate reruns, ledger commands or implementation edits were performed. The pinned oracle is the cache checkout at `af7566a9da2eff169cb74955efcc5ede1e5de9f8` named in each brief, not the moving reference checkout.

History/provenance: `git log --format=%h:%s -- <file>` and `git log --all` were read, together with relevant step-2/law diffs (`294ef4fa7c`, `c817c154ea`, `1c1cb85670`). Forced Schema JSON codecs, guarded unknown-property reads and tagged errors are retained. No report establishes an unforced lab divergence requiring upstream restoration. Report claims about completed S2/S3 do not authorize docs, coverage or vitest-canon work in this merge; none of the submitted records is solely such work.

Native-runtime allowlist: the live `standards/effect-laws.allowlist.jsonc` was read and its entries parsed; **0 entries** match `scratchpad/effected/github-actions/**`. Accordingly there are no `allow-<n>` additions. Historical removed entries are not reintroduced.

`required.json` assigns 11 non-overlapping groups, at most 2 source files each. All affected files of the installer/JWT codec defect belong to g9. Tests requiring edits are assigned once; existing tests for equivalent Bool.match/Effect.die substitutions can be retained without rewriting. Every fix stays within the module source/test surfaces. Deviation records, exportsAdded, README Port notes, allowlist changes and the shared ledger remain central work.

## Required

### r1 — Validate finite IDs at finalize and delete response boundaries
- file: scratchpad/effected/github-actions/Artifact.ts:546; scratchpad/effected/github-actions/Artifact.ts:615
- class: schema   severity: required
- standard: EF-3, EF-33; D11; D9 / section 14 (verified upstream bug).   evidence: part-1 Sol reports read-only differential RPC probes returning successful id: NaN for artifactId="not-a-number" in both lab and pinned oracle. The live finalize/delete expressions call Number(stringField(...) ?? fallback); Infinity and 1e309 likewise produce non-finite numbers. ArtifactItem already decodes listing ids with S.Finite.
- failure: Upload exposes an id that cannot match any artifact; delete exposes a non-finite id despite a previously decoded finite listing id.
- fix: Decode normalized finalize/delete results with identity-annotated schemas using finite numeric ids and derived result types. Preserve missing-id defaults (upload 0; delete found.id); map invalid supplied ids to the existing malformed ArtifactError policy. Add RPC regressions for not-a-number, Infinity and 1e309 in Artifact.test.ts. Central bookkeeping records the verified upstream bug.
- seats: part-1/grok.md#grok-2-1; part-1/sol.md#sol-2-1

### r2 — Reject line breaks in resolved tar-manifest paths
- file: scratchpad/effected/github-actions/ActionCache.ts:488
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); save/restore path fidelity.   evidence: Sol differential probes admitted /work/a\nb and emitted two manifest lines in both lab and oracle; a streamed native tar probe confirmed that newline-separated names become separate archive members. The live manifest is resolved.join("\n") plus a trailing newline.
- failure: A single accepted filename becomes multiple tar paths, causing failures or archiving unrelated existing files.
- fix: Before writing the manifest or invoking tar/upload, reject resolved paths containing LF or CR with ActionCacheError archiveFailed and an offending-path diagnostic. Add ActionCache.test.ts regression proving no tar/upload runs for a newline-bearing filename; record the verified upstream bug centrally.
- seats: part-1/sol.md#sol-2-2

### r3 — Remove recursively covered descendants from the tar input manifest
- file: scratchpad/effected/github-actions/ActionCache.ts:493
- class: perf   severity: required
- standard: D11 algorithmic-class criterion; D9 / section 14 (verified duplicate-member upstream bug).   evidence: Sol differential manifests include selected directories and their independently matched descendants; its streamed tar probe confirmed duplicate file members. A depth-d chain with a B-byte file at each level archives B(1+...+d) bytes, Θ(Bd²), versus Θ(Bd) distinct payload. Exact-path deduplication does not remove directory/descendant overlap.
- failure: Recursive-glob saves repeatedly read, compress, upload and extract descendants, with quadratic payload I/O in deep trees.
- fix: Use an ordered prefix pass or path trie to omit paths already covered by a selected real directory that tar recursively archives. Preserve symlink behavior, meaningful ordering, and cache-version hashing of the original literal patterns. Add an archive-member regression in ActionCache.test.ts proving each covered file is stored once. Record the demonstrated upstream bug centrally.
- seats: part-1/sol.md#sol-2-3

### r4 — Propagate the templates trailing-carriage-return refusal as a typed Result failure
- file: scratchpad/effected/github-actions/ManagedDocument.ts:512
- class: bug   severity: required
- standard: EF-1; D11; D9 / section 14; templates recorded trailingCarriageReturn upstream-bug fix.   evidence: ManagedDocumentError.kind and KIND_PROSE omit trailingCarriageReturn. LF/empty documents with region content hello\r reach the lab SectionDialect refusal; Result.getOrThrow(S.decodeUnknownResult(kind)(failure.reason)) then throws SchemaError. The pinned templates oracle lacks that reason, while the templates deviation already records its introduction.
- failure: withRegionsResult throws out of its promised Result channel; withRegions cannot return the intended ManagedDocumentError.
- fix: Add trailingCarriageReturn to the public error-kind schema and prose map, then return ManagedDocumentError through Result.fail without throwing on reason translation. Handle the unreachable unknownCommentStyle invariant separately with the existing RejectedRegionDialectError contract. Add an LF-document/bare-CR regression in ManagedDocument.test.ts and record the propagation centrally.
- seats: part-2/grok.md#grok-2-1

### r5 — Annotate all reusable cache-key constraint blocks
- file: scratchpad/effected/github-actions/CacheKey.ts:161; scratchpad/effected/github-actions/CacheKey.ts:164; scratchpad/effected/github-actions/CacheKey.ts:174; scratchpad/effected/github-actions/CacheKey.ts:230
- class: schema   severity: required
- standard: effect-laws-v1 law 18; EF-12c; D11.   evidence: Live Segment pattern, Segments length filter, RestoreDepth isInt/isBetween checks, and cross-field depth filter lack complete identifier/title/description metadata. Segments carries only a title. The green gates demonstrably left these source sites intact. Round-1 r18 covered two of these still-open sites; Fable identifies the remaining pattern and integer/range checks.
- failure: Reusable constraints violate the schema-check metadata law; schema/issue consumers lack the required constraint metadata.
- fix: Supply identity-derived identifier, title and description on every named reusable check, including both RestoreDepth built-ins. Preserve pattern, length/range bounds, existing title, and restore-depth message. Retain/update CacheKey.test.ts assertions to cover the metadata without weakening grammar tests; any forced schema-key bookkeeping is central.
- seats: part-2/grok.md#grok-2-2; part-2/fable.md#fable-2-1

### r6 — Annotate the reusable managed-region name grammar check
- file: scratchpad/effected/github-actions/ManagedDocument.ts:44
- class: schema   severity: required
- standard: effect-laws-v1 law 18; EF-12c; D11.   evidence: NamePart is S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u)) without filter annotations and is reused by namespace and key. Field annotateKey descriptions do not supply check metadata. The existing pattern-only test and claimed green gates leave this omission intact.
- failure: The shared namespace/key constraint lacks mandatory identifier, title and description.
- fix: Pass identity-derived identifier, title and description as S.isPattern filter annotations. Preserve the pattern and field descriptions; retain/update ManagedDocument.test.ts metadata assertions.
- seats: part-2/grok.md#grok-2-3; part-2/fable.md#fable-2-2

### r7 — Reject object-path dot segments before S3 signing and HTTP execution
- file: scratchpad/effected/github-actions/BlobStore.ts:360
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); S3Config path-style addressing contract.   evidence: Sol recording-fetch probes in lab and pinned oracle map a/../b, b and ./b to /bucket/b, a/./b to /bucket/a/b, and ../outside to /outside. Signing receives the unnormalized raw object path; URL normalization occurs after signing. Round-1 fixes for reserved characters and repeated slashes do not address dot segments.
- failure: Distinct accepted keys alias outgoing resources, signatures mismatch the sent path, and parent segments can remove the bucket.
- fix: Reject complete . and .. segments in the joined bucket/prefix/key path with a typed BlobStoreError before signing or sending. Preserve all other raw segments and existing encoding. Add BlobStore.test.ts regressions showing no HTTP execution for those paths; record the verified upstream bug centrally.
- seats: part-2/sol.md#sol-2-1

### r8 — Honor non-multiple maxWait debounce deadlines
- file: scratchpad/effected/github-actions/CheckDocument.ts:639
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); debounce maxWait staleness-bound contract.   evidence: Sol read-only TestClock probes with quiet=500ms, maxWait=750ms and reports at 0/400ms show no write at 750ms and the first write at 1000ms in lab and oracle. The loop sleeps a full quiet interval before checking elapsed maxWait.
- failure: Continuous reports exceed the promised staleness bound by up to almost one additional quiet interval.
- fix: Bound each poll sleep by the remaining maxWait budget and flush when that budget expires, preserving quiet-window behavior and scope finalization. Add the 500ms/750ms TestClock regression in CheckDocument.test.ts; record the verified upstream bug centrally.
- seats: part-2/sol.md#sol-2-2

### r9 — Normalize bare carriage returns inside table cells
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:300
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); table/tableFor row fidelity.   evidence: Sol probes table([one,two], [[a\rb,ok]]) in lab and oracle; the pinned Markdown parser produces two data rows instead of one. Live inline normalization uses /\r?\n/g and therefore misses standalone CR.
- failure: A CR-containing cell terminates its row and changes column relationships; tableFor inherits the failure.
- fix: Replace CRLF, CR and LF with <br> using /\r\n|\r|\n/g. Add direct-table and schema-derived-table bare-CR regressions in GitHubMarkdown.test.ts; record the verified upstream bug centrally.
- seats: part-2/sol.md#sol-2-3

### r10 — Escape unmatched link-label brackets while preserving supported inline Markdown
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:439
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); writer surrounding-structure contract.   evidence: Sol lab/oracle probes generate [left]right](https://example.test) and [left[right](https://example.test). The pinned parser reads literal text plus autolink, or links only right, respectively. Link children are raw passthrough Html nodes.
- failure: Unmatched label brackets break the link or exclude part of the supplied label.
- fix: Apply bracket-aware escaping to unmatched, unescaped brackets before constructing the passthrough node, preserving supported inline Markdown. Add parser-backed regressions in GitHubMarkdown.test.ts showing the whole label belongs to one link; record the verified upstream bug centrally.
- seats: part-2/sol.md#sol-2-4

### r11 — Give S3Config an executable schema source of truth
- file: scratchpad/effected/github-actions/BlobStore.ts:133
- class: schema   severity: required
- standard: ARCHITECTURE Schemas Are Executable Contracts; EF-33; schema-first-development-prompt; D5/D11.   evidence: The live exported S3Config interface contains only representable strings, optional strings and redacted strings, with no corresponding runtime schema. The green gates leave this concrete domain-payload declaration intact.
- failure: Consumers cannot derive configuration decoding, guards, annotations or arbitraries from the required schema source of truth.
- fix: Define an identity-annotated S3Config schema and derive its same-name type, preserving all field types and explicit-undefined optional semantics. Keep constructor behavior. Add a focused new-schema round-trip property in BlobStore.property.test.ts; added-export/deviation bookkeeping is central, not a module-group README/ledger edit.
- seats: part-2/sol.md#sol-2-5

### r12 — Use Bool.match for the dry-run orchestration decision
- file: scratchpad/effected/github-actions/DryRun.ts:49
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: The live guard is enabled ? Effect.as(Effect.logInfo(...), fallback) : effect, a boolean-driven runtime orchestration branch remaining on the claimed green commit.
- failure: Correct behavior uses an implementation that violates the binding boolean-matching law; the gate missed this source form.
- fix: Import effect/Boolean as Bool and use Bool.match with lazy branches, preserving logging, fallback and the original disabled effect. Retain DryRun.test.ts behavior assertions; no test rewrite is required.
- seats: part-2/sol.md#sol-2-6

### r13 — Keep complete shim targets literal in POSIX and Windows scripts
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:451
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); validated target invocation contract.   evidence: All three seats show that double-quoted target interpolation retains shell/cmd metacharacter semantics. Sol differential probes install bin/$tool.js successfully in lab and oracle, then a shell argument probe expands it to bin/expanded.js. Target containment does not constrain these bytes; cache-root components also enter the full target.
- failure: Accepted targets can execute the wrong pathname, fail to launch, or inject shell/cmd commands when the shim runs.
- fix: Encode the entire resolved POSIX target as a single-quoted literal with embedded single-quote escaping in both node-script and executable branches, retaining "$@". On Windows encode safely or reject unsupported quote/expansion/control bytes in the complete target with layoutUnexpected before any shim write, including cache-root components; do not blanket-reject Windows path separators. Add target/cache-root metacharacter regressions in PackageManagerInstaller.test.ts, preserving ordinary shim semantics. Record the verified upstream bug centrally.
- seats: part-3/grok.md#grok-2-1; part-3/sol.md#sol-2-1; part-3/fable.md#fable-2-1

### r14 — Reject Windows device names before writing installer shims
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:35; scratchpad/effected/github-actions/PackageManagerInstaller.ts:639
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); shim-file containment/existence contract.   evidence: BinName accepts NUL, CON, PRN, AUX, COM1-COM9 and LPT1-LPT9; shimFileName appends .cmd and lexical path containment still succeeds. Win32 reserves these stems case-insensitively even with extensions, so a confined string is not necessarily a regular shim file.
- failure: A Windows install can succeed while its command was written to a device or was never created as a file in .bin.
- fix: When windows is true, reject reserved device stems before the first dot, case-insensitively, through layoutUnexpected before any shim write. Preserve current containment checks and POSIX accepted names. Add a Windows-only regression beside the escaping-bin cases in PackageManagerInstaller.test.ts; record the verified upstream bug centrally.
- seats: part-3/grok.md#grok-2-2; part-3/fable.md#fable-2-3

### r15 — Preserve own __proto__ bin-map entries
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:508
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); manifest accepted-key fidelity.   evidence: normalizeBins enumerates own manifest properties then uses entries[name] = string. For __proto__, the inherited setter ignores a string rather than defining an own key. Grok supplies this exact assignment semantics; lab and oracle share the construction. Fable's claim that this string assignment throws TypeError is incorrect and is not retained as evidence.
- failure: A sole __proto__ bin becomes a false no-bin refusal; with sibling bins it silently disappears from an otherwise successful installation.
- fix: Use R.assignProperty or R.fromEntries to construct the bin record, preserving string-value and empty-map validation. Add a JSON own-__proto__ plus normal-bin regression in PackageManagerInstaller.test.ts; record the verified upstream bug centrally.
- seats: part-3/grok.md#grok-2-3; part-3/fable.md#fable-2-2

### r16 — Preserve own __proto__ keys when handing off child secrets
- file: scratchpad/effected/github-actions/Secret.ts:105
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); forChildEnv accepted-key fidelity.   evidence: Sol differential probes supply own __proto__ and NORMAL redacted entries and receive keys=[NORMAL], ownProto=false, maskedCount=2 in both lab and oracle. Live assignment declassified[name] = plaintext triggers the inherited setter rather than defining the key.
- failure: An accepted secret is masked but silently absent from the successful child-environment handoff.
- fix: Use R.assignProperty(declassified, name, plaintext), preserving the plain-record representation and masking order. Add the own-key regression in Secret.test.ts and record the verified upstream bug centrally.
- seats: part-3/grok.md#grok-2-4; part-3/sol.md#sol-2-2

### r17 — Remove throw-to-catch JSON codec control flow and redundant identity unwraps
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:677; scratchpad/effected/github-actions/PackageManagerInstaller.ts:900; scratchpad/effected/github-actions/internal/jwt.ts:60; scratchpad/effected/github-actions/internal/jwt.ts:88
- class: effect-idiom   severity: required
- standard: EF-1, EF-3, EF-19; effect-laws-v1 law 21; D11.   evidence: Live manifest/packument decoders wrap getOrThrowWith(decodeResult(...), error => error) in Effect.try. JWT payloadOf throws the same typed SchemaError only to catch it into Result; unsignedJwt repeats the identity wrapper on encodeResult. Green gates miss the forms. 294ef4fa7c/c817c154ea prove Schema codecs and narrowed unknown-field access were diagnostic-forced, not an unforced change to restore.
- failure: Already typed codec failures detour through synchronous exceptions; trivial wrappers duplicate direct Result helpers.
- fix: Use S.decodeEffect(Json) plus Effect.mapError for installer JSON boundaries with existing subjects/reasons/SchemaError causes. Map the JWT decodeResult failure directly to JwtPayloadFailure without throwing, preserving segment/base64url behavior and cause identity. Use Result.getOrThrow for unsignedJwt's intentionally throwing fixture encoder. Add/retain malformed-input regressions in PackageManagerInstaller.test.ts and internal/jwt.coverage.test.ts. Keep codecs and guarded unknown reads; their forced deviation record belongs centrally.
- seats: part-3/grok.md#grok-2-5; part-3/grok.md#grok-2-6; part-3/sol.md#sol-2-4

### r18 — Terminate POSIX zip options before supplying filenames
- file: scratchpad/effected/github-actions/internal/archiveCommands.ts:165
- class: bug   severity: required
- standard: D11; D9 / section 14 (verified upstream bug); literal archive-path contract.   evidence: Sol lab/oracle command probes with files=[-h] emit [-6,-qr,/out/artifact.zip,-h]. Installed zip documentation treats arguments following -- as literal paths; the Artifact caller accepts leading-dash relative names.
- failure: A legitimate filename is interpreted as a zip option, altering archive behavior or selecting help instead of packing the file.
- fix: Insert -- between destination and files in the POSIX argv. Update archiveCommands.test.ts command-shape assertions and add a leading-dash-path regression; preserve the Windows branch. Record the verified upstream bug centrally.
- seats: part-3/sol.md#sol-2-3

### r19 — Construct unstubbed defects directly with Effect.die
- file: scratchpad/effected/github-actions/internal/unstubbed.ts:57
- class: effect-idiom   severity: required
- standard: EF-1; D11; preserve the law-forced tagged-defect contract.   evidence: Live unstubbed returns Effect.sync(() => { throw UnstubbedMemberError.make(...) }). 1c1cb85670 forced replacement of native Error with the tagged error, but does not force throw-based control flow; the green gates miss the explicit throw.
- failure: A defect already representable as Effect data is introduced by a JavaScript throw in the shared source helper.
- fix: Return Effect.die(UnstubbedMemberError.make({ message })) with the exact existing message and defect value. Retain callers' defect assertions; no upstream restore or module-local bookkeeping edit is needed.
- seats: part-3/grok.md#grok-2-7

## Backlog

None. No submitted record is solely documentation, JSDoc, coverage, vitest-canon, an unsupported performance preference, or outside the port write surface. Regression tests attached to demonstrated defects stay with those defects. The S3Config property is targeted validation of its new schema, not a coverage/canon sweep.

## Handled by the deviation codemod

None of the submitted round-2 records asks only to record a law-forced change. Central provenance is referenced in fixes where necessary, but is not counted as a separate finding or assigned to a group. Keep round-1 codemod records central; they are not re-raised as round-2 required work.

## Rejected

None of the 29 submitted records is rejected in full. Duplicates are merged, not counted as rejections. The incorrect TypeError subclaim in part-3/fable.md#fable-2-2 is discarded in r15 in favor of the supported own-key-loss evidence. Installer metacharacter fixes are reconciled in r13: protect complete targets, preserve POSIX valid names through quoting, and do not reject Windows separator backslashes as if they were POSIX injection bytes.
