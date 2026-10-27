I'll review the named github-actions files against the pinned upstream oracle and the port decisions, and I will only report findings. First I'm loading the binding decisions, the round-2 inventory, and the port ledger so I don't re-raise closed items.Round-2 fixes for these files are already recorded. I'll read the twelve sources against the pinned oracle and look only for defects the green gates do not already catch.The round-2 fixes are in place. Next I’ll probe the remaining edge cases those fixes don’t cover: link-label escapes, list and heading breaks, and S3 endpoint signing.The review is still open. I am checking the trailing-backslash link case and the BlobStore signing path against the round-2 inventory and the recorded deviations before I file anything.### grok-3-1
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:190
- class: bug   severity: required
- standard: D11; D9 / section 14 (upstream-bug). The round-2 bracket escape is recorded at GitHubMarkdown.test.ts:68,83 and leaves this input unchanged.   evidence: `escapeLinkLabel` only rewrites unmatched `[`/`]`; its `\\[\s\S]` alternative needs a character after the backslash, so a final odd run stays put. `link` then wraps that string in a passthrough `Html` child. `stringify.ts:748` emits `[${children}](${destination(url)})` and `stringify.ts:703` writes `Html` verbatim, so `GitHubMarkdown.link("foo\\", "https://example.test")` is `[foo\](https://example.test)`. `escape.ts:48-52` consumes `\` plus escapable punctuation (`]` is in `ESCAPABLE`, `unescape.ts:32`) as literal text before `makeLinkCloseConstruct` (`link.ts:240`, trigger `]`). The pinned parser therefore never closes one link around the label. Upstream `GitHubMarkdown.ts:342` passes the label through raw and emits the same string.
- failure: A label that ends with an odd number of backslashes is rendered as literal text, or as text plus a separate autolink, instead of one link whose label keeps that backslash.
- fix: After the bracket pass, if the label ends with an odd backslash run, append one backslash. Add a `Markdown.parseResult` regression beside GitHubMarkdown.test.ts:68 for `` `foo\\` `` and a lone `\`. Record the upstream-bug deviation.

### grok-3-2
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:524
- class: bug   severity: required
- standard: D11; D9 / section 14 (upstream-bug); `GitHubMarkdown.list` continuation-indent contract (same text upstream at GitHubMarkdown.ts:369). Distinct from the recorded table `<br>` deviation.   evidence: List items are raw `Html`. `stringify.ts:1021` indents only on `\n`. `preprocess.ts:127-129` treats a bare CR as a line break, and its own example `preprocessLines("foo\r").length === 2` is at preprocess.ts:110. `GitHubMarkdown.list(["a\rb"])` therefore stringifies as `- a\rb`, which the parser splits into a one-line item `a` and a following paragraph `b`. Upstream `GitHubMarkdown.ts:378` uses the same passthrough.
- failure: A bare carriage return in a list item ends the bullet. The following text is outside the list. LF items stay indented, so CR and LF of the same item disagree.
- fix: Normalize `\r\n` and bare `\r` to `\n` in each item before `passthrough`, so the existing hanging indent applies. Add a parse regression that `a\rb` is one item. Record the upstream-bug deviation.

### grok-3-3
- file: scratchpad/effected/github-actions/BlobStore.ts:385
- class: bug   severity: required
- standard: D11; D9 / section 14 (upstream-bug); AWS SigV4 canonical URI is the absolute path of the request actually sent (query excluded). Documented join is `<endpoint>/<bucket>/<key>` (`BlobStore.ts:160-163`).   evidence: `makeS3` signs `objectPath` (`BlobStore.ts:371-376`), which is `bucket`, optional `prefix`, and `key`. `canonicalize` (`sigv4.ts:183-193`) encodes that path and puts an empty canonical query in the signature. The request URL is the raw `endpoint` string plus the encoded object path (`BlobStore.ts:385`). `new URL(endpoint).host` (`BlobStore.ts:363`) drops pathname, search, and hash from the signed host. For `https://minio.local:9000/s3` the signature covers `/bucket/key` while the client requests `/s3/bucket/key`. For `https://h.example/s3?x=1` the key is appended inside the query. `new URL` on an unparseable endpoint throws `TypeError` out of `Effect.fn`, so the failure is a defect rather than `BlobStoreError` reason `misconfigured`. Upstream oracle `BlobStore.ts:217` and `:242` do the same join. Recorded deviations cover segment encoding and empty segments only. Tests use origin endpoints (`BlobStore.test.ts:43`).
- failure: A custom endpoint whose pathname, search, or hash is not empty is signed for a different resource than the URL that is sent, so S3-compatible stores reject the call with `SignatureDoesNotMatch`. An unparseable endpoint dies instead of failing as misconfiguration.
- fix: Parse the endpoint fallibly. Fail `BlobStoreError` `misconfigured` on an invalid URL or a non-empty search or hash. Sign `pathname` plus the object path, and send that same encoded path. Add a regression that `https://store.example/s3` signs and requests `/s3/bucket/key` and that an invalid endpoint fails typed before HTTP. Record the upstream-bug deviation.

### grok-3-4
- file: scratchpad/effected/github-actions/BlobStore.ts:20
- class: schema   severity: required
- standard: effect-laws-v1 law 19; schema-first-development-prompt “Use LiteralKit for a reusable discriminator domain”.   evidence: `const DotSegment = S.Literals([".", ".."])` is referenced by name at `S.is(DotSegment)` (`BlobStore.ts:390`). Law 19 reserves `S.Literals` for anonymous inline unions never referenced by name. The green gates are `effect-imports`, `effect-fn`, `terse-effect`, and `native-runtime` (`EFFECTED_PORT_GOAL.md` lint row). None of those rewrites a named `S.Literals` binding. `terse-effect` finding kinds in `TerseEffect.ts` stop at nested `Bool.match`, helper refs, and object-spread shapes.
- failure: The named `.` / `..` domain stays an `S.Literals` schema, so it has no `LiteralKit` `.is`, `.$match`, or `.Enum` and drifts from the named-literal rule already applied to `CheckState`.
- fix: Define `DotSegment` with `LiteralKit([".", ".."])` and keep `S.is(DotSegment)` at the path check. No behavior change.

