### sol-3-1
- file: scratchpad/effected/github/GitTag.ts:346
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9/D11 and §14, verified upstream bug; `GitTag.upsert` create-or-reset contract.   evidence: A read-only scripted-HTTP probe with `"tags/tags/foo"` showed `create` posting `{"ref":"refs/tags/tags/foo","sha":"a"}`, while `upsert` posted `{"ref":"refs/tags/foo","sha":"a"}`. When that POST returned an already-exists error, `upsert` then PATCHed `/git/refs/tags/tags/foo`. The pinned oracle has the same `rejectEmpty` followed by `create(short, sha)` sequence.
- failure: `upsert` normalizes the tag once itself and again inside `create`. For names whose normalized form still begins with `tags/`, creation targets a different ref from direct creation and from the reset fallback. It can create the wrong tag or check one tag’s existence and overwrite another.
- fix: Pass the original `tag` to `create`, retaining the once-normalized `short` for `reset`. Add regressions for both successful creation and the already-exists fallback using `"tags/tags/foo"`.

### sol-3-2
- file: scratchpad/effected/github/GitTag.ts:398
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-3/EF-31; standards/schema-first-development-prompt.md “Effect owns fallibility and runtime boundaries”; D11 and §14 law-forced boundary validation.   evidence: Read-only probes through the real client showed `latestSemver()` returning `hasFails=false, hasDies=true` for `{name:42, commit:{sha:"abc"}}`, `{name:"v1.0.0", commit:{sha:null}}`, and `{name:"v1.0.0"}`. The defects were respectively `tag.lastIndexOf is not a function`, schema validation failure, and access to missing `entry.commit.sha`. The pinned oracle retains the same unchecked extraction and throwing `SemverTag.make` path. Round-2 req-13 repaired `list`; these probes exercise the separate `latestSemver` path.
- failure: Malformed external tag data bypasses the advertised `GitHubError` channel. String operations and nested property access occur before validation, and construction of the selected semver tag can throw.
- fix: Decode the tag wire record, including its nested commit SHA, before prefix matching or version extraction. Map validation failures to `GitHubError.decode("GitTag.latestSemver", ...)` and construct the selected result from validated fields. Add typed-failure regressions for these three responses.

### sol-3-3
- file: scratchpad/effected/github/GitHubError.ts:603
- class: bug   severity: required
- standard: standards/effect-first-development.md EF-3/EF-31; D9/D11 and §14, verified upstream bug.   evidence: While tracing the focused `internal/headers.ts` parser into snapshot construction, a read-only transport probe supplied the complete triple `x-ratelimit-remaining: 0`, `x-ratelimit-limit: 5000`, `x-ratelimit-reset: 1e308`. Both HTTP 200 and HTTP 429 produced `hasFails=false, hasDies=true`, with schema validation failing at `resetEpochSeconds`. `headerNumber` accepts this finite, unsafe integer; `readRateLimitHeaders` returns it; `record` passes it to `RateLimitSnapshot.make`, whose field requires `S.Int`. The pinned oracle has the same unchecked snapshot path. Round-2 req-11 tests oversized reset delays without the complete snapshot triple.
- failure: Invalid rate-limit metadata turns a successful response into a defect, or replaces a recoverable HTTP rate-limit failure with a defect before classification. Saturating retry-delay milliseconds does not protect snapshot construction.
- fix: Validate the complete parsed triple against `RateLimitSnapshot` through a nonthrowing schema path before recording it. Ignore an invalid snapshot and retain the previous snapshot, while preserving the existing oversized-delay saturation and HTTP classification. Add HTTP 200 and HTTP 429 regressions with all three headers present.

### sol-3-4
- file: scratchpad/effected/github/GitHubRepository.ts:581
- class: bug   severity: required
- standard: `GitHubRepository.applySettings` and `AppliedSettings` document that returned keys identify fields actually sent; EFFECTED_PORT_GOAL.md D9/D11 and §14, verified upstream bug.   evidence: A read-only real-client probe of `applySettings({has_issues:undefined})` issued a PATCH with an empty body but returned `{rest:["has_issues"], graphql:[]}`. `applySettings({has_discussions:undefined})` issued a repository GET and GraphQL mutation whose input contained only `repositoryId`, yet returned `{rest:[], graphql:["has_discussions"]}`. The pinned oracle likewise routes and records every entry without excluding `undefined`.
- failure: Schema-valid inputs to the open settings map report settings as applied even though serialization omits their values. An entirely absent configuration also causes unnecessary writes and, on the GraphQL path, an extra repository read.
- fix: Skip entries whose value is `undefined` before routing them or recording their keys. Preserve `false`, `null`, and other explicitly supplied values. Add regressions asserting empty reports and zero requests for both REST-only and GraphQL-only undefined settings.

REQUIRED: 4
BACKLOG: 0