---
title: "GOAL.md gains an operator-ruling exit"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Remove the third exit from the launcher template in Goals/Bootstrap.ts."
---

Operator ruling 2026-11-12. The launcher's done conditions add: an operator ruling recorded under `decisions/` with `origin/main` showing `closeout.status == initiative.status`. A Stop-hook evaluator can check it from one file and one jq line.
