# Original plain case-name helper under one invocation authority

The private CaseName stage now composes the existing default scan and candidate
processor in the original find_case_name order. Both phases are exposed as
internal functions for enclosing composition while their standalone stages
remain available. The combined stage reuses the existing metadata owner, so it
acquires operation admission once and shares the Scope, captured deadline,
native admission and text authority rather than nesting admitted stages.
Every extract method has R=never.

Only a truthy candidate reaches processing. None and native empty text preserve
every metadata/year/span field, even when scanning found a pre-citation year or
a versus token. For a reached versus token, source UserString truth depends on
its native length rather than merely its presence. Processing retains the
existing arbitrary-precision year result and field-preserving patch. The source
no-assignment patch is shared with the existing processor instead of duplicated.
Source None word projection uses the established native representation of None;
general host truth/model protocols remain separate.

## Direct original composition evidence

The producer calls the actual original find_case_name, not a reconstruction of
scan/process results. It uses all 64 sealed source scan inputs crossed with
full/short citation and fresh/seeded metadata. Original models, complete before/
after metadata/year/span snapshots, the reached-processing flag and real regex
call counts are retained. The scan corpus and source/license identities are
sealed as dependencies. Runtime is CPython 3.11.15 and regex 2023.12.25 at the
unchanged clean oracle commit/tree.

There are 256 calls: 120 reach processing, 104 succeed without it and 32 fail
during scanning. They make 1,912 original regex calls. All false-candidate paths
retain the complete initial snapshot; this is the source guard that standalone
processing tests could not establish. Both hash-seed exports are byte-identical.
The portable verifier passes seven corruption controls and exact pinned replay.

- Producer SHA-256: 3305e1ee61adebca9f177becca49ace82b89e096268a9bad017db9548d839469
- Corpus SHA-256: a63b136ccfac79f2dbf0c3ca38797d40cdb2d8296eb06b035ac676ed563ba1a2
- Scan dependency SHA-256: 9731078b964f5daa0c075b630a5fa236efe06cb297c123f45f39a637bbac9553

The combined target smoke selects ten original calls: no-op/seeded preservation,
the discovered-year guard, versus processing, short-mode assignments and all
three source scan failure classes. Both Bun and Node match metadata, native
state, numeric year, full-span start and independently confirm exactly 72 child
exits per runtime. No operation or native work remains active, queued or
quarantined. The full 256-case replay is registered in hosted integration and
must confirm 1,912 child exits per runtime; it remains pending.

The near-complete-budget control first measures successful combined work, then
installs an allowance one unit smaller. It reaches beyond the scan's child count
into processing and fails with the original producedTextUtf16 safety error,
retaining spent work and independently confirming every started child. This
guards against giving processing a fresh budget. Existing standalone scanner
and processor tests remain in the regression.

## Hosted duplication repair

Hosted Fallow job 127849308861 on e4e5f8bee4 reports no cognitive finding, but
artifact 13496157742 identifies clone dup:e6d237dc between the plain scanner and
HTML name word-count preflight. Both now reuse decodeCitationMetadataWordRequest
in the existing MetadataComposition module. Schema decoding still precedes the
captured token-count limit and word preparation; each caller retains its closed
invalid-input error. There is no changed threshold, baseline or ignored path.

An isolated source scan reports no cognitive/cyclomatic excess. Its duplicate
check also exposed a copied no-assignment patch; sharing the processor's patch
removed that group. The final isolated duplicate check reports zero groups.
These scans lack the repository dependency/coverage graph and are not passing
hosted gates. A pure exported error translator uses Effect dual for the required
data-first/pipeable API; no lint suppression was added.

The five-file regression passes 31 tests in 26.51 seconds across composed/plain
scan/processing, HTML names and regex protocol controls. Package lint and source/
test checks pass (0.4/3.4 seconds). The focused shared-budget and original guard
controls also pass as part of that run. Hosted exact-head repair and all full
replays remain required.

After sharing the existing no-assignment patch, the focused eight-test composed/
processing regression passes in 12.36 seconds and package checks pass again
(0.4/3.2 seconds). No further runtime changes follow those receipts.

The first publication attempt stopped at a transient fetch failure. A direct
retry succeeded; main's unrelated #2746 repair and citation replay #2749 were
then merged, through 4d79b1d1c4. The latter retains the exported source loader,
uses controlled extraction time for semantic replay and adds an explicit common
stage-deadline test. The post-merge composed/processing suite passes all nine
tests in 12.85 seconds, and package checks pass (0.4/3.8 seconds). Source-bound
hashes are refreshed for the integrated fixture. No production runtime changes
are made by this follow-up synchronization.

## Remaining full goal

This completes the built-in helper connection, not full extraction or the public
engine Layer. Full metadata phase ordering and the HTML-to-plain fallback still
need enclosing model integration; general host/alias/model mutation and exception
translation remain required. Whole-engine allocation/scaling, remaining parser/
resolver behavior, public semantic codecs/service/Layer, exhaustive source and
donor accounting, reflection and lifecycle closeout are unchanged. All eleven
representation laws, four fidelity questions and fifteen unfinished proof rows
remain open, with no semantic waiver.
