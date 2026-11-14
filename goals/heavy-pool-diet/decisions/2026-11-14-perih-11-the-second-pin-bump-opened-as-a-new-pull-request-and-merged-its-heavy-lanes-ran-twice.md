---
title: "PERIH-11: the second pin bump opened as a new pull request and merged; its heavy lanes ran twice"
date: 2026-11-14
kind: checkpoint
lane: "docs/heavy-pool-diet-second-pin-bump"
reversal: "Revert this PR's squash commit; the readings and the receipt are removed."
---

The next closure change after the first bump merged (#3325) published beep-ci-6d366333e222 and opened a new pull request, #3334, from the deleted-branch state. It passed its own Check and merged on 2026-11-14 as b7d3c9d99a. A main push while it was open left it alone, and a push whose pin step ran just after the merge opened nothing from a stale checkout. That closes the one case the PERIH-11 reading still listed as unseen. Found while reading: #3334 was labelled two seconds after it opened, and its five heavy lanes ran in both the Check run and the Heavy Admit run, ten heavy jobs for one head. The fix would be in check.yml or heavy-admit.yml, which this goal changes only with the CI goals driver's word; it is recorded in research/OPPORTUNITIES.md and not changed. Readings: history/2026-11-14-perih-11-slice-2-after-the-bump.md.
