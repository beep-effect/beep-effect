---
title: "Junie ran out of quota mid-T2; the public partition moves to Codex gpt-6.1-sol as well"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "Re-run remaining public jobs with --profile claude or junie once quota returns; per-artifact records keep completed reads"
---

Junie's JetBrains quota returned 477 Out of quota on 2026-11-07 after a handful of reads (the runner recorded 239 failed launches before the batch stopped making progress; the quota signal appeared only in Junie's log file, now detected and treated as a pause). The next pool is claude-opus-5-5 children, which recovered from this morning's rate limit, but 784 Opus reads would draw the scarce Anthropic weekly pool that also runs the orchestrating session, and that pool already tripped a rate limit today. The public partition therefore runs on the chain's step 2, Codex gpt-6.1-sol medium (codex-sol profile), beside the private partition. Every reading records its ModelRun, so pool provenance stays per finding. Rejected: buying JetBrains credits (operator-only spend).
