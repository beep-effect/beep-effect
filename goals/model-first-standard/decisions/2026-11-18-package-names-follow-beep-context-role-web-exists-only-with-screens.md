---
title: "Package names follow @beep/<context>-<role>; web exists only with screens"
date: 2026-11-18
lane: "claude/model-first-standard-doctrine-b72d36"
reversal: "Rename the packages in the standard and the scaffolder plan, or require web for every context"
---

The four packages are `@beep/<context>-contract`, `-model`, `-host` and `-web`, the same `@beep/<slice>-<role>` convention legacy slices use, so package metadata, identity composers and Fallow zones keep one naming rule. `contract`, `model` and `host` exist for every context; `web` exists when the context has screens, as in the prototype, where `authority` and `runs` have no web package (explorations/model-first-slices/DECISIONS.md D3). The smallest legal slice in chapter 13 is therefore three packages.
