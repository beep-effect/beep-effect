---
title: "An incomplete main push listing leaves main commits unread, and main is read before the job reads"
date: 2026-11-13
lane: "fix/certainty-main-unread"
reversal: "Revert this PR: main commits then fold to no-run when the listing fails, and the push listing is read after the pull-request job reads again."
---

A 7-day run, `bun run beep ci certainty --since 2026-11-03 --until 2026-11-10`, was refused as api-partial: the default 1,500-request bound ran out during the per-attempt pull-request job reads, before the check.yml push listing was read. The report then folded every main commit to `no-run`, with rate 0 and no partial marker, although the commits had push runs (fda98a2c4bd has push run 42717956683). A `--preview` reader would have taken "not read" as a main verdict rate of 0. Two changes fix this. The push listing, a few pages, is now read before the job reads, so the bound refuses a pull-request job read instead: that head is stamped api-partial, and main keeps its real verdicts. When the listing still does not complete, every main commit gets the new verdict `unread` (`CiCertaintyMainVerdict`), never `no-run`. The main stat then counts them in `unread` and reports no rate. Certification is refused as before.
