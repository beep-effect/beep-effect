# USPTO `ptmnfee2` Maintenance-Fee Dataset

**Research date:** 2026-07-14  
**Consumer:** `goals/law-docketing-patent-spine`  
**Disposition:** required official-source input; ingest as a versioned bulk snapshot,
not as an online docket-calculation API.

## Executive finding

`PTMNFEE2` is the USPTO Patent Maintenance Fee Events product. It covers recorded
events for patents granted from 1981-09-01 forward, is published weekly, and each
weekly release is cumulative rather than a delta. The catalog describes the
distribution as ASCII/text and names `MaintFeeEventsFileDocumentation.doc` as its
data dictionary. The original USPTO launch notice additionally says each release
has an event file, a `MaintFeeEventsDesc` event-code-description file, and
documentation for both layouts. [USPTO-derived federal catalog
record](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)
and [USPTO Official Gazette launch
notice](https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm)

This is therefore a replacement-snapshot feed: a refresher should download the
new complete release, validate it, and atomically replace the previously generated
artifact. It must not append the new file to the old file. That recommendation
follows directly from USPTO's statement that every weekly file is cumulative and
the repo's generate-first/checksum/drift convention. [Federal catalog
metadata](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)
and [`gov-legal-data-driver-codegen` determinism
contract](../../../goals/gov-legal-data-driver-codegen/SPEC.md#constraints)

## 1. Format, cadence, and replacement semantics

| Property | Established result | Evidence |
| --- | --- | --- |
| Product | `PTMNFEE2`, Patent Maintenance Fee Events (1981-present) | [Federal catalog record](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present) |
| Coverage start | Recorded events for patents granted on or after 1981-09-01 | [Federal catalog record](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present) |
| Cadence | Weekly (`R/P1W`); USPTO's launch notice says Tuesday | [Federal catalog metadata](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present) and [Official Gazette notice](https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm) |
| Full vs. delta | Every new weekly event file is cumulative; treat it as a full replacement snapshot | [Federal catalog description](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present) |
| Distribution | ASCII/text; the current portal product page is `https://data.uspto.gov/bulkdata/datasets/ptmnfee2` | [Federal catalog distribution metadata](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present) |
| Companion files | Event data, `MaintFeeEventsDesc` code descriptions, and `MaintFeeEventsFileDocumentation.doc` layout documentation | [Official Gazette launch notice](https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm) and [catalog `dataDictionary`](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present) |

The official launch notice establishes that the documentation describes both the
event-file fields/format and the code-description-file fields/format, but the
current `.doc` content was not retrievable through the accessible ODP pages in
this session. Consequently, the exact delimiter, byte widths, null convention,
date encoding, header presence, archive member names, and current column order
are **NEEDS-VERIFICATION against the downloaded 2026 release documentation**.
[Official Gazette launch
notice](https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm)

**Approximate size: NOT FOUND in a current primary USPTO source.** The product
metadata exposed through the official catalog does not publish a byte count, and
the authenticated product-data response/current archive headers were not
available to this session. The refresher must record the observed compressed and
uncompressed byte counts rather than hard-code an estimate. [Federal catalog
metadata](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)
and [ODP bulk-data Search API documentation](https://data.uspto.gov/apis/bulk-data/search)

### Provisional record model, not yet an implementation contract

The existence and authority of the USPTO layout document are verified; its 2026
contents are not. Until the current file is downloaded, the driver may reserve
schema concepts for patent number, application number, entity indicator,
application filing date, grant date, event entry date, and event code, but **must
not freeze delimiter/width/optionality rules from a third-party parser**. The
checked-in source documentation and an adversarial sample from the actual release
must close this gate. [USPTO catalog `dataDictionary`](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)

## 2. Event-code vocabulary

The authoritative dataset-specific vocabulary is the USPTO
`MaintFeeEventsDesc` companion file described by the Office when it launched the
product. The same notice says `MaintFeeEventsFileDocumentation` documents the
description file's fields and format. This is a different vocabulary from the
Patent File Wrapper prosecution `eventDataBag`/Appendix B vocabulary and from
numeric fee schedule codes; no code should be interpreted merely because it
looks like one of those other namespaces. [Official Gazette launch
notice](https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm)

The current USPTO fee schedule does establish the statutory payment families that
the dataset must be capable of representing: large/small/micro entity fee codes
`1551/2551/3551`, `1552/2552/3552`, and `1553/2553/3553` for the 3.5-, 7.5-, and
11.5-year payments; `1554`-`1556` (and small/micro counterparts) for grace-period
surcharges; and `1558`/`1560` families for delayed-payment petitions. These are
**fee codes, not by themselves proof of the exact `PTMNFEE2` event-code spelling**.
[Current USPTO fee
schedule](https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule#patent-maintenance-fees)

**Complete 2026 event-code enumeration: NEEDS-VERIFICATION.** The companion file
was not downloadable in this session, so this note does not invent a list of
payment, expiration, reminder, correction, refund, entity-change, or reinstatement
codes. The generator must fail closed on an unknown code while preserving its raw
value, and the refresh PR must include a vocabulary diff against the prior
`MaintFeeEventsDesc` snapshot. [Official Gazette launch
notice](https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm)

**Versioning:** no semantic-version field or separately versioned code-list
contract was found in the official product metadata. The defensible version is
therefore the weekly release date plus checksums of the event archive,
documentation, and `MaintFeeEventsDesc`; any stronger version claim is **NOT
FOUND**. [Federal catalog
record](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)

## 3. Coverage and event semantics

The payment windows open at 3, 7, and 11 years after grant and permit payment
without surcharge until 3.5, 7.5, and 11.5 years; a further six-month grace period
permits payment with a surcharge. If payment and surcharge are absent at the end
of that grace period, rights lapse at the 4th, 8th, or 12th year. [USPTO Official
Gazette explanation](https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm)
and [USPTO maintenance guidance](https://www.uspto.gov/patents/maintain)

The bulk data is an event history, not a precomputed deadline table: payment,
surcharge, expiration, and later reinstatement must be inferred from chronological
records using the contemporaneous companion-code description. USPTO separately
explains that reinstatement requires acceptance of a petition and delayed payment,
and that an expired patent can regain force; a consumer must therefore never
treat an expiration event as immutable current status. [USPTO reinstatement
guidance](https://www.uspto.gov/patents/maintain#reinstate-an-expired-patent)
and [MPEP §2591](https://www.uspto.gov/web/offices/pac/mpep/s2591.html)

The dataset's patent-level events also do not eliminate date-calculation rules:
payments received online must arrive before midnight Eastern Time on the last day,
and a Saturday, Sunday, or federal-holiday endpoint rolls to the next eligible
day. The docketing consumer must own those legal-calendar calculations rather
than infer them from the weekly publication date. [USPTO maintenance
guidance](https://www.uspto.gov/patents/maintain#when-to-pay)

### Documented edge cases

- Maintenance fees apply to utility and reissue utility patents based on
  applications filed on or after 1980-12-12, but not to design patents, plant
  patents, or statutory invention registrations. [USPTO maintenance
  guidance](https://www.uspto.gov/patents/maintain)
- A reissue does not restart the schedule: due dates continue from the original
  patent's grant. For fees due on or after 2018-01-16, each reissue patent may
  require a separate payment, and the original patent may also require payment
  while another reissue application remains pending. [MPEP
  §1415.01](https://www.uspto.gov/web/offices/pac/mpep/s1415.html)
- A shortened term, including a terminal disclaimer, does not prorate a fee that
  is otherwise due before expiration. [MPEP
  §2520](https://www.uspto.gov/web/offices/pac/mpep/s2520.html)
- **Continuation/divisional family roll-up semantics in `PTMNFEE2`: NOT FOUND.**
  The official sources reviewed describe events by granted patent and do not say
  that related continuations share a maintenance ledger. Do not family-collapse
  events; join by the record's patent/application identity, and let the legal
  domain model continuity separately. [Federal catalog product
  description](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)

## 4. Access, authentication, and URL stability

The product is cataloged as public, but ODP has required a USPTO.gov account to
access the portal site since 2026-06-18. The documented bulk-data Search API at
`GET https://api.uspto.gov/api/v1/datasets/products/search` requires an API key;
the Product Data endpoint is the documented choice for enumerating releases of a
known product. [USPTO registration
notice](https://www.uspto.gov/about-us/news-updates/uspto-open-data-portal-require-registration-access-beginning-june-18-2026)
and [ODP bulk-data Search API](https://data.uspto.gov/apis/bulk-data/search)

**Direct-file authentication: NEEDS-VERIFICATION.** The metadata declares the
dataset public, but this session could not live-probe whether the resolved archive
URI itself accepts anonymous requests after the 2026 registration change. The
refresh job should assume account/API-key-mediated discovery, keep credentials in
`Redacted`, and never commit a signed/ephemeral download URL. [Federal catalog
access metadata](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)
and [USPTO registration
notice](https://www.uspto.gov/about-us/news-updates/uspto-open-data-portal-require-registration-access-beginning-june-18-2026)

**Published numeric rate/usage limits: NOT FOUND.** USPTO's terms prohibit access
patterns that deny or decrease service and warn that unusually high automated
database traffic may be blocked, while directing bulk users to bulk products. A
weekly single-product fetch with conditional metadata checks, bounded retries,
and no per-record API crawl is the conservative policy. [USPTO Terms of
Use](https://www.uspto.gov/terms-use-uspto-websites#use-of-uspto-databases)

The stable identifier is `PTMNFEE2` and the stable landing page is
`https://data.uspto.gov/bulkdata/datasets/ptmnfee2`; USPTO expressly warns that
deep links may change or disappear without warning. Resolve the current file URI
from product metadata at refresh time and persist the product id, release date,
resolved source URI, response metadata, and checksum in the generated manifest.
[Federal catalog distribution
metadata](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)
and [USPTO linking policy](https://www.uspto.gov/terms-use-uspto-websites#linking-policy)

## 5. Licensing and public-repo fixture policy

The federal catalog marks this dataset with Creative Commons Public Domain Mark
1.0. USPTO's current Terms say most government-produced site material is public
domain in the United States and may be freely copied and distributed, request
USPTO acknowledgement, reserve possible international copyright, and warn that
some third-party material on USPTO sites may remain protected. [Dataset license
metadata](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)
and [USPTO copyright
terms](https://www.uspto.gov/terms-use-uspto-websites#copyright-information)

Public-repo fixtures may therefore contain small, unmodified `PTMNFEE2` event and
code-description excerpts, provided each fixture records `source: USPTO`, product
id `PTMNFEE2`, source release date, source URL, checksum of the complete downloaded
source, extraction method/line identities, access date, and Public Domain Mark.
Do not include portal HTML, logos/seals, patent drawings, or other third-party
materials; fixture rows should contain only the government-produced structured
records necessary to test parsing and state transitions. [USPTO copyright and
seal terms](https://www.uspto.gov/terms-use-uspto-websites)

## 6. Refresh ownership and goal boundary

### `@beep/uspto` / driver substrate owns

1. A codegen-only refresh command that resolves the latest `PTMNFEE2` release,
   downloads the cumulative archive plus its current documentation/code
   description, checks content type and size bounds, computes checksums, and
   stages output before atomic replacement. This follows the repo rule that
   downloads happen only during codegen and committed generated artifacts make
   build/check network-free. [`gov-legal-data-driver-codegen`
   constraints](../../../goals/gov-legal-data-driver-codegen/SPEC.md#constraints)
2. Schema-first parsing of raw fields; lossless preservation of raw event codes;
   generated native code/description vocabulary; duplicate handling; ordering;
   and explicit unknown-code/schema-drift failures. The driver owns faithful
   USPTO-native facts, not legal conclusions. [`DECISIONS.md` Q4/Q5
   pre-draft](../DECISIONS.md#q4-status-code-vocabulary--versioned-generated-artifact-or-runtime-status-codes-cache)
3. A committed manifest containing product id, release date, retrieval timestamp,
   landing/resolved URLs, compressed/uncompressed sizes, source checksums,
   documentation/code-list checksums, generator version, row count, rejected-row
   count, and vocabulary diff. Re-running against pinned inputs must be byte-for-
   byte deterministic, with CI `git diff --exit-code` drift proof.
   [`gov-legal-data-driver-codegen` AC#6/Q7](../../../goals/gov-legal-data-driver-codegen/SPEC.md#acceptance-criteria)

### `law-docketing-patent-spine` owns

1. Selecting the legally operative event sequence for a matter; computing
   opening, surcharge, expiration, reinstatement, and notice dates; holiday and
   Eastern-Time rules; and producing human-reviewable deadline provenance.
   [USPTO timing rules](https://www.uspto.gov/patents/maintain#when-to-pay)
2. Reissue-family, continuity, terminal-disclaimer, patent-term, entity-status,
   and reinstatement policy; alerts and workflow; and the rule that a bulk event
   is evidence, not by itself a legal conclusion. [MPEP reissue
   rules](https://www.uspto.gov/web/offices/pac/mpep/s1415.html) and [MPEP
   reinstatement/intervening-rights rule](https://www.uspto.gov/web/offices/pac/mpep/s2591.html)
3. Joining `PTMNFEE2` to the patent spine and retaining source snapshot/checksum,
   raw record identity, parser version, derived-rule version, and review status
   on every deadline. This preserves the packet's native-vocabulary/domain-
   interpretation ownership split. [`DECISIONS.md` Q5
   pre-draft](../DECISIONS.md#q5-package-placement--where-do-net-new-drivers-and-the-prosecution-phase-overlay-live)

## Required implementation-time verification gates

- Download the latest release through an authorized ODP session/API key and
  capture exact filenames, archive layout, sizes, headers, delimiter/widths,
  encoding, nulls, date formats, and row count.
- Commit or checksum-pin the contemporaneous USPTO documentation and
  `MaintFeeEventsDesc`; enumerate and diff the complete vocabulary before mapping
  any event.
- Live-probe anonymous resolved-file access and record the result; do not assume
  that `accessLevel: public` means unauthenticated transport after 2026-06-18.
- Obtain a written/current USPTO answer only if international redistribution or
  fixture use beyond structured government-authored rows is required.

