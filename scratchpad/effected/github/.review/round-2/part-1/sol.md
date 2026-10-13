### sol-2-1
- file: scratchpad/effected/github/GitHubApp.ts:843
- class: bug   severity: required
- standard: D9; section 14; `standards/effect-first-development.md` EF-26, structured concurrency.   evidence: A read-only `bun --no-cache -e` probe built the client with an expired initial token, blocked the replacement mint in a simulated fetch, and interrupted the requesting fiber. After 80 ms it reported `{"interruptFinished":false,"signalAborted":false,"mints":2}`. Interruption completed only after the probe released the mint response. The pinned oracle’s refresh operation has no corresponding `Effect.uninterruptible` wrapper. This is new cancellation evidence concerning the recorded rotation repair.
- failure: Refresh makes revocation, JWT signing and the replacement HTTP request uninterruptible while holding the rotation permit. A stalled mint prevents request cancellation and holds up other callers and scope cleanup indefinitely.
- fix: Keep serialization and atomic ownership transfer, but narrow interruption masking to the state update and finalizer registration. Restore interruptibility around blocking refresh operations, retaining any successfully acquired replacement before interruption can discard ownership. Add a blocked-refresh cancellation regression that verifies the fetch signal aborts, the requesting fiber terminates, and cleanup retains ownership guarantees.

### sol-2-2
- file: scratchpad/effected/github/Attestation.ts:255
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `AttestationShape.listForSubject` promises everything attested about the digest. GitHub’s [List attestations specification](https://docs.github.com/en/rest/repos/attestations#list-attestations) defines cursor pagination and a default page size of 30.   evidence: A read-only probe supplied two HTTP pages, with a `Link: …; rel="next"` header on the first. `listForSubject("abc")` returned `{"calls":1,"urls":["https://example.invalid/first"]}`; the second page was never requested. The pinned oracle also makes only one `requestDecoded` call.
- failure: Listing silently omits attestations beyond the first page. A caller checking for a particular attestation can report absence even though a later page contains it.
- fix: Traverse the endpoint through the existing pagination machinery and decode the collected entries through the owned schema. Preserve the API-version header, predicate filter, ordering and existing empty-result handling. Add a two-page cursor regression and record the upstream-bug deviation under section 14.

### sol-2-3
- file: scratchpad/effected/github/GitHubError.ts:471
- class: bug   severity: required
- standard: `GitHubError.fromOctokit` documents classification of arbitrary throwables as pure and total; `standards/effect-first-development.md` EF-3 and EF-31; D9 and section 14, verified upstream bug.   evidence: Read-only probes against both the lab and pinned oracle called `fromOctokit("probe", { status, message: "failure" }, 0)` with `NaN`, `Infinity` and `404.5`. Every case threw `Error: Schema validation failed`. `P.isNumber` admits these values, but the eventual `GitHubError.status` constructor validates `S.Int`.
- failure: A malformed numeric status escapes the error classifier as a synchronous exception. When classification runs inside the transport Effect, it becomes a defect instead of the advertised typed `GitHubError`, bypassing typed recovery and retry handling.
- fix: Validate the status with a schema-derived integer guard before retaining it. Treat an invalid status as unavailable and classify the original throwable as a transport failure, preserving its cause. Add non-finite and fractional-status regressions and record the upstream-bug correction.

### sol-2-4
- file: scratchpad/effected/github/GitHubError.ts:473
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `saysAlreadyExists` explicitly recognizes duplicate-resource failures from prose, and `GitBranch.upsert` depends on that classification.   evidence: Read-only probes against both revisions classified `{ status: 422, message: "already exists" }` as `alreadyExists`, but classified `{ status: 422, message: "x".repeat(501) + " already exists" }` as `rejected`. `readThrowable` truncates the message before `saysAlreadyExists` searches it.
- failure: Display-message truncation removes routing evidence. A duplicate-resource response whose identifying phrase occurs after the display limit fails an upsert instead of taking its reset or update path.
- fix: Classify against the complete original message and structured validation entries, then sanitize only the reason emitted on the resulting error. Add a regression with duplicate-resource prose beyond the 500-character display limit and record the upstream-bug deviation.

### sol-2-5
- file: scratchpad/effected/github/GitHubCommit.ts:92
- class: perf   severity: required
- standard: D11, measured regression versus upstream and an algorithmic allocation argument.   evidence: The pinned oracle uses `message.split("\n", 1)[0] ?? ""`; the lab calls `Str.split(message, "\n")`, which splits the entire message. A read-only warmed probe used a 1,000,008-byte message with a short subject and 200,000 body lines. Thirty reads took approximately **0.102 ms** for the oracle expression and **116.387 ms** for the lab getter, returning the same subject. The lab allocates an array proportional to the number of body lines; the oracle’s bounded split produces at most one element. This is new performance evidence for the recorded coverage simplification.
- failure: Reading a short subject scans and splits the entire commit body on every access, introducing substantial CPU work and allocation for long messages.
- fix: Find the first newline with `Str.indexOf` and return the preceding slice with `Str.slice`, or the original message when no newline exists. Preserve empty-message and first-line behavior without splitting the remaining body.

### sol-2-6
- file: scratchpad/effected/github/GitHubIssue.ts:500
- class: perf   severity: required
- standard: D11, algorithmic-class argument for auxiliary allocation and early-match work.   evidence: The pinned oracle searches with `comments.find(...)` and stops at the first match. The lab first maps and spreads every comment into a new object, then searches. A read-only probe supplied 10,000 comments with the marker in the first comment and counted body reads in the remaining comments: the lab performed **19,998** tail-body reads; the oracle expression performed **0**. The map also creates 10,000 replacement objects and an additional array. This is new evidence concerning the recorded nullable-body normalization change.
- failure: Even an immediate marker match incurs a full traversal and O(n) auxiliary allocation. The upstream search needs O(1) auxiliary space and examines only the prefix through the first match.
- fix: Normalize each body while searching and stop immediately on a match, retaining the normalized body with the selected comment. Construct the returned `CommentRecord` from that selected value without cloning the entire listing.

REQUIRED: 6
BACKLOG: 0