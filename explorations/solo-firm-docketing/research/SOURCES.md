# Solo-Firm IP Docketing — Sources & Provenance

<!-- markdownlint-disable MD034 -- Provenance ledger preserves cited URLs verbatim. -->

- **Cluster / origin:** 2026-06-18 external landscape sweep, three focused
  research tracks, supplemental docketing research, and live repo capability
  discovery refreshed 2026-07-14.
- **Provenance:** [`../RESEARCH.md`](../RESEARCH.md) is the synthesis;
  [`01-ip-prosecution-docketing.md`](./01-ip-prosecution-docketing.md),
  [`02-court-litigation-outlook.md`](./02-court-litigation-outlook.md), and
  [`03-official-data-handroll.md`](./03-official-data-handroll.md) carry the
  cited research. No URL below was added unless it already appeared in those
  files.

## 1. Mined source corpus

| Source | Title | Upstream | Location | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| `fastpat` | maintenance-fee downloader/reference implementation | `iamlemec/fastpat` | [`03-official-data-handroll.md`](./03-official-data-handroll.md), “USPTO maintenance-fee events” | `ptmnfee2` parsing | **Reference only — LICENSE NEEDS-REVERIFICATION** |
| `python-epo-ops-client` | EPO OPS client | `ip-tools/python-epo-ops-client` | [`03-official-data-handroll.md`](./03-official-data-handroll.md), “Foreign official sources” | OPS auth/call shape | **Reference only — LICENSE NEEDS-REVERIFICATION** |
| `patent-client` | patent-data client | `parkerhancock/patent_client` | [`03-official-data-handroll.md`](./03-official-data-handroll.md), “Open-source assets” | official-data access patterns | **Reference only — LICENSE NEEDS-REVERIFICATION** |
| `courtlistener` | CourtListener application | `freelawproject/courtlistener` | [`03-official-data-handroll.md`](./03-official-data-handroll.md), “Open-source assets” | litigation source architecture | **Reference only — LICENSE NEEDS-REVERIFICATION** |
| `courtlistener-api-client` | CourtListener API client | `freelawproject/courtlistener-api-client` | [`03-official-data-handroll.md`](./03-official-data-handroll.md), “Open-source assets” | REST client patterns | **Reference only — LICENSE NEEDS-REVERIFICATION** |

**How these inform this packet:** these repositories corroborate that official
data can be consumed programmatically. They are not implementation dependencies;
no code may be ported until the upstream license is verified.

## 2. Upstream repositories & licenses

| Repo | On-disk URL | License | Port discipline |
| --- | --- | --- | --- |
| `iamlemec/fastpat` | https://github.com/iamlemec/fastpat | NEEDS-REVERIFICATION | reference-only |
| `ip-tools/python-epo-ops-client` | https://github.com/ip-tools/python-epo-ops-client | NEEDS-REVERIFICATION | reference-only |
| `parkerhancock/patent_client` | https://github.com/parkerhancock/patent_client | NEEDS-REVERIFICATION | reference-only |
| `freelawproject/courtlistener` | https://github.com/freelawproject/courtlistener | NEEDS-REVERIFICATION | reference-only |
| `freelawproject/courtlistener-api-client` | https://github.com/freelawproject/courtlistener-api-client | NEEDS-REVERIFICATION | reference-only |

## 3. External research sources

### Official legal authorities and calendars

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
- USPTO post-registration trademark timeline:
  https://www.uspto.gov/trademarks/trademark-timelines/post-registration-timeline-all-registrations-except-madrid-protocol

These URLs establish the starting authorities, not implementation completeness.
Effective dates, supersession, extensions, closures, revival, and every shaped
edge case remain fixture-level attorney review requirements.

### Official datasets and event APIs

| Source | On-disk citations | Packet use |
| --- | --- | --- |
| USPTO ODP | https://data.uspto.gov/apis/getting-started · https://data.uspto.gov/apis/api-rate-limits · https://data.uspto.gov/apis/patent-file-wrapper/documents · https://api.uspto.gov/api/v1/patent/oa/oa_actions/v1/records | Patent event source; official mail date; sequential same-key polling. |
| ODP migration/history | https://www.uspto.gov/about-us/news-updates/uspto-launches-new-open-data-portal · https://www.uspto.gov/learning-and-resources/electronic-data-products/additional-patent-data-products · https://data.uspto.gov/documents/documents/PEDS-to-ODP-API-Mapping.pdf | Migration context; date-sensitive operational details need refresh before build. |
| USPTO `ptmnfee2` | https://data.uspto.gov/bulkdata/datasets/ptmnfee2 · https://www.uspto.gov/learning-and-resources/electronic-data-products/additional-patent-data-products | Maintenance-fee event cross-check. |
| USPTO TSDR | No direct official TSDR URL appears in the cited research. **NEEDS-REVERIFICATION**; see [`03-official-data-handroll.md`](./03-official-data-handroll.md), “Official-source inventory.” | Follow-on trademark official register; auth/rate/outage claims remain unverified. |
| EPO OPS | https://www.epo.org/en/searching-for-patents/data/web-services/ops · https://developers.epo.org · https://ops.epo.org/3.2/auth/accesstoken | Follow-on foreign official events; fair-use details need refresh. |
| WIPO PATENTSCOPE data services | https://www.wipo.int/en/web/patentscope/data/index | Follow-on PCT data source. |
| PACER | https://pacer.uscourts.gov/pacer-pricing-how-fees-work | Pricing/access boundary; not treated as a public retrieval API. |
| CourtListener REST/RECAP | https://www.courtlistener.com/help/api/rest/ · https://www.courtlistener.com/help/api/rest/v4/recap/ · https://free.law/recap/ | Follow-on court official event source. |
| CourtListener alerts/webhooks | https://www.courtlistener.com/help/api/rest/alerts/ · https://www.courtlistener.com/help/api/webhooks/ | Push path for court docket events. |
| CourtListener limits/MCP | https://free.law/2026/05/07/api-included-in-memberships/ · https://free.law/2026/05/12/courtlistener-is-now-available-inside-claude/ · https://wiki.free.law/c/courtlistener/help/api/mcp/model-context-protocol-mcp-server-for-agentic-access · https://mcp.courtlistener.com | Date-sensitive quotas and official hosted MCP. |

