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

Contents (raw payload gitignored by `.gitignore` rule `journal-snapshot-*/*/` — rows carry
pids, process-start instants and host checkout paths; this repo is public. Manifest, digests and
the redacted projection are committed):

- `canonical/journal.ndjson` — 695 rows, 0 malformed (raw payload; local-only)
- `journal.redacted.ndjson` — 695 rows, the committed redacted projection (added after the
  PR #1386 review), written at the snapshot root by
  `research/scripts/redact_journal_snapshot.py --write`. Redaction rule (the run-3b corpus
  custody precedent): `pid` and `procStart` are dropped, and each row carries
  `ownerRef = sha256("<pid>:<procStart>:<captureSalt hex>")[:12]` with `ownerRefVariant`
  `pid_pair` on all 695 rows (the ETL labels by identity member, and every row carries
  `pid`). The 200 released and ticket-evicted rows carry no `procStart`, which is written
  `<absent>` (the ETL's `owner_refs_without_start`), so their `ownerRef` cannot join a
  started one. `checkoutRoot` becomes the capture-scoped
  `checkoutRef = sha256("<checkoutRoot>:<captureSalt hex>")[:12]` (35 distinct; equality
  joins kept, no label; a candidate path cannot be confirmed from the committed bytes
  without the local salt). The first render hashed the bare path and was re-rendered
  the same day after the PR #1386 P2 security thread (second addendum in DECISIONS.md);
  the recorded projection digest is the re-render's. Every other member (`_tag`, `schemaVersion`,
  `attemptId`, `nonce`, `originKey`, `kind`, `priority`, `weightTokens`, `branch`,
  `memoryPeakBytes`, `reason`, every `*AtMillis`) is kept verbatim, and an unknown member
  fails the script. One row per line in payload order, keys sorted.
- `canonical/capture-salt.hex` — the capture salt (hex of 32 random bytes); gitignored with the
  payload, local-only, never committed or printed
- `SHA256SUMS.txt` — digests of the payload and the projection (committed; the payload line
  proves later bytes unchanged/evicted, the projection line pins what Queue D reads)

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

Handoff: the run-4 pin (goal `ciops-ontology-pipeline` P1, W3) reads `journal.redacted.ndjson`
by path and by its `SHA256SUMS.txt` sha256 from any clone or detached worktree, after
`research/scripts/redact_journal_snapshot.py --check` passes there. The raw payload stays
local-only; its digest proves the projection's provenance, and where the payload and salt are
present `--check` recomputes the projection byte for byte. A missing or mismatched projection
fails Queue D closed: there is no silent fallback to the `run3b-fleet` pin.
