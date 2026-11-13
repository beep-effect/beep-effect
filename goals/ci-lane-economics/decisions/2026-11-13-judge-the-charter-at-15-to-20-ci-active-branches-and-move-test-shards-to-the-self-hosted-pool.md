---
title: "Judge the charter at 15 to 20 CI-active branches and move test shards to the self-hosted pool"
date: 2026-11-13
lane: "chore/ci-goals-finish"
reversal: "Restore the six-branch bound of repair decision 3 and build the pre-push governor; return the shard jobs to ubuntu-24.04 in check.yml."
---

Operator ruling 2026-11-13 (about 05:50Z, relayed by the orchestrator). It replaces D1's load bound and repair decision 3's ruling that the charter is judged at six or fewer CI-active branches.

**Evidence.** Preview census `2026-11-10T04:00Z` to `2026-11-13T05:40Z` (373 Check runs, 15 required contexts, ruleset version `54940515`; `research/window-5-preview-2026-11-13.md`): Test Unit p95 24m00s (p50 12m56s), shard pickup p95 13m32s against the 5m00s tripwire (n=3,944), and peak CI-active branches of 8, 9 and 17 on the three days with runs. No day was at or under six. On main run 43370160740 every hosted job waited 10 to 16 minutes for a runner while the slowest body ran 9m05s: about 70 hosted jobs per run against the 60-job concurrency cap, with 11 runs queued.

**Ruling.**

- The charter is judged at the load the operator actually runs: about 15 to 20 CI-active branches. A window passes or fails at that bound; a day above 20 is reported, not excused.
- The six-branch fan-out governor signed in repair decision 3 is not built.
- The test shards (Test Unit, Test Integration, Property Laws) move from GitHub-hosted `ubuntu-24.04` to the existing self-hosted EC2 pool. No new paid service. The runner scaler baseline (`RUNNERS_MAXIMUM_COUNT`, 2) is not raised permanently without the operator: the driver sizes the runners the shards need at about 20 branches and brings that number with an estimated monthly EC2 delta first.
- The workflow edits that change shard labels are hand-merged by the operator and land after #3215.
- The census fixes (a verdict-wait column per required context, Test Integration shards in the population) and the hosted job diet go ahead.
- Window 5 starts after those land and is measured at the new bound.

Window 4 (`2026-10-27T10:00Z` to `2026-11-03T10:00Z`) was previewed on 2026-11-02 and never censused as a full week; its layout was superseded by D4 and the 2026-11-08 to 2026-11-10 repacks, so it stays a preview and admits nothing.
