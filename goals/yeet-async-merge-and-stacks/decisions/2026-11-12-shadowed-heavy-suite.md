---
title: "A skipped Heavy Admit run must not shadow the admitted one"
date: 2026-11-12
lane: "fix/merge-gate-shadowed-heavy-suite"
reversal: "Drop the re-report step from heavy-admit.yml (admission back to event-label-only) and the gate's shadow classification; strict merges after a later label then fail again at GitHub."
---
On 2026-11-12 #3133 passed `yeet merge-gate`, and then merge-async failed with "3 of 15 required status checks are expected". An `unblocks-main` label had been applied after `ready-for-heavy`, which started a second Heavy Admit run whose jobs all skipped. At merge time GitHub's ruleset reads only the newest run of each workflow and event on the head. `Heavy / Check`, `Heavy / Docgen` and `Heavy / Doctest` therefore read as expected, although every check run and the GraphQL status rollup were green. The legacy merge endpoint had hidden this, because an admin merge bypasses rules automatically. Merge-async was right not to request a bypass.

Four changes follow.

1. **Re-report in `heavy-admit.yml`.** A label other than an admission label, on a same-repository PR that carries `ready-for-heavy`, re-reports the heavy lanes. It never re-runs them. The admission job finds the newest earlier Heavy Admit run on the same head that reported lanes. It re-reports (`heavy.yml` `admitted: false`, so every `Heavy / *` lane is skipped in the newest suite and no EC2 work runs) only when two conditions hold:
   - that earlier run succeeded and ran the same `heavy.yml` (the `referenced_workflows` sha matches);
   - no newer copy of those lanes on the head, the Check workflow's included, is red or unfinished (the job reads the head's check runs with `checks: read`).

   Otherwise it skips, as before. GitHub counts a skipped required check as passing, and the gates and the settle logic read the label, so a re-reported head stays admitted. Fork admission is unchanged (event-label-only).
2. **Label order in `yeet open`.** The compute-profile worker label is applied before `ready-for-heavy`.
3. **Ruleset model in the gates.** `yeet merge-gate`, `yeet gh pr status|merge` and the gate table read required checks the way the ruleset does: check runs in a replaced suite do not count. A required context with no live run is judged by its newest hidden copy:
   - red: holds as red, even while the replacing run is still going, and relaxed mode checks it as the PR's own red with no bypass;
   - passed: `required-shadowed`, where strict holds with the remedy (re-apply `ready-for-heavy`) and relaxed records the attribution and requests the bypass;
   - unfinished: pending.

   Optional checks keep the newest run per name across every suite, so a red optional check in a replaced suite still holds and is recorded.
4. **`check.yml` cancel step.** The superseded-run cancel also cancels pending, waiting and requested runs. It lists the branch's runs once, and a failed listing only warns.

Residual: a later label replaces a `ready-for-heavy` re-apply that is still pending behind a running matrix in the shared concurrency group. The gate catches any check that this leaves hidden.
