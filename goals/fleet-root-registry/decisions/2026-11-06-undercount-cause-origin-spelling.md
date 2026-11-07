---
title: "The undercount is an origin-spelling mismatch, fixed in its own PR"
date: 2026-11-06
lane: "feat/fleet-root-registry"
pullRequest: 2852
reversal: "Revert #2852 to restore the suffix-only normalizeOriginUrl; beep-effect0 and its lanes drop out of the mirror again."
---

Refutes the 2026-11-06 hypothesis. git -C beep-effect0 worktree list reports 34 checkouts and succeeds; beep-effect0's origin is https://github.com/beep-effect/beep-effect.git while every other clone uses git@github.com:beep-effect/beep-effect.git, and Fleet.service.ts normalizeOriginUrl stripped only a trailing slash and .git, so cloneMatchesOrigin rejected the clone and every lane it owns. The one attributed lane under beep-effect0-worktrees (pr1371-r10-9951f493) is registered in beep-effect2. #2852 reuses ArtifactPaths canonicalRepositoryIdentity; after it the beep-effect0 group lists 35 rows (34 plus the beep-effect2 lane). The fix lives outside this PR so this PR's roots-unset parity diff stays clean and plain fleet output is not changed here. Rejected: folding the fix into this PR (the workstation parity diff would carry 34 unrelated rows).
