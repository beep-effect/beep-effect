# CourtListener P0 Verification Deltas

Verified 2026-07-11. These deltas replace P0 assumptions that no longer match
CourtListener’s public machine-readable surface. They do not relax the binding
terms controls in [`data-source-terms-matrix.md`](./data-source-terms-matrix.md).

## 1. No official OpenAPI schema endpoint

**Delta.** CourtListener does not expose an official OpenAPI document at
`/api/schema/`. The URL returned a Django 404, and the current application URL
configuration wires the API through Django REST Framework routers without an
OpenAPI/Swagger schema route. The current dependency manifest contains no
`drf-spectacular`, Swagger, or equivalent OpenAPI generator. GitHub code search
for `openapi`, `swagger`, or `spectacular` in the repository returned zero code
hits. The v3.12 changelog’s experimental-OpenAPI statement did not produce a
public schema route that exists today.

**Evidence (accessed 2026-07-11):**

- [`https://www.courtlistener.com/api/schema/`](https://www.courtlistener.com/api/schema/)
  — quote: “Page not found (404).”
- [`cl/urls.py` at the captured upstream commit](https://github.com/freelawproject/courtlistener/blob/2e1922c693b9ecbe83b487d5c27f2b4a721128e9/cl/urls.py)
  — quote: `path("", include("cl.api.urls"))`.
- [`cl/api/urls.py` at the captured upstream commit](https://github.com/freelawproject/courtlistener/blob/2e1922c693b9ecbe83b487d5c27f2b4a721128e9/cl/api/urls.py)
  — quote: `router_v4 = DefaultRouter()`.
- [`pyproject.toml` at the captured upstream commit](https://github.com/freelawproject/courtlistener/blob/2e1922c693b9ecbe83b487d5c27f2b4a721128e9/pyproject.toml)
  — observed result: no dependency named `drf-spectacular`, `swagger`, or
  `openapi`.
- [GitHub code search scoped to the repository](https://github.com/search?q=repo%3Afreelawproject%2Fcourtlistener+openapi+OR+swagger+OR+spectacular&type=code)
  — observed result: zero code hits.
- [REST API change log, v3.12](https://www.courtlistener.com/help/api/rest/changes)
  — quote: “Our support of OpenAPI remains experimental.”

**Consequence.** SPEC D4’s instruction to commit official `/api/schema/`
output is unsatisfiable. P4/P5 use the donor MIT OpenAPI file only as a
bootstrap renderer input, then reconcile it against CourtListener’s official
live v4 API-root JSON and per-resource `OPTIONS` metadata. The official live
surface, not the donor file, decides parity.

## 2. Official machine-readable capture

**Delta.** The P0 official capture is committed under
`research/specs/courtlistener/`:

- `api-root.v4.json`: the 47 keys returned by the official v4 API root;
- `options/*.json`: 23 resource `OPTIONS` documents available anonymously;
- `options-status.tsv`: the access result for every one of the 47 root keys,
  including `401` and parameter-dependent responses that could not be captured
  anonymously.

**Evidence (accessed and fetched 2026-07-11):**

- [Official v4 API root JSON](https://www.courtlistener.com/api/rest/v4/?format=json)
  — quote: `"search": "https://www.courtlistener.com/api/rest/v4/search/?format=json"`.
- [Representative official Court `OPTIONS` resource](https://www.courtlistener.com/api/rest/v4/courts/)
  — quote: `"name": "Court List"`.
- [CourtListener REST API help](https://www.courtlistener.com/help/api/rest/)
  — quote: “REST APIs.”

The capture is intentionally a reproducible evidence set, not an invented
OpenAPI export. `options-status.tsv` distinguishes anonymous capture failure
from endpoint absence.

## 3. Deprecated visualization endpoints

**Delta.** Exclude both `visualizations` and `visualizations/json` from P4/P5
generation. The routes remain present in the live API root, but CourtListener
marks the feature largely deprecated and removed visualization display from
the website.

**Evidence (accessed 2026-07-11):**

- [Official visualization API deprecation notice](https://www.courtlistener.com/help/api/rest/v4/visualizations/)
  — quote: “This API is largely deprecated as of late 2025.”
- [Official visualization API deprecation notice](https://www.courtlistener.com/help/api/rest/v4/visualizations/)
  — quote: “The ability to display visualizations on CourtListener.com has
  been removed.”

**Consequence.** The D3 exclusion list is exactly:
`visualizations`, `visualizations/json`. Their presence in the 47-key root is
recorded, but they do not count against generated-operation parity.

## 4. Changelog deltas affecting generation

### v4.3: anonymous access tightened

Anonymous requests to dockets, opinion clusters, and opinions now return
`401 Unauthorized`.

**Evidence:** [official REST API change log](https://www.courtlistener.com/help/api/rest/changes)
(accessed 2026-07-11) — quote: “Anonymous requests now receive a `401
Unauthorized` response.”

**Generation consequence:** schemas and offline tests must not infer endpoint
absence from anonymous `401` responses. The driver must use literal
`Authorization: Token <token>` for authenticated operation.

### v4.4: bankruptcy information added

The live surface adds a `bankruptcy-information` endpoint and a
`bankruptcy_information` field on dockets.

**Evidence:** [official REST API change log](https://www.courtlistener.com/help/api/rest/changes)
(accessed 2026-07-11) — quote: “A new `bankruptcy_information` field.”

**Generation consequence:** add the endpoint and docket field when reconciling
the donor bootstrap against the live root/metadata.

### v4.5: expensive text filters removed

CourtListener removed `contains`, `icontains`, `endswith`, and `iendswith`
lookups from text fields across all endpoints.

**Evidence:** [official REST API change log](https://www.courtlistener.com/help/api/rest/changes)
(accessed 2026-07-11) — quote: “The following filter types have been removed
from text fields across all endpoints.”

**Generation consequence:** the donor spec may still describe these filters;
P4/P5 must not generate filter surfaces that the live API rejects. Retain only
the live-supported exact/iexact and startswith/istartswith text lookups, and
route full-text use cases to the Search API.

## 5. Donor OpenAPI provenance and inventory mismatch

**Delta.** The donor OpenAPI file is not an official CourtListener export. It
comes from the MIT `us-legal-tools` checkout at commit
`cdec243b47f3c159c27d9504599e6bfc4c689dcf` dated 2025-08-06. Its own update
instructions tell an AI assistant to read CourtListener documentation and
generate the file.

**Evidence (accessed 2026-07-11):**

- [Pinned donor OpenAPI file](https://github.com/beshkenadze/us-legal-tools/blob/cdec243b47f3c159c27d9504599e6bfc4c689dcf/packages/courtlistener-sdk/courtlistener-openapi.json)
  — observed inventory: 51 paths and 53 HTTP operations.
- [Pinned donor update prompt](https://github.com/beshkenadze/us-legal-tools/blob/cdec243b47f3c159c27d9504599e6bfc4c689dcf/packages/courtlistener-sdk/UPDATE_OPENAPI_PROMPT.md)
  — quote: “Use this prompt to recreate or update the CourtListener OpenAPI
  specification.”
- [Official v4 API root JSON](https://www.courtlistener.com/api/rest/v4/?format=json)
  — observed inventory: 47 top-level endpoint keys on 2026-07-11.

The counts are not directly equivalent: the donor counts detail paths and
multiple methods, while the API root lists resource roots. The name-level
cross-check still demonstrates drift:

| Inventory comparison | Count | Names |
| --- | ---: | --- |
| Donor operations | 53 | 51 paths; donor baseline claim |
| Official live API-root keys | 47 | Includes the two deprecated visualization keys |
| Distinct donor collection roots | 29 | Derived from donor paths |
| Donor-only root names | 7 | `citations`, `judge-positions`, `non-investment-income`, `original-proceedings-panels`, `pacer-doc-ids`, `processing-queue`, `spouse-income` |
| Live-only root names | 25 | Includes `bankruptcy-information`, pluralized financial-disclosure resources, RECAP resources, tags, and other current roots |

The complete live-only set is: `aba-ratings`, `attorneys`,
`bankruptcy-information`, `disclosure-positions`, `docket-entries`,
`docket-tags`, `educations`, `fjc-integrated-database`, `increment-event`,
`memberships`, `non-investment-incomes`, `opinions-cited`,
`originating-court-information`, `parties`, `prayers`, `recap-documents`,
`recap-email`, `recap-query`, `retention-events`, `scrapers/scotus-email`,
`sources`, `spouse-incomes`, `tag`, `tags`, and `visualizations/json`.

**Consequence.** The donor file remains the MIT bootstrap for schemas and
rendering, with attribution. P4/P5 parity is the reconciled live inventory:
official 47-key root plus available official `OPTIONS` metadata, minus the two
recorded deprecated visualization endpoints, with authenticated resources
validated through official documentation and offline fixtures rather than
treated as absent after anonymous `401` responses.
