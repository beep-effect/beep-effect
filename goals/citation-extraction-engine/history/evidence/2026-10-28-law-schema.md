# Canonical law schema replacement

Date: 2026-10-28. P1 remains in progress; no target parity row is completed.

## Applied migration and consumer evidence

`FullLawCitation` now occupies the `law` branch of the existing `Citation`
and `FullCitation` schemas. It replaces the provisional `StatuteCitation` and
`RegulationCitation`. Statutes and regulations are legal classifications;
the official oracle uses one parser family for both. Their files/barrels are
removed without aliases. The unused `StatuteComponentSpan` is removed.
All three standalone
type lists (`CitationType`, `FullCitationType`, `ShortFormCitationType`) are
removed. The existing union's discriminants are the tag source; subsets now
reference `Citation.cases` members directly.

Immediately before deletion, the frozen-surface AST scan covered 7,755 source
files with no relevant parse errors. Its five external production findings
are the same reviewed package identity/build/quality metadata recorded in the
identity-foundation receipt. Two unrelated namespace test references are also
unchanged. The three required textual consumer/export scans were repeated.
Owning domain tests are migrated; no production citation-shape consumer was
found. The post-migration scan still preserves the frozen legacy inventory;
retired names cannot disappear from future scan scope just because their
source definitions are deleted.

The canonical law schema contains no inherited `CitationBase`, local citation
ID, matched text, source span, component coordinates, grouping, warning bag,
confidence or execution timing. Other provisional citation forms are still
mixed and must be replaced in later P1 work. This change does not promote the
entire union to its final semantic contract.

## Exact source mapping

The clean official pin is
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e` with the recorded tree/license.
`ops/probe-law-schema.py` emits `law-field-audit.json`, binding the producer,
source files, Python/reporters versions and frozen clock. It accounts for
575 law extractors and 19 named group keys, plus six focused observations.
This audit is maintainer source evidence, not an executable target parser.

The group keys include `act`, `agency`, `article`, `chapter`, `docket_number`,
`issue`, `kind_code`, `law`, `number`, `page`, `pamphlet`, `reg`, `reporter`,
`rule`, `section`, `subject`, `title`, `volume` and `year`. The oracle's
`CitationBase.__hash__` documentation explicitly calls these non-exhaustive
and non-guaranteed. Accordingly `components` is a schema-decoded map of legal
component names to nullable strings. It preserves supplied keys, leading
zeros, unusual legal identifiers and the difference between an absent key and
an explicit null. Null decodes to `Option.none`; no numeric coercion occurs.
It does not hold raw occurrence coordinates or extraction diagnostics.

| Provisional field | Canonical ownership/mapping |
| --- | --- |
| `title: Natural` | Textual `components.title` when the oracle supplies it. |
| `chapter` | Exact `components.chapter`; distinct from title. |
| `code` | `components.reporter`, preserving the captured legal abbreviation. |
| `section` | Exact `components.section`, including a captured range string. |
| `subsection`, `pincite` | `metadata.pinCite`; no redundant alias. |
| `publisher` | `metadata.publisher`. |
| `year: Natural` | Textual `metadata.year`; parsed validity stays private. |
| `hasEtSeq` | Canonical `metadata.pinCite` may contain `et seq.`. |
| `sectionRange`, `subsectionRange` | Donor interpretation remains in audit. |
| `recompiledYear`, `editionLabel` | Donor-only extraction remains in audit. |
| `jurisdiction` | No invented canonical field; donor/context proof is open. |
| `spans` and inherited occurrence fields | Future verified mention evidence. |

The canonical metadata also preserves textual month/day and an explanatory
parenthetical. Pin-cite span coordinates belong to occurrence evidence.
Parsed numeric year is computed by the oracle from textual metadata and its
clock-sensitive validity rule; that processing behavior remains required but
is not duplicated as encoded semantic truth.

The decisive examples are:

- `35 U.S.C. § 101 (2018)`: `title: "35"`, `reporter: "U.S.C."`,
  `section: "101"`, metadata year `"2018"`.
- `37 C.F.R. § 1.56 (2020)`: `chapter: "37"`, `reporter: "C.F.R."`,
  `section: "1.56"`, metadata year `"2020"`.
- The enriched C.F.R. probe retains `(a)`, `West`, `Jan.`, `2`, `2020` and
  `disclosure` as separate metadata strings.
- A range stays `"405.1-405.2"`. The subsection-range probe observes only
  canonical `(a)`; it does not authorize improving that behavior silently.

No separate regulation schema or accepted residual C.F.R. extension is
established. The donor obligations remain open in the exhaustive ledger.

## Publication identity and laws

`CitationEditionRef` identifies the existing immutable edition artifact by
SHA-256. `CitationLawPublication` preserves candidate multiplicity and an
optional selected member. Its schema rejects a selected ref absent from the
candidate list. Exact/variation partitioning remains a private processing
concern; the candidate bag remains available for equivalent authority hashing.
The engine must resolve refs against its owning artifact and check their
publication kind. A well-formed digest alone is not artifact-resolution proof.

Laws receive no invented case ReporterId. The existing vocabulary mapping
identifies these exact frozen law-publication editions:

- C.F.R.: `b6293de3e161f1a649d897f5d5a099841074c14ebeee8e2996e7d2c172eefe4c`.
- U.S.C.: `e6528d7da54cc9b358e645efb285f19fe9da550ed25322acf0312fafd9c7860f`.

Tests use these source-bound refs and prove structured round trips through
`FullLawCitation` and the existing unions, optional/null component fidelity,
publication ambiguity/membership, retired-tag rejection and removal of
occurrence fields from the encoded semantic model. Schema-generated law
values also pass the schema-derived equivalence round-trip property.

## Reproduction and remaining proof

```sh
PYTHONHASHSEED=0 "$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/probe-law-schema.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" --output /tmp/law-field-audit.json
bun run beep quality package-verify @beep/law-practice-domain
```

Domain package audit/docgen passed (9.7/9.8 seconds), downstream use-case
checks passed (14.0/9.1 seconds), and server checks passed (52.1/14.1 seconds).
The ten-component portable audit passes and explicitly reports missing final
target proof; it is not a parity verdict. Goals doctor reports no new blocking
findings. The final package/app source scan finds none of the six retired
symbol names, including the unused statute component schema.

Cache logs are `law-consumers.log`, `law-consumers-symbols.log`,
`law-consumers-package.log`, `law-consumers-exports.log`,
`law-post-consumers.log`, `law-schema-package-verify.log` and
`law-use-cases-verify.log`. These are local checkpoint checks. Full law
extraction, correction, edition selection, authority identity, anchors and
resolution behavior still need target implementation and differential proof.
The one-PR, complete-parity and runtime safety gates remain unchanged.
