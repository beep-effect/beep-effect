---
title: "Gate table reads threads per ready PR with the merge gate's rule"
date: 2026-11-06
lane: "feat/orchestrator-handoff-p2"
reversal: "Restore one batched GraphQL query over all open PRs and compute outstanding threads from it."
---

gate.sh ran one GraphQL query over the first 60 open PRs with 100 threads each and reimplemented the outstanding rule in jq. The table instead reads every page of open PRs over REST and calls the `@beep/github` ReviewThread service once per PR out of draft, every page, with the same `outstanding` rule `yeet merge-gate` uses. Drafts read no threads (`threads=-`): the gate never meets a draft. A failed read is `threads=?` and never zero. Each base branch's ruleset is read once over REST (`requiredStatusContexts`), the reader the authenticated merge-gate path already uses, so the table spawns no `gh`. Cost: one GraphQL query per ready PR per poll, about ten at the 2026-11-06 queue size, within the REST-first ruling's budget for a four-minute poll.
