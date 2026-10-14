# github — round-3 inventory

Read all nine seat reports and all six adjacent briefs: part-1, part-2 and part-3 each contain grok.md, sol.md, fable.md, BRIEF.md and BRIEF.grok3.md. The fable files identify the independent Grok medium fallback seat. Seat references include part/report/original id because ids repeat between parts. part-3/grok and part-3/fable report NO FINDINGS.

Counts: 33 raw seat records, with compound reports split and overlaps deduplicated, yield **21 required, 0 backlog, 0 handled by the deviation codemod, 0 rejected; 6 groups**. The current native-runtime allowlist contains no entries for scratchpad/effected/github/**, so **0 allow-* findings** apply.

The reports review 3ad7b305790c7f0903f6d55766c55186745ba2d1. This merge reads the existing @lab/effected-2 checkout at 9f73185dd8517933985c39c9a3ba6f9765480185; the named @lab/effected branch was not checked out. The live GitHub source/test diff against the reviewed commit is empty. Existing unrelated edits are left alone. Probe outputs are attributed seat evidence, not newly executed tests.

The entire operator revision block, D1–D20, §12.4/12.5 and §14 govern classification. The requested S2/S3 deferral overrides the briefs' gate-state claims; no seat finding here is solely docs, JSDoc, coverage or vitest-canon. Runtime defects in law-forced changes remain required. No finding seeks an unforced-change restore; inspected GitHubApp/DeploymentEnvironment/GitTag histories and the round-2 GitHubApp diff support the surviving repair analysis. Ledger entries, README Port notes and added-export/deviation recording belong to the central codemod and are not write assignments.

required.json assigns disjoint source and test ownership, with at most five source files in a group. Referenced models, GraphQL conversion patterns, harness.ts, fixtures.ts and shared pagination helpers are read-only dependencies unless explicitly assigned. No root manifest, lockfile, repository config, PORT_LEDGER.json or README Port notes is assigned. Verification must use one vitest process at a time with --maxWorkers=2; module-wide coverage must use beep-heavy --slot-only. No tests, scratch-copy compiler probes, session/ledger/closeout commands or implementation fixes were run for this merge.

## Required

### req-01 — Make REST throwable coercion total

- file: scratchpad/effected/github/GitHubError.ts:464,473
- class: bug   severity: required
- standard: D9/D11; §14 verified upstream-bug; standards/effect-first-development.md EF-3/EF-31
- evidence: part-1/sol's read-only lab and pinned-oracle probes passed { toString: null }, a null-prototype object and an array containing one to fromOctokit; all threw TypeError: No default value. Both unchecked String(error) fallbacks remain. GraphQL's protected conversion demonstrates the existing repair pattern. The Grok assertion that String(Symbol()) throws is incorrect and is not relied on.
- failure: An unknown transport throwable can defect during classification instead of becoming GitHubError, bypassing typed recovery.
- fix: Protect both coercions locally with Result.try and a stable fallback, preserving successful descriptions and the original cause. Reuse the GraphQL conversion pattern without requiring edits to GraphQL.ts. Add uncoercible-object and array regressions in GitHubError.test.ts.
- seats: part-1/grok:grok-3-1; part-1/sol:sol-3-1; part-1/fable:fable-3-1

### req-02 — Let scope cleanup terminate a blocked token rotation

- file: scratchpad/effected/github/GitHubApp.ts:840-867
- class: bug   severity: required
- standard: D9/D11; §14 bug in round-2 repair; standards/effect-first-development.md EF-26
- evidence: The finalizer waits on rotation.withPermits(1), while fresh holds that permit across interruptible revoke/mint/client work. Scope.close runs finalizers uninterruptibly and does not itself interrupt an independently forked permit holder. A holder blocked forever therefore prevents finalization. GitHubApp.test.ts interrupts the requesting fiber before close, so its green regression does not cover this order.
- failure: Closing the layer scope can wait forever for a stalled refresh and never revoke its owned credential.
- fix: Track and stop in-flight rotation before final cleanup; interrupt and join its fiber, then revoke the owned token without waiting behind an unbounded permit holder. Preserve refresh serialization and atomic ownership updates. Add a scope-close-while-refresh-is-blocked regression in GitHubApp.test.ts that proves abort, completion and correct revocation.
- seats: part-1/grok:grok-3-2

### req-03 — Decode issue comments before marker matching and construction

- file: scratchpad/effected/github/GitHubIssue.ts:499-515
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; §14 law-forced external-boundary validation; D9 short-circuit preservation
- evidence: commentOnce applies marker.matches to comment.body ?? '' and uses throwing CommentRecord.make for the selected or created comment. body={} reaches includes and throws; fractional ids and null URLs fail the constructor. PullRequestComment.recordOf already demonstrates typed decoding for the same model. Round-2 req-13's malformed-comment probe establishes the failure mechanism.
- failure: Malformed listed or created comments become defects instead of operation-specific GitHubError.decode failures.
- fix: Validate each inspected body's string shape before matching, retaining nullish-body normalization and upstream short-circuit search; decode the selected and created CommentRecord effectfully and map failures to GitHubError.decode. Do not eagerly decode/traverse the entire tail after a match or reintroduce the eager map removed in round 2. Add malformed-body/id/URL and early-match regressions in GitHubIssue.coverage.test.ts.
- seats: part-1/grok:grok-3-3; part-1/fable:fable-3-5

### req-04 — Decode issue projections and label shapes in the typed channel

- file: scratchpad/effected/github/GitHubIssue.ts:402-471
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; §14 law-forced external-boundary validation
- evidence: project uses IssueInfo.make on request/paginate data; labelNames dereferences non-string labels and retains a null name. part-1/sol's real scripted-client probe with number=1.5 produced fails=false, dies=true in lab and oracle. A null label throws before construction; a null label name fails the array-of-strings schema.
- failure: get and list defect on malformed issue numbers or labels while advertising GitHubError.
- fix: Decode the selected wire fields before unsafe label access and decode IssueInfo effectfully, mapping failures to the calling operation's GitHubError.decode. Preserve valid label omission, state normalization and ordering; use effectful list traversal. Add fractional-number/null-label/null-name regressions in GitHubIssue.coverage.test.ts.
- seats: part-1/grok:grok-3-4; part-1/sol:sol-3-2 [issue projection]; part-1/fable:fable-3-5 [issue projection]

### req-05 — Decode check-run references instead of throwing

- file: scratchpad/effected/github/CheckRun.ts:619
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; standards/ARCHITECTURE.md principle 5; §14 law-forced boundary validation
- evidence: refOf calls CheckRunRef.make for create/get. numericId leaves 1.5 fractional, while id requires S.Int. part-1/sol's real scripted HTTP-200 probe produced fails=false, dies=true, Schema validation failed in both lab and oracle; non-string name/status have the same unchecked boundary.
- failure: Malformed check-run responses bypass the advertised GitHubError channel.
- fix: Make refOf an effectful decoder of validated selected fields and map errors to GitHubError.decode for create/get. Preserve numeric-id normalization and valid defaults; cover fractional ids and wrong-type fields in CheckRun.coverage.test.ts.
- seats: part-1/grok:grok-3-5; part-1/sol:sol-3-2 [check-run projection]; part-1/fable:fable-3-7

### req-06 — Decode release and asset projections

- file: scratchpad/effected/github/GitHubRelease.ts:259-281,402
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; §14 law-forced external-boundary validation
- evidence: project and assetOf use throwing ReleaseInfo.make and ReleaseAsset.make on request/paginate data. The sol scripted getByTag id=1.5 probe defects in lab and oracle. draft/prerelease require booleans; asset id/size require S.Int. uploadAsset already validates its AssetResponse and is not the demonstrated missing boundary.
- failure: getByTag/create/list/update or listAssets can defect rather than return GitHubError.decode on malformed releases/assets.
- fix: Decode ReleaseInfo and ReleaseAsset effectfully with operation-specific GitHubError.decode mapping; validate selected wire shapes before unsafe access and use effectful traversal. Preserve uploadAsset's validated response path and valid defaults/order. Add invalid release-id/boolean and asset-size cases in GitHubRelease.coverage.test.ts.
- seats: part-1/grok:grok-3-6; part-1/sol:sol-3-2 [release/asset projections]; part-1/fable:fable-3-8

### req-07 — Decode commit summaries and comparison models

- file: scratchpad/effected/github/GitHubCommit.ts:364,461
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; §14 law-forced external-boundary validation
- evidence: summarize calls CommitSummary.make from get/list and compare maps it over commits; compare later calls CommitComparison.make. part-1/sol's commit.message=42 probe defects in lab and oracle. author.login=null is retained by fromUndefinedOr despite optional string validation; fractional ahead_by/behind_by and unknown status also fail construction. File projections already use a typed decoder.
- failure: Malformed commit or comparison data escapes get/list/compare as a defect even though file decoding returns typed errors.
- fix: Decode the selected summary and comparison shapes effectfully, mapping errors to GitHubError.decode for get/list/compare, including compare's embedded commits. Validate nested wire access, preserve optional-field semantics and fileOf, and use effectful traversal. Add message/login/status/count regressions in GitHubCommit.coverage.test.ts.
- seats: part-1/grok:grok-3-7; part-1/sol:sol-3-2 [commit summary]; part-1/fable:fable-3-6

### req-08 — Decode GitHub App responses before dereferencing

- file: scratchpad/effected/github/GitHubApp.ts:717,758-766,793
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; §14 law-forced external-boundary validation
- evidence: part-1/sol's scripted HTTP probes found defects for identity name=42, installation id=1.5, and HTTP-201 null token payload in both lab and oracle. Installation.make and AppIdentity.make throw; minted.token is read before the existing InstallationToken decoder. Fractional bot user ids and wrong-type account logins share the boundary.
- failure: Malformed installation, identity or token responses bypass GitHubAppError; output-model decoding cannot protect earlier property access.
- fix: Decode selected wire response shapes before nested access, then decode Installation/AppIdentity/InstallationToken effectfully and map failures to the existing installation/identity/token GitHubAppError kinds. Preserve valid defaults, fallback behavior and order. Add null-token and invalid installation/identity/bot fields to GitHubApp.test.ts.
- seats: part-1/grok:grok-3-8; part-1/sol:sol-3-3; part-1/fable:fable-3-9

### req-09 — Decode environment list results without synchronous throws

- file: scratchpad/effected/github/DeploymentEnvironment.ts:266
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; standards/schema-first-development-prompt.md boundary rule; §14 law-forced validation
- evidence: list maps external entries through DeploymentEnvironmentInfo.make, whose name requires S.String. part-1/sol's environments=[{name:42}] HTTP probe defects in the lab; the oracle returns that invalid value successfully. The law-forced model addition needs a typed boundary rather than restoration of unchecked oracle success.
- failure: A malformed environment entry becomes a defect instead of GitHubError.decode.
- fix: Validate each selected environment wire shape and decode DeploymentEnvironmentInfo effectfully with GitHubError.decode('DeploymentEnvironment.list', ...). Preserve valid result representation and order; add wrong-type-name regression in DeploymentEnvironment.test.ts. Central codemod records the forced validation change.
- seats: part-1/grok:grok-3-9; part-1/sol:sol-3-2 [environment projection]

### req-10 — Decode Git Database commit references

- file: scratchpad/effected/github/GitCommit.ts:383
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; standards/ARCHITECTURE.md principle 5; §14 law-forced external-boundary validation
- evidence: part-1/sol's scripted GitCommit.get response with parents=[{sha:null}] returned fails=false, dies=true, Schema validation failed in lab and oracle. CommitRef.make receives unchecked commit.sha, commit.tree.sha and projected parents; unsafe nested reads precede construction.
- failure: Malformed Git Database commit data becomes a defect instead of the service's GitHubError.
- fix: Decode selected wire fields, including tree and parent SHA shapes, before projection; decode CommitRef effectfully and map failures to GitHubError.decode('GitCommit.get', ...). Add malformed-parent and missing-nested-object cases in GitCommit.coverage.test.ts.
- seats: part-1/sol:sol-3-2 [Git Database commit projection]

### req-11 — Validate branch ref SHA before returning typed success

- file: scratchpad/effected/github/GitBranch.ts:435-464
- class: type-safety   severity: required
- standard: D11; standards/effect-first-development.md EF-3; standards/ARCHITECTURE.md principle 5; §14 law-forced boundary validation
- evidence: part-1/sol's real-client HTTP-200 {object:{sha:42}} probe returned 42 from sha and Some(42) from shaOption despite string/Option<string> declarations. readRef currently performs no decoding, and exists treats that Some as existence.
- failure: Successful service results violate their public types and malformed refs can be reported as existing.
- fix: Decode {object:{sha:S.String}} inside readRef and map errors to GitHubError.decode(operation, ...), preserving notFound recovery. Add wrong-type SHA and missing-object regressions for sha/shaOption/exists in GitBranch.test.ts.
- seats: part-1/sol:sol-3-4

### req-12 — Validate base64 file content before string operations

- file: scratchpad/effected/github/GitHubContent.ts:186
- class: bug   severity: required
- standard: D9/D11; standards/effect-first-development.md EF-3/EF-31; §14 verified upstream-bug
- evidence: part-1/sol's HTTP-200 {type:'file',encoding:'base64',content:null} probe returned fails=false, dies=true from content.content.replace in lab and oracle. Round-2 req-08 protected unsupported-encoding rendering, not this base64 content branch.
- failure: getFile/getFileOption defect on malformed content instead of returning typed decode errors.
- fix: Validate the outer response before property access and the base64 branch's content as a string before replace. Map malformed data to GitHubError.decode while preserving existing directory/non-file/unsupported-encoding rejection behavior. Add null/omitted/wrong-type content cases through both file APIs in GitHubContent.coverage.test.ts.
- seats: part-1/sol:sol-3-5

### req-13 — Traverse older issue cross-reference timeline pages

- file: scratchpad/effected/github/GitHubIssue.ts:179,536-543
- class: bug   severity: required
- standard: D9/D11; §14 verified upstream-bug; isCrossReferencedBy's requested-PR existence contract
- evidence: The document asks timelineItems(last:50) without pageInfo or a before cursor; the method checks only those nodes. part-1/sol's two-page probe supplied 50 recent other-PR references plus hasPreviousPage/startCursor and a matching earlier page; lab and oracle returned false after one request.
- failure: An ordinary issue timeline with more than 50 cross-reference events can incorrectly report an older matching PR absent.
- fix: Add pageInfo and a before cursor to the owned query/schema and walk previous pages until a match or exhaustion. Preserve the CROSS_REFERENCED_EVENT filter and early match. Add a preceding-page match regression in GitHubIssue.coverage.test.ts.
- seats: part-1/sol:sol-3-6

### req-14 — Complete attestation cursor pagination

- file: scratchpad/effected/github/Attestation.ts:255
- class: bug   severity: required
- standard: D9/D11; §14 verified upstream-bug; listForSubject contract; surviving round-2 req-03
- evidence: The live source still performs one requestDecoded and maps listed.attestations. part-1/fable identifies the unchanged single-page path; round-2 req-03 supplies the stronger lab/oracle two-page Link probe (calls=1, only first-page URL). The round-2 commit diff contains no Attestation repair, so this is a surviving evidenced defect rather than a closed item repeated without evidence.
- failure: Attestations after the first cursor page are missing from the result.
- fix: Use existing client pagination machinery for this route and owned ListResponse/entry decoding before projection. Preserve API-version headers, predicate filter, document order and initial notFound/422 empty-list recovery. Add a two-page Link/cursor regression in Attestation.coverage.test.ts; keep shared pagination helpers read-only.
- seats: part-1/fable:fable-3-2

### req-15 — Preserve own permission keys during normalization

- file: scratchpad/effected/github/GitHubApp.ts:810
- class: bug   severity: required
- standard: D9/D11; §14 verified upstream-bug; TokenPermissions own-grant contract
- evidence: normalizePermissions assigns out[key]=value on an ordinary object. For the own enumerable '__proto__' key from JSON input, this invokes the inherited setter instead of creating an own grant. TokenPermissions.fromGitHub uses R.fromEntries and retains this key, but normalization drops it first. The oracle shares the assignment.
- failure: An own '__proto__' permission disappears from the installation token.
- fix: Filter entries to string values and build the permission record with R.fromEntries so every accepted key becomes an own property. Add an own '__proto__' plus ordinary-grant regression through token normalization in GitHubApp.test.ts.
- seats: part-1/fable:fable-3-3

### req-16 — Own an observed minted credential before interruptible postprocessing

- file: scratchpad/effected/github/GitHubApp.ts:752-766,841-844
- class: bug   severity: required
- standard: D9/D11; §14 bug in rotation repair; standards/effect-first-development.md EF-26/EF-31
- evidence: rotate restores the entire app.token effect, including the HTTP request and subsequent InstallationToken decoding, and stores owned only after that effect returns. Thus the mask protects the returned-token handoff but not the observed raw response's postprocessing inside app.token. Effect's run loop may yield between operations, so interruption before the decoder returns can discard an observed credential while owned is empty. This is separate from the finalizer's permit deadlock.
- failure: A replacement credential received from GitHub can remain unowned if interruption terminates token postprocessing; scope cleanup then cannot revoke it.
- fix: Separate interruptible mint HTTP from masked ownership transfer of a returned raw credential, registering cleanup before interruptible decoding/client construction. Track a revocable observed token even if decoding or construction does not finish. Keep stalled HTTP abortable and do not claim revocation of a token never observed by the client. Add a deterministic cancellation-after-response regression in GitHubApp.test.ts proving observed-token revocation.
- seats: part-1/fable:fable-3-4

### req-17 — Reject invalid rate-limit snapshots without discarding responses

- file: scratchpad/effected/github/internal/octokit.ts:156; scratchpad/effected/github/GitHubError.ts:600-604
- class: bug   severity: required
- standard: D9/D11; §14 verified upstream-bug; standards/effect-first-development.md EF-3/EF-31; residual of round-2 req-11
- evidence: part-3/sol's scripted REST success, pagination success, REST 429 and GraphQL 429 probes with complete remaining=0/limit=5000/reset=9007199254740992 headers all reported Failure, fails=false, dies=true. part-2/sol additionally probed reset=1e308. headerNumber accepts finite unsafe integers; readRateLimitHeaders passes them to record's throwing RateLimitSnapshot.make, whose fields require S.Int. Round-2 delay saturation does not protect snapshot construction.
- failure: Invalid metadata turns successful payloads into defects or defects before HTTP failure classification, replacing typed GitHubError/GitHubGraphQLError and bypassing retries.
- fix: In internal/octokit.ts record, validate the complete parsed snapshot nonthrowingly against RateLimitSnapshot. Leave the previous Ref value unchanged and succeed with void when invalid; update it only with a valid snapshot. Keep header parsing, retry-delay saturation and classification intact. Add complete-triple unsafe-integer/overflow REST, pagination and GraphQL regressions in transport.test.ts and internal/octokit.coverage.test.ts, including prior-snapshot retention. No headers.ts or Resilience.ts edit is needed.
- seats: part-2/grok:grok-3-1; part-2/sol:sol-3-3; part-3/sol:sol-3-1

### req-18 — Decode latest-semver candidates before fallible access

- file: scratchpad/effected/github/GitTag.ts:396-405
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; standards/schema-first-development-prompt.md boundary rule; §14 law-forced validation
- evidence: part-2/sol's real-client probes with name=42, version-shaped name plus sha=null, and missing commit all produced fails=false, dies=true in latestSemver. String operations, nested SHA access and SemverTag.make occur inside Effect.sync; the oracle has the same unchecked path. The repaired list decoder and green line coverage do not cover latestSemver's failures.
- failure: Malformed tag data bypasses latestSemver's GitHubError channel as a defect.
- fix: Validate the entry's string name before prefix/extraction, preserve prefix/non-version/prerelease short-circuit skips, and validate nested commit SHA for selected candidates before effectful SemverTag decoding. Map validation failures to GitHubError.decode('GitTag.latestSemver', ...), retaining one-pass selection and valid ordering. Add wrong-name/null-SHA/missing-commit typed-failure cases in GitTag.test.ts; do not force SHA validation on candidates the upstream algorithm skips.
- seats: part-2/grok:grok-3-2; part-2/sol:sol-3-2; part-2/fable:fable-3-1

### req-19 — Normalize tag upsert creation exactly once

- file: scratchpad/effected/github/GitTag.ts:346
- class: bug   severity: required
- standard: D9/D11; §14 verified upstream-bug; GitTag.upsert create-or-reset contract
- evidence: part-2/sol's lab/oracle scripted probe with tags/tags/foo showed direct create posting refs/tags/tags/foo, while upsert posted refs/tags/foo and its already-exists fallback patched tags/tags/foo. rejectEmpty followed by create(short, sha) normalizes twice on creation but once on reset.
- failure: Creation and reset address different refs and can create or overwrite the wrong tag.
- fix: Pass the original tag to create and retain the once-normalized short for reset. Add successful-create and already-exists-fallback regressions with tags/tags/foo in GitTag.test.ts.
- seats: part-2/sol:sol-3-1

### req-20 — Exclude undefined settings from writes and applied-key reports

- file: scratchpad/effected/github/GitHubRepository.ts:581
- class: bug   severity: required
- standard: D9/D11; §14 verified upstream-bug; applySettings/AppliedSettings keys-actually-sent contract
- evidence: part-2/sol's real-client probes of {has_issues:undefined} and {has_discussions:undefined} made REST/GraphQL requests but reported those keys applied although serialization omitted their values. The latter also read the repository and sent a mutation containing only repositoryId. The oracle routes and records the same undefined entries.
- failure: A configuration containing only absent values triggers unnecessary writes and falsely reports settings applied.
- fix: Skip undefined-valued entries before routing or recording their keys, preserving false, null and explicitly supplied values. Add REST-only and GraphQL-only undefined-input regressions asserting empty reports and zero HTTP requests in GitHubRepository.test.ts.
- seats: part-2/sol:sol-3-4

### req-21 — Validate nested tag records before the existing list decoder

- file: scratchpad/effected/github/GitTag.ts:335
- class: effect-idiom   severity: required
- standard: D11; standards/effect-first-development.md EF-3/EF-31; §14 law-forced boundary validation; residual of round-2 req-13
- evidence: list reads entry.commit.sha while constructing the input to S.decodeEffect(TagRef). An absent or null commit throws before the decoder or its mapError can run. The existing malformed-tag matrix covers an object with sha=null, not a missing/null commit, so its green typed-failure tests miss this path.
- failure: A malformed nested commit kills GitTag.list as a defect rather than GitHubError.decode('GitTag.list', ...).
- fix: Decode the selected page-element wire shape before nested access, then feed validated fields into the existing TagRef decoder and error mapping. Preserve list's existing decode-before-prefix behavior and ordering. Add null/missing-commit typed-failure cases in GitTag.test.ts.
- seats: part-2/fable:fable-3-2

## Backlog

None. No seat finding is solely documentation, coverage, test-canon work, outside D11 or dependent on a repository-level write outside the allowed port surface. Regression tests accompanying demonstrated runtime defects remain part of the required fixes.

## Handled by the deviation codemod

None of the 33 seat records asks only to record a law-forced change. Requests to record the actual repairs retained above are downstream central bookkeeping, not additional required findings or group assignments. The codemod owns per-module/per-class deviation and adjusted-test records, added exports and README Port notes.

## Rejected

None of the distinct findings lacks evidence or a concrete in-surface fix, contradicts an operator ruling, or merely restates a gate-enforced check. The retained boundary/cleanup defects show paths that green gates and existing regressions missed. Duplicate seat records are merged rather than counted as rejected. The incorrect Symbol-coercion subclaim in part-1/grok:grok-3-1 is discarded; the independently probed uncoercible inputs retain req-01.

