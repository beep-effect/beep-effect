# Law Docketing Patent Spine — Sources & Provenance

<!-- markdownlint-disable MD034 -- Provenance ledger preserves cited URLs verbatim. -->

- **Primary ledger:**
  [`explorations/solo-firm-docketing/research/SOURCES.md`](../../../explorations/solo-firm-docketing/research/SOURCES.md).
  The relevant implementation corpus below is reproduced from that exploration;
  provenance corrections begin there and are then synchronized here.
- **Origin:** 2026-06-18 research tracks and 2026-07-14 live capability refresh.
- **Freshness rule:** P0 re-verifies legal authority, effective dates, API
  behavior, and live repo paths before freezing fixtures or contracts.

## 1. Mined source corpus

| Source | Title | Upstream | Exploration location | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| `fastpat` | maintenance-fee downloader/reference implementation | `iamlemec/fastpat` | `research/03-official-data-handroll.md`, “USPTO maintenance-fee events” | `ptmnfee2` parsing | Reference only — LICENSE NEEDS-REVERIFICATION |

No upstream code may be ported until its license is verified. The source only
corroborates official-data consumption patterns; it is not a dependency.

## 2. Upstream repositories & licenses

| Repo | On-disk URL | License | Port discipline |
| --- | --- | --- | --- |
| `iamlemec/fastpat` | https://github.com/iamlemec/fastpat | NEEDS-REVERIFICATION | reference-only |

## 3. External research sources

### Legal authorities

- 37 CFR 1.362 maintenance-fee timing:
  https://www.ecfr.gov/current/title-37/chapter-I/subchapter-A/part-1/subpart-B/subject-group-ECFR335b8caa4be3dd2/section-1.362
- 37 CFR 1.7 day/closure treatment:
  https://www.ecfr.gov/current/title-37/chapter-I/subchapter-A/part-1/subpart-A/subject-group-ECFR5cdb43ad1467198/section-1.7
- MPEP §2506 maintenance-fee times:
  https://www.uspto.gov/web/offices/pac/mpep/s2506.html
- MPEP §710 statutory and shortened response periods:
  https://www.uspto.gov/web/offices/pac/mpep/s710.html
- WIPO PCT time-limit tables:
  https://www.wipo.int/en/web/pct-system/texts/time_limits

These establish starting authorities, not complete rule coverage. P0 must
refresh effective dates, supersession, closures, extensions, revival, and each
supported exceptional case for attorney fixture approval.

### Official datasets and APIs

| Source | On-disk citations | Packet use |
| --- | --- | --- |
| USPTO ODP | https://data.uspto.gov/apis/getting-started · https://data.uspto.gov/apis/api-rate-limits · https://data.uspto.gov/apis/patent-file-wrapper/documents · https://api.uspto.gov/api/v1/patent/oa/oa_actions/v1/records | Official patent event/mail date and sequential same-key polling; refresh before build. |
| ODP migration/history | https://www.uspto.gov/about-us/news-updates/uspto-launches-new-open-data-portal · https://www.uspto.gov/learning-and-resources/electronic-data-products/additional-patent-data-products · https://data.uspto.gov/documents/documents/PEDS-to-ODP-API-Mapping.pdf | Date-sensitive operational context. |
| USPTO `ptmnfee2` | https://data.uspto.gov/bulkdata/datasets/ptmnfee2 · https://www.uspto.gov/learning-and-resources/electronic-data-products/additional-patent-data-products | Maintenance-fee event cross-check. |

Commercial CPI/LawToolBox/Alt Legal sources remain in the primary ledger but
are intentionally not implementation inputs here: CPI evaluation fires only
after handroll v1, and LawToolBox belongs to the court track.

## 4. In-repo capability references

| Brick | Live reference | Disposition |
| --- | --- | --- |
| USPTO ODP driver | `@beep/uspto`; `packages/drivers/uspto/src/Uspto.service.ts` | reuse/extend for OA coverage and sequential polling |
| Candidate governance | `CandidateTask`, `ApprovalGate`, `ContextPacket`, `EmailArtifact`; `packages/workspace/domain/src/entities/` | reuse |
| Law-practice context | `Matter`, `PatentAsset`, thin `OfficeAction`; `packages/law-practice/domain/src/entities/` | reuse/extend; FilingEvent and Deadline NET-NEW |
| Law workflows | `packages/law-practice/use-cases/` and `packages/law-practice/server/` | extend |
| Outlook driver | `@beep/m365`; `packages/drivers/m365/`; `goals/m365-driver/` | extend with one-way calendar writes |
| Durable embedded SQL | `@beep/pglite`; `packages/drivers/pglite/src/PgliteClient.service.ts` | reuse; docketing tables NET-NEW |
| Rule policies | No repo-local docket deadline engine found in the exploration | NET-NEW narrow US deterministic module |

## 5. Cross-links & provenance

- Primary provenance surface:
  `explorations/solo-firm-docketing/research/SOURCES.md`.
- Synthesis: `explorations/solo-firm-docketing/RESEARCH.md`.
- Ratified contract: `explorations/solo-firm-docketing/{DECISIONS,BRIEF,MAP}.md`.
- Paired goal: `goals/law-docketing-reliability/`.
- Related driver goal: `goals/m365-driver/`.
