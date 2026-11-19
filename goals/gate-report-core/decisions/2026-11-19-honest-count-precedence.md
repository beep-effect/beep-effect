---
title: "Reason precedence: cancelled, errored, failed, passed; a fallback item explains an unexplained failure"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Edit the settled-reason and fallback rules in the reducer."
---

Totals are computed from the items, never taken from the runner. Load, hook and unhandled failures are fault items with their own totals, and `failed` counts ordinary failures only. A run is errored when the tool said so, when nothing was collected, or when a fallback was added. The fallback is one fault item carrying the log excerpt, added when no item failed and the exit code was nonzero or the tool reported a reason other than passed. Every item is recorded, passed ones included, so a later run can tell fixed from never seen.
