---
title: "Private-partition guard: message ids repo-wide, participant handle on goal-added lines"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "Return to a literal whole-tree git grep on the handle after removing the pre-existing public references, or widen the guard's diff base"
---

The acceptance check named a git grep on the archive's message ids and participant handle. The 50 message ids must match nothing anywhere in the tree. The one non-operator participant handle is also a public GitHub owner already cited in 9 tracked exploration and goal files that predate this goal, so a whole-tree grep can never pass. The guard therefore checks message ids against the whole tree and the handle against lines this goal adds (origin/main...HEAD plus uncommitted). Identifiers live only in an out-of-repo pattern file and the guard prints counts, never values. First run 2026-11-07: 0 and 0. Rejected: rewriting the pre-existing public references, an unrelated change.
