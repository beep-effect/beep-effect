---
title: "Matter authority reads one JSON variable and a denied anchor resolution looks like absent evidence"
date: 2026-11-24
lane: "p6"
reversal: "Rename the variable or map Denied to a distinct citation error; the empty default and the span attributes stay."
---

## Context

Row 8 adds `MatterAuthorityLive`, `AuthorizedSourceTextResolver` and the anchor-resolution check in
citation `SourceResolution`. The design names `MatterAuthorityConfig` as a `Config` decode with the
empty configuration as the default, and the resolution's "refusal value" for path 2, without naming
the variable or the value.

## Decision

- `MatterAuthorityLive` reads `BEEP_LAW_PRACTICE_MATTER_AUTHORITY` as JSON through
  `Config.schema(S.fromJsonString(MatterAuthorityConfig))` with `EmptyMatterAuthorityConfig` as the
  default. `MatterAuthorityLayer(config)` takes an explicit configuration for hosts that read their
  own profile (rows 9 and 14) and for tests.
- A denied anchor resolution fails with `CitationPrerequisiteError { dependency: "source-evidence" }`,
  the value an unresolvable source already gets, before any source read. A denial and an absent
  source are indistinguishable to the caller; the access kind and reason go to the
  `MatterAuthority.authorize` span only.
- Citation tests that are not about the wall provide a principal and an authority that grants every
  scope (`test/MatterWall.fixtures.ts`); the wall itself is proved with the real
  `MatterAuthorityLayer` in `MatterAuthority.test.ts` and `CitationResolverBoundary.test.ts`.
