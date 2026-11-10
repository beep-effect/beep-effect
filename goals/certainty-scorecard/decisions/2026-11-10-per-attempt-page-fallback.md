---
title: "Per-attempt job reads fall back to 30-job pages before a run is stamped partial"
date: 2026-11-10
lane: "claude/jovial-sammet-084b0a"
reversal: "Drop the 30-job retry in collectCiWorkflowRunAttemptJobs; exhausted 100-job pages then stamp the attempt partial directly."
---

Live probes on 2026-11-10: run 42646019844 returned all 180 jobs as three per-attempt reads of 60 after transient 502s the retries absorbed, and the per-attempt union of Heavy Admit 42655574858 equals its `filter=all` listing (22 of 22 `(id, run_attempt)` tuples). Run 42669948388's attempts 2 and 3 still returned 502 on every one of five 100-job reads, while the same attempts read cleanly at `per_page=30` and 50. The reader therefore retries an exhausted attempt once in pages of 30 and only then records a partial read. A partial read is never dropped: the window census refuses it without `--preview` and stamps it with the existing preview banner (new guard reason `partial-read`), and the certainty report marks the head api-partial and refuses certification. Rerun attempts list their unchanged jobs again with the original timestamps; runner-minute sums de-duplicate those copies by (name, started_at, completed_at) within the run.
