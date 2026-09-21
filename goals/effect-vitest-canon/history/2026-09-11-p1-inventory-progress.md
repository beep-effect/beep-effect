# P1 inventory progress — 2026-09-11

This is a progress snapshot, not P1 acceptance. Benjamin authorized P1 after
PR1067 merged; P2 still requires acknowledgement of the completed inventory.
The branch starts from main `662823dd960367046ba7d73dd8fd25d15782865a`.

## Reviewed source-audit batches

The first three batches cover 31 of 1,122 census files across six packages.
All four lens reads and source hashes are recorded. Their 138 rows include
33 proposed findings and 105 coverage-only records. The public decoder accepts
the numeric findings but rejects the charter's `NONE` coverage IDs. A narrow
schema correction is prepared privately and remains unapplied during the
baseline source freeze. No complete lens inventory is accepted yet.

| Package | Files | Resource rows | Flake rows | Property rows | Observability rows | Proposed findings | Coverage only |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| @beep/fc-runs | 1 | 1 | 1 | 1 | 1 | 1 | 3 |
| @beep/todox | 1 | 1 | 1 | 1 | 1 | 0 | 4 |
| @beep/types | 1 | 1 | 1 | 1 | 1 | 0 | 4 |
| @beep/identity | 12 | 12 | 12 | 19 | 16 | 22 | 37 |
| @beep/ontology-config | 1 | 1 | 1 | 1 | 1 | 1 | 3 |
| @beep/utils | 15 | 16 | 15 | 17 | 15 | 9 | 54 |

These are row counts, not independent defect counts. Property, observability and
detector rows may describe distinct risks at the same occurrence. The first
batches preserve native filesystem and layer-construction failure subjects;
they do not authorize automatic mechanical replacement. Data is the next
five-file audit batch.

## Timing evidence

123 successful, schema-normalized Node command baselines have been adopted
with matching census test-file coverage, retained raw hashes, worker settings,
process limits and host-load context. Two successful reports await a review of
omitted census files. CIops, effect-drizzle and QA-capture have retained failed
attempts; their distinct runtime/compatibility causes are recorded in
`ops/inventory/timings/baseline-failures.json`. Repo-cli and the final packages
remain in collection at this snapshot. No failed run is an accepted baseline.

Worker settings are documented in `ops/inventory/timings/worker-settings.json`.
Before/after comparisons must preserve those settings and runtime. Measured
wall time is separate from reporter duration and receives no numerical load
adjustment. These baselines do not substitute for compiler, coverage or package
verification.

## Hosted history

`ops/inventory/hosted-history-summary.json` covers the frozen window from
2026-08-12T23:06:31Z to 2026-09-11T23:06:31Z. All 527 failed workflow records
have complete job listings: 12,348 job records and 913 failed-job dispositions.
560 relevant logs are available; 21 returned HTTP 404 and one downloaded job
lacks a visible primary cause. Metadata completeness does not imply full causal
attribution. No failure is classified as flaky solely from these observations.
The summary retains package job links and explicit evidence gaps; raw logs stay
private. Root verified 1,637 continuation artifacts and preservation of the
176 original evidence files.

## Remaining P1 work

Finish the baseline collection and coverage-boundary review, apply and prove
the narrow inventory-schema correction, audit the remaining files through all
four lenses, and enrich package digests with accepted timings and qualified
history. Then run full inventory validation and the required Grok review of
40 sampled files. Benjamin's inventory acknowledgement remains the gate to P2.
The 90 inherited-main detector additions are retained with an unchanged baseline.
