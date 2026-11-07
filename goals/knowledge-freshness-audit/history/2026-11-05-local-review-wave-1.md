# Local audit review and first repair wave — 2026-11-05

The operator requested local false-positive and omission review, followed by
repairs of validated issues, while preserving other owners and spending no money.
This authorizes the reviewed repairs below. It does not accept every earlier
proposal, close the audit, or change the goal lifecycle.

## Evidence and boundaries

The collected audit used frozen source `e462bc12e9fdb6da2db1f7ad8bd3be791f7806b4`.
These repairs were separately revalidated against base
`405727310e87e7392b3fbd7f684cf9b2ed1fea5f`. Original reports and their qualifications
remain unchanged in private evidence storage. Repeated topics count as repeated
evidence, not independent defects. PM T17's missing original stays excluded.

The root checkout's existing package manifest and lockfile changes were left
untouched. Work took place in an isolated feature lane. No cloud agents, paid
services, provider authentication, worker operations or remote publication were
used. Historical records and vendored skill bundles were not rewritten.

## Reviewed repairs

| Finding | Report evidence | Current-source validation and repair |
|---|---|---|
| Shared use-cases described as nonexistent/future | T1/T2 architecture; T6 glossary | Existing package and PromotionGate promotion record establish existence. Correct present guidance and neighboring onboarding/index text; retain the promotion bar, contract-only boundary and conditional future test subpath. |
| Retirement refers to removed workspace manifest | T2 `kfa-t2-001` | Workspace membership lives in root package.json. Describe removing explicit entries when present, plus affected TypeScript/Turbo references, without changing the workspace generator. |
| Retired pathless gate | T1 standards | Current scripts do not define agents:pathless:check. Remove the obsolete additional gate; do not invent a successor. |
| Clock confidence overclaims | T23 R11 | Beacon high uses 25 ms RMS and four pairs; medium uses 80 ms and three pairs. OBS medium is a distinct start anchor. Explain that RMS is not a per-event maximum or frame-accuracy guarantee. Correct the top-level skill as well as its reference. |
| QA strip layout | T5 QA | ExtractionPlanner caps strip width at 960. Separate strip frames from JPEG contact sheets and derive actual frame counts from the extraction plan. |
| LiteralKit helper and rebuild examples | T10 L2/P2/L4; repeated T11 | Current interface exposes match/matchOrElse. Annotations preserve helpers; S.brand is a derivation requiring restoration. Correct direct skill instructions, references and dependent crispen guidance. |
| Schema example navigation | T10 X2/X3/X5/X6 | Point to Docgen.schemas.ts definitions, describe exact optional transport keys, remove an unrelated equivalence-symbol pointer and qualify the refined PixelAllowance example. |
| Missing AST brands | T11 C2 | All 31 affected Md Opaque declarations remain unbranded at the new base. Add unique-symbol brands, align recursive decoded/encoded companions, construct syntax nodes through their schemas and preserve nominal Document types in checked/strict codecs. |
| Configured pre-push hook omitted | T10 Yeet | lefthook.yml still configures bun-version-check. Distinguish it from the removed catalog hook; configuration is not proof of installation. |
| Verdict schema token | T11 Yeet | Current writer/schema use yeet-verdict/v2. Update the reference. |
| Readiness prerequisites omitted | T9/T27 orchestrate | ReadyGate requires a passing exact-head receipt or legitimate ancestor carry. Add that prerequisite and include window=ok in the illustrative gate row. Executable gates remain unchanged. |

The skill updater preserves pinned vendored entries and synchronizes local
mirrors/lock hashes. Its first dry run also exposed an inherited stale
browser-qa-loop lock hash. The generated lock is retained, with that baseline
drift distinguished from this lane's edits.

## False-positive and omission decisions

- T29 C73 does not establish an always-true formal contradiction. The surrounding
  instructions require genuine differences and allow equivalence.
- T91's different write-tree values do not prove Party mutation or establish
  clone identity. Keep the own-checkout observation and the other author's
  attestation separate; no index repair follows.
- Packet-relative research/SOURCES.md references and intentionally ignored local
  projections are not broken merely because a repo-root tracked-file lookup
  misses them. Earlier proposal records already carry those qualifications.
- Dated roadmap, migration, vendor and historical status statements are evaluated
  at their stated time. Later changes alone do not falsify historical claims.
- Missing checks in a per-record function are not global validator omissions when
  cross-record callers enforce them. Unknown host behavior stays unknown.
- The neighboring current instructions also contained the stale LiteralKit token,
  package-existence wording and clock-precision promise. Those omissions were
  included in the repair scope instead of fixing only the originally anchored line.
- Unresolved external semantics, licensing/provenance, protected teaching content,
  privacy-impact decisions and existing implementation-owner work remain separate.
  Unsupported evidence is not classified as false or silently repaired.

## Verification and friction

The documented LiteralKit matching/annotation/branded-derivation smoke passed.
The initial nominal-brand edit passed all 208 Md tests but failed type checking:
recursive companions and syntax builders still described structural nodes.
That failure belongs to this lane, not the environment. Subsequent checks exposed
additional derivation and construction seams; the implementation was corrected
rather than weakening type checks or inventing passing proof.

Final local verification passed: the full `quality package-verify @beep/md`
audit and docgen, separate source/test type checking, all 208 existing tests
in 13 files, and `skills update --check`. This document is a bounded repair/review
receipt, not a whole-audit coverage certificate, hosted proof or readiness closure.
