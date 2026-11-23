---
title: "P5: registry writes in the stacked P5 layer run against origin/main over a base that publishes, with the identity-registry lint in each row gate and a re-stamp after each parent merge"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Write against the P4 branch as base by a decision file naming why the hosted lint's default base does not apply"
---

Independent review of the P5 design, finding on registry writes in a stacked layer. Applies decisions `2026-11-22-p1-over-a-base-commit-that-publishes-no-term-set-the-writers-keep-the-release` and `2026-11-22-p1-the-snapshot-release-is-a-property-of-the-change-against-its-base-ref` to P5.

At design time the lane's merge base with `origin/main` (9a4f7b0258d) publishes no `identity/registry/term-snapshot.json`, so the writers keep 2.0.0 and the lint skips its exact-release checks locally. `origin/main` publishes 2.0.0, and the stack already adds namespaces at 2.0.0. A hosted lint, or the lane after a main merge, would demand the next minor release and restamp each since.

1. Before row 5, the lane takes a base that publishes: it merges the P4 branch once P4 has merged `origin/main`, or merges `origin/main` directly if P4 has not.
2. Every registry write in rows 5, 7 and 12 runs `bun run beep identity registry --write --base origin/main`, the base the hosted lint computes by default (the P5 PR's GitHub base is the P4 branch). Each of those gates runs `bun run beep lint identity-registry --base origin/main`.
3. After each parent layer merges, the lane merges it, reruns the writer with `--base origin/main`, and fixes each row the lint reports as since-misstated in its source shard.
