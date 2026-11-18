---
title: "Vercel.Project fails on a repository-link mismatch instead of relinking"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-vercel"
pullRequest: 3290
reversal: "Relink in reconcile once a distilled release ships a project link operation, and drop ProjectRepositoryMismatch in the same PR."
---

Review thread PRRT_kwDOPbO_N863RrL3 on #3290: an adopted project never received the declared `gitRepository`. The installed `@distilled.cloud/vercel@1.0.0-rc.18` has no operation that links or relinks a project's repository: `projects.ts` exposes only `createProject.gitRepository`, and the only link operations are `networking` private-link endpoints. So `Vercel.Project` checks the observed link against the declared `gitRepository` (owner/name, case-insensitive) and fails with `ProjectRepositoryMismatch`, both in `diff` (so `alchemy plan` reports it before anything is applied) and before any write in `reconcile`. A deliberate change of the declared repository still replaces the project. For the P4 oip.law adoption, the existing project must already be linked to `beep-effect/beep-effect`, or the props must omit `gitRepository`.
