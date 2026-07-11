# P0 Data and Source-Terms Matrix

Verified against the linked upstream pages on 2026-07-11. “Not stated” means
that the reviewed upstream license, policy, and API pages did not grant or
prohibit the named activity. It is not treated as permission to discard
provenance or other operative terms. This is an engineering gate, not legal
advice.

## Summary

| Upstream | Data license | API terms | Commercial use | Cache / retention | Redistribution / fixtures | Attribution | Authority | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Federal Register](https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status) (accessed 2026-07-11) | Not stated on reviewed pages | Not stated | No limit stated | Not stated | Not stated | Not stated | Web/API edition is unofficial; GovInfo PDF is official | ALLOW-WITH-CONDITIONS |
| [eCFR](https://www.ecfr.gov/reader-aids/understanding-the-ecfr/what-is-the-ecfr) (accessed 2026-07-11) | Not stated on reviewed pages | Not stated | No limit stated | Not stated | Not stated | Not stated | Current editorial compilation, not an official legal edition | ALLOW-WITH-CONDITIONS |
| [DOL](https://dataportal.dol.gov/) (accessed 2026-07-11) | Government works generally public domain; verify each dataset | DOL API agreement applies | Permitted without implied endorsement | Not stated | Open data may be reused and redistributed; preserve source truth | Required DOL API notice | Agency data service, supplied as-is; not a legal source-of-record promise | ALLOW-WITH-CONDITIONS |
| [CourtListener](https://www.courtlistener.com/terms/) (accessed 2026-07-11) | No blanket API/database license stated | CourtListener terms and membership/API rules apply | No blanket ban; lawful-use and FCRA restrictions apply | Not stated upstream; packet limits to ephemeral, in-process cache | No blanket grant; packet requires synthetic-only fixtures | Not stated | Non-government aggregator; expressly disclaims accuracy and reliability | ALLOW-WITH-CONDITIONS |
| [govinfo](https://www.govinfo.gov/about-site/policies) (accessed 2026-07-11) | Public domain unless otherwise indicated | GovInfo policy plus api.data.gov key rules | No limit stated | Not stated | Copying permitted subject to indicated third-party rights | Preserve requested credits | Official GPO access system; use official renditions and package metadata | ALLOW-WITH-CONDITIONS |

## Federal Register

### D2 findings

- **Data license:** not stated in the reviewed FederalRegister.gov legal-status
  or API documentation. The absence of an express site-wide license means the
  driver must not infer that third-party images, attachments, or incorporated
  material are public domain merely because a response came from a `.gov`
  host. [Legal status](https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status)
  and [API v1 documentation](https://www.federalregister.gov/developers/documentation/api/v1)
  (accessed 2026-07-11).
- **API terms of service:** not stated in the reviewed API documentation; the
  page documents the public API rather than a separate API contract.
  [API v1 documentation](https://www.federalregister.gov/developers/documentation/api/v1)
  (accessed 2026-07-11).
- **Commercial-use limits:** not stated in the reviewed legal-status or API
  pages. Conservatively, this is not an endorsement right and does not override
  rights notices attached to particular material. [Legal status](https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status)
  and [API v1 documentation](https://www.federalregister.gov/developers/documentation/api/v1)
  (accessed 2026-07-11).
- **Caching / retention:** not stated. The implementation may use a bounded
  operational cache, but cache entries must retain source URL, retrieval time,
  document number, publication date, and the upstream status/source fields so
  stale prototype data is not presented as current official text.
  [Legal status](https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status)
  (accessed 2026-07-11).
- **Redistribution / committed fixtures:** not stated. Commit only the minimum
  response excerpt needed for a test; record its source URL, retrieval date,
  and rights status, and prefer synthetic fixtures when an item contains
  attachments or third-party material. [API v1 documentation](https://www.federalregister.gov/developers/documentation/api/v1)
  (accessed 2026-07-11).
- **Attribution:** not stated. Preserve Federal Register source links and
  document identifiers as provenance rather than implying endorsement.
  [API v1 documentation](https://www.federalregister.gov/developers/documentation/api/v1)
  (accessed 2026-07-11).
- **Source of authority:** FederalRegister.gov calls its HTML edition an
  “unofficial prototype”; the official edition is the PDF made available on
  GovInfo. A consumer must reconcile legally material text to that official
  rendition rather than treating API/HTML output as controlling.
  [Legal status](https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status)
  (accessed 2026-07-11).

Verdict: ALLOW-WITH-CONDITIONS (preserve source/status metadata; label the
API/HTML edition unofficial; link or reconcile to the official GovInfo PDF;
do not assume rights in third-party material).

### Propagation obligations

- Per-driver README: state the unofficial-prototype caveat and identify the
  GovInfo PDF as the official rendition.
- Fixture metadata: include source URL, access date, document number,
  publication date, rights review, and `authority: unofficial-prototype`.
- Cache-policy config: bounded TTL plus retrieval/status metadata; never cache
  away a correction, withdrawal, or superseding official rendition.

## eCFR

### D2 findings

- **Data license:** not stated in the reviewed eCFR “What is the eCFR?” or API
  pages. The site describes government regulatory text, but does not give a
  blanket license for every object or attachment returned by the service.
  [What is the eCFR?](https://www.ecfr.gov/reader-aids/understanding-the-ecfr/what-is-the-ecfr)
  and [API v1 documentation](https://www.ecfr.gov/developers/documentation/api/v1)
  (accessed 2026-07-11).
- **API terms of service:** not stated in the reviewed developer page.
  [API v1 documentation](https://www.ecfr.gov/developers/documentation/api/v1)
  (accessed 2026-07-11).
- **Commercial-use limits:** not stated. This does not create an endorsement
  right or erase item-specific third-party rights. [What is the eCFR?](https://www.ecfr.gov/reader-aids/understanding-the-ecfr/what-is-the-ecfr)
  (accessed 2026-07-11).
- **Caching / retention:** not stated. Cache entries must preserve the eCFR
  currency dates and retrieval time; a cached result must not be described as
  current after its currency metadata is stale. [What is the eCFR?](https://www.ecfr.gov/reader-aids/understanding-the-ecfr/what-is-the-ecfr)
  (accessed 2026-07-11).
- **Redistribution / committed fixtures:** not stated. Use minimal excerpts,
  record provenance and currency dates, and prefer synthetic data for anything
  whose rights status is unclear. [API v1 documentation](https://www.ecfr.gov/developers/documentation/api/v1)
  (accessed 2026-07-11).
- **Attribution:** not stated. Retain eCFR URLs, title/part identifiers, and
  currency metadata as provenance. [API v1 documentation](https://www.ecfr.gov/developers/documentation/api/v1)
  (accessed 2026-07-11).
- **Source of authority:** eCFR is an up-to-date editorial compilation and is
  not an official legal edition of the CFR. The official annual CFR editions
  are published by the Office of the Federal Register and Government
  Publishing Office. [What is the eCFR?](https://www.ecfr.gov/reader-aids/understanding-the-ecfr/what-is-the-ecfr)
  (accessed 2026-07-11).

Verdict: ALLOW-WITH-CONDITIONS (carry currency metadata and the
non-official-edition disclaimer; do not infer rights for attachments or
third-party material).

### Propagation obligations

- Per-driver README: state that eCFR is current editorial material, not the
  official legal edition, and identify the official annual CFR editions.
- Fixture metadata: include source URL, access date, title/part, currency
  dates, rights review, and `authority: editorial-not-official-edition`.
- Cache-policy config: bounded TTL, retrieval time, and eCFR currency dates;
  stale entries must remain visibly stale.

## Department of Labor Open Data Portal

### D2 findings

- **Data license:** DOL says its open data can be “freely used, reused, and
  redistributed by anyone.” The portal’s government-work link explains that
  U.S. government works generally are not copyright-protected in the United
  States, while warning that not everything on a government site is a
  government work. Apply that status per dataset and per asset.
  [DOL Open Data Portal](https://dataportal.dol.gov/) and
  [USA.gov, Copyright and government works](https://www.usa.gov/government-works)
  (accessed 2026-07-11).
- **API terms of service:** registration and API use accept DOL’s API
  agreement. It permits services that search, display, analyze, retrieve, and
  view DOL data; DOL may limit or terminate access and may change the terms.
  The live portal replaces the now-dead `developer.dol.gov` host.
  [DOL Open Data Portal terms modal](https://dataportal.dol.gov/)
  (accessed 2026-07-11; `developer.dol.gov` DNS lookup also failed on
  2026-07-11).
- **Operational API limits:** `X-API-KEY` is a required query parameter; a
  response is capped at 5 MB or 10,000 records, whichever comes first, and an
  account may hold at most five API keys. These are access conditions, not
  data-license restrictions. [DOL API guide and key manager](https://dataportal.dol.gov/)
  (accessed 2026-07-11; SPA bundle
  `/static/js/main.1788ccf8.js`).
- **Commercial-use limits:** no commercial-use ban is stated. DOL forbids use
  of its name to imply endorsement of any commercial or non-profit product,
  service, or entity. [DOL Open Data Portal terms modal](https://dataportal.dol.gov/)
  (accessed 2026-07-11).
- **Caching / retention:** not stated in the portal terms, FAQ, or API guide.
  A bounded cache is therefore an engineering choice, not an upstream grant;
  it must retain dataset identity, fetch time, and license metadata and must
  not bypass access limits. [DOL Open Data Portal](https://dataportal.dol.gov/)
  and [DOL website policies](https://www.dol.gov/general/aboutdol/website-policies)
  (accessed 2026-07-11).
- **Redistribution / committed fixtures:** DOL open data may be reused and
  redistributed, but the API terms say content may not be modified or falsely
  represented while still claiming DOL as the source. Commit a real fixture
  only when its dataset metadata identifies it as a U.S. government work;
  otherwise use synthetic data. [DOL Open Data Portal and terms modal](https://dataportal.dol.gov/)
  (accessed 2026-07-11).
- **Attribution:** an application using the API should prominently display:
  “This product uses the US Department of Labor API but is not endorsed or
  certified by the US Department of Labor.” DOL may be named only to identify
  the source, without implying endorsement. [DOL Open Data Portal terms modal](https://dataportal.dol.gov/)
  (accessed 2026-07-11).
- **Source of authority:** DOL supplies the data but provides the API “as is”
  and “as available,” without promising error-free or uninterrupted access.
  The portal does not state that an API response is a legally controlling
  publication; consumers must follow the dataset’s named source-of-record.
  [DOL Open Data Portal terms modal](https://dataportal.dol.gov/)
  (accessed 2026-07-11).

Verdict: ALLOW-WITH-CONDITIONS (accept and surface the DOL API terms;
display the required notice; never imply endorsement; preserve content truth
and per-dataset rights metadata; obey request/key limits; use
`ApiKeyQueryAuth`).

### Propagation obligations

- Per-driver README: reproduce the required DOL notice, non-endorsement rule,
  terms link, query-parameter auth shape, and request/key limits.
- Fixture metadata: record dataset ID, source URL, access date, per-dataset
  license/government-work status, modification status, and the DOL notice.
- Cache-policy config: bounded TTL and dataset/fetch/license metadata; caching
  must not be used to evade API limits or to keep silently stale data.

## CourtListener

### D2 findings

- **Data license:** underlying court documents are public records, but
  CourtListener is a non-government service and its terms do not publish a
  blanket license for the API response/database as a whole. Its copyright
  policy accepts DMCA notices, so the public-record character of a filing does
  not erase possible rights in every included item. [CourtListener terms and
  policies](https://www.courtlistener.com/terms/)
  (accessed 2026-07-11).
- **API terms of service:** use of CourtListener accepts its site terms; API
  access is authenticated and included with eligible Free Law Project
  memberships. The service may restrict availability, scope, or amount of use
  and may change or discontinue service. [CourtListener terms and policies](https://www.courtlistener.com/terms/),
  [REST API help](https://www.courtlistener.com/help/api/rest/), and
  [API access included in memberships](https://free.law/2026/05/07/api-included-in-memberships/)
  (accessed 2026-07-11).
- **Commercial-use limits:** no blanket commercial-use ban is stated.
  CourtListener prohibits unlawful use and use of its information for FCRA
  eligibility decisions, consumer reports, or any use that could make Free Law
  Project subject to the FCRA. [CourtListener terms and policies](https://www.courtlistener.com/terms/)
  (accessed 2026-07-11).
- **Caching / retention:** not stated in the reviewed terms, REST help, or bulk
  data page. The packet’s binding, stricter rule therefore controls: cache only
  in process and ephemerally; no durable or cross-process response cache.
  [CourtListener terms and policies](https://www.courtlistener.com/terms/),
  [REST API help](https://www.courtlistener.com/help/api/rest/), and
  [bulk legal data](https://www.courtlistener.com/help/api/bulk-data/)
  (accessed 2026-07-11).
- **Redistribution / committed fixtures:** CourtListener provides bulk data
  for research and legal-technology prototyping, but that statement is not a
  blanket license for every database element or PACER/RECAP document. The
  packet’s binding rule controls: committed fixtures are synthetic only and
  contain no real PACER/RECAP content. [CourtListener bulk-data FAQ](https://www.courtlistener.com/faq/#why-bulk)
  and [bulk legal data](https://www.courtlistener.com/help/api/bulk-data/)
  (accessed 2026-07-11).
- **Attribution:** not stated as a general API-data requirement in the
  reviewed terms or REST help. Keep CourtListener and original-court URLs and
  identifiers as provenance, without implying that CourtListener certified the
  result. [CourtListener terms and policies](https://www.courtlistener.com/terms/)
  and [REST API help](https://www.courtlistener.com/help/api/rest/)
  (accessed 2026-07-11).
- **Source of authority:** CourtListener expressly makes no guarantee of the
  truth, accuracy, relevance, or reliability of its material and warns that
  documents may be unreliably reproduced. It is not a court or government
  source of record; legally material text must be checked against the issuing
  court. [CourtListener terms and policies](https://www.courtlistener.com/terms/)
  (accessed 2026-07-11).

Verdict: ALLOW-WITH-CONDITIONS (eligible authenticated API access; obey
lawful-use and FCRA restrictions; in-process/ephemeral cache only;
synthetic-only committed fixtures with no real PACER/RECAP content; preserve
court and CourtListener provenance; never represent the service as legally
authoritative).

### Propagation obligations

- Per-driver README: link the current terms, API membership policy, FCRA/use
  restrictions, reliability disclaimer, and non-authoritative-source caveat.
- Fixture metadata: set `synthetic: true`, `containsRealPacerRecap: false`, and
  record that no payload was copied from CourtListener or PACER/RECAP.
- Cache-policy config: force in-process, ephemeral storage; prohibit disk,
  shared, committed, or indefinite caches regardless of upstream silence.

## govinfo

### D2 findings

- **Data license:** GovInfo states that information on the site is generally
  in the public domain unless otherwise indicated. Its policy also recognizes
  that a package may contain protected third-party material, so rights must be
  checked at item level. [GovInfo policies](https://www.govinfo.gov/about-site/policies)
  (accessed 2026-07-11).
- **API terms of service:** GovInfo’s site policy applies; no separate GovInfo
  API terms are stated on the reviewed policy page. API keys and operational
  limits are provided through api.data.gov, whose manual documents the
  `api_key` query parameter and key-specific rate limits. [GovInfo policies](https://www.govinfo.gov/about-site/policies)
  and [api.data.gov developer manual](https://api.data.gov/docs/developer-manual/)
  (accessed 2026-07-11).
- **Commercial-use limits:** not stated. Public-domain status does not permit
  implied GPO or agency endorsement and does not override item-specific rights.
  [GovInfo policies](https://www.govinfo.gov/about-site/policies)
  (accessed 2026-07-11).
- **Caching / retention:** not stated. A bounded cache may retain public-domain
  responses, but it must retain package/granule identity, retrieval time,
  last-modified metadata, and any item-specific rights notice.
  [GovInfo policies](https://www.govinfo.gov/about-site/policies)
  and [api.data.gov developer manual](https://api.data.gov/docs/developer-manual/)
  (accessed 2026-07-11).
- **Redistribution / committed fixtures:** public-domain material may be
  copied and distributed unless an item says otherwise. A real fixture must
  contain its GovInfo package/granule identifiers, access date, and rights
  review; protected third-party material must be removed or replaced with a
  synthetic fixture. [GovInfo policies](https://www.govinfo.gov/about-site/policies)
  (accessed 2026-07-11).
- **Attribution:** GovInfo requests appropriate source/byline/photo/image
  credit where supplied. Preserve those credits and a GovInfo source link;
  never use them to imply endorsement. [GovInfo policies](https://www.govinfo.gov/about-site/policies)
  (accessed 2026-07-11).
- **Source of authority:** GovInfo is GPO’s official system for publications
  from the three branches and supplies official Federal Register PDFs. Prefer
  the official package/rendition and retain its package metadata; do not assume
  that a transformed excerpt has the same evidentiary status as the official
  rendition. [About GovInfo](https://www.govinfo.gov/about)
  and [Federal Register legal status](https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status)
  (accessed 2026-07-11).

Verdict: ALLOW-WITH-CONDITIONS (check item-specific rights; preserve
credits, package/granule provenance, and official-rendition links; obey
api.data.gov key/rate rules; do not imply endorsement).

### Propagation obligations

- Per-driver README: state the public-domain-unless-indicated rule,
  third-party-material caveat, credit request, api.data.gov rules, and
  official-rendition guidance.
- Fixture metadata: include package/granule ID, source URL, access date,
  rights/credit review, and official rendition URL.
- Cache-policy config: bounded TTL plus package/granule, retrieval,
  last-modified, and rights metadata; invalidate on upstream modification.
