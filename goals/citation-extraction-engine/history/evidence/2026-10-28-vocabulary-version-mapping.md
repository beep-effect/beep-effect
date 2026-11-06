# Frozen oracle to public vocabulary mapping — 2026-10-28

Reviewer: Codex. Result: identity-compatible with explicit source-version
adaptations. Every legacy case reporter, edition and court has an accounted
public identity. Law/journal publications remain distinct canonical families.
This clears the data-coverage question from prerequisite admission; it does
not prove engine behavior or close P0's remaining accounting/safety gates.

## Sources and public boundary

The behavior oracle remains eyecite commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, with reporters-db 3.2.53 and
courts-db 0.10.22. No dependency, upstream source or prerequisite was changed.

The public vocabulary remains artifact `crv1:f353e51400a5:fad63b383b92`,
schema `court-reporter-vocabulary/v1`, projection 1, reporters-db 3.2.66 and
courts-db 0.10.27. The audit consumes only
`@beep/law-practice-domain/values/CourtReporterVocabulary`:
`CourtReporterArtifact`, `CourtReporterArtifactContract`, `CourtId`,
`ReporterId` and ambiguity-preserving `findReportersByAlias`.
It imports no generated/private vocabulary module.

`ops/export-public-vocabulary.ts` snapshots the public structured codec into
the task cache. `ops/export-vocabulary-mapping.py` validates the clean oracle
pin/tree and dependency versions, reads its original publication/court data,
and reconciles every content-addressed Reporter/Edition artifact from the
existing operation corpus. It emits portable `vocabulary-mapping.json` under
the eyecite fixture directory. The test-only schema is
`CitationOracleVocabularyMapping` from
`@beep/law-practice-use-cases/test`.

## Complete identity coverage

| Frozen source | Records | Treatment |
| --- | ---: | --- |
| Case reporters | 1,259 | Current public `ReporterId` |
| Law publications | 373 | Canonical `FullLawCitation` source data |
| Journal publications | 798 | Canonical `FullJournalCitation` source data |
| All publication editions | 2,533 | Exact parent-artifact relationship |
| Courts | 2,798 | Same public `CourtId`, preserving legacy selection order |

The 2,430 publication records have exact set equality with the frozen Reporter
artifacts; the 2,533 editions similarly match every Edition artifact. No
publication or edition disappears because the public vocabulary is newer.

Law and journal records are not case-reporter identities. Giving them a new
`ReporterId` would misrepresent the public contract, whose records cover case
reporters. Keep their publication spelling, name, source/cite type and edition
bounds in the frozen parser data and corresponding legal citation semantics.
This is semantic separation of the oracle's generic Reporter container, not a
second public case-reporter vocabulary. The parser does not mint public IDs.
Two law-source names are empty upstream (`Or. Laws Spec. Sess.` and
`Or. Laws Adv. Sh.`); the evidence schema preserves those values rather than
inventing names or refusing otherwise valid source records.

## Three reviewed identity transitions

1,256 case-reporter source tuples match the current primary abbreviation,
name and cite type exactly. Three require explicit source-bound transitions:

- Legacy `C.I.T.` / specialty / Court of International Trade Reports maps to
  `reporter:ec9ba165d777489bf3ceb824`. The public `Ct. Int'l Trade` record
  explicitly owns `C.I.T.` as an alias. This consolidates two legacy records
  into one current identity; it does not conflate the separate neutral `CIT`
  reporter.
- Legacy `Ct. Int'l Trade` / federal / the same report name maps to that same
  public identity. The current cite type is specialty. The old cite type
  remains available to reproduce the frozen oracle's behavior.
- Legacy `Teiss.` / state / Louisiana Court of Appeals Reports, Teisser maps
  to `reporter:d6ce49dfb219086bae7a6d8a`. The current name corrects Teisser
  to Teissier, with the same abbreviation, edition dates and jurisdictions.

These are exact reviewed tuple-to-ID bindings, not fuzzy matching or a
first-alias shortcut. `Woolw.` continues to return both public candidates; the
correct source identity selects its own candidate. An ambiguity corruption
control proves that replacing it with the other valid alias owner fails.

## Version-sensitive metadata and parser behavior

The mapping retains all differences instead of substituting current data:

- Six reporter records have differing projected metadata: `Wash.`,
  `Wash. App.`, `Teiss.`, `C.I.T.`, `N.W.` and `Ct. Int'l Trade`.