### grok-3-5
- file: scratchpad/effected/github-actions/BlobStore.ts:338
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; EF-2; D11.   evidence: `O.isNone(stored) ? Effect.succeed(O.none()) : decode…` chooses which effect runs. `terse-effect --check` does not report raw conditionals (finding kinds in `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts` are helper-ref, thunk-helper, flow-candidate, option-object-compaction, conditional-optional-object-spread, nested-option-match, nested-bool-match, dual-overload). The same gate miss was required for `DryRun.ts` in round 2; that site is now `Bool.match` and these branches remain.
- failure: Memory `get` branches on a boolean instead of matching the stored `Option`.
- fix: Replace the ternary with `O.match(stored, { onNone: () => Effect.succeed(O.none()), onSome: (bytes) => … })`.

### grok-3-6
- file: scratchpad/effected/github-actions/BlobStore.ts:369
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-2; D11.   evidence: `config.sessionToken === undefined ? undefined : yield* Secret.forSigning(config.sessionToken)` is a boolean orchestration branch. Same `terse-effect` gap as grok-3-5.
- failure: Session-token declassification is selected with a boolean ternary inside `makeS3`.
- fix: `yield* O.match(O.fromUndefinedOr(config.sessionToken), { onNone: () => Effect.succeed(undefined), onSome: Secret.forSigning })`.

### grok-3-7
- file: scratchpad/effected/github-actions/BlobStore.ts:408
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: `status < 200 || status >= 300 ? Effect.fail(BlobStoreError.make(...)) : Effect.void` chooses the effect. Same `terse-effect` gap as grok-3-5.
- failure: HTTP acceptance is a boolean effect ternary.
- fix: `Bool.match(status < 200 || status >= 300, { onTrue: () => Effect.fail(BlobStoreError.make({ reason: "refused", key, status })), onFalse: () => Effect.void })`.

### grok-3-8
- file: scratchpad/effected/github-actions/CheckDocument.ts:564
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-2; D11.   evidence: `sink.read === undefined ? yield* Ref.get(writtenRef) : yield* sink.read.pipe(...)` chooses which effect reads the document. Same `terse-effect` gap as grok-3-5. `Effect.timeout` still fails rather than returning null; keep the `?? ""` on the success value only.
- failure: Reconcile selects the live read versus the shadow ref with a boolean ternary.
- fix: Match `O.fromUndefinedOr(sink.read)` and run `Ref.get(writtenRef)` on none and the timed read on some.

### grok-3-9
- file: scratchpad/effected/github-actions/CheckDocument.ts:589
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: `(alreadyLogged ? Effect.logDebug : Effect.logInfo)(...)` chooses the log effect. Same `terse-effect` gap as grok-3-5.
- failure: The stale-pass log level is a boolean effect ternary.
- fix: `Bool.match(alreadyLogged, { onTrue: () => Effect.logDebug(message, fields), onFalse: () => Effect.logInfo(message, fields) })`.

### grok-3-10
- file: scratchpad/effected/github-actions/GitHubToken.ts:300
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: `Exit.isSuccess(exit) ? Effect.void : Effect.ignore(app.revoke(minted.token))` is the `acquireUseRelease` release decision. Same `terse-effect` gap as grok-3-5.
- failure: Token revocation-on-failure is a boolean effect ternary.
- fix: `Bool.match(Exit.isSuccess(exit), { onTrue: () => Effect.void, onFalse: () => Effect.ignore(app.revoke(minted.token)) })`.

### grok-3-11
- file: scratchpad/effected/github-actions/DetachedProcess.ts:755
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11.   evidence: `isErrno(cause, "ESRCH") ? Effect.succeed(false) : Effect.fail(DetachedSignalFailedError.make(...))` chooses the effect inside `reap`. Same `terse-effect` gap as grok-3-5.
- failure: ESRCH handling is a boolean effect ternary.
- fix: `Bool.match(isErrno(cause, "ESRCH"), { onTrue: () => Effect.succeed(false), onFalse: () => Effect.fail(DetachedSignalFailedError.make({ pid, cause })) })`.

### grok-3-12
- file: scratchpad/effected/github-actions/ManagedDocument.ts:481
- class: docs   severity: backlog
- standard: D9. Upstream `ManagedDocument.ts:261` carries the same gotcha. A behavior change would be a deviation without a new collision.   evidence: The gotcha says region keys share `NamePart` (`/^[A-Za-z0-9][A-Za-z0-9_-]*$/u`, `ManagedDocument.ts:44`) and throw at construction. `withRegionsResult` (`ManagedDocument.ts:509`) calls `SectionId.make` with `wireKey`, and `SectionKey` (`templates/Section.ts:42`) allows dots. Namespace and key still go through `NamePart` (`ManagedDocument.ts:268-274`), so `ownRegions` (`ManagedDocument.ts:704`) can keep using `startsWith(prefix)` without two documents spelling one marker.
- failure: A dotted region key is accepted and round-trips. Callers who rely on the gotcha expect a throw.
- fix: Describe the construction check as `SectionKey` on the wire key, and state that dots in the region segment stay unambiguous because namespace and key cannot contain them.

REQUIRED: 11
BACKLOG: 1
