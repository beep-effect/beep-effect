---
title: "Declare the types lint toolchain hash before qualification"
date: 2026-11-06
lane: "codex/cache-types-key-input-20261106"
reversal: "Remove the hashed environment declaration or revert this change; types lint stays uncached."
---

Prepare the dependency-free types lint computation for the existing pilot runtime-key guard by declaring BEEP_CACHE_TOOLCHAIN_DIGEST in the child task env list while retaining cache false. Eight bounded native metadata-only plans with the pinned stable and canary clients prove that synthetic digest changes were ignored before the edit and invalidate the task hash after it. Input paths, command, dependencies and outputs are unchanged; only the child config file input changes. Evidence is in research/types-lint-toolchain-key-2026-11-06.json and its companion report. No task body, remote cache operation, credential read or manual quality suite ran. This is not runtime-key enforcement, qualification, adoption or production activation; types-specific execution and the full trust/adoption contracts remain open.