- Three legacy edition rows differ. `N.W.2d` now ends on 2023-12-31 and
  `Wash. 2d` on 2023-02-19; both legacy ends were open. Historical `C.I.T.`
  maps to the current `Ct. Int'l Trade` edition, whose start is 1980-01-01,
  while the legacy edition began in 1750.
- The current reporter metadata also contains newer editions within existing
  report families. Their existence does not add frozen parser patterns.
- Twenty-four courts have jurisdiction metadata changes after normalizing
  legacy single-element jurisdiction arrays. Every legacy court name,
  citation string and projected start/end range still matches. Extra legacy
  date metadata such as reorganization lists remains in the evidence but is
  outside the public effective-range projection.

The public identities and frozen parsing data have different jobs. The engine
must use the public IDs while preserving the oracle's old edition dates,
reporter metadata, regex configurations and ordered court-parenthetical
selection. For example, current closed edition dates must not silently change
`Edition.includes_year` or reporter disambiguation. The oracle's court helper
reads the ordered IDs/citation strings; the fixture hashes that exact sequence.
A control rejects replacing the old N.W.2d bound with the current bound.

A focused exact-pin probe uses `1 C.I.T. 1. 1 Ct. Int'l Trade 1.`. The oracle
extracts two full case citations, compares them unequal and resolves them into
two separate authority groups, even though their reporters map to one public
identity. The retained `cit-identity-merger-probe.json` and
`ops/probe-identity-merger.py` reproduce this result. The authority key must
retain the frozen corrected edition/reporter semantics; using only the current
ReporterId plus volume/page would incorrectly merge these groups. This probe
still requires integration into the final supplemental case ledger.

The public artifact has four reporter records outside the mapped legacy set:
Arizona Cases Digest, Texas Business Court, Virgin Islands Superior Court
Neutral Citation and LexisNexis Vermont Superior Court. It also has eleven new
court IDs. These are recorded as public-only additions; their presence does
not silently expand the canonical old parser's behavior. Any accepted parser
extension still requires its own disposition and regression proof.

No published ID is reassigned or replaced. The three legacy tuples were not
previously issued public IDs, so their explicit bindings do not alter the
prerequisite's ID lifecycle policy. The implementation must retain the mapping
and source-data version alongside its parser artifact version. Reversing this
adaptation requires a new reviewed parser-data/mapping version and regenerated
proof, rather than falling back to untyped strings or private imports.

## Portable proof

```sh
bun run goals/citation-extraction-engine/ops/export-public-vocabulary.ts \
  "$CACHE_ROOT/public-vocabulary.json"
"$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/export-vocabulary-mapping.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" \
  --public-snapshot "$CACHE_ROOT/public-vocabulary.json" \
  --output packages/law-practice/use-cases/test/fixtures/eyecite/vocabulary-mapping.json
bun run goals/citation-extraction-engine/ops/check-vocabulary-mapping.ts
python goals/citation-extraction-engine/ops/verify-vocabulary-controls.py \
  --scratch-root "$CACHE_ROOT"
bun run beep quality package-verify @beep/law-practice-use-cases
```

The portable checker verifies exact artifact-set coverage, immutable parent
relationships, public identity existence, exact versus reviewed tuple
transitions, all reporter/edition/court differences, ordered court selection
and the complete public-only additions. Unknown extra fields fail decoding,
including a forged `ReporterId` on a law publication.

Observed: the audit passes, all 20 actual-validator corruption controls pass,
and full package audit/docgen pass. Controls include missing/duplicate source
rows, unissued or wrong ambiguous IDs, an invented noncase ID, erased identity
transitions or metadata differences, edition-parent corruption, substitution
of a current date into legacy data, altered court order/strings, stale version
or source hashes, and unaccounted additions.

A fresh public snapshot and second oracle export produce byte-identical
mapping bytes: 2,994,269 bytes, SHA-256
`b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5`.
Logs accompany this receipt.

## Remaining scope

This is a representation/data compatibility proof. The future engine still
must implement and test the mapping, retain frozen behavior under its own
versioned parser artifact, and prove exact source anchors. Supplemental oracle
probes, donor decisions, schema-owned limits, regex execution strategy, final
parity-gate integration and all implementation/closeout gates remain open.
