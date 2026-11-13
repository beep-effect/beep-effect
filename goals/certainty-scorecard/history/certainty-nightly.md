# Certainty nightly record

One row per scored UTC day from `.github/workflows/certainty-nightly.yml` on main (decision
`certainty-nightly-workflow`). Aggregates and run ids only: no head list, no branch name. Each recorded day's
aggregates-only summary is copied beside this file as `certainty-nightly/<day>.md`, because the run's artifact
expires after 90 days.

## Counting rule

- A day counts toward P2's seven when a run on main for that day concluded `success` and its `report.json` has
  `"certified": true`.
- A refused, failed or missing night breaks the streak unless a re-run of the same day certifies it: a new
  dispatch (`gh workflow run certainty-nightly.yml --ref main -f day=<day>`) or a GitHub re-run of the refused
  run (`gh run rerun <run-id>`). The row for that day says `yes` under Re-run and gives the run id and attempt
  number that counted; the refused or dropped scheduled night keeps its own row.
- A main verdict that lands after the night's capture is picked up only by a re-run of that day; nothing re-polls
  main inside the 7-day horizon (PLAN.md execution notes).
- The first countable day is 2026-11-14, the first whole UTC day after both baseline breaks (d8326d55935 and
  3e822c71c5, both 2026-11-13).

## Recording a night

```sh
gh run list --workflow certainty-nightly.yml --branch main --limit 10 \
  --json databaseId,attempt,conclusion,event,createdAt
gh run download <run-id> --name certainty-report-<day>-attempt-<n> --dir ~/.cache/beep/certainty-nightly/<day>
gh run view <run-id> --json jobs --jq '.jobs[] | {name, startedAt, completedAt}'
jq '{certified, refusals, requestCount}' ~/.cache/beep/certainty-nightly/<day>/report.json
mkdir -p goals/certainty-scorecard/history/certainty-nightly
cp ~/.cache/beep/certainty-nightly/<day>/summary.md goals/certainty-scorecard/history/certainty-nightly/<day>.md
```

Job minutes are the `Certainty Nightly Report` job's `completedAt` minus `startedAt`, rounded up to whole
minutes as GitHub bills them. A row for a night that does not count keeps its conclusion and refusal, so the
streak can be audited.

## Nights

| UTC day | Run id | Attempt | Event | Re-run | Conclusion | Certified | GitHub requests | Job minutes | Code heads n / misses / superseded | SLO p50 / p95 | Main verdict rate |
| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
