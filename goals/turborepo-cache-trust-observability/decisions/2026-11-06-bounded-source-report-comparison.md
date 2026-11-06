---
title: "Bound the source report comparison without raising observer limits"
date: 2026-11-06
kind: checkpoint
reversal: "Restore the previous full-report reread; leave all existing memory and archive bounds unchanged."
---

Accepted-source run 42220475249 passed source inspection and returned a memory-limit refusal at observer line 62 on Python 3.9.25. The reported shared read_source allocation requests the full 4 MiB artifact cap; its initial/final phase is not explicitly recorded. See research/dependency-source-reread-refusal-2026-11-06.json. Read the initial declared size plus one growth-detection byte, then compare final source contents in 64 KiB chunks against retained bytes. Preserve exact equality, no-follow regular-file/size checks, truncation/growth refusal, immutable output and all existing 256 MiB/two-pass/time/artifact bounds. Add hosted memory-pressure and byte/length mutation regressions through the existing production-digest suite. No local tests ran; actual full-tree success and both comparable observations remain unproven. No cache qualification, producer approval, signing or production rollout is granted.
