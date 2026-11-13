---
title: "The admission-chain gate reads heavy-pool pickup per producer run"
date: 2026-11-13
lane: "fix/certainty-scoring-fixes"
pullRequest: 3144
reversal: "Delete this file; the Admission chain criterion then reads the certainty-scorecard row under whatever definition it carries when measured."
---

The Admission chain acceptance criterion defines its row as "Heavy Admission job start to the first `Heavy / *` job start ... on non-docs PR runs". certainty-scorecard #3144 (decision `certainty-scoring-fixes` there) changed what `beep ci certainty` reports as `admissionToHeavy`. The old row took the earliest non-skipped `Heavy / ` job of check.yml runs only. Since #3030 that is mostly the hosted `Heavy / Test Integration` aggregate, which starts after every integration shard, so the row measured shard time (planned fixture p50 6.45 min). The row now covers every producer run of a code head, check.yml and heavy-admit.yml alike, and pairs that run's own Heavy Admission start with its first executed job on the heavy pool (beep-ec2-heavy runner labels). On the same fixture the p50 is 1.22 min (n 15). This goal reads the criterion under that definition: first heavy-pool job per producer run, both producers. Its baseline must be taken with a `beep ci certainty` build that includes #3144. A baseline taken before #3144 and a measurement after it compare different quantities, and neither may be used against the other.
