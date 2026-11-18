---
title: "Window 5 cannot pass; the heavy-pool lanes breach on wait at two branches, so the held set merges and the window restarts"
date: 2026-11-18
kind: checkpoint
lane: "docs/ci-window5-preview-restart"
reversal: "Delete this checkpoint and keep the held set held until the window-5 census on 2026-11-20T20:10Z."
---

Preview census on 2026-11-18 at about 02:30Z, on main `3199097213`, with `bun run beep ci lane-timings --window --preview`.

- Whole window so far (2026-11-13T20:00Z to now): 13 of the 15 required contexts breach on wait p95, from 20m37s (SAST) to 70m49s (Docgen). Every lane's own duration p95 is under 20 minutes; the longest is Test Unit at 19m20s. Worst shard pickup p95 is 13m44s against the 10m00s tripwire (n=11,738). Peak CI-active branches: 14 on 11-13, 11 on 11-14, at most 2 on 11-15 to 11-17, 7 on 11-18. Load never reached the 15 to 20 branch charter band.
- Quiet days only (2026-11-15T00:00Z to 2026-11-18T02:00Z): pickup p95 is 1m25s and passes, and so do eleven contexts. Check (28m25s), Doctest (27m00s), Docgen (26m51s) and Test Unit (23m20s) still breach on wait at one or two branches. That is structural, not load: these lanes wait behind heavy admission and the two-runner heavy pool.
- Overflow pool `beep-ovf`: 810 scale-up calls, 858 runners requested, 847 launched, 11 retryable errors and none fatal. It launched from 2026-11-13T20:36Z to 2026-11-14T06:34Z and not since, because no hosted queue built up on the quiet days.
- Window 5 cannot pass at its census. The operator ruled on 2026-11-18 to merge the held set now and restart the window rather than run it out. The order is heavy-pool-diet lanes-first (#3302) and its slice 6, then infra turbo-cache stage 2, then infra P5, then certainty slices 13 (#3367) and 11b (#3369). Window 6 is the seven days after the last of them merges, and its census is scheduled at that time.
