# Citation Capability Ledger

This ledger prevents “implemented the common examples” from being mistaken for
eyecite parity. It inventories canonical behavior and the known unique
TypeScript-port families. During P0, each aggregate row must expand into
case-level rows in the committed oracle manifest.

## Closed state vocabulary

The P0 machine manifest separates facts that must never be combined in one
free-form status:

- `kind`: `canonical | extension`;
- `disposition`:
  `unresolved | required | adopted | subsumed | rejected | follow-up`; and
- `workflowState`: `audit | blocked | ready | complete`.

`unresolved` is nonterminal. Canonical rows may finish only as `required` or
`subsumed` with `workflowState: complete`; `subsumed` requires named equivalent
proof. Extension rows finish as `adopted`, `subsumed`, `rejected`, or
`follow-up` with `workflowState: complete`. `follow-up` requires an existing
`successorGoal`. Every terminal row also requires rationale/source/proof
references appropriate to its disposition.

The prose tables below are P0 seed inventory, not a substitute for the
machine-readable case manifest. Provisional targets express hypotheses only;
they are not dispositions.

## Canonical official-eyecite capability families

| ID | Source | Observable capability | Target treatment | Disposition | Workflow |
| --- | --- | --- | --- | --- | --- |
| C-001 | `eyecite/__init__.py` | Public `clean_text` | Schema-decoded cleaning request and Effect operation | required | audit |
| C-002 | `eyecite/clean.py` | Named/callable cleaning pipeline; HTML, XML, whitespace, underscores; invalid step | Named schema modes plus injected server cleaner port and raw-position map | required | audit |
| C-003 | `eyecite/__init__.py` | Public `get_citations` | Effect extraction operation returning schema-modeled document/mentions | required | audit |
| C-004 | `eyecite/tokenizers.py` | Base tokenizer, reporter extractor population, overlap handling, nominative reporters | Effect-native tokenizer plus injected server tokenizer port; no native Hyperscan runtime | required | audit |
| C-005 | `eyecite/models.py` | Reporter and Edition behavior | Consume stable vocabulary IDs/lookups/version; do not copy raw data model | required | audit |
| C-006 | `eyecite/models.py` | Full case, law, and journal citations | Semantic tagged-union members with equivalent fields/normalization; U.S.C. belongs to canonical `FullLawCitation` | required | audit |
| C-007 | `eyecite/models.py` | Short case, supra, Id., reference, and unknown citations | Semantic/reference members plus separate occurrence evidence | required | audit |
| C-008 | `eyecite/models.py` | Citation comparison, corrected citation/full span, hash, resource identity | Schema-derived equivalence plus deterministic hash/normalization behavior | required | audit |
| C-009 | `eyecite/models.py` | Token, token subclasses, TokenExtractor, Resource, Document | Schema-modeled private stages; public exposure only when proved | required | audit |
| C-010 | `eyecite/find.py` | Full/short/supra/Id. extraction and metadata enrichment | Equivalent extraction stages and exact component/source anchors | required | audit |
| C-011 | `eyecite/find.py` | Reference extraction from plain text and markup | Equivalent reference mentions and antecedent guesses | required | audit |
| C-012 | `eyecite/helpers.py` | Case-name boundaries, plaintiff/defendant, court/date/pincite/parenthetical metadata | Equivalent semantic enrichment with named regression tests | required | audit |
| C-013 | `eyecite/helpers.py` | Reporter disambiguation, citation filtering, overlap resolution | Equivalent deterministic filtering with stage diagnostics | required | audit |
| C-014 | `eyecite/resolve.py` | Full authority/resource grouping | Brand-separated document-local authority/mention IDs | required | audit |
| C-015 | `eyecite/resolve.py` | Short/supra/Id./reference resolution, ambiguity, invalid pincite | Tagged stable-ID resolution data | required | audit |
| C-016 | `eyecite/__init__.py` | Public `resolve_citations` | Effect resolution operation over `CitationDocument` | required | audit |
| C-017 | `eyecite/annotate.py` | SpanUpdater and replacement-offset tracking | Consume verified normalization/raw mapping; equivalent annotation spans | required | audit |
| C-018 | `eyecite/annotate.py` | Plain/HTML annotation, tag balancing, long diff, pincite inclusion | Effect annotation operation with exact output cases | required | audit |
| C-019 | `eyecite/__init__.py` | Public `annotate_citations` | Schema-decoded annotation request and Effect operation | required | audit |
| C-020 | `eyecite/regexes.py` | Boundary, punctuation, short-cite, and reference-pincite regex composition | Behaviorally equivalent bounded JavaScript pattern strategy | required | audit |
| C-021 | `eyecite/helpers.py`, `utils.py` | Court parenthetical parser, name validity, punctuation, markup placeholders/style balancing | Port or subsume every test-observed behavior | required | audit |
| C-022 | `tests/assets/opinion.txt` | Whole-opinion extraction/annotation fixture | Attributed normalized oracle fixture | required | audit |

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

