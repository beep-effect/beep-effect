# USPTO PTMNFEE2 Ingest — Sources & Provenance

This ledger reproduces the source-exploration entries relevant to the weekly
cumulative maintenance-fee release. The primary ledger and detailed research
remain:
[`research/SOURCES.md`](../../../explorations/uspto-patent-driver-depth/research/SOURCES.md)
and
[`ptmnfee2-maintenance-fee-dataset.md`](../../../explorations/uspto-patent-driver-depth/research/ptmnfee2-maintenance-fee-dataset.md).

- **Source exploration:** `explorations/uspto-patent-driver-depth`
- **Dataset:** USPTO `PTMNFEE2`, cataloged as Public Domain Mark 1.0
- **Shared generator dependency:** `goals/uspto-prosecution-read`

## 1. Relevant source corpus

No mined third-party parser is an implementation authority for the 2026 layout.
The exact delimiter/widths, members, null/date/header rules, and complete code
list must come from the current USPTO release documentation and companion file.

| Source | Established use | Disposition |
| --- | --- | --- |
| USPTO `PTMNFEE2` product page | Stable product identity and landing page | Resolve current release during authorized P0; never pin an ephemeral URL |
| Federal catalog record | Weekly cumulative semantics, ASCII/text, data dictionary, Public Domain Mark | Primary metadata/fixture-license evidence |
| USPTO Official Gazette launch notice | Tuesday cadence; event file, `MaintFeeEventsDesc`, and documentation contract | Primary shape history; current files still govern |
| ODP bulk-data Search API | API-key product discovery and Product Data route | Use for discovery; verify live response/limits |
| Current release files | Exact wire layout, full vocabulary, sizes/counts/checksums | Sole implementation authority after P0 capture |

## 2. License and fixture discipline

The federal catalog marks the dataset Public Domain Mark 1.0; USPTO terms say
most government-produced material is public domain while third-party material,
seals/logos, and URL stability need care. Fixtures may include only small
government-authored structured excerpts with source, product, release, URL,
full-source checksum, extraction identity/method, access date, and attribution.

## 3. External research sources

- [USPTO `PTMNFEE2` bulk-data product](https://data.uspto.gov/bulkdata/datasets/ptmnfee2)
- [Federal Patent Maintenance Fee Events catalog record](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)
- [USPTO Maintenance Fees Event File launch notice](https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm)
- [USPTO ODP bulk-data Search API](https://data.uspto.gov/apis/bulk-data/search)
- [USPTO ODP registration announcement](https://www.uspto.gov/about-us/news-updates/uspto-open-data-portal-require-registration-access-beginning-june-18-2026)
- [USPTO maintenance-fee guidance](https://www.uspto.gov/patents/maintain)
- [USPTO current patent maintenance-fee schedule](https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule#patent-maintenance-fees)
- [MPEP section 1415.01, reissue maintenance fees](https://www.uspto.gov/web/offices/pac/mpep/s1415.html)
- [MPEP section 2520, maintenance fee amounts](https://www.uspto.gov/web/offices/pac/mpep/s2520.html)
- [MPEP section 2591, reinstatement/intervening rights](https://www.uspto.gov/web/offices/pac/mpep/s2591.html)
- [USPTO Terms of Use](https://www.uspto.gov/terms-use-uspto-websites)

Legal timing/reissue/reinstatement sources constrain what the driver must not
infer; they belong to the patent-spine consumer, not this native parser.

## 4. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| `@beep/uspto` | `packages/drivers/uspto/src/` | extend with discovery, parse, full replacement, manifest, and fixtures |
| Four-vocabulary mechanism | `goals/uspto-prosecution-read` | required dependency; reuse without fork |
| Generate-first precedent | `goals/gov-legal-data-driver-codegen/SPEC.md` | reuse checksum, provenance, network-free build, and drift-report principles |
| Patent-spine intake | `goals/law-docketing-patent-spine` | consumer of typed fixture; owns legal conclusions |
| Reliability orchestration | `goals/law-docketing-reliability` | owns refresh scheduling/cursor/recovery |

## 5. Honest P0 unknowns

- Exact 2026 filenames, archive members, delimiter/widths, encoding, null/date/
  header rules, and row count.
- Complete contemporaneous `MaintFeeEventsDesc` enumeration and format.
- Current compressed/uncompressed sizes and response headers.
- Published/observed numeric rate limits.
- Anonymous resolved-file download behavior after 2026-06-18 registration.
- Stronger versioning than release date plus file/document/code-list checksums:
  not found and must not be invented.

## 6. Cross-links and provenance

- Source packet: [`README`](../../../explorations/uspto-patent-driver-depth/README.md),
  [`BRIEF`](../../../explorations/uspto-patent-driver-depth/BRIEF.md),
  [`MAP`](../../../explorations/uspto-patent-driver-depth/MAP.md), and
  [`DECISIONS`](../../../explorations/uspto-patent-driver-depth/DECISIONS.md).
- Dependency: [`goals/uspto-prosecution-read`](../../uspto-prosecution-read/README.md).
- Goal contract: [`SPEC.md`](../SPEC.md) and [`PLAN.md`](../PLAN.md).
