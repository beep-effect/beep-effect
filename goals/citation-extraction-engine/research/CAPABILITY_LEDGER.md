# Citation Capability Ledger

This ledger prevents “implemented the common examples” from being mistaken for
eyecite parity. It inventories canonical behavior and the known unique
TypeScript-port families. During P0, each aggregate row must expand into
case-level rows in the committed oracle manifest.

## Status vocabulary

- `baseline-verified`: source/pin behavior was directly executed or inspected.
- `required`: canonical capability; implementation and proof are mandatory.
- `audit`: extension candidate; run its pinned tests and apply the extension
  gates before assigning a terminal disposition.
- `adopt`: intended extension target, conditional only on reproducible source
  proof and safety.
- `subsumed`: target behavior belongs to another named repo-native capability.
- `follow-up`: deliberately belongs to a named successor, not this public API.
- `blocked`: implementation waits on a prerequisite contract.
- `complete`: implementation and case-level proof landed.

No canonical row may finish as `rejected`, `follow-up`, or unexplained.

## Canonical official-eyecite capability families

| ID | Source | Observable capability | Target treatment | Current state |
| --- | --- | --- | --- | --- |
| C-001 | `eyecite/__init__.py` | Public `clean_text` | Schema-decoded cleaning request and Effect operation | required |
| C-002 | `eyecite/clean.py` | Named/callable cleaning pipeline; HTML, XML, whitespace, underscores; invalid step | Equivalent deterministic cleaning plus raw-position map | required/blocked |
| C-003 | `eyecite/__init__.py` | Public `get_citations` | Effect extraction operation returning schema-modeled document/mentions | required |
| C-004 | `eyecite/tokenizers.py` | Base tokenizer, reporter extractor population, overlap handling, nominative reporters | Effect-native tokenizer with equivalent tokens/candidates; no native Hyperscan runtime | required/blocked |
| C-005 | `eyecite/models.py` | Reporter and Edition behavior | Consume stable vocabulary IDs/lookups/version; do not copy raw data model | required/blocked |
| C-006 | `eyecite/models.py` | Full case, law, and journal citations | Semantic tagged-union members with equivalent fields/normalization | required/blocked |
| C-007 | `eyecite/models.py` | Short case, supra, Id., reference, and unknown citations | Semantic/reference members plus separate occurrence evidence | required/blocked |
| C-008 | `eyecite/models.py` | Citation comparison, corrected citation/full span, hash, resource identity | Schema-derived equivalence plus deterministic hash/normalization behavior | required |
| C-009 | `eyecite/models.py` | Token, token subclasses, TokenExtractor, Resource, Document | Schema-modeled internal stages; public exposure only when needed | required |
| C-010 | `eyecite/find.py` | Full/short/supra/Id. extraction and metadata enrichment | Equivalent extraction stages and exact component/source anchors | required/blocked |
| C-011 | `eyecite/find.py` | Reference extraction from plain text and markup | Equivalent reference mentions and antecedent guesses | required/blocked |
| C-012 | `eyecite/helpers.py` | Case-name boundaries, plaintiff/defendant, court/date/pincite/parenthetical metadata | Equivalent semantic enrichment with named regression tests | required/blocked |
| C-013 | `eyecite/helpers.py` | Reporter disambiguation, citation filtering, overlap resolution | Equivalent deterministic filtering with stage diagnostics | required/blocked |
| C-014 | `eyecite/resolve.py` | Full authority/resource grouping | Stable-ID authority groups | required/blocked |
| C-015 | `eyecite/resolve.py` | Short/supra/Id./reference resolution, ambiguity, invalid pincite | Tagged stable-ID resolution results | required/blocked |
| C-016 | `eyecite/__init__.py` | Public `resolve_citations` | Effect resolution operation over `CitationDocument` | required |
| C-017 | `eyecite/annotate.py` | SpanUpdater and replacement-offset tracking | Consume verified normalization/raw mapping; equivalent annotation spans | required/blocked |
| C-018 | `eyecite/annotate.py` | Plain/HTML annotation, tag balancing, long diff, pincite inclusion | Effect annotation operation with exact output cases | required/blocked |
| C-019 | `eyecite/__init__.py` | Public `annotate_citations` | Schema-decoded annotation request and Effect operation | required |
| C-020 | `eyecite/regexes.py` | Boundary, punctuation, short-cite, and reference-pincite regex composition | Behaviorally equivalent bounded JavaScript pattern strategy | required |
| C-021 | `eyecite/helpers.py`, `utils.py` | Court parenthetical parser, name validity, punctuation, markup placeholders/style balancing | Port or subsume every test-observed behavior | required/blocked |
| C-022 | `tests/assets/opinion.txt` | Whole-opinion extraction/annotation fixture | Attributed normalized oracle fixture | required |

