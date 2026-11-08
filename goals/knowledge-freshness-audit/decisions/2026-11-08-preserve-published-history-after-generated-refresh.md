---
title: "Preserve published history after generated-artifact refreshes"
date: 2026-11-08
kind: checkpoint
lane: "codex/audit-generated-refresh"
reversal: "Restore the prior paragraph and remove this checkpoint if published feature branches adopt a different history policy."
---

Parent review found an unqualified rebase instruction in the generated-artifact refresh policy. The workflow applies to in-flight feature PRs, while Yeet prohibits rebasing published branches. Replace that instruction with merging accepted origin/main after the dedicated refresh PR lands. Preserve the dedicated-refresh rule, scoped catalog exception, ratchet behavior and historical evidence. Ten open PR file lists and 131 existing registered checkouts showed no competing target edit before this change. This is a documentation repair; no artifact regeneration, baseline change, git-history rewrite or service action is performed. P4 remains partial, PM and ADHD stay separate, and no spending is admitted.
