---
title: "Shard @beep/law-practice-server into three Test Unit partitions"
date: 2026-11-08
lane: "@slop/11-6-26"
pullRequest: 2915
reversal: "Return @beep/law-practice-server to unit-d (weight 749), drop law-practice-1..3 from the partition table, the check.yml matrix and the census layout; the census keeps judging runs by the layout they ran."
---

The 2026-11-02 rebin measured @beep/law-practice-server at 98 s. After #2847 registered the canonical citation corpora its Bun/Istanbul unit run takes about 2,970 s on the 4-vCPU hosted runner, so unit-d went from a 25-minute body to a 60-minute job timeout on main (runs 42417048100, 42422844786) and on #2915. The package now runs as three Vitest shards (law-practice-1..3, weight 990 each, the mechanism repo-cli-1..6 already use); unit-d keeps its other 45 packages at weight 651. check.yml lists thirteen Test Unit partitions and the lane-timings census gains the thirteen-shard layout. The per-document extraction cost itself stays with goals/citation-extraction-engine.
