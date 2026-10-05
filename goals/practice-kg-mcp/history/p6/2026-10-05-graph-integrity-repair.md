# P6 evidence — graph-integrity repair (repo-side + workstation rebuild)

Date: 2026-10-05 · Closes the two blocker mechanisms from
[`../p5/2026-07-30-defect-register.md`](../p5/2026-07-30-defect-register.md)
and the A-items the plan attached to P6. Decision record: `SPEC.md` D-11.
Client numbers are withheld here as in the register; the un-anonymized probe
output lives in the session transcript only.

## What changed (repo)

| Mechanism | Fix | Where |
| --- | --- | --- |
| Root cause §1 — client dimension never extracted; families keyed on the bare docket number (A-1/A-2/A-3) | The build scans each docket document's extracted text for the practice's own `<client>.<docket><country><seq>` reference form and attributes the document to the one client it names for its family; documents without evidence inherit a family-wide consensus client when every attributed sibling agrees, otherwise they stay in a bare "unattributed" family. Family and docket natural keys become `<client>.<family>` / `<client>.<docket>`. | `PracticeKg.references.ts` (DuckDB scan), `PracticeKg.families.ts` (`attributeDocuments`), `PracticeKg.projections.ts` |
| Root cause §2 — `enrichment.docket_families` treated as membership (A-12/A-15) | Enrichment never creates families or `files_as` edges. An anchor is a member of a family only when its number is mentioned by exactly one keyed family's docket documents (file name first, then text); every other mentioning family gets a `mentioned_in_family` edge labelled `mention-derived`. `enriched_family` is retired. | `PracticeKg.families.ts` (`resolveAnchors`), `KgEdgePredicate`, `PracticeKgEpistemicStatus` |
| A-4 dual-keyed enrichment divergence | Application-keyed and patent-keyed rows merge on the application number before placement (`reconcileAnchors`); both numbers count as mentions of the same anchor. | `PracticeKg.families.ts` |
| A-5 recycle-bin `$R` stubs as first-class documents | Documents whose source basename is a `$R` stub carry `epistemic_status = recycled-unverified` (their `has_document` edges too) and never vote on attribution. | `PracticeKg.families.ts`, projections |
| A-6 file-name docket indistinguishable from record-derived | New `kg_node.attribution_source` (`filename`, `restored-name`, `text-reference`, `family-consensus`, `client-map`, `official-record`, `mention`), exposed on every graph tool row at the balanced tier. | `KgAttributionSource`, `@beep/law-practice-tables`, `PracticeKg.tools.ts` |
| A-7 claims not joinable to documents | Claim snapshots gain `sourceDocumentDigest`, resolved by unique file-name stem against the bundle's `documents` table (the batch inputs are extraction copies named `<n>_<document name>.txt`; their bytes match no catalogued text, so content hashing cannot join them). 91 of the 102 demo inputs resolve to exactly one document; the rest stay null. Takes effect on the next claims batch. | `PracticeKg.claims.ts`, `PatentClaimCandidate.ts`, `kg_candidate_claims` row |
| A-9 origin chains cite the excluded refresh run | The source-origin-chain aggregate is filtered to the runs the build included. | `catalogRowsSql` |
| A-11 `builtAt` vs `bundleVersion` mismatch | Manifest and `kg_build` now carry `builtAt` (wall clock) and `corpusSnapshotAt` (newest catalogued mtime); bundle version `2026-10-05-01`. | schemas, tables, projections |
| A-14 application `docketFamily` null | Populated for member anchors (bare family in `docket_family`, client in `client`, keyed family in the payload). | projections |

