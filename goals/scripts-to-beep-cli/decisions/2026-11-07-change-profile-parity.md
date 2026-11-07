---
title: "change-profile reads the checkout's pattern file and fails open like the shell"
date: 2026-11-07
lane: "goals/scripts-to-beep-cli"
reversal: "Drop the runtime pattern read and the fail-open branch; use the compiled-in patterns"
---

Parity with scripts/ci-change-profile.sh: pinned `BEEP_CI_PR_BASE_SHA`/`BEEP_CI_PR_HEAD_SHA` win over positional base/head; a missing pin or failed diff on a pull_request warns and keeps every profile active; patterns come from the checkout's `CiOperational.patterns.json` when present (fail closed on an invalid file) because the binary is main's code but must classify the PR's tree.
