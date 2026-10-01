# Admission journal snapshot — 2026-10-01 (organic withdrawal and resubmission evidence)

Why (graduation audit 2026-10-01, steward ruling the same day): the canonical admission
journal is a rolling window that keeps only the newest 200 admissions
(`RETAINED_ADMISSIONS = 200`, `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:51`; the trim runs on every append). At the
snapshot instant it held the only organic evidence for the run-4 docket's Queue D duties
(`otp:bind-request-termination:001`, `otp:bind-admission-request:001`): 46 `admission-withdrawn`
rows and 1 `admission-ticket-evicted` row (queued-submitter-death), each with its
`admission-enqueued` row, including one withdrawn attempt that was re-enqueued (a
resubmission chain). The first withdrawal had 31 admissions before it and the ticket eviction
59, so at the measured 2.8 admissions/hour the window would have dropped them within roughly
11 and 21 hours. No audit lane, docket lane or run generator captured this data; this
snapshot freezes it before the run-4 pin, following the 2026-08-27 precedent beside it.

Source: the canonical admission root's `journal.ndjson`
(`~/.beep/runtime/beep-admit-uid-<uid>/`, resolved the way the run-3b fleet-corpus ETL's
`admission_sources()` resolves it). Copied byte-for-byte at 2026-10-01T12:20Z.

Contents (payload gitignored by `.gitignore` rule `journal-snapshot-*/*/` — rows carry pids,
process-start instants and origin keys; this repo is public. Manifest + digests are committed):

- `canonical/journal.ndjson` — 695 rows, 0 malformed (payload)
- `SHA256SUMS.txt` — digest of the payload (committed; proves later bytes unchanged/evicted)

Census at snapshot (per `_tag`):

| `_tag` | rows |
| --- | --- |
| admission-enqueued | 249 |
| admission-admitted | 200 |
| admission-released | 199 |
| admission-withdrawn | 46 |
| admission-ticket-evicted | 1 |

Schema versions: `yeet-admission-journal/v3` 495 rows, `yeet-admission-journal/v1` 200 rows.
Window (earliest enqueue/admit instant → latest instant in any row):
2026-09-28T11:41:11Z → 2026-10-01T12:12:44Z. Lease evictions in window: 0.

Use: the run-4 pin reads this snapshot as an organic input for Queue D (eviction and
withdrawal evidence) instead of the live journal; the live journal is also
re-censused at the pin. Interim snapshot only — it is not a run4-fleet corpus pin and carries
no generator digest.
