---
title: Repo Sanity collects its checks in one lane body, with a narrower documentation path
date: 2026-11-26
reversal: Split the Repo Sanity checks into separate check.yml steps and run every one on documentation diffs.
governs:
  - src/commands/Ci/CiLane.ts#ciLaneStepsForTesting
enforcedBy: []
---

Workflow policy runs inside the collecting body, not as its own check.yml step: a separate step's red skipped the whole lane body, the shadcn step included (hosted-setup-tax PERIH-02 follow-up). Repo Sanity is the one hosted owner of the strict @shadcn/lint policy (.oxlintrc.shadcn.json; PERIH-02); it is required, so a finding blocks the merge, and the step group runs every step and fails with all reds, so an earlier red cannot hide it. `audit:github repo-sanity` runs the changeset graph check (its `repo-sanity:changeset-graph` lane), so the body carries no second copy (PERIL-04). The changeset gate goes through the path-aware wrapper, so lab-only changes are exempt from changeset ceremony (lab-apps-lifecycle P2, ratified row 8).

A documentation-only diff (prose, packet files, `.changeset/*.md`) can fail only the public-repo home path law and the changeset checks; every other step reads code-route paths (sources, manifests, tool configuration, workflows), and Docs Policy runs the knowledge and packet policy on the same diffs. The home path law is required on every head: Heavy / Lint Policy also runs it on code pull requests but is not a required context.

The skills-lock check exists because no other hosted lane compared the installed skills with skills-lock.json, and pull requests kept merging over a stale lock (#3225, #3246). A SKILL.md edit is a documentation diff, so the step sits on both paths. `--offline` keeps it to tracked files: the plain check refetches each floating upstream skill through the unauthenticated GitHub API, which rate-limits shared runner addresses and would turn an upstream push into a red on an unrelated pull request. It takes about a second, and check.yml skips it on a pull request that changes none of the `skills` pattern row's paths.

The census stamp check exists because the single-checker census baseline records the compiler it was measured with, and a compiler bump that leaves it behind makes the gate's counts incomparable; no lane noticed two such bumps. It reads the baseline and one `tsc --version` (no build, about a second), so it runs on every full pass; a documentation-only diff can move neither input. Coverage owner rows are checked here because a new reader of a scanned repository file (a generated standards file or root tooling input) in another package does not select the row's owners (hosted-setup-tax TURB-01); readers are TypeScript sources, so a documentation-only change cannot add or drop one.

Rejected: separate check.yml steps (one red skipped the rest); one path for every diff (documentation pull requests pay for code-route checks).
