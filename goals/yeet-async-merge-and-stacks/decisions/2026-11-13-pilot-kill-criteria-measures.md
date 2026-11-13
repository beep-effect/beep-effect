---
title: "How the pilot's kill criteria are measured"
date: 2026-11-13
lane: "docs/stack-pilot-record"
reversal: "Judge the second criterion on ready-to-merge minutes, or the first on each week separately; the GitHub API still holds the instants needed for either."
---

The criteria in SPEC.md are sentences; the record gives each one a number a later session can read. Used: stacks in `GET /repos/{owner}/{repo}/stacks` created inside the clock on base main whose two layers each carry a lane's own change. Fewer than four in the fourteen days fires the first criterion, because two a week is a rate, not a floor for each week. Probe, test and acceptance stacks do not count, nor does a stack that was unstacked or closed with nothing merged. Wait: the minutes a review window was the only thing holding the stack, from every other gate criterion being met on both layers to the later window elapsing. A median above 40 minutes, two windows at the default length, fires the second. Time spent on hosted CI or on review fixes is not window wait: an ordinary pull request pays it too, and stack #3190 took 77 minutes with none of them spent on a window. Force-push: one stack that landed only after a lane rewrote a published branch, or after someone pressed Rebase stack for it, fires the third. The stack listing is the count of record, so a lane that forgets its row does not shrink the census.
