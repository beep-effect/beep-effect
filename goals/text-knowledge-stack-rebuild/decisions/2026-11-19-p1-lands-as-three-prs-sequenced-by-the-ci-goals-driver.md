---
title: "P1 lands as three PRs sequenced by the CI goals driver"
date: 2026-11-19
kind: checkpoint
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Open B and C without the driver's word; nothing in the code depends on the order beyond A before B before C"
---

The CI goals driver ruled the P1 merge order on 2026-11-19, relayed by the orchestrator. PR A (L0 identity: the IRI move, ContentHash and the minting function, the canonical-JSON re-points) opens and merges only after the infra gate's PR #3422 (registry exports as leaves) merges. Main is then merged into A once, and any identity slug A adds takes the registry-leaf form #3422 introduces. A's final head gets the infra gate's bundle-diff: if A reaches no runner handler it merges at any time outside a freeze; if it does, it merges before the gate's PR 2 plan_only. A's final goes to the orchestrator, and the lane waits for that result. PR B and PR C open only after the runner cutover's step 4b and only on the driver's word, and the orchestrator is told before each opens. C's final states that the alchemy-github-runners and infra ci-runners test suites are green on C's head. Each of A, B and C cuts a beep CI binary release and a pin PR that the driver diffs.
