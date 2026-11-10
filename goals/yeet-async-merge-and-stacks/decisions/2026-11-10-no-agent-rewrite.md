---
title: "A lane never rewrites a published ref; it adopts GitHub's rewrite"
date: 2026-11-10
lane: "docs/stack-test-results"
reversal: "Allow a Yeet-owned, lease-pinned rewrite after an operator ruling on force-pushes."
---

No `gh stack rebase`, `sync`, `modify` or browser Rebase stack from a lane. After a GitHub-initiated rewrite the lane takes the remote head with `git switch -C <branch> origin/<branch>` and replays unpushed work fast-forward. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `no-rebase-law`; confirmed in the test, where the lane never force-pushed.
