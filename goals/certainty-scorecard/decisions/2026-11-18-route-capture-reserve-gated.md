---
title: "Route capture 2026-10-31..11-17 as a reserve-gated background reader"
date: 2026-11-18
lane: "t3/certainty-scorecard-route-capture-2026-10-31"
reversal: "Revert the slice-12 PR: capture reads unmetered by hand again, RECEIPTS.json points back at e840ea6d…, and the new corpus pin is deleted."
---

ROUT-05 slice 3 (PLAN slice 12). `beep ci route capture` now runs as a background reader under `github-budget-ledger`'s reserve signal instead of by hand. The new `RouteReadBudget` (`packages/tooling/tool/cli/src/commands/Ci/RouteBudget.ts`) does three things before and around every GitHub call the corpus makes:

- It reads the ledger's `reserve` for the `core` bucket of the identity the capture's responses carry. While that bucket is `Below` its floor, the call waits for the bucket's reset (at most 60 minutes, the corpus's existing rate-limit bound). A longer wait fails with `corpus-fetch`, and the per-day checkpoint resumes the next run. Until a response names the identity, any `user:` identity's `core` bucket below its floor holds the call, because the capture reads as this host's `gh` login. `Clear` and `Unknown` admit (ledger ruling A7).
- It counts every response the transport hands to `RateLimitSink`, through a counting sink that forwards to the ledger's sink, so the ledger still records the rows. These are the responses that carry rate-limit headers, pagination pages and `GET /rate_limit` included; a response without them (some 5xx answers) is not counted, the same set the ledger records. The command prints `capture metered N GitHub response(s) as <identity>; waited W time(s) for the core reserve` on stderr, on failure too.
- Admission is per logical call (one day's list, or one run view with its job pages, fallback pages and retries), so a call admitted just above the floor can cross it by its own pages. At eight concurrent calls that is a few dozen requests at most, typically eight to sixteen, and every later call waits for the reset. In the live capture its own reads never took the bucket below 833.
- Without a ledger (`BEEP_GITHUB_LEDGER` off) the calls are counted and never held, and the line says unmetered.

`routeGhRunner` used to re-provide its build-time context over the caller's, which replaced the counting sink. The build context now fills in only what the caller's context lacks. The REST runner retries a jobs read that fails at the transport (a 502) once in pages of 30, because run 42669948388 answers 502 on every 100-job page (decision `per-attempt-page-fallback`). The admission gate is `packages/tooling/tool/cli/test/ci-route-budget.test.ts`, which covers the forwarding count, the clear admit, the hold until reset, the hold before the identity is known and the refusal past an hour, plus a 502-then-30 case in `ci-route-corpus.test.ts`.

The capture ran 2026-11-17T23:54Z..2026-11-18T01:20Z in five checkpointed bursts. The receipt (`goals/verification-route/research/corpus/RECEIPTS.json`) now covers 2026-09-01..2026-11-17: 10,435 runs, 10,424 heads, sha256 `d8328a6dd060…`, 3.4 MB. That is 4,107 runs beyond the old receipt, 4,243 created on or after 2026-10-31 (the old capture had already pinned 136 finished runs of its open day). Today, 2026-11-18, stays open by design. Spend:

- The 2026-10-31 burst read 271 runs before the counter fix, so it was not counted.
- The four later bursts read 263, 5,436, 53 and 2,530 times: 8,282 metered responses for about 3,970 runs, about 2.1 per run.
- The second burst stopped on the run-42669948388 502 with `user:kriegcloud` core at 833 of 5,000, above the 750 floor. Other readers then took the bucket to 6 while the resumed capture held (53 reads, 8 reserve waits) until it was stopped and resumed with the pre-identity hold. The last burst waited twice and finished with core at 2,021.

Census on the new corpus (`beep ci route census`, 8,321 pull-request heads, 0 unresolved, unknown atom share 1.7%): conservation holds. Lane, support and unknown jobs are 276,172 + 27,669 + 11,411 = 315,252, and milliseconds 82,970,502,000 + 1,274,766,000 + 2,107,879,000 = 86,353,147,000. Unknown is 2.4% of job time. On the new window alone (153,209 jobs, 622,207 min), unknown is 0.84%, two groups:

- `Shadcn Lint` (2,815 jobs, 5,243 min): a real lane until #3117 folded it into Repo Sanity on 2026-11-12, so it is a retired name with no descriptor, like `Knip` and `Heavy / Effect Diagnostics` on the old window.
- Two unexpanded conditional names (`needs.admission.outputs.legacy_coverage …`, `… legacy_integration …`): 1,012 skipped jobs of about 0 minutes.

Both groups are reported, not mapped, under decision `job-attribution-classes`. 4,439 failed jobs in the new window carry steps; `tasks` stays absent until slice 11b.

The legacy `hosted-runs.ndjson.gz` (sha256 `e840ea6d…`) stays beside the new pin. The completed verification-route packet and its 2026-10-31 census cite it, and the 242-skipped replay gate restores it with the old receipt. The intermediate per-day pins the capture wrote were deleted before commit.

Rejected: checking the reserve once per day, because a weekday costs about 550 requests and a once-per-day check could start one 100 requests above the floor and cross it; a request bound of its own, because the ledger owns the threshold (decision `shared-rest-budget`, D27); dropping the legacy corpus file, because that breaks the cited sha and the restore gate.
