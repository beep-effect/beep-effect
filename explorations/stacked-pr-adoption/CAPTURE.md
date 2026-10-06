# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-05

Operator request (condensed): investigate how beep-effect can adopt stacked
PRs, for both CI cost and agent workflow. Written recommendation only — no
change to CI, rulesets, or Yeet in this task.

Why now, from the 2026-10-05/06 merge burn-down:

- One fix PR on main (#1436: OSV advisories + a stale cloud-bootstrap test)
  blocked about 12 open PRs. Each blocked PR had to merge main and re-run the
  full required matrix (16 required contexts, 7 Heavy lanes on a saturated
  self-hosted fleet).
- Queued Heavy runs on PRs that could not merge yet starved the one PR that
  unblocked everyone; 9 runs were cancelled by hand.
- Informal stacks were already in use: #1433 and #1442 merged into
  `goals/push-first-publish` (#1427's branch); #1444 carries #1440's commit and
  must merge after it.
- #1429 and #1435 copied the unblocking PR's commits (merged its branch)
  instead of stacking on it.

Questions asked:

1. Does native stacking let a child PR run the required matrix once, against
   the stack, and avoid re-running after the base lands?
2. How much Heavy-runner time would today's pattern have saved (from the
   Actions runs API for 2026-10-05)?
3. What Yeet/agent changes would make lanes stack by default?
4. Risks: squash merges dropping late pushes, review bots on stacked diffs, the
   `ready-for-heavy` label gate, docs-only skip rules.

Prior art named by the operator: the two stacked-PR memories (stacked PRs got
no required checks because `check.yml`/`storybook.yml` trigger on
`pull_request: branches: [main]`, and the auto-retarget fires `edited`, not
`synchronize`), `explorations/agent-pipeline-velocity` (pr-topology ruling),
`explorations/beep-ci-operational-ontology` (Ruling 21, merge queue = ship-velocity
E8), the speed-loop / time-to-certainty OPPORTUNITIES ledgers, and Yeet.
Open puzzle: #1433/#1442 (base `goals/push-first-publish`) did get required
check runs — what changed?
