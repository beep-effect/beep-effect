# Fleet journal snapshot — 2026-08-27 (pre/post-#870 boundary evidence)

Why (round-2 seat G, BLOCKER "self-erasing experiment"): attempt journals are 50-start
ring buffers; post-#870 yeets evict pre-#870 attempts from the same files. This
snapshot freezes the pre-intervention fleet evidence hours after PR #870 merged
(2026-08-27T19:52:03Z, `debbbb51f7`).

Contents (payload gitignored — verdict messages carry machine paths/pids; this repo is
public. Manifests + digests are committed):

- `<checkout>/<run-dir>/attempts.ndjson` — 245 journals, 28 checkouts, 5.9MB (payload)
- `CHECKOUT_HEADS.txt` — checkout → HEAD (12-hex) + branch at snapshot time (committed)
- `SHA256SUMS.txt` — digest per journal (committed; proves later bytes unchanged/evicted)
- `gh-runs-2026-08-20..28.json` — 200 hosted runs, createdAt/updatedAt window around the
  intervention (payload; `run_started_at` already rewritten upstream, see memory)

Lock-bounce classifier sample: the exact sentence "Another Yeet full proof" appears in
pre-#870 verdict messages (see any `publish:00-head-install-preflight` failure in the
payload); if #870 replaces that text, `kpi_baseline_probe.py`'s `LOCK_SENTENCE`
heuristic dies — re-derive from this snapshot.

Not yet captured (needs a post-#870 checkout): the scheduler's ticket/lease store —
this branch predates `QualityScheduler.ts`; locate and snapshot it after the corpus
rebase or `queueWaitMs` for the intervention window is unrecoverable.
