---
title: "The model is @beep/gate-report in foundation/modeling, free of repo specifics"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Move the model's modules into the gate-run library and delete the modeling package."
---

The architecture review approved `@beep/gate-report` at foundation/modeling/gate-report: it models a developer-artifact format, as `@beep/sbom`, `@beep/lockfiles` and `@beep/tsconfig` do, and foundation is the only family a product slice could reuse it from. Typed, pure console data is allowed there; `@beep/github-reporting` is the precedent. Three conditions hold. Repo specifics stay out: the pointer table is a schema whose command strings the library supplies, record paths live in tooling, and the input fingerprint is an opaque string. The console budget (8,000 characters, 240 per line, 12 diff lines) is a `ConsoleBudget` input with the agent default supplied by the library. The model does not depend on `@beep/github-reporting`: its closure is ten packages against four, and the CI projection in `goals/ci-gate-reports` should depend on both instead.
