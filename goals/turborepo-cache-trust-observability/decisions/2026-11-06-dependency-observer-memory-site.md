---
title: "Locate the dependency observer memory refusal"
date: 2026-11-06
kind: checkpoint
lane: "codex/cache-dependency-memory-site-20261106"
reversal: "Revert the optional refusal-location fields and their tests; retain the actual failed observation and its artifact identities."
---

The released-source inspection passed on run 42209083425, but dependency diagnosis refused with memory-limit. Add only a fixed module family, line number and Python version to that refusal. Preserve private exception/frame data and the original minimal refusal if metadata allocation also fails. Keep the 256 MiB process cap and all archive/digest/publication bounds unchanged. Hosted CI must prove the new privacy regressions; two successful real diagnostics and every whole-goal acceptance criterion remain pending.
