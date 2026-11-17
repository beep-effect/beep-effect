---
title: "The beep-reviewer switch is the committed reviewerCheck flag of infra-github"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-github"
reversal: "Remove the reviewer check from the stack's ruleset ownership (omit requiredStatusChecks handling for beep-reviewer) and keep the CLI's direct ruleset edit."
---

D20's switch is `StackConfig.mainRuleset.reviewerCheck` (`ReviewerCheck` LiteralKit: `required` | `advisory`). `requiredChecks` appends `{ context: "beep-reviewer", integrationId: 5321138 }` for `required` and leaves the configured checks alone for `advisory`; the stack tests flip it both ways and prove every other check and both bypass actors survive. The committed value is `advisory`, the live position (the census ruleset lists no `beep-reviewer`). The flag is committed configuration, not a dispatch input: a workflow input would be reverted by the next push deploy, and the standing deploy-workflow shape allows only a bare `workflow_dispatch`. CLI change, designed and not in this head (not needed for the plan): once the stack is armed, `beep reviewer ruleset release|require` stops PUTting ruleset 10240248 and instead rewrites `reviewerCheck` in `packages/tooling/infra/github/src/Production.ts` and opens the PR through Yeet; `--apply` on the old path refuses while `INFRA_GITHUB_DEPLOY_ARMED` is `true`. A `release` PR raised because the reviewer is down cannot itself pass a required `beep-reviewer` check, so it merges through the repository-admin bypass the ruleset keeps.
