---
title: "The projection fold advances its cursor with each entry and lists a node once"
date: 2026-11-10
lane: "agent-memory-store-p1"
reversal: "Advance the cursor after the whole batch again, by decision file, only together with a fold into a copy that is swapped in whole"
---

Review finding on PR 3058: applyEntries mutated the fold entry by entry but moved the cursor once after the loop, so an interruption or a payload that failed to decode mid-batch made the next catch-up fold the same entries again, and pushTo listed a node twice, doubling it in the export. Each entry's payload is now decoded first, then its change and its cursor step run with no yield between them, so the cursor always sits right after the last folded entry; pushTo also skips a node id already listed. catchUp runs only inside importFolder, exportFolder and projectNode, which all hold the projector's one-permit semaphore, so two fibers never fold one projection at once; two projector layers hold two projections. Tests: test/MarkdownProjection.test.ts.
