# Court Reporter Vocabulary — Sources & Provenance

This implementation ledger carries the source corpus relevant to ingestion,
canonical vocabulary, stable identity, and compatibility. The exploration
ledger remains primary:
[`explorations/court-vocabulary-resolver/research/SOURCES.md`](../../../explorations/court-vocabulary-resolver/research/SOURCES.md).

- **Source exploration:** `explorations/court-vocabulary-resolver`
- **Ratified contract:** exploration `DECISIONS.md`, `BRIEF.md`, and `MAP.md`

## 1. Relevant mined source corpus

| Nugget | Upstream | Source | Disposition here |
| --- | --- | --- | --- |
| `courts-db#1` | courts-db | `courts_db/data/courts.json:1-27` | port with BSD-2 attribution; re-count pinned source |
| `courts-db#2` | courts-db | `courts_db/data/variables.json:1-13` | port authored regex data with attribution |
| `courts-db#6` | courts-db | `courts_db/utils.py:140-177` | reimplement deterministic template/ordinal/inheritance assembly |
| `courts-db#8` | courts-db | `courts_db/data/courts.json:68091-68113` | re-derive court-to-reporter facts from pin |
| `courtlistener#7` | courtlistener | `cl/search/models.py:1872-1937` | facts-only reference; no AGPL expression |
| `courtlistener#8` | courtlistener | `cl/search/models.py:2883-2941` | optional derived interop facts only |
| `seal-rookery#1` | seal-rookery | `seal_rookery/seals/seals.json:1-12` | license-unknown factual cross-check only |

The resolver nuggets `courts-db#3/#5/#7` inform later resolver behavior and are
not implementation scope here; P0 may scan their regex corpus only to report
compatibility evidence shared downstream.

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What this goal takes |
| --- | --- | --- | --- |
| [courts-db](https://github.com/freelawproject/courts-db) | BSD-2-Clause | port/reimplement with root attribution | pinned source data, templates, regex dictionary, deterministic assembly |
| [reporters-db](https://github.com/freelawproject/reporters-db) | BSD-2-Clause | port with root attribution | canonical reporter records, variations, editions, string `cite_type` |
| courtlistener | AGPL-3.0-only | facts-only clean-room reference | optional derived interop values; never decode authority |
| seal-rookery | unknown | reference only | cross-check; no vendoring |

The scaffold pins courts-db `v0.10.27` at
`f353e51400a55cc8942b230b3e12540ad364fd23` and reporters-db `v3.2.66` at
`fad63b383b92f9446c223ddc12bf0b6fd1a6b44c`. P0 verifies those choices and
records checksums, retrieval dates, and source/ID counts. Historical counts in
the exploration are explicitly non-authoritative.

Verified 2026-07-25:

| Source | Archive SHA-256 | Authoritative emitted counts |
| --- | --- | --- |
| courts-db `f353e5…` | `6c0e4fc800a8ebdb7d539960fd08b8373b219623694723af36378df229f369fa` | 2,809 assembled records / 2,809 unique IDs / 28 place inputs |
| reporters-db `fad63b…` | `11d6aee9b5927fbf29d92fbce6e502c712d3c7acd0a3ed736293d7100b1386f2` | 1,236 reporter keys / 1,262 records; 797 journal keys / 798 records; 371 law keys / 373 records; 189 case-name keys / 239 expansions; 7 regex families; 50 state abbreviations |

The local eyecite implementations were audited as secondary research, not data
authority. See [`EYECITE_DATA_AUDIT.md`](./EYECITE_DATA_AUDIT.md).

## 3. External sources

- [courts-db repository](https://github.com/freelawproject/courts-db),
  [raw data](https://raw.githubusercontent.com/freelawproject/courts-db/main/courts_db/data/courts.json),
  and [BSD-2 license](https://raw.githubusercontent.com/freelawproject/courts-db/main/LICENSE)
- [reporters-db repository](https://github.com/freelawproject/reporters-db) and
  [PyPI project](https://pypi.org/project/reporters-db/)
- [CourtListener jurisdiction help](https://www.courtlistener.com/help/api/jurisdictions/)
- [Feist Publications v. Rural Telephone](https://www.law.cornell.edu/supremecourt/text/499/340)
- [re2js](https://github.com/le0pard/re2js) and
  [Sonar ReDoS overview](https://www.sonarsource.com/blog/vulnerable-regular-expressions-javascript/)

Full claim trails live in the exploration's five `research/*.md` dossiers.

## 4. In-repo capabilities

| Capability | Path | Disposition |
| --- | --- | --- |
| `SyncDataTarget` registry/schemas | `packages/tooling/tool/cli/src/commands/SyncDataToTs/` | reuse; two targets NET-NEW |
| Generated artifact family | `packages/law-practice/domain/src/internal/generated/free-law-project/` | private law-practice zone; artifacts NET-NEW |
| `EntityId.factory` | `packages/shared/domain/src/entity/EntityId.ts` | reuse for stable IDs |
| `LiteralKit` | `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts` | reuse for canonical closed domains |
| Citation consumers | `packages/law-practice/domain/src/values/Citation/` | downstream consumer; compatibility integration NET-NEW |
| Existing inference values | `packages/law-practice/domain/src/values/CourtInference/` | lossy derived projection only |

## 5. Cross-links

- Source exploration: [`README`](../../../explorations/court-vocabulary-resolver/README.md),
  [`BRIEF`](../../../explorations/court-vocabulary-resolver/BRIEF.md),
  [`MAP`](../../../explorations/court-vocabulary-resolver/MAP.md),
  [`DECISIONS`](../../../explorations/court-vocabulary-resolver/DECISIONS.md), and
  [`primary ledger`](../../../explorations/court-vocabulary-resolver/research/SOURCES.md).
- Consumer: [`citation-extraction-engine`](../../citation-extraction-engine/README.md).
