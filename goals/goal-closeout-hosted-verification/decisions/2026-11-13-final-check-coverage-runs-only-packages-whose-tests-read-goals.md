---
title: "final-check coverage runs only packages whose tests read goals/"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Restore the previous affected-set computation for goals/ paths."
---

Operator ruling 2026-11-12. On a diff confined to goal-packet files, the coverage gate runs only the packages whose tests read `goals/`. With none affected it records 'no affected packages' and passes. Evidence: coverage ran 46 minutes on #3101, a goals-only diff. Ships as its own PR from lane final-check-coverage-scope.