| ID | Reference capability | Provisional target | Reason/boundary | Disposition | Workflow |
| --- | --- | --- | --- | --- | --- |
| E-001 | Donor occurrence IDs, `byId`, string/parallel groups | Split/reuse by identity role | Use `CitationMentionId`/`CitationAuthorityId`; reserve shared `LawPractice.CitationId` for persisted entities | unresolved | audit |
| E-002 | Cleaning `SegmentMap`/`TransformationMap` | Subsumed composition | Mapping is required, but canonical verified-span substrate owns raw normalization semantics | unresolved | audit |
| E-003 | `extractCitationsAsync` | Subsumed | Effect represents asynchronous and synchronous execution without duplicate API | unresolved | audit |
| E-004 | Typed `CitationParseError` and validation | Adopt concepts through closed action errors | Donor exception shapes cannot leak; boundary translation follows repo Effect law | unresolved | audit |
| E-005 | False-positive filters | Adopt when proved | Useful hardening after canonical results remain attributable | unresolved | audit |
| E-006 | Granular full-form extractors beyond Python forms | Adopt when proved | Legal semantic extensions belong in the same tagged union, not a second hierarchy | unresolved | audit |
| E-007 | State/federal statute and regulation special forms | Reconcile before adoption | 35 U.S.C. is canonical `FullLawCitation`; audit 37 C.F.R. and residual donor-only fields separately | unresolved | audit |
| E-008 | Court normalization/inference and pincite parsing | Split between prerequisite and tested parser behavior | Consume vocabulary public contract; preserve only unique tested parsing behavior | unresolved | audit |
| E-009 | `DocumentResolver`, scope strategies, fuzzy candidate indexes | Adopt only deterministic proved semantics | Resolution output remains brand-separated tagged data; no hidden heuristics | unresolved | audit |
| E-010 | Footnote detection/tagging/zones | Adopt when exact source zones are proved | Occurrence evidence, never semantic citation fields | unresolved | audit |
| E-011 | Document analysis, citation graph, quote attribution | Likely follow-up | Broader document understanding must not bloat the engine; a final follow-up needs an existing named goal | unresolved | audit |
| E-012 | Surrounding context and case grouping helpers | Derive or subsume | Prefer `CitationDocument` projections over duplicate value truth | unresolved | audit |
| E-013 | Durable locators | Subsumed | Verified-span prerequisite owns durable source identity/re-anchor semantics | unresolved | audit |
| E-014 | `toBluebook` / `formatBluebook` | Adopt as schema transforms | Required source-supported transformation proof; not a formatter API | unresolved | audit |
| E-015 | Parallel-citation ranking/reordering | Adopt when legally sourced and proved | Presentation behavior belongs to structured Bluebook transformation | unresolved | audit |
| E-016 | `IdLawCitation` and section substitution | Adopt when proved | Coherent resolution extension for statutory authorities | unresolved | audit |
| E-017 | `DOLOpinionCitation` | Adopt when proved and vocabulary-backed | Coherent legal form using exact anchors and brand-separated identities | unresolved | audit |
| E-018 | `CaseNameCitation` and explicit overlap modes | Adopt when proved | Reconcile with canonical markup references | unresolved | audit |
| E-019 | Convenience HTML annotation APIs | Subsumed | One schema-decoded annotation operation selects text/HTML mode | unresolved | audit |
| E-020 | Raw `COURTS`/`REPORTERS` exports | Reject | Violates the stable public vocabulary boundary | rejected | complete |
| E-021 | Native/custom tokenizer class API parity | Subsumed behavior | Preserve injectable behavior through server service/Layer, not donor class layout or function-valued schema fields | unresolved | audit |
| E-022 | Generic utility exports (`bisect*`, guards, asserts) | Subsumed unless product-relevant | Reuse Effect/schema-derived helpers; do not port helper surface for its own sake | unresolved | audit |

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
9. closed `kind`, `disposition`, and `workflowState` fields plus any
   `blockedBy`/`successorGoal` and divergence reference; and
10. proof command/result.

Aggregate method coverage or line coverage cannot substitute for this manifest.

## Completion queries

Before P4 can pass, machine-check the ledger for:

- zero unknown or composite `kind`, `disposition`, or `workflowState` values;
- zero canonical cases missing a target test;
- zero canonical cases with `unresolved`, `rejected`, or `follow-up`
  disposition or noncomplete workflow;
- zero extension exports/test families without a complete terminal disposition;
- zero adopted extension rows without a regression test and source citation;
- zero `follow-up` rows without an existing named `successorGoal`;
- zero divergence rows without rationale and normalized comparison evidence; and
- zero incorporated fixtures without license/provenance metadata;
- zero duplicate case IDs or proof-target IDs; and
- exact set equality between independently generated source inventory, runtime
  case export, and canonical manifest rows.
