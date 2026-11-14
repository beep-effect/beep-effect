---
title: "PERIH-11 is paid: the first pin bump passed its own Check and merged"
date: 2026-11-14
kind: checkpoint
lane: "docs/heavy-pool-diet-pin-bump-merged"
reversal: "Revert this PR's squash commit; the PERIH-11 acceptance line reads unchecked again and the reading note is removed."
---

The first pin-bump pull request (#3326, the pin for beep-ci-00e2e35dbaee) passed its own Check with all five heavy lanes green and merged on 2026-11-14 as 76238b4c11. The next two main pushes that matched the workflow's path filter (#3331, #3332) left the closure unchanged: no compile, no release and no pull request. With the earlier readings (the first run re-recorded on a byte-identical release; a newer release updated the same pull request) the SPEC acceptance line for PERIH-11 holds and is checked. Not yet seen and named in the note: a closure change after a merged bump opening a new pull request. Readings: history/2026-11-14-perih-11-slice-2-after-the-bump.md. The pin bump was the gate on route-soundness-repair PERIH-10, which PLAN slice 9 waits on.
