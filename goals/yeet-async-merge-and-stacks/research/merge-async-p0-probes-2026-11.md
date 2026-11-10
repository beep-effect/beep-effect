# `merge-async` P0 probes, 2026-11-10

Slice A's P0 research: the three endpoint behaviours `SPEC.md` and the
slice brief left open (the 409 body, a head that moves between request and
execution, and an expired result), plus the error bodies the client has to
decode. Every response below was read live from this repository through
`gh api --include` between 06:00Z and 06:05Z on 2026-11-10.

## How the probes ran

- A throwaway base branch, `probe/merge-async-base`, cut from `main` at
  `6d47006fa1`. No ruleset targets it (`GET rules/branches/<base>` returned
  no rules) and no workflow runs on a pull request to it (every
  `pull_request` trigger names `branches: [main]`), so nothing reached `main`
  and no runner was spent.
- Four docs-only probe PRs against that base, each one commit made through the
  contents API: #3082, #3083, #3084 and #3085 (draft). #3082 and #3084 merged
  into the throwaway base; #3083 and #3085 were closed. The probe branches and
  the base were deleted afterwards.
- Every request sent `merge_action=direct_merge`, `merge_method=squash`, a
  `sha` and `bypass_rules=false`. No probe sent a bypass.

## Answers

### 1. A second request while one is in flight: HTTP 409 with the first request's uuid

Two requests for #3082 sent concurrently, same `sha`. One answered 202, the
other 409, and both bodies name the same uuid:

```json
HTTP 202 {"status":"pending","details":{"message":"Merge request enqueued.","uuid":"d1db8402-…","merge_method":"squash","merge_action":"direct_merge","expected_head_sha":"946279b435…","bypass_rules":false}}
HTTP 409 {"status":"pending","details":{"message":"A merge request already exists for this pull request.","uuid":"d1db8402-…","merge_method":"squash","merge_action":"direct_merge","expected_head_sha":"946279b435…","bypass_rules":false}}
```

The 409 body has the same shape as the 202, so the client attaches to the
in-flight request by polling that uuid. The commit GitHub wrote used the
title of the request that won (`docs: probe 1b`) with the body exactly as
sent: the losing request's title is discarded, so a caller that attaches
must not claim its own title was written.

### 2. A head that moves

- **Before the request** (a stale `sha`, or one that never existed): HTTP 400,
  `{"status":"failed","details":{"message":"Pull request head branch was modified."}}`.
  Nothing is enqueued.
- **Between the 202 and execution**: request for #3083 at `c80637ce60`
  answered 202 at 06:02:09.99Z; a commit pushed through the contents API
  landed at 06:02:11.10Z. Every poll then read
  `{"status":"failed","details":{"message":"Head branch is out of date. Review and try the merge again."}}`
  and the PR stayed open at the new head. The `sha` pin holds after
  acceptance too: a moved head fails, it never merges the newer commit.

### 3. An expired result: no observation, unknown uuid answers 404

The 24-hour expiry cannot be observed inside one session. The nearest
observable state is a uuid GitHub does not hold for that pull request, which
answers 404 with GitHub's ordinary not-found body, both for a made-up uuid and
for a real uuid polled under the wrong PR number:

```json
HTTP 404 {"message":"Not Found","documentation_url":"https://docs.github.com/rest/pulls/pulls#get-the-result-of-an-asynchronous-merge","status":"404"}
```

The client treats a 404 poll as an `expired` outcome: the result is
unknown, never merged. The gate turns it into a hold and the pull request
read decides what happened. Re-run the observation on a uuid older than 24
hours when one is next at hand; until then this row is inferred, not seen.

### Other bodies the client decodes

| Case | HTTP | Body |
| --- | --- | --- |
| Already merged, request again | 200 | `{"status":"merged","details":{"message":"Pull request is already merged.","sha":"788501c606…"}}` |
| Poll after a merge | 200 | `{"status":"merged","details":{"message":"Pull request was merged.","sha":"788501c606…"}}` (stable on six polls over 17 s) |
| Draft PR | 400 | `{"status":"failed","details":{"message":"Pull request is in draft."}}` |
| Closed PR | 400 | `{"status":"failed","details":{"message":"Pull request is closed."}}` |
| No `commit_title` sent | 202, then merged | GitHub wrote its default, `<PR title> (#n)`, as the legacy call did |

A 400 or 409 carries the same `{status, details}` body as a success, so the
client decodes it from the octokit error's `response.data` rather than from
the rendered message. Only 202, 200, 400 and 409 carry that body; any other
status stays a `GitHubError`.

### Timing

#3082: 202 at 06:01:2xZ, `merged` on the first poll three seconds later. The
stack test saw 9 s for a three-layer stack. The gate polls every 2 s for up
to 120 s; a request still `pending` after that holds as unsettled and is
never read as merged.

## What this changes in slice A

- `GithubAsyncMergeOutcome` has five cases: `Pending` (with `inFlight` set
  for a 409), `Enqueued`, `Merged`, `Failed` and `Expired`.
- The gate maps `Failed` to a `merge-failed` hold carrying GitHub's
  sentence, `Expired` and a poll that runs out to `merge-unsettled`, and
  never maps `Pending` or `Enqueued` to merged.