## Official unittest-method inventory

The exact pin has 52 unittest methods. These IDs are source anchors, not the
final case granularity: every asserted tuple, `subTest`, and parameter entry
inside them must become a separate oracle-manifest row.

### Cleaning and utilities

- `UtilsTest.test_clean_text`
- `UtilsTest.test_clean_text_invalid`
- `UtilsTest.test_dump_citations`

### Tokenization and regex/court helpers

- `TokenizerTest.test_reporter_tokenizer`
- `TokenizerTest.test_overlapping_regexes`
- `TokenizerTest.test_extractor_filter`
- `RegexesTest.test_roman_numeral_regex`
- `RegexesTest.test_parenthetical_court_parser`

### Models, identity, correction, and comparison

- `ModelsTest.test_citation_comparison`
- `ModelsTest.test_resource_comparison`
- `ModelsTest.test_resource_comparison_with_missing_page_cites`
- `ModelsTest.test_citation_comparison_with_missing_page_cites`
- `ModelsTest.test_citation_comparison_with_corrected_reporter`
- `ModelsTest.test_citation_comparison_with_different_source_text`
- `ModelsTest.test_citation_comparison_with_nominative_reporter`
- `ModelsTest.test_citation_comparison_with_different_reporter`
- `ModelsTest.test_tax_court_citation_comparison`
- `ModelsTest.test_id_citation_comparison`
- `ModelsTest.test_unknown_citation_comparison`
- `ModelsTest.test_missing_page_cite_conversion`
- `ModelsTest.test_persistent_hash`
- `ModelsTest.test_hash_function_identity`
- `ModelsTest.test_corrected_full_citation_includes_closing_parenthesis`
- `ModelsTest.test_page_correction`

### Finding, metadata, filtering, spans, and references

- `FindTest.test_find_citations`
- `FindTest.test_find_law_citations`
- `FindTest.test_find_journal_citations`
- `FindTest.test_find_tc_citations`
- `FindTest.test_date_in_editions`
- `FindTest.test_citation_filtering`
- `FindTest.test_disambiguate_citations`
- `FindTest.test_nominative_reporter_overlaps`
- `FindTest.test_custom_tokenizer`
- `FindTest.test_citation_fullspan`
- `FindTest.test_reference_extraction_using_resolved_names`
- `FindTest.test_reference_extraction_from_markup`
- `FindTest.test_reference_filtering`
- `FindTest.test_markup_plaintiff_and_antecedent_guesses`
- `FindTest.test_citation_in_parenthetical_does_not_emit_warning`

### Resolution

- `ResolveTest.test_issue_167`
- `ResolveTest.test_full_resolution`
- `ResolveTest.test_supra_resolution`
- `ResolveTest.test_short_resolution`
- `ResolveTest.test_ambigous_short_cite`
- `ResolveTest.test_id_resolution`
- `ResolveTest.test_non_case_resolution`
- `ResolveTest.test_complex_resolution`
- `ResolveTest.test_reference_resolution`

### Annotation

- `AnnotateTest.test_annotate`
- `AnnotateTest.test_tag_balancing`
- `AnnotateTest.test_long_diff`
- `AnnotateTest.test_span_with_pincite`

## TypeScript-port extension families

These are family-level seed rows. P0 must enumerate every public export and
test-observed unique behavior at the pinned commits, identify overlap between
the ports, and then assign one terminal disposition.

Both pinned suite attempts are currently environment-blocked by absent
JavaScript dependencies; see `EYECITE_BASELINE.md`. Source inspection can seed
rows, but no extension becomes “proven” until its donor tests execute.