Tool contract: `kg_docket_family` accepts a bare family (returns every keyed
family sharing it, each row's `family` column naming its key) or a keyed
family; `kg_application_lookup` walks `mentioned_in_family` in place of
`enriched_family`. The organizer (`beep corpus organize`) is untouched: the
client prefix is absent from every file name in the corpus (0 of 643 docket
files), so the only deterministic source is document text, which the build
already reads for full-text search.

## Fixture evidence (CI)

`packages/law-practice/server/test/PracticeKg.projections.test.ts` now models
two clients sharing bare family `20001`, a family-level note with no client
evidence, a `$R` restore stub, an anchor mentioned by one family (member) and
an anchor mentioned by two (mention-only). The suite pins the attribution
source, status, keyed natural key, and edge set for every node, the keyed and
bare `kg_docket_family` lookups, byte-identical rebuilds, and the DDL ↔
Drizzle column equality including the new columns. The claims test pins
`sourceDocumentDigest` resolving to the catalogued document.

## Workstation rebuild (real corpus, base run, emails included)

`bun run apps/practice-kg-mcp/src/build.ts --corpus-root <corpus> --bundle-out
<corpus>/staging/practice-kg-bundle-p6 --overwrite` — about 7 minutes wall clock.
Numbers below are from the rebuild after the review fixes (graph store format 2).
The shipped `practice-kg-bundle` was left in place (see "Not done").

| Count | 2026-07-27-01 (shipped) | 2026-10-05-01 (P6) |
| --- | --- | --- |
| documents / emails | 7,330 / 118,771 | 7,330 / 118,771 |
| nodes | 8,092 | 8,249 |
| edges | 2,799 | 1,761 |
| `docket_family` nodes | 105 (bare) | 174 = 147 client-keyed + 27 bare remainders |
| `client` nodes | 1 (client map) | 31 |
| `docket` nodes | 385 | 442 (client-keyed) |
| `files_as` edges | cartesian (90 rows / 8 dockets in G-1) | 74; max 4 applications per family; 0 applications filed from more than one family; 0 from an unattributed family |
| `mentioned_in_family` edges | — | 246, all `mention-derived` |
| documents labelled `recycled-unverified` | 0 | 274 (63 docket, 211 unsorted) |
| spine nodes backed only by recycle stubs (`recycled-unverified`) | 0 | 7 families, 14 dockets, 2 clients |
| anchors: member / mention-only | — | 41 / 49 |

Attribution of the 643 docket documents: 345 `text-reference`, 169
`family-consensus`, 129 file-name only (`filename` 111 / `restored-name` 18);
514 carry a client. Of the 105 bare families, 74 resolve to one client, 21 to
several (max 16), 10 to none.

Exit criteria from `PLAN.md`:

- **Family 10013 splits by client prefix — met.** Four client-keyed families
  (2 + 1 + 1 + 5 dockets) plus a bare `10013` remainder of 4 dockets whose
  documents carry no client evidence (label "unattributed",
  `attribution_source = filename`).
- **Family 10073 shows zero phantom patents — met.** No application or patent
  is a member of any `10073` family; the eight enrichment patents that the
  old fan-out attached to it survive only as 9 `mentioned_in_family` edges.
- **Application `13/572,982` anchors exactly one family — not met as
  worded, met in substance.** The number is cited by docket documents of six
  different keyed families (it is a cross-citation, not a filing of any of
  them), so the build gives it no membership (`attribution_source =
  mention`, 0 `files_as`, 6 mention edges). The criterion assumed a unique
  home that the corpus does not support; the cartesian seven-family
  membership is gone, which is what the criterion was guarding.
- **G-1/G-3 spot re-runs on the Windows target — pending** (needs the
  rebuilt bundle copied to the target and a fresh Claude Desktop chat with
  memory cleared; workstation has no Claude Desktop, D-10b).

## Review wave (PR #1430, same day)

Twelve reviewer threads reduced to nine defects, all fixed before the numbers
above were taken:

- `kg_docket_family` counts are now per matched family, not summed across
  every family a bare number matches.
- An anchor is a member only when exactly one family mentions it across file
  names and text together, and that family is client-keyed; an unattributed
  bare family never owns an anchor.
- An anchor's own record replaces a parent stub minted earlier by a child's
  `continuation_of`.
- Family, docket, and client nodes whose only evidence is a recycle stub are
  labelled `recycled-unverified`, not just the document.
- Reference scans keep the docket code, so a document that cites another
  client's matter under the same family number is attributed by the reference
  naming its own docket.
- The PGlite store format is versioned `2`; the host refuses an older bundle
  with a message naming both formats instead of a generic invalid-manifest
  error. The shipped `2026-07-27-01` bundle must be replaced together with
  the server.
- `kg_application_lookup` accepts a bare docket as well as a client-keyed one.
- The rebuild-determinism test no longer depends on a frozen clock.

## Not done / operator decisions

- The P3 candidate claims live in the shipped bundle's `kg.pglite`; the P6
  rebuild starts a fresh store, so the claims batch
  (`apps/practice-kg-mcp/src/claims.ts`, ~54 min, metered LanguageModel
  calls) must be rerun onto `practice-kg-bundle-p6` before it replaces the
  shipped bundle. Not run here because it spends API budget.
- AC-2 node provenance, typed `kg_provenance` errors, truncation signalling,
  degenerate-join detection and match offsets are P7 (B-items), unchanged.
- A-8 / A-10 / A-13 remain scope calls for Tom (PLAN "Product scope
  decisions").
