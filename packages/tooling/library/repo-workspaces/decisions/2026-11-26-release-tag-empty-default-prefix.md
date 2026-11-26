---
title: ReleaseTag defaults the version prefix to "" for scoped and unscoped names alike
date: 2026-11-26
reversal: Default versionPrefix to "v" for unscoped names in ReleaseTag.scoped, matching silk-release-action's live pkg@v1.0.0, and update the literal tag strings in test/ReleaseTag.test.ts.
governs:
  - src/ReleaseTag.ts#ReleaseTag
  - src/ReleaseTag.ts#TagFormatOptions
enforcedBy: []
---

The default version prefix is `""` for every tag style and name (strict SemVer, 2026-07-25); a tool that wants `v<semver>` passes `versionPrefix: "v"`.
The literal tag strings in `test/ReleaseTag.test.ts` are the continuity contract: git tag history is not an API, and pre-1.0 breaking-change freedom covers code, not a consumer's existing tags, so change one deliberately or not at all.
Rejected: silk-release-action's live `pkg@v1.0.0` for unscoped names, which makes the default depend on scoping.
