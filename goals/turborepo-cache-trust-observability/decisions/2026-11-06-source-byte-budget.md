---
title: "Bind complete large sources within explicit file and inventory byte budgets"
date: 2026-11-06
lane: "codex/cache-source-budget"
reversal: "Revert the focused preflight while preserving failed evidence and complete-input binding; keep producer approval closed until a bounded replacement handles the actual declared fixtures."
---

Accepted-source inspection42142818104 failed before diagnostics. Three new declared fixtures are13.4/17.0/34.9MB, beyond the previous8MiB reader cap. Raise the file payload ceiling to64MiB and add a one-GiB aggregate metadata preflight before any source payload read. Keep four-reader concurrency,20,000paths,ten-minute job,four-MiB source-plus-diagnostic report and all diagnostic limits. Read each file only up to its preflight size with the existing overflow probe, and reject a returned length mismatch. Hash every declared byte with the existing digest algorithm, preserving containment, aliases, modes and source-inventory drift checks. Larger future inventories refuse until their numeric budget is reviewed. Author complete-large-file, per-file overflow, aggregate zero-read and size-drift controls for hosted CI; no local quality suite or source-generator entrypoint. No deployment, producer approval, qualification, credential, signing, capacity or whole-goal acceptance change.
