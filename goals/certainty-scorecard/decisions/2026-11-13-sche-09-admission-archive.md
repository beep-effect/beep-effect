---
title: "SCHE-09 slice 1: trimmed admission rows go to a 30-day archive and fold back with the live journal"
date: 2026-11-13
lane: "feat/certainty-sche-09-admission-archive"
reversal: "Revert this PR: the ring drops trimmed rows again and quality scheduler history goes away; delete any journal-archive/ segments left under the admission root by hand."
---

The admission journal keeps 200 admissions (2,400 known rows) and used to drop everything older. Now the locked rewrite in `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` first appends every row the ring trims to `<admission root>/journal-archive/<YYYY-MM-DD>.ndjson` (the UTC day of the trim), under the same journal lock and after an ownership fence, and only then publishes the trimmed journal. The ring, the live journal and its readers are unchanged.

- A copy that fails keeps the trimmed rows in the live journal (one stderr line) until a later rewrite archives them, so a trim never deletes a row it could not copy (the D18 rule that a copy failure blocks deletion).
- Each batch starts with a newline, so a torn tail left by an interrupted append stays on its own undecodable line.
- `readAdmissionJournalHistory` (schemas `AdmissionJournalArchive`, `AdmissionJournalHistory`) folds segments oldest first, then the live journal. It drops byte-identical repeats (a crash between copy and publish, or a retried rewrite) and decodes through `AdmissionJournalReader`, so v1, v2 and v3 rows decode together. Rows it cannot decode are counted, not hidden.
- `bun run beep quality scheduler history` prints aggregates: rows read, admissions, the admitted span and wait p50, p95 and max. `--json` prints every row for the scheduler levers in local-proof-under-ten. First run on the workstation, 2026-11-13: 600 live rows, 200 admissions from 2026-11-09 to 2026-11-13, wait p50 0.1 s, p95 28.4 s, max 279.1 s, no archive segment yet.
- Retention follows the PERIL-10 shape (#3139, #3199). The scheduler reap pass (each promotion tick's repair and `quality scheduler reap --apply`) deletes segments whose UTC day ended at least 30 days ago. It lists names only and never reads a segment on the admission path, and the reap dry run previews the prune with the same predicate. There is no byte cap: at roughly 160 rows a day of about 400 bytes, 30 days is about 2 MB.

Gotchas: checkouts on an older revision still trim without copying, so history is complete only once every live checkout runs this revision. The pressure fields the lever names (capacity tokens and MemAvailable at admit, PSI some10, unadmitted slice memory) are not in this slice. They add reads on the promotion path, and the scheduler record's seats disagree on whether they belong on journal rows or in unit observations (ontology run-3 ruling 9 parked journal capacity stamps). They are PLAN slice 5b.

Rejected: archiving in the reap pass alone (the trimmed rows are gone by then); one immutable file per trim (one file per admission at steady state); folding the archive into `quality scheduler status` (status stays a point-in-time snapshot).
