---
title: "P2: live standards and the cache baselines stop spelling the retired package name; the doctor is not widened"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Restore the package name in chapter 16, the glossary and the baseline review reason, and extend the delete-package history predicate to cache-baseline review fields instead."
---

The final gate of research/2026-11-20-p2-design.md section 10 needs delete-package --allow-stale-packets --check to print clean. After the doctor fix of preparatory PR a it still found residue in 24 live files, all written by this lane: chapter 16 and the glossary named the retired package, and the review reason of the commit-13 cache request, which bun run beep cache baseline copies into every subject it stamps, spelled it in 22 baseline files. Chapter 16 and the glossary now say the former provenance package; decision p2-delete-package-doctor-reads-dated-records-as-history already holds that these chapters stay live. The baselines are re-stamped through the repo route with docs/reports/tksr-p2-l1-reason-cache-review-2026-11-22.md and its request; the diff touches only the review block of each file, and cache audit and cache-policy read 0 blocking findings. Widening the doctor's history predicate to cache-baseline reason fields was not taken: a baseline file is live configuration, and a predicate that skips part of a live file would hide a real reference there. The --check now prints clean.
