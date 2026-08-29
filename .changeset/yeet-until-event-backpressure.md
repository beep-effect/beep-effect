---
"@beep/repo-cli": minor
---

Add `yeet monitor --watch --until-event`, the event-exit contract for agent
babysitting loops: the watch stream now polls the PR's comment collections
through the durable branch-scoped watermark and emits one `comment-posted`
row per new review or conversation comment, and under `--until-event` the
process exits on the first actionable batch — immediately on a failing check
(the failure capsule is already durable), and two polls after the first new
comment so a review bot's burst lands as one wake. The merge loop's job triage
also stops waiting for run-level conclusions: a completed red job inside an
in-progress run is classified on the next poll, a red whose log has not
materialized yet reports `awaiting-log` instead of "needs code fix", and a
rerun GitHub rejects refunds its once-per-job allowance for a later poll.
