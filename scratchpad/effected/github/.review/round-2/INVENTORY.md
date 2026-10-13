# github — round-2 inventory

Read all nine reports: part-1/{grok,sol,fable}.md, part-2/{grok,sol,fable}.md and part-3/{grok,sol,fable}.md, plus every adjacent BRIEF.md and BRIEF.grok3.md. The part-2 sol report numbers its findings codex-2-*; fable.md files identify the separate Grok fallback seat. Seat references below retain the part, report and original finding id to disambiguate reused ids.

Counts: 20 raw seat findings → 17 distinct findings; **16 required, 1 backlog, 0 deviation-codemod-only, 0 rejected; 7 groups**. The four record-guard reports merge into one cross-file root cause. part-3/sol and part-3/fable report NO FINDINGS. The current native-runtime allowlist has no entries matching scratchpad/effected/github/**: **0 allow-* additions**.

Reports review 60fcfb5ebcdc26765a66cc1f13afc88adcb05d11. This read-only merge ran on the existing @lab/effected-2 checkout at f66ff213589ba63ad2abdab0c573d8d40919e989, rather than switching to the requested @lab/effected branch. git diff between the review head and live HEAD shows no source/test differences for github. Probe results below are seat evidence, not newly executed tests. No tests, scratch-copy compiler probes, cache-refresh commands or ledger/closeout commands were run.

Binding precedence: the entire operator revision block, D1–D20, §12.5 and §14 were read. The task's explicit documentation/coverage/canon deferral governs this merge despite the briefs' S2/S3-green claim. Bookkeeping for forced changes, exports and any resulting deviations stays with the central codemod; actual defects in those changes remain required. Commit history and step-2/laws/S1/S3 diffs distinguish the forced JSON-codec migration in req-08 from the unforced eager work in req-06/req-07.

Group ownership is defined in required.json. No source or test file occurs in two groups; g3 owns all six source files spanned by req-13/req-14 because both touch WorkflowDispatch.ts. g2 owns all four files spanned by req-09. Reuse harness.ts, fixtures.ts and existing imported helpers read-only. No root manifest, lockfile, external config, PORT_LEDGER.json or README Port notes are assigned. Any future verification must use one vitest process at a time with --maxWorkers=2; module-wide coverage requires beep-heavy --slot-only.

## Required

### req-01 — Remove array-to-record predicates from both throwable classifiers

- file: scratchpad/effected/github/GitHubError.ts:478; scratchpad/effected/github/GraphQL.ts:198
- class: type-safety   severity: required
- standard: D11/D15; effect-laws-v1 laws 4 and 17; AGENTS.md schema-derived or correctly typed built-in guards
- evidence: Both isRecord declarations claim Record<string, unknown> while delegating to P.isObjectOrArray, whose declared result includes arrays. Those guards feed throwable, response, headers, validation and GraphQL entry reads. The assertion gate counts casts/non-null assertions/any, not user-defined predicates; round-1 req-30 repaired only internal/octokit.ts. Four seat records identify this same surviving narrowing defect.
- failure: Array values become unverified string-keyed records and can influence classification through named properties; green assertion/lint gates do not detect the predicate.
- fix: Delete both ad-hoc isRecord predicates. Narrow with P.isObject before record reads, retaining correctly inferred record types and normal-object classification. Add array and ordinary-object regressions to both classifier suites; send law-17-forced array exclusion to central deviation recording. Do not restore the oracle casts.
- seats: part-1/grok:grok-2-1; part-1/fable:fable-2-2; part-2/grok:grok-2-1; part-2/fable:fable-2-1

### req-02 — Make blocking installation-token refresh interruptible without losing ownership

- file: scratchpad/effected/github/GitHubApp.ts:843
- class: bug   severity: required
- standard: D9/D11; §14 verified bug in the recorded rotation repair; effect-first-development EF-26
- evidence: part-1/sol's read-only blocked-mint probe interrupted the requesting fiber, then reported interruptFinished=false, signalAborted=false, mints=2 after 80 ms; termination waited for the mint response. The live rotate wraps revocation, minting, client construction and Ref.set in Effect.uninterruptible while refresh holds rotation.withPermits(1).
- failure: A stalled replacement HTTP request blocks cancellation, other refresh callers and scope cleanup indefinitely.
- fix: Retain serialization and atomic ownership transfer, but mask only ownership state updates/finalizer registration. Restore interruption around blocking revoke/sign/mint work and retain or finalize any acquired replacement before interruption can discard it. Add a blocked-refresh regression in GitHubApp.test.ts proving HTTP abort, requesting-fiber termination and correct token cleanup.
- seats: part-1/sol:sol-2-1

### req-03 — List all cursor-paginated attestations

- file: scratchpad/effected/github/Attestation.ts:255
- class: bug   severity: required
- standard: D9/D11; §14 upstream-bug; listForSubject's all-attestations contract
- evidence: part-1/sol's two-page HTTP probe supplied a rel=next Link on page one, but both lab and pinned oracle issued only the initial request; the lab returned calls=1 and only the first-page URL. The live implementation uses one client.requestDecoded with ListResponse.
- failure: Attestations after the first page disappear from results, producing false absence for a requested subject.
- fix: Reuse existing pagination machinery to traverse cursor pages and decode collected entries through the owned schema. Preserve API-version headers, predicate filter, order and existing notFound/422 empty-result handling. Add a two-page Link/cursor regression in Attestation.coverage.test.ts; central recording receives the verified upstream-bug evidence.
- seats: part-1/sol:sol-2-2

### req-04 — Reject invalid numeric HTTP statuses before constructing GitHubError

- file: scratchpad/effected/github/GitHubError.ts:471
- class: bug   severity: required
- standard: D9/D11; §14 upstream-bug; effect-first-development EF-3 and EF-31
- evidence: part-1/sol probed fromOctokit('probe', { status, message: 'failure' }, 0) in the lab and pinned oracle with NaN, Infinity and 404.5; every input threw Schema validation failed. readThrowable accepts P.isNumber while GitHubError.status validates S.Int.
- failure: Malformed status values turn throwable classification into a synchronous exception and transport defect instead of a typed GitHubError.
- fix: Use a schema-derived S.Int guard before retaining a status. Treat invalid statuses as unavailable, classify as transport failure and preserve the original cause. Add non-finite/fractional-status regressions in GitHubError.test.ts and supply the upstream-bug evidence centrally.
- seats: part-1/sol:sol-2-3

### req-05 — Classify duplicate-resource prose before truncating the displayed reason

- file: scratchpad/effected/github/GitHubError.ts:473
- class: bug   severity: required
- standard: D9/D11; §14 upstream-bug; saysAlreadyExists and GitBranch.upsert routing contract
- evidence: part-1/sol's lab/oracle probes classified status 422 plus 'already exists' as alreadyExists, but status 422 plus 'x'.repeat(501) + ' already exists' as rejected. readThrowable sanitizes/truncates before saysAlreadyExists searches the reason.
- failure: An existing resource can incorrectly fail upsert when its identifying phrase occurs beyond the 500-character display limit.
- fix: Retain the complete original message for classification with structured validation entries; sanitize only the emitted reason after selecting the error kind. Add a long-message duplicate-resource regression in GitHubError.test.ts and provide upstream-bug evidence for central recording.
- seats: part-1/sol:sol-2-4

### req-06 — Restore bounded upstream commit-subject extraction

- file: scratchpad/effected/github/GitHubCommit.ts:92
- class: perf   severity: required
- standard: D9/D11; later operator restore-unforced-change ruling; measured regression versus oracle
- evidence: The seat measured 30 reads of a 1,000,008-byte/200,000-body-line message: oracle bounded split approximately 0.102 ms; lab full Str.split approximately 116.387 ms. git log --format=%h:%s -- this file and git show cc8f05d446 identify the exact S3 replacement of message.split('\n', 1)[0] ?? '' with A.headNonEmpty(Str.split(...)); step-2/laws and cda9f7f481 S1 diffs leave this getter unchanged. cc8f05d446 explicitly calls this a coverage simplification, not a diagnostic repair.
- failure: Every subject read splits the whole body and allocates in proportion to body-line count, despite needing only the first line. No diagnostic, law or ruling forced removing the upstream split bound.
- fix: Restore the upstream bounded message.split('\n', 1)[0] ?? '' getter and any upstream test lines rewritten for this change. Add empty/no-newline/multiline and long-body regression cases in GitHubCommit.coverage.test.ts. The inspected S3 diff adds test files rather than rewriting upstream tests, so no concrete upstream test-line restoration was identified. Do not retain full splitting as a recorded deviation.
- seats: part-1/sol:sol-2-5

### req-07 — Restore upstream short-circuit comment marker search

- file: scratchpad/effected/github/GitHubIssue.ts:500
- class: perf   severity: required
- standard: D9/D11; later operator restore-unforced-change ruling; algorithmic-class regression
- evidence: The seat's 10,000-comment probe placed the match first: lab read tail bodies 19,998 times; oracle read them zero times. git log --format=%h:%s -- the file, step-2/laws diffs, and git show cf2c19c76b show that the S3 coverage commit introduced A.map(...spread, body fallback).find and removed the selected-result body fallback. No diagnostic/law commit forced that eager map; cf2c19c76b adds new coverage/property tests and does not rewrite resources2.test.ts.
- failure: An immediate match still traverses/clones all comments, adding O(n) auxiliary storage and work where the upstream find examines only the matching prefix.
- fix: Restore comments.find(comment => marker.matches(comment.body ?? '')) and the selected CommentRecord body fallback existing.body ?? '', preserving upstream short-circuit order. Restore any upstream test lines rewritten for this divergence; the inspected commit identifies none. Add an early-match/body-read regression in GitHubIssue.coverage.test.ts. Do not keep eager normalization as a recorded deviation.
- seats: part-1/sol:sol-2-6

### req-08 — Render absent/null content encodings without creating a defect

- file: scratchpad/effected/github/GitHubContent.ts:183
- class: bug   severity: required
- standard: D9/D11; §14; effect-first-development EF-3/EF-31 and JSON-codec law
- evidence: The oracle interpolates JSON.stringify(content.encoding), with encoding optional in Octokit's type. The lab encodes with S.fromJsonString(S.String) and Effect.orDie, so absent or null encodings fail instead of forming rejected errors. git log --format=%h:%s -- the file and git show c5c8bf0b92 prove the JSON-codec substitution originated in an effected-port step-2 commit.
- failure: A malformed/absent encoding makes getFile/getFileOption die while constructing a rejection; upstream returns typed rejected/422 with undefined or null in its reason.
- fix: Keep the law-forced schema JSON codec, but make rendering total for the rejection path: undefined renders as 'undefined', null as 'null', and strings remain JSON-quoted via a nonthrowing codec. Preserve the typed rejected/422 result and add omitted/null/string encoding regressions in GitHubContent.coverage.test.ts. The faulty change itself is required; recording its forced provenance belongs to the central codemod. Do not restore JSON.stringify.
- seats: part-1/fable:fable-2-1

### req-09 — Use succeedNone at five explicit-generic gate misses

- file: scratchpad/effected/github/GitHubCommit.ts:486,495; scratchpad/effected/github/GitBranch.ts:449; scratchpad/effected/github/GitHubContent.ts:197; scratchpad/effected/github/GitHubRelease.ts:320
- class: tsgo   severity: required
- standard: D11; tsgo preferSucceedSomeOrNone; effect-laws-v1 law 21
- evidence: All five live branches contain Effect.succeed(O.none<...>()). The rule is configured at error, but round-1 req-32 demonstrated that explicit type arguments evade it. Effect.succeedNone has Effect<Option<never>> and is assignable to all five declared success types. The repaired round-1 internal/paginate sites are separate.
- failure: The configured Effect idiom remains violated through a demonstrated compiler-pattern gap, not a speculative already-enforced diagnostic.
- fix: Replace these five Effect.succeed(O.none<...>()) expressions with Effect.succeedNone, preserving surrounding catchIf, pagination completion and declared types. Keep existing notFound/completion tests in the owned GitBranch/GitHubCommit/GitHubContent/GitHubRelease coverage suites green; no docs-example sweep is assigned here.
- seats: part-1/fable:fable-2-3

### req-10 — Use identity for the GraphQL passthrough variable encoder

- file: scratchpad/effected/github/GraphQL.ts:436
- class: law   severity: required
- standard: AGENTS.md tersest equivalent helper rule; effect-laws-v1 laws 2 and 21
- evidence: encodeVariables ?? ((variables) => variables) is live. The seat traces the green terse-effect gate gap: getArrowReplacement accepts call-expression bodies, while the thunk matcher requires zero parameters; this one-parameter identifier body matches neither. effect/Function.identity preserves V and is assignable to the default encoder.
- failure: An avoidable passthrough closure violates the direct-helper Code Law while the gate misses its shape.
- fix: Import identity from effect/Function and use encodeVariables ?? identity. Preserve reference identity and both default/custom encoder behavior in GraphQL.coverage.test.ts.
- seats: part-2/grok:grok-2-2

### req-11 — Bound retry-delay milliseconds to the error schema's integer domain

- file: scratchpad/effected/github/internal/headers.ts:121,126
- class: bug   severity: required
- standard: D9/D11; §14 verified upstream-bug; effect-first-development EF-3 and EF-31
- evidence: part-2/sol:codex-2-1 probed retryAfterMillisFrom({ 'retry-after': '9007199254741' }, 0), obtaining 9007199254741000, which fails S.is(S.Int); larger values overflow to Infinity. Both lab/oracle GraphQL classifiers threw Schema validation failed. A real scripted lab HTTP 429 yielded hasFails=false, hasDies=true. The reset calculation likewise multiplies seconds without bounding.
- failure: Server delay headers can convert a recoverable rate-limit failure into a schema-construction defect and bypass excessive-delay refusal.
- fix: Bound both nonnegative millisecond calculations to Number.MAX_SAFE_INTEGER before returning them, ensuring the computed delay remains in S.Int and oversized values still exceed the retry ceiling. Add unsafe-integer/overflow/reset regressions in internal/headers.coverage.test.ts and a typed HTTP-failure regression in transport.test.ts; provide upstream-bug evidence centrally.
- seats: part-2/sol:codex-2-1

### req-12 — Make GraphQL throwable string fallbacks nonthrowing

- file: scratchpad/effected/github/GraphQL.ts:185,209
- class: bug   severity: required
- standard: D9/D11; §14 upstream-bug; effect-first-development EF-31; schema-first total-functions guidance
- evidence: The sol seat probed both lab and oracle with fromThrowable('probe', { toString: null }, 0) and { errors: [{ message: 42, toString: null }] }; both inputs threw TypeError: No default value. These reach the live String(error) and String(raw) fallbacks.
- failure: The classifier's unknown-input domain includes values whose string coercion throws, introducing defects during typed transport error translation.
- fix: Protect both coercions with a nonthrowing conversion and stable fallback description; retain the original throwable as cause and preserve descriptions for successful coercions. Add both counterexamples to GraphQL.coverage.test.ts and send verified upstream-bug evidence for central recording.
- seats: part-2/sol:codex-2-2

### req-13 — Decode fallible comment, workflow-run and tag projections in the typed channel

- file: scratchpad/effected/github/PullRequestComment.ts:267; scratchpad/effected/github/WorkflowDispatch.ts:312; scratchpad/effected/github/GitTag.ts:336
- class: effect-idiom   severity: required
- standard: D11; effect-first-development EF-3/EF-31; schema-first external-boundary rule; §14 law-forced deviations
- evidence: The sol seat's real scripted HTTP probes used comment body={}, workflow run id=1.5, and tag name=''. PullRequestComment.create, WorkflowDispatch.runStatus and GitTag.list each returned hasFails=false, hasDies=true and Schema validation failed. The live projectors use throwing CommentRecord.make/WorkflowRunStatus.make/TagRef.make; the oracle shares these constructors. These are distinct from repaired round-1 commit-file projection.
- failure: Malformed external data escapes APIs advertising GitHubError as defects; marker matching can also invoke string methods before comment validation.
- fix: Decode projected values effectfully using the owning schemas and map failures to operation-specific GitHubError.decode, following PullRequest.project. Validate comments before marker matching, use effectful traversal for tags, and apply workflow status projection to both direct reads and discovery. Preserve valid defaults/order/results. Add malformed-response typed-channel regressions in PullRequestComment.test.ts, WorkflowDispatch.test.ts and GitTag.test.ts; supply EF-3 deviation details centrally.
- seats: part-2/sol:codex-2-3

### req-14 — Decode secret, variable, ruleset and workflow list return models

- file: scratchpad/effected/github/RepositoryVariable.ts:294,370; scratchpad/effected/github/RepositorySecret.ts:311,366; scratchpad/effected/github/Ruleset.ts:311; scratchpad/effected/github/WorkflowDispatch.ts:357
- class: schema   severity: required
- standard: D11; effect-first-development EF-3; ARCHITECTURE principle 5; schema-first boundary decoding; §14 law-forced deviations
- evidence: The sol seat supplied list responses with variable value=null, secret name=42, ruleset id=null/source_type=undefined, and workflow id=null. Services returned success arrays rejected by S.is(S.Array(theExportedInfoSchema)). Live projections return annotated object literals without decoding, including both repository/environment secret and variable paths.
- failure: HTTP-derived results violate their advertised schemas despite successful service returns; independently generated round-trip models do not prove boundary validity.
- fix: Decode the selected list fields through VariableInfo, SecretInfo, RulesetInfo and WorkflowInfo before returning, mapping failures to each operation's GitHubError.decode. Preserve ordering, field selection, optional-field representation and plain-object results. Cover repository/environment paths and malformed responses in the owning RepositoryVariable.test.ts, RepositorySecret.test.ts, Ruleset.test.ts and WorkflowDispatch.test.ts. Supply law-forced deviation sites centrally.
- seats: part-2/sol:codex-2-4

### req-15 — Encode slash-free repository coordinate segments in RepoRef

- file: scratchpad/effected/github/Repo.ts:77,84
- class: schema   severity: required
- standard: D9/D11; §14 verified upstream-bug/schema-law cause; effect-first-development EF-35 and schema-first precision guidance
- evidence: The sol seat constructed RepoRef.make({ owner: 'acme/extra', repo: 'widget' }) in both lab and oracle: slug='acme/extra/widget' and parseResult(slug) fails. A second valid constructor input { owner: 'acme', repo: 'extra/widget' } produces the identical slug. Both fields are S.NonEmptyString; Repo.property.test.ts generates a separate slash-free Coordinates domain that hides these valid-model counterexamples.
- failure: Schema-valid coordinates cannot round-trip through their formatter/parser and distinct coordinates collapse to the same slug.
- fix: Add slash-excluding schema checks to both nonempty fields while retaining every other accepted character. Use Arbitrary.schema(RepoRef) for formatter/parser fidelity and add explicit slash rejection in Repo.property.test.ts/Repo.coverage.test.ts. This is an evidenced model/formatter defect, not a standalone coverage request; central recording receives the acceptance-tightening cause.
- seats: part-2/sol:codex-2-5

### req-16 — Read top-level GraphQL response-error headers into the transport snapshot

- file: scratchpad/effected/github/internal/octokit.ts:282
- class: bug   severity: required
- standard: D9/D11; §14 verified upstream-bug; Transport.rateLimit failure snapshot contract
- evidence: The seat cites @octokit/graphql's GraphqlResponseError storing HTTP headers at error.headers while error.response contains the GraphQL body. Live readThrownHeaders returns before considering top-level headers when response.headers is missing; the oracle has the same lookup. Existing transport.test.ts:119-138 fixtures place headers under response. GraphQL.fromThrowable already supports the top-level location, proving the classification/snapshot inconsistency.
- failure: An HTTP-200 GraphQL errors response leaves rateLimit stale even while the classified failure sees fresh header data.
- fix: Fall back to a non-array error.headers record when response.headers is absent or otherwise unusable, while preserving the existing explicit rejection of array response.headers without fallback. Reuse correctly typed object guards. Add an HTTP-200 GraphQL-error-shape snapshot regression in transport.test.ts and keep malformed nested-header behavior covered in internal/octokit.coverage.test.ts; supply upstream-bug evidence centrally.
- seats: part-3/grok:grok-2-1

## Backlog

### back-01 — Repair the ignored internal pagination JSDoc example

- file: scratchpad/effected/github/internal/paginate.ts:50
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md compilable Examples; requested S2/S3 deferral
- evidence: The example calls .join(',') on Stream.runCollect's Chunk. Chunk exposes join as a module helper, not an instance method. The seat demonstrates that docgen Parser.shouldIgnore drops @internal declarations before checking the example, explaining the green gate miss.
- failure: The example fails typechecking and throws if run, even though ignored internal documentation passes docgen.
- fix: During the documentation backlog pass, import effect/Chunk and use Chunk.join(Effect.runSync(Stream.runCollect(items)), ',') to preserve the printed 1,2 result.
- seats: part-3/grok:grok-2-2
- disposition: JSDoc finding deferred to Backlog by the task's explicit S2/S3 rule, regardless of the seats' green-gate brief.

## Handled by the deviation codemod

None of the round-2 seat findings asks only to record a systemic law-forced change. Required findings that repair behavior may supply evidence/sites to the central per-module, per-class codemod; that downstream bookkeeping is not counted as another finding and is not assigned to a repair group.

## Rejected

None. Each distinct seat finding has evidence and a concrete fix. The two idiom findings demonstrate specific green-gate misses; the JSDoc gate miss is retained in Backlog under the requested deferral. No accepted finding requires an out-of-surface repository change or contradicts the operator rulings.

