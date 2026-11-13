---
title: "ROUT-02 landed outside the packet: Docs Policy job and the docs-only Repo Sanity path"
date: 2026-11-12
kind: checkpoint
lane: "perf/ci-applicable-checks"
reversal: "Revert the perf/ci-applicable-checks PR; docs-only PRs return to the full Repo Sanity lane and no hosted knowledge or packet policy."
---

The operator asked on 2026-11-10 for CI to run only the checks applicable to a change, in one PR with no new packet. That PR builds ROUT-02 as D8 and the operator's 2026-11-09 answer rule it: one check.yml job (`docs-policy`, Docs Policy) plus a CiLane id. On docs_only pull requests it runs the root Turbo tasks a documentation diff can fail (`DOCS_POLICY_ROOT_TASKS` in `packages/tooling/tool/cli/src/commands/Ci/DocsPolicy.ts`) plus `knowledge doctor ci --base`. The completeness test (`packages/tooling/tool/cli/test/ci-docs-policy.test.ts`) derives the obligation from `turbo.json` inputs over every docs-classified tracked file plus synthetic probes. Every root task that matches, and every uncached root task, is either run or carries a reason in `DOCS_POLICY_EXCLUSIONS`. The job is not a required context, so Repo Sanity keeps a required documentation path: the home path law, the changeset graph and the changeset status (`beep ci lane repo-sanity --docs-only`).

The same PR tightens the docs-only classifier for ROUT-03 and ROUT-07. `ciCodeShapedPathPatterns` keeps JavaScript and TypeScript, dependency manifests and lockfiles, and tool configuration (tsconfig, .gitignore, Biome, Turbo, docgen, components.json, oxlintrc) on the code route wherever they sit. Before it, 21 JS/TS files and the goal-folder tsconfig and .gitignore files under docs roots were docs-only, while oxlint, effect-imports, config-sync, schema-first and opaque-roundtrips read them. PERIH-10 (base-ref patterns) is still open; this change only tightens.
