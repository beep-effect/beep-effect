---
title: "Every lever is open at graduation; #3008 makes the COVE-02 hole concrete"
date: 2026-11-09
reversal: "Re-run the lever status check against origin/main and supersede this decision with the new statuses."
---

Checked against origin/main at c90929b1ff1 (re-verified after the base moved): no lever of this goal has landed. #3008 made a bare local `bun run coverage` plan `--affected` from the origin/main merge base, but the bare path still calls the comparator without that base (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` line 4838), so it plans from one tree and judges against the working-copy floors; COVE-02 stays open and is now reached by every bare run. #3010 (a docs-only allocation report) and #3011 (docs-only scanner qualification in Tasks.ts) add no hosted docs-policy job or lane id, so ROUT-02 stays open; #3039 (merged) gave Repo Sanity a goals-only path that runs only the private-home-paths law, which is not the knowledge and packet policy D8 asks for.
Source: `git log origin/main` and file reads in this checkout on 2026-11-09, re-read at c90929b1ff1 on 2026-11-10.