| ID | Reference capability | Intended disposition | Reason/boundary | Current state |
| --- | --- | --- | --- | --- |
| E-001 | Stable `CitationId`, `byId`, string/parallel groups | adopt | Required for non-fragile evidence and resolution relationships | audit |
| E-002 | Cleaning `SegmentMap`/`TransformationMap` | subsumed/adopt composition | Mapping is required, but canonical verified-span substrate owns raw normalization semantics | audit/blocked |
| E-003 | `extractCitationsAsync` | subsumed | Effect already represents asynchronous and synchronous execution without duplicate API | audit |
| E-004 | Typed `CitationParseError` and validation | adopt as schema-backed typed errors | Matches repo Effect boundary law | audit |
| E-005 | False-positive filters | adopt when source tests prove correctness | Useful hardening after canonical results remain attributable | audit |
| E-006 | Granular full-form extractors beyond Python forms | adopt when test-backed | Legal semantic extensions belong in the same tagged union, not a second hierarchy | audit |
| E-007 | State/federal statute and regulation special forms | adopt when test-backed | Includes ratified 35 U.S.C./37 C.F.R. product pull and coherent legal forms | audit |
| E-008 | Court normalization/inference and pincite parsing | subsumed/adopt composition | Consume vocabulary public contract; preserve unique tested parsing behavior | audit/blocked |
| E-009 | `DocumentResolver`, scope strategies, fuzzy candidate indexes | adopt only deterministic tested semantics | Resolution output must remain stable-ID tagged outcomes; no hidden heuristics | audit |
| E-010 | Footnote detection/tagging/zones | adopt when exact source zones are proven | Occurrence evidence, never semantic citation fields | audit/blocked |
| E-011 | Document analysis, citation graph, quote attribution | follow-up unless required by adopted extraction/resolution proof | Broader document-understanding product capability must not bloat the core engine silently | audit |
| E-012 | Surrounding context and case grouping helpers | adopt/subsume | Prefer derived `CitationDocument` projections over duplicate value truth | audit |
| E-013 | Durable locators | subsumed | Verified-span prerequisite owns durable source identity/re-anchor semantics | audit/blocked |
| E-014 | `toBluebook` / `formatBluebook` | adopt as schema transforms, not formatter API | Required transformation proof; source-supported subset only | audit |
| E-015 | Parallel-citation ranking/reordering | adopt when legally sourced and tested | Presentation behavior belongs to structured Bluebook transform | audit |
| E-016 | `IdLawCitation` and section substitution | adopt when test-backed | Coherent canonical-resolution extension for statutory authorities | audit |
| E-017 | `DOLOpinionCitation` | adopt when test-backed and vocabulary-backed | Coherent legal form; must use stable identity and exact anchors | audit/blocked |
| E-018 | `CaseNameCitation` and explicit overlap modes | adopt when test-backed | Useful reference extraction semantics; must reconcile with canonical markup references | audit |
| E-019 | Convenience HTML annotation APIs | subsumed | One schema-decoded annotation operation should select text/HTML mode | audit |
| E-020 | Raw `COURTS`/`REPORTERS` exports | rejected | Violates the stable public vocabulary boundary | terminal |
| E-021 | Native/custom tokenizer class API parity | subsumed | Preserve injectable behavior through Effect service/layer, not donor class layout | audit |
| E-022 | Generic utility exports (`bisect*`, guards, asserts) | subsumed unless independently product-relevant | Reuse Effect/schema-derived helpers; do not port helper surface for its own sake | audit |

## Required case-ledger columns

The P0 machine-readable oracle manifest must contain:

1. stable case ID;
2. source repository, commit, file, method, and local case ordinal/name;
3. license and affected-material class;
4. raw input and options;
5. canonical cleaning, token, citation, span, resolution, and annotation outputs
   applicable to that case;
6. explicit Python-code-point to UTF-16 normalization metadata;
7. normalized fixture hash and generator version;
8. target TypeScript test path/name;
9. disposition/status and divergence reference; and
10. proof command/result.

Aggregate method coverage or line coverage cannot substitute for this manifest.

## Completion queries

Before P4 can pass, machine-check the ledger for:

- zero canonical cases missing a target test;
- zero canonical cases with `unreviewed`, `rejected`, `follow-up`, or `deferred`;
- zero extension exports/test families without a terminal disposition;
- zero adopted extension rows without a regression test and source citation;
- zero divergence rows without rationale and normalized comparison evidence; and
- zero incorporated fixtures without license/provenance metadata.
