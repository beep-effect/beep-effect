# Law Docketing Reliability — Sources & Provenance

<!-- markdownlint-disable MD034 -- Provenance ledger preserves cited URLs verbatim. -->

- **Primary ledger:**
  [`explorations/solo-firm-docketing/research/SOURCES.md`](../../../explorations/solo-firm-docketing/research/SOURCES.md).
  The relevant reliability corpus below is reproduced from that exploration;
  provenance corrections begin there and are then synchronized here.
- **Origin:** 2026-06-18 research tracks and 2026-07-14 live capability refresh.
- **Known gap:** the exploration names a healthchecks.io-style endpoint or
  tailnet cron as a shape, but carries no cited external monitor selection.
  P0 must select and source the actual independent path; no URL is invented here.

## 1. Mined source corpus

No mined upstream repository in the exploration ledger is an implementation
input for the reliability adapter. The monitor and reliability workflows are
NET-NEW; source selection and license/terms recording belong to P0.

## 2. Upstream repositories & licenses

None selected. Any external monitor SDK or reference implementation remains
reference-only until its repository, license, terms, credential model, and
failure-domain independence are recorded.

## 3. External research sources

| Source | On-disk citations | Packet use |
| --- | --- | --- |
| USPTO ODP | https://data.uspto.gov/apis/getting-started · https://data.uspto.gov/apis/api-rate-limits · https://data.uspto.gov/apis/patent-file-wrapper/documents · https://api.uspto.gov/api/v1/patent/oa/oa_actions/v1/records | Refresh sequential same-key polling assumptions and derive cursor/retry/freshness proof. |
| ODP migration/history | https://www.uspto.gov/about-us/news-updates/uspto-launches-new-open-data-portal · https://www.uspto.gov/learning-and-resources/electronic-data-products/additional-patent-data-products · https://data.uspto.gov/documents/documents/PEDS-to-ODP-API-Mapping.pdf | Date-sensitive operational behavior requiring P0 refresh. |

The primary ledger's vendor deadline-engine sources are not monitor-selection
evidence and must not be repurposed as such.

## 4. In-repo capability references

| Brick | Live reference | Disposition |
| --- | --- | --- |
| Patent records contract | `goals/law-docketing-patent-spine/` and the scoped `packages/law-practice/{domain,use-cases,tables,server}` surfaces it creates | dependency; consume, do not duplicate legal truth |
| USPTO ODP driver | `@beep/uspto`; `packages/drivers/uspto/src/Uspto.service.ts` | reuse/extend for sequential polling and cursor evidence |
| Outlook driver | `@beep/m365`; `packages/drivers/m365/` | reuse for reminder/reconciliation projections |
| Durable embedded SQL | `@beep/pglite`; `packages/drivers/pglite/src/PgliteClient.service.ts` | reuse for cursor, acknowledgment, and recovery evidence |
| Reliability monitor | No independent dead-man integration identified in the exploration | NET-NEW external adapter |
| Reliability workflows | No escalation/acknowledgment/recovery workflow identified in the exploration | NET-NEW within law-practice boundaries |

## 5. Cross-links & provenance

- Primary provenance surface:
  `explorations/solo-firm-docketing/research/SOURCES.md`.
- Synthesis: `explorations/solo-firm-docketing/RESEARCH.md`.
- Ratified contract: `explorations/solo-firm-docketing/{DECISIONS,BRIEF,MAP}.md`.
- Dependency and blocked acceptance:
  `goals/law-docketing-patent-spine/`.
