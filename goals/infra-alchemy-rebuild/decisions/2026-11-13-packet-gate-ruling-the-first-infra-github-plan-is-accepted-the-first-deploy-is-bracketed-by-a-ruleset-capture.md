---
title: "Packet gate ruling: the first infra-github plan is accepted; the first deploy is bracketed by a ruleset capture"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-github"
reversal: "Remove the capture-and-compare step from the runbook's first-deploy procedure."
---

Ruling by the packet gate session, 2026-11-13, on the plan result. Accepted as it stands: the 36 provider-gap `create` entries are explained and the stack tests prove the first apply sends no create request; the work is not held on an upstream contribution, and the gap is recorded as friction with file evidence in `research/OPPORTUNITIES.md` so it can go upstream later. Added before any arming: because the `main` ruleset is rewritten on every deploy, the runbook's first-deploy procedure captures `gh api repos/beep-effect/beep-effect/rulesets/10240248` before and after the run under `~/.local/state/beep/infra-github/`, diffs them with `updated_at` removed (the diff must be empty), and on any other difference disarms and re-applies the captured JSON with `gh api -X PUT`.
