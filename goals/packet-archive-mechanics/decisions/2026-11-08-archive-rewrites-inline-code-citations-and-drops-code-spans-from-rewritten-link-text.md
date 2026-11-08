---
title: "Archive rewrites inline-code citations and drops code spans from rewritten link text"
date: 2026-11-08
lane: "fix/archive-inbound-citations"
reversal: "Revert this PR; the planner returns to Markdown link destinations only and tombstones render Provides in code spans again."
---

Batch 1 (#2834) and batch 2 (#2968) both reached Heavy / Lint Policy with introduced `knowledge:semantic-delta` findings: 30 and 54. The planner and rewriter read only Markdown link destinations, so plain inline-code citations of removed files were never repointed. Links they did rewrite kept a code span as link text, and the doctor reads that span as a tracked path. Generated tombstone READMEs also listed capability ids such as goals/graph in code spans, which read as repo paths.

The plan now carries an `InboundLinkForm`. Markdown documents contribute plain inline-code citations, including directories the tombstone keeps nothing under. The rewriter emits a link with plain text in both forms, and tombstones list capability ids as plain text.

Citations already on `main` from batch 1 are unchanged; they stay baseline findings. The plan is recomputed per run and receipts do not embed links, so no persisted data needs migrating. Friction receipt: each batch otherwise repeats a hand repoint after hosted Lint Policy reports it.
