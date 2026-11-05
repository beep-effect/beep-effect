# Canonical model semantic rebaseline

Date: 2026-10-28. P0/P1 remain in progress. No parity row is completed here.

## Source and migration boundary

`canonical-model-audit.json` records all eight canonical model/metadata field
projections and eight focused oracle probes. The maintainer producer verifies
the clean official commit/tree, Python, hash seed and reporters version before
observing the source. Its own digest, the lock/license, dependency versions,
frozen clock and source-file hashes bind the record. The probes include all
eight model families and the missing-page case. They are source evidence;
they do not execute or approve a TypeScript parser.

Before replacement, the frozen-surface AST scan examined 7,747 source files
with no relevant parse errors. Its five external production findings remain
the previously reviewed identity/build/quality metadata; the two namespace
escapes are unrelated legal-position tests. The required broad symbol,
package-import and export scans were repeated. Only owning schema code,
examples and tests need migration. No temporary compatibility bridge is used.

The old recursive `Citation.models.ts` is replaced in place with the existing
union and schema-derived subsets. Canonical form definitions live in its
adjacent semantic modules. Provisional extension branches remain in the same
union until their donor dispositions and schema migration; no second citation
hierarchy is introduced. The canonical source `ShortCaseCitation` retains the
repo semantic name `ShortFormCaseCitation`. The old `JournalCitation` is
replaced by canonical `FullJournalCitation` without an alias.

## Field ownership

| Oracle field | Target ownership |
| --- | --- |
| `groups` | `components`, preserving textual values and null versus missing. |
| `all_editions` | Immutable publication-edition candidates. |
| `edition_guess` | Optional selected edition, checked against candidates. |
| `exact_editions`, `variation_editions` | Private processing witnesses. |
| `year` | Private clock-validated projection of metadata's textual year. |
| `metadata.pin_cite` | `metadata.pinCite`, with its exact text retained. |
| `metadata.parenthetical` | Semantic explanatory string. |
| `metadata.year`, `month`, `day` | Uncoerced textual date components. |
| `metadata.court` | Known versioned court ID or explicit unmapped text. |
| `metadata.plaintiff`, `defendant` | Party/name fields. |
| `metadata.extra` | `metadata.additionalText` on full cases. |
| `metadata.antecedent_guess` | Semantic `antecedentGuess` label. |
| `metadata.resolved_case_name_short` | Enriched legal `shortCaseName`. |
| `metadata.resolved_case_name` | Enriched legal `caseName`. |
| Token, index, spans, document | Private stages/verified mentions. |
| Metadata pincite span coordinates | Future verified component anchors. |

All source metadata fields have an explicit owner. Enriched names remain
legal values, not embedded resolved-citation copies, indices or pointers.
Relationships between occurrences/authorities still belong to the unfinished
`CitationDocument`/resolution contracts. Structured codec equivalence proves
round trips; it is not a claim to implement Python citation hash/equality,
which requires the separate canonical authority-key behavior.

Known courts carry `CourtId` and `CourtReporterArtifactVersion`. An unmapped
court preserves its source value, including an explicit empty string.
Version compatibility and actual vocabulary membership must be checked by the
engine; a format-valid ID is not lookup proof.

Case publication candidates pair historical `CitationEditionRef` with public
`ReporterId`, scoped by the vocabulary version. Different editions may map to
the same reporter ID, preserving historical distinctions such as C.I.T.
A selected edition must occur in the candidate list. Engine artifact
resolution, source-kind checks and mapping compatibility remain required.
Law/journal publications share the edition-reference bag without inventing
case reporter identities.

Shared `CitationComponents` and `CitationPublication` replace the previously
law-prefixed primitive names; their structured law representation is retained.
Shared locator/date schemas remove field-definition duplication across forms.
`FullCitation.Type` and `.Encoded` are aliases derived from the schema itself,
and the named input is accepted by its schema codec in the typed test. No
manual shape interface or member list is used for those aliases.
The `law` schema and its focused codec tests migrate to these shared names.

## Applied removals and tests

The recursive `Parenthetical` and `ParentheticalType` are removed. Canonical
parenthetical content is retained as text; any adopted donor classification
and nested-document relationships need their own evidenced disposition and
stable-ID document model. The five orphaned case, short-case, Id, supra and
journal coordinate models are removed. Other provisional extension coordinate
models remain pending their migration. No replacement public offset primitive
is added; exact evidence must use the prerequisite verified anchor.

`FullCaseCitation.toBlueBook` is removed. Its old concatenation test and the
recursive citation-copy test no longer describe the target contract. The
structured Bluebook models/transforms and their directional laws/dtslint remain
mandatory, unfinished P1 work. Removing the old helper does not complete them.
Other legacy default tests remain for the provisional branches they still
exercise. Donor-specific field/classification promises remain open in the
exhaustive donor ledger; none is accepted or rejected by this migration.

Six focused semantic tests cover full/short cases, Id, supra, named reference,
unknown and journal round trips, all existing union memberships, textual/null
precision, known/unmapped courts, edition membership and historical identity
separation. They reject occurrence/recursive fields from the encoded model and
prove the old formatter is absent at the type level.
Seven independent schema-derived arbitrary tests exercise each new form
and the existing union codec. Independent generation avoids multiplying
discard rates across checked publication schemas; selected-member states
have explicit positive/negative tests. The law codec suite is retained.
These tests establish representation, not extraction,
formatting, resolution or source-anchor parity.

## Reproduction and next gate

```sh
PYTHONHASHSEED=0 "$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/probe-canonical-models.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" --output /tmp/canonical-model-audit.json
bun run beep quality package-verify @beep/law-practice-domain
```

The domain package gate passes (audit 8.7 seconds, docgen 9.9 seconds), as do
the downstream use-case gate (15.4/9.1 seconds) and server gate (45.4/19.8
seconds). The server type check is repeated after the final schema-derived
type helper. The ten-component portable audit passes while explicitly leaving
final target proof open. Goals doctor reports no new blocking findings.
The final source scan retains the same five reviewed production metadata
findings and no relevant parse errors; retired core symbols are absent from
package/app sources.

Cache records: `core-pre-consumers.json`, `core-pre-consumers.log`,
`core-symbols.log`, `core-imports.log`, `core-exports.log` and
`core-package-verify.log`, `core-server-check.log`,
`core-use-cases-verify.log`, `core-server-verify.log` and
`core-parity-audit.log`. Next implement verified mentions/receipts and stable
ID document relationships, lawful Bluebook codecs, and the actual private
extract/clean/resolve/annotate pipeline against the exhaustive corpus.
