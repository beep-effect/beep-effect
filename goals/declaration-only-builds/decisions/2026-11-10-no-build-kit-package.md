---
title: "No build-kit package; the generated-scripts policy owns the change"
date: 2026-11-10
reversal: "Create the package with bun run beep create-package once a publish lane exists for it to own."
---

Changes go through the generated `beep:build` and `beep:check` defaults in `@beep/repo-cli-kit` and the Turbo task-contract test in `@beep/repo-cli`. The stale-tsbuildinfo incident that motivated a build-kit was fixed by #1874 with an emit-layout change and a contract test. Agent call.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q3).
