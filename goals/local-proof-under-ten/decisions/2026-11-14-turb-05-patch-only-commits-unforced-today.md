---
title: "Patch-only and override-only commits are forced from slice 9"
date: 2026-11-14
lane: "perf/local-proof-force-reason"
reversal: "Drop the patch and override triggers from decideTurboForce (pathReasons and rootPolicyReasons in Yeet/internal/TurboForce.ts) so only a bun.lock change forces; the shadow keeps recording them."
---

Before this slice the actual decision forced only when `bun.lock` was in the three-dot diff. A patch-content edit leaves `bun.lock` alone, because `bun.lock` records patch paths and no patch content, and Turbo hashes no patch content either. A commit that touched only `patches/` was therefore never forced and could replay a cached green; #2873 (d8ef9b3839b) was such a commit. An override-only commit that left `bun.lock` alone was in the same position. A stale green is a correctness defect, so the orchestrator ruled to close the gap where it was found, in this slice. Widening the force is not the narrowing that ruling D14 defers.

From this slice the actual decision also forces when a file under `patches/` or the root `patchedDependencies` changed (`patches-changed`), or when the root `overrides` or `resolutions` changed (`overrides-changed`). The recorded `reasons` list every trigger that applied. The same `git diff --name-only <base>...HEAD -- bun.lock patches package.json` finds the path triggers, and the root `package.json` is read at the merge base and HEAD only when it is in that diff. Nothing else about the forced set changed: a `bun.lock` change forces as before with the same log line, a run that touches none of the three is not forced, the forced steps are the ones a lockfile force always set, and a failed diff still forces nothing. If the merge base or the root manifest cannot be read, the path triggers stand and the shadow is recorded as unavailable. The narrowed shadow is unchanged and still drives nothing.
