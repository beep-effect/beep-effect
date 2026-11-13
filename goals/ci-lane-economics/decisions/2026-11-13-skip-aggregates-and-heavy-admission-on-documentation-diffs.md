---
title: "Skip the required aggregates and Heavy Admission at job level on documentation diffs"
date: 2026-11-13
lane: "fix/ci-applicability-docs-only"
reversal: "Revert the pull request: the four aggregates return to `if: !cancelled()`, Heavy Admission regains its documentation step, and the Vercel and Storybook pull_request path filters are removed."
---

A documentation-only pull request took 13 to 15 hosted runners (measured on #3170, #3202 and #3205, 2026-11-13) although it can fail only Repo Sanity's documentation path, Docs Policy, Commitlint and Secret Scanning. Four aggregates (Lint, Test Unit, Property Laws, Heavy / Test Integration) each queued up to 400 seconds for a runner to print one line, Heavy Admission queued 177 to 350 seconds in front of Repo Sanity to emit three constants, and the Storybook and Vercel Deploy workflows each took a runner to decide to do nothing.

Decision: the aggregates and Heavy Admission are skipped at job level when Change Profile succeeded and reported `docs_only` (same-repository heads for admission). GitHub reports a job-level skip as a passing required check, which the ruleset already relies on for Codegen Drift, Nix Shell, Security, SAST and the Heavy lanes. The Heavy caller reads Change Profile directly and still calls heavy.yml with `admitted: false`, so every `Heavy / <lane>` context exists. Any other profile result runs each aggregate, whose script fails closed. Vercel Deploy gets a `pull_request.paths` filter equal to its preview rule, and Storybook ignores pull requests confined to docs/, goals/, explorations/ and research/.

Test Plan keeps starting beside Change Profile and still takes one runner (about 25 seconds) on a documentation diff. Gating it on Change Profile would put one more runner wait in front of every code pull request's test shards, the ordering the 2026-11-10 decision in this packet protects.

`ci-docs-job-admission.test.ts` simulates the job graph from the checked-in `if` expressions and fails when a documentation diff requests any runner beyond Change Profile, Test Plan, PR Size Label, Commitlint, Secret Scanning, Repo Sanity and Docs Policy.
