---
title: "require-description accepts a lead derived from the export's annotation"
date: 2026-11-23
lane: "goals/jsdoc-lead-single-source-w4"
reversal: "Drop the derived-lead exemption from beep/require-description in policy-pack lint-rules docs.ts and restore the leads the rule then reports"
---

In `packages/tooling/*/*/src` the docs oxlint config runs `beep/require-description` under `--max-warnings=0`. Wave 3 showed it rejecting a type companion (`export type X = typeof X.Type`) whose only lead restated `X`'s `$I.annote*` description: removing the lead left a tags-only block. That is the same restatement the goal removes, so the rule now treats a declaration as described when docgen can derive its lead: it records every `annote`/`annoteSchema`/`annoteClass`/`annoteError`/`annoteHttp` call whose identifier names an enclosing variable or class and whose options carry a literal `description`, and at `Program:exit` it reports only the missing descriptions that no such annotation covers, by the declaration's own name or its enclosing namespace's. This mirrors `derivedLead` in `@beep/repo-utils/JSDoc/LeadSource` (annotated value, same-named type companion, namespace members). Fixture cases cover a companion type and namespace member, an annotated class, an annotation naming another export, and an annotation without a description.