### Vendor documentation and commercial surfaces

- **CPI:** developer portal and due-date/auth surface at
  https://developer.computerpackages.com/; annuity API posture at
  https://www.computerpackages.com/patent-annuity-management/.
- **LawToolBox:** partner API at https://api.lawtoolbox.com/api; partner deadline
  description at https://lawtoolbox.com/partners-surface-lawtoolbox-deadlines;
  pricing at https://lawtoolbox.com/pricing/; Microsoft certification entry at
  https://learn.microsoft.com/en-us/microsoft-365-app-certification/teams/lawtoolboxcominc-lawtoolbox.
- **Alt Legal:** API announcement at https://www.altlegal.com/blog/alt-legal-api/;
  pricing at https://www.altlegal.com/pricing/; TSDR outage account at
  https://www.altlegal.com/blog/tsdr-api-shutdown-alt-legal/; patent-support
  posture at https://support.altlegal.com/en/articles/2358912.
- **AppColl:** no-API statement at https://forum.appcoll.com/topic/285/api;
  pricing at https://www.appcoll.com/law-firm-product-pricing/; e-Office Action
  support at https://support.appcoll.com/eoffice-actions.
- **Clarivate:** IP data API and portal-access FAQ at
  https://developer.clarivate.com/apis/ipdata-api and
  https://developer.clarivate.com/content/developer-portal-faq.
- **Anaqua/PATTSY WAVE:**
  https://www.anaqua.com/resource/pattsy-wave-an-integrated-docketing-platform-for-ip-operations-leaders/
  and https://www.anaqua.com/pattsy-wave/achieve-docketing-excellence/.
- **Dennemeyer:** DIAMS and API pages at
  https://www.dennemeyer.com/ip-software/diams/ and
  https://www.dennemeyer.com/services/digital-ip/dennemeyer-api.
- **Other court-market citations:** Clio API at
  https://docs.developers.clio.com/clio-manage/api-reference/; Docket Alarm API
  at https://www.docketalarm.com/api/v1/; CourtAlert at
  https://www.courtalert.com/content/CaseManagement; CalendarRules at
  https://www.calendarrules.com/.

Partner eligibility, production credentials, contract terms, pricing, SLA, and
current API behavior are **NEEDS-REVERIFICATION** before a vendor packet starts.
The vendor and operational assertions in
[`../IP_LAW_FIRM_DOCKETING_RESEARCH.md`](../IP_LAW_FIRM_DOCKETING_RESEARCH.md)
have no external URLs on disk and are therefore also **NEEDS-REVERIFICATION**;
they are context, not implementation authority.

## 4. In-repo capability references

| Brick | Live reference | Disposition |
| --- | --- | --- |
| USPTO ODP driver | `@beep/uspto`; `packages/drivers/uspto/src/Uspto.service.ts` | reuse/extend for office-action coverage and sequential polling |
| Candidate governance | `CandidateTask`, `ApprovalGate`, `ContextPacket`, `EmailArtifact`; `packages/workspace/domain/src/entities/` | reuse |
| Law-practice context | `Matter`, `PatentAsset`, thin `OfficeAction`; `packages/law-practice/domain/src/entities/` | reuse/extend; FilingEvent and Deadline are NET-NEW |
| Law workflows | `packages/law-practice/use-cases/` and `packages/law-practice/server/` | extend with docketing ports/workflows/adapters |
| Outlook driver | `@beep/m365`; `packages/drivers/m365/`; `goals/m365-driver/` reserves `Calendars.ReadWrite` | extend with one-way calendar writes |
| Durable embedded SQL | `@beep/pglite`; `packages/drivers/pglite/src/PgliteClient.service.ts` supports file-backed `dataDir` | reuse; law-practice docketing tables are NET-NEW |
| Rule policies | No repo-local docket deadline engine found in [`../RESEARCH.md`](../RESEARCH.md), “NOT FOUND / net-new” | **NET-NEW:** narrow US-deterministic module |
| Reliability monitor | No independent dead-man integration identified in the packet research | **NET-NEW** |
| Follow-on sources | No TSDR, CourtListener, or EPO driver identified in the packet research | **NET-NEW**, matter-gated |

## 5. Cross-links & provenance

- Packet synthesis: [`../RESEARCH.md`](../RESEARCH.md)
- Ratified policy: [`../DECISIONS.md`](../DECISIONS.md)
- Shaped pitch and decomposition: [`../BRIEF.md`](../BRIEF.md) and
  [`../MAP.md`](../MAP.md)
- Related driver goal: [`../../../goals/m365-driver/`](../../../goals/m365-driver/)
- Graduated goals:
  [`law-docketing-patent-spine`](../../../goals/law-docketing-patent-spine/README.md)
  and [`law-docketing-reliability`](../../../goals/law-docketing-reliability/README.md).
- Graduated product prose:
  [`docs/product/solo-firm-docketing.md`](../../../docs/product/solo-firm-docketing.md).
