---
title: "Legacy merge stays behind BEEP_YEET_MERGE_ENDPOINT=legacy for one working day"
date: 2026-11-10
lane: "claude/trusting-hamilton-1ad7d1"
reversal: "Set BEEP_YEET_MERGE_ENDPOINT=legacy in the merging shell; after the deletion PR, revert that PR."
---

Every Yeet merge (merge-gate, merge, gh merge, owner checkpoint) goes through settleYeetMerge, which reads BEEP_YEET_MERGE_ENDPOINT (async by default; legacy routes to PUT pulls/{n}/merge, which cannot send a bypass). An unparseable value falls back to async with a warning, because async is the path that holds a failed rule. The legacy call and the switch are deleted in a small follow-up PR one working day after slice A merges: on or after 2026-11-11.
