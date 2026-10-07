# Phase 1 gate — source intake, acquisition and navigation

Recorded 2026-10-06. This report closes the source-accounting and implementation
verification boundary. The orchestrator admitted the final navigation gate and
authorized Phase 2 reading. This document does not admit unread sources as
support for findings.

## Verified census and source accounting

The reusable library is `~/YeeBois/research/beep-effect/`. Its final catalog
contains 143 input files, 142 parsed documents, 5,389 citation occurrences and
1,175 stable source identities. The maintained status command was run against
the final catalog to confirm the following mutually exclusive **source-level**
categories, rather than infer them from version totals:

| Current source category | Sources | Meaning |
| --- | ---: | --- |
| Readable | 985 | Required source evidence is complete and passes the strict integrity/provenance gate. |
| Unavailable | 7 | Reviewed, evidence-bound unavailability at the recorded locator and capture time. |
| Ambiguous | 2 | Reviewed ambiguity remains explicit. |
| Incomplete | 29 | Reviewed partial evidence; complete reading is not claimed. |
| Tool-blocked | 16 | Reviewed retrieval-route failure; upstream unavailability is not inferred. |
| Internal | 56 | Reviewed internal references, separately accounted. |
| Operational | 12 | Reviewed operational references, separately accounted. |
| Non-reference | 68 | Reviewed code/protocol tokens or other citation candidates that are not external source references. Original occurrences remain preserved. |
| **Total** | **1,175** | **Missing: 0.** |

The strict verifier passed with `integrityFailures=0`, `requiredFailed=0` and
`missing=0`. It separately reports **998 readable source/version obligations**:
one source identity can have more than one required version, so this is neither
a count of distinct readable sources nor a count of acquisition attempts.

The older verifier headline `unavailable=75` groups **7 unavailable + 56 internal
+ 12 operational**. It does not mean that 75 external sources were inaccessible.
Historical failed, interrupted, unsupported and blocked attempts remain visible
and are not used as current source-category totals.

The gate allows each required reference/version to be covered by complete,
validated reading evidence or a valid explicit reviewed disposition. A
reviewed disposition closes accounting, not reading. An unreviewed failed or
blocked attempt cannot satisfy this boundary.

## Acquisition and provenance evidence

There are **105 actual Git repository clones** under `repos/github/<owner>/<name>`
and **10 YouTube source identities**. Clone pins and API discussion/diff evidence
are separate obligations: a default-branch clone does not by itself constitute
reading a cited issue, pull request, file or release. Complete legacy API diffs
do not require every closed PR head object to exist in that clone. New explicit
diff provenance and genuinely empty PR diffs retain their strict checks.

All **seven required routes** have verified operational evidence: Firecrawl,
GitHub, native paper acquisition, YouTube captions, alphaXiv, Grok deep research
and Grok X import/search. These qualifications bind actual source captures or
provider events; installed commands and version output do not qualify a route.

Grok evidence records execution of the actual deep-research workflow and native
X Search. The observed provider stream did not establish complete original post
bodies for the 27 cited X references. All **27 remain explicitly incomplete**;
they cannot affirm source claims. The other two incomplete sources are the
GitHub release and commit listings that reached the maintained 100-page bound.

Original evidence, source identities, requested and captured versions, byte
counts and SHA-256 hashes remain preserved. Corrections and readmissions are
additive. The final Akron article repair preserved its original UTF-8 BOM in
exact artifact decoding, rather than changing source text or relaxing equality.
The false text mismatch was documented and the original capture was readmitted
with a separate local validation receipt.

## Verification and navigation boundaries

`quality package-verify @beep/repo-cli` **run 5 passed audit and docgen with exit
0**. Run 4 ended with interruption/exit 130 and is not successful verification
proof. The focused view/evidence suite passed 69 tests after the final BOM repair;
package type checking and formatting also passed.

The browser evidence exercises direct `file://` navigation, search/filter
controls, narrow-window layout, escaped evidence views and report/source/evidence
backlinks. Round 5's independent judge read the timeline and opened all 20
included images, excluded three dropped frames, and reported **zero findings,
required count 0**. The exact judge result was saved and successfully ingested with required findings
0; final rendering completed and the orchestrator admitted navigation. Phase 2
reading is now authorized. Neither browser evidence nor source-accounting
completion is a substantive research finding.

## Reuse, relocation and retained receipts

A disposable later-intake demonstration added a distinct same-day immutable
intake and a second report/occurrence while preserving the original intake bytes,
stable source identity and capture ID. Repeating acquisition preserved the same
capture ID. This demonstrates receipt/object reuse; whole catalog bytes are not
an acquisition-idempotence promise because catalog history can advance.

The relocation fixture was refreshed from the final catalog and render; catalog
and index hashes match between source and copy, and five direct-file browser
scenarios passed. An initial plain copy could not replace existing read-only Git
objects in the owned disposable fixture; the corrected copy replaced those
destination files and exited 0 without mutating the source library. Generated
navigation uses relative links and does not require a server, CDN or fetch.

Small operational receipts survive lane retirement in
`ops/session-evidence/2026-10-06/phase1-closeout/` within the external library.
The folder's `manifest.json` and additive `navigation-manifest.json` bind each
preserved file's relative path, byte count and SHA-256;
`relocation-final-manifest.json` adds the refreshed final-copy proof. It includes final strict verify/status, package-verification
run 5, later-intake/idempotence and relocation receipts, final repair checks,
and round-5 recorder/judge-pack metadata. Source originals already remain in the
library; large provider results, videos and credentials were not copied into
this closeout packet.

The confirmed catalog snapshot SHA-256 is
`ee8274008bc6a21e8c372bb6309bcc9fce053981ea1e1c56cc3ad79152b1b453`.

## Additive Phase 2 checkpoint

The gate above records the original intake at the time Phase 2 was admitted.
Substantive reading later identified three gated article excerpts that were not
complete source bodies. Their reviewed incomplete dispositions preserve the
original captures. The implementation now selects current valid evidence in
catalog append order for each requested revision, so historical readable captures
cannot mask a later human review. A later valid acquisition can restore reading
without deleting that history. Wrong-revision or corrupt reviews cannot override
valid evidence, and historical artifact integrity is still checked.

Seven gap-bound sources and one discovery document were then added. Final strict
verification reports 989 readable, 7 unavailable, 2 ambiguous, 32 incomplete,
16 tool-blocked, 56 internal, 12 operational and 68 non-reference sources: 1,182
in total, with zero missing or integrity failures. The original denominator and
supplemental intake remain separate in [final coverage](COVERAGE.md).
