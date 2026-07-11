# Gov/Legal Data Driver Delivery — Sources & Provenance

Provenance ledger for the delivery packet. The predecessor packet's ledger
([`goals/gov-legal-data-driver-codegen/research/SOURCES.md`](../../gov-legal-data-driver-codegen/research/SOURCES.md))
remains the primary mined-source corpus (19 gold nuggets, 12 upstream repos,
licenses + port discipline); this file joins only the delivery-specific
provenance: the donor SDK specs, per-upstream official documentation, and the
in-repo bricks this packet composes. Built during the 2026-07-11 design
session; extended during P0.

- **Predecessor packet:**
  [`goals/gov-legal-data-driver-codegen`](../../gov-legal-data-driver-codegen)
  — SPEC Decision Log Q1–Q8 stays binding except where this packet's SPEC
  records a dated superseding entry (D4 supersedes the Q1 "no clean OpenAPI
  for CL/DOL" assumption).
- **Design session:** 2026-07-11 grill-with-docs (claude) — decisions D1–D7
  recorded in [`SPEC.md`](../SPEC.md) Locked Decisions.
- **Data/source-terms matrix (P0 deliverable):**
  [`research/data-source-terms-matrix.md`](./data-source-terms-matrix.md) —
  verified 2026-07-11; all five upstreams are conditional allows, with the
  operative README, fixture-metadata, and cache-policy propagation rules
  recorded per upstream.
- **CourtListener P0 deltas:**
  [`research/courtlistener-deltas.md`](./courtlistener-deltas.md) — the absent
  official OpenAPI route, committed live machine-readable surface,
  deprecations, changelog changes, and donor drift.

## 1. Donor SDK corpus (reference implementations)

Local checkout: `/home/elpresidank/YeeBois/research/law_stuff/repos/us-legal-tools`
(github.com/beshkenadze/us-legal-tools, MIT). All four SDKs are Orval v7
codegen over committed specs (axios SDK + fetch/zod MCP). **Port discipline:
take the committed specs and API-shape knowledge with attribution; never port
the Orval/axios/zod runtime** (predecessor Q1; SPEC D4).

| Source | What it is | Location (donor repo) | Disposition |
| --- | --- | --- | --- |
| fedreg spec | Federal Register API v1 OpenAPI (14 GET ops: documents, facets, issues TOC, public-inspection, agencies, images, suggested searches) | `packages/federal-register-sdk/openapi.json` | bootstrap/diff reference; P0 commits the official upstream spec |
| ecfr specs | eCFR Swagger 2.0 + converted OAS3 (15 GET ops: admin, search, versioner) | `packages/ecfr-sdk/v1.json`, `packages/ecfr-sdk/v1-openapi3.json` | diff reference — beep's committed `@beep/ecfr` `openapi.json` is a hand-maintained 2-operation subset today; P1 grows it to the full 15-operation surface (ecfr.gov v1 docs as authority) |
| dol spec | DOL v4 OpenAPI (6 GET ops: datasets, get/{agency}/{endpoint} json/xml/csv + metadata; `filter_object` DSL; limit/offset + array-tail pagination metadata) | `packages/dol-sdk/openapi-v4.yaml` (+ `scripts/fix-openapi-spec.ts`) at `cdec243b47f3c159c27d9504599e6bfc4c689dcf` | MIT bootstrap with attribution; no official DOL OpenAPI is published (P0 verified 2026-07-11) |
| CL spec | AI-authored CourtListener v4 OpenAPI (53 ops, 133 models; cursor pagination; `RateLimitError`/`wait_until`) | `packages/courtlistener-sdk/courtlistener-openapi.json` (+ `api-data.json`) at `cdec243b47f3c159c27d9504599e6bfc4c689dcf` | MIT bootstrap/diff reference, not an official export; reconcile to the official live API root + `OPTIONS` metadata |
| CL auth shape | Literal `Authorization: Token <env>` axios mutator (DRF TokenAuthentication, not Bearer) | `packages/courtlistener-sdk/src/api/client.ts` | pattern only (already captured as predecessor nugget us-legal-tools#3) |
| DOL quirks | Last-array-element pagination metadata; `filter_object` JSON filter DSL (`eq/neq/gt/lt/in/not_in/like` + `and`/`or` nesting) | `packages/dol-sdk/src/api/generated/model/*` JSDoc | model as first-class tagged-union schemas (SPEC AC#4) |
| fedreg agency enum | ~470 agency slugs as a const enum | `packages/federal-register-sdk/src/api/generated/model/agency.ts` | reference for the P2 agency-slug domain decision (LiteralKit vs branded string) |

**Known donor inaccuracies (do not port):** the dol-sdk README documents
`createApiClient`/`getAgencies` symbols that do not exist; the donor never
actually injects the DOL API key. P0 resolved the earlier auth contradiction:
`X-API-KEY` is a **query parameter**, not a header. The live
`dataportal.dol.gov` SPA bundle
[`/static/js/main.1788ccf8.js`](https://dataportal.dol.gov/static/js/main.1788ccf8.js)
(accessed 2026-07-11) lists “X-API-KEY (string, required)” as a parameter; its
URL, Python `requests` `params`, and R `GET(..., query=params)` examples all
put it in the query string. The bundle’s only `Authorization: Bearer` headers
serve the portal’s own account/API-key management calls. Consequently,
`@beep/dol` wires `ApiAuth.ApiKeyQueryAuth`.

No official DOL OpenAPI document was published as of 2026-07-11. The live SPA
hardcodes the API calls and exposes documentation, but no OpenAPI URL; the
donor MIT `packages/dol-sdk/openapi-v4.yaml` at commit
`cdec243b47f3c159c27d9504599e6bfc4c689dcf` remains the attributed bootstrap.
[DOL Open Data Portal](https://dataportal.dol.gov/) and
[SPA bundle](https://dataportal.dol.gov/static/js/main.1788ccf8.js)
(accessed 2026-07-11).

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
| --- | --- | --- | --- |
| us-legal-tools (beshkenadze) | MIT | Port-with-attribution | Committed OpenAPI specs (bootstrap/diff), endpoint inventories, CL Token-auth shape, DOL DSL/pagination quirks |
| courtlistener (freelawproject) | AGPL-3.0-only | **Clean-room reimplement only** | Pattern reference via predecessor ledger; official API schema/data are consumed as a service, not code |

Licenses gate ports. The full upstream table (TalentScore, us-gov-open-data-mcp,
mcp-uspto, etc.) lives in the predecessor ledger §2 and is not duplicated here.

## 3. External research sources

Official upstream API documentation, reproduced from the predecessor ledger
§3 (verbatim URLs on disk there; not invented here):

- Federal Register API v1 docs + legal status —
  https://www.federalregister.gov/developers/documentation/api/v1 ·
  https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status
- eCFR API v1 docs + spec —
  https://www.ecfr.gov/developers/documentation/api/v1 ·
  https://www.ecfr.gov/developers/documentation/api/v1.json
- CourtListener REST v4 overview + citation-lookup —
  https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview ·
  https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup
- CourtListener auth hardening (API in memberships) —
  https://free.law/2026/05/07/api-included-in-memberships/
- DOL Open Data Portal / user guide —
  https://dataportal.dol.gov/ ·
  https://www.dataportal.dol.gov/pdf/dol-api-user-guide.pdf ·
  https://usdepartmentoflabor.github.io/DOLAPI/ — the former
  `developer.dol.gov` host no longer resolves and is replaced by the portal
  (verified 2026-07-11).
- api.data.gov developer manual — https://api.data.gov/docs/developer-manual/
- Donor repo — https://github.com/beshkenadze/us-legal-tools

### P0 verified (2026-07-11)

The following artifacts were fetched without schema conversion, then
pretty-printed with the repo biome JSON formatter (whitespace only —
semantically identical, key order preserved). Every CourtListener
`options/*.json` file is the JSON response to an HTTP `OPTIONS` request at the
exact URL shown.

| Committed artifact | Exact upstream fetch URL | Fetch date / transformation |
| --- | --- | --- |
| `research/specs/federal-register-openapi.json` | https://www.federalregister.gov/developers/documentation/api/v1.json | 2026-07-11; official OpenAPI, 14 GET operations; no schema conversion (biome pretty-print only) |
| `research/specs/courtlistener/api-root.v4.json` | https://www.courtlistener.com/api/rest/v4/?format=json | 2026-07-11; official v4 root, 47 endpoint keys; no conversion |
| `research/specs/courtlistener/options/aba-ratings.json` | https://www.courtlistener.com/api/rest/v4/aba-ratings/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/agreements.json` | https://www.courtlistener.com/api/rest/v4/agreements/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/audio.json` | https://www.courtlistener.com/api/rest/v4/audio/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/courts.json` | https://www.courtlistener.com/api/rest/v4/courts/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/debts.json` | https://www.courtlistener.com/api/rest/v4/debts/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/disclosure-positions.json` | https://www.courtlistener.com/api/rest/v4/disclosure-positions/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/educations.json` | https://www.courtlistener.com/api/rest/v4/educations/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/financial-disclosures.json` | https://www.courtlistener.com/api/rest/v4/financial-disclosures/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/gifts.json` | https://www.courtlistener.com/api/rest/v4/gifts/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/increment-event.json` | https://www.courtlistener.com/api/rest/v4/increment-event/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/investments.json` | https://www.courtlistener.com/api/rest/v4/investments/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/non-investment-incomes.json` | https://www.courtlistener.com/api/rest/v4/non-investment-incomes/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/people.json` | https://www.courtlistener.com/api/rest/v4/people/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/political-affiliations.json` | https://www.courtlistener.com/api/rest/v4/political-affiliations/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/positions.json` | https://www.courtlistener.com/api/rest/v4/positions/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/recap-fetch.json` | https://www.courtlistener.com/api/rest/v4/recap-fetch/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/reimbursements.json` | https://www.courtlistener.com/api/rest/v4/reimbursements/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/retention-events.json` | https://www.courtlistener.com/api/rest/v4/retention-events/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/schools.json` | https://www.courtlistener.com/api/rest/v4/schools/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/search.json` | https://www.courtlistener.com/api/rest/v4/search/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/sources.json` | https://www.courtlistener.com/api/rest/v4/sources/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/spouse-incomes.json` | https://www.courtlistener.com/api/rest/v4/spouse-incomes/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options/tags.json` | https://www.courtlistener.com/api/rest/v4/tags/ | 2026-07-11; no conversion |
| `research/specs/courtlistener/options-status.tsv` | https://www.courtlistener.com/api/rest/v4/?format=json plus an `OPTIONS` probe to each of its 47 exact endpoint URLs | 2026-07-11; generated access map only (`200`, `401`, or parameter-dependent status), no response-body conversion |

CourtListener’s `https://www.courtlistener.com/api/schema/` returned a Django
404 on 2026-07-11. Current `cl/urls.py`, `cl/api/urls.py`, and
`pyproject.toml` expose DRF routers but no public OpenAPI generator/route.
Therefore no official CourtListener OpenAPI artifact exists to commit; the
official machine-readable baseline is the capture above. Full evidence and
the D4 consequence are in
[`courtlistener-deltas.md`](./courtlistener-deltas.md).

The DOL portal and its `/static/js/main.1788ccf8.js` bundle were fetched on
2026-07-11. `developer.dol.gov` failed DNS resolution; `dataportal.dol.gov` is
the live replacement. The bundle publishes the query-parameter auth examples
and hardcoded routes but no official OpenAPI document, so the pinned donor MIT
spec remains the bootstrap described in §1.

### P1 eCFR endpoint breadth (2026-07-11)

| Source or decision | Provenance | P1 disposition |
| --- | --- | --- |
| Official eCFR Swagger 2.0 artifact | `research/specs/ecfr-official-v1.json`, fetched 2026-07-11 from https://www.ecfr.gov/developers/documentation/api/v1.json; biome pretty-print only | Authority for the 15 GET operations across admin, search, and versioner |
| Multi-family URL layout | Official paths already include `/api/<family>/v1`; the prior package spec used `basePath: /api/versioner/v1` | Set the hand-maintained package spec `basePath` to `""` and retain full official paths so one origin serves all three families |
| Agencies family correction | Official path is `/api/admin/v1/agencies.json`; the prior two-operation subset placed it under versioner | Corrected to the admin path and changed the default technical API URL to the shared `https://www.ecfr.gov` origin |
| Search response modeling | Only search results has an official response schema; the remaining search endpoints leave 200 response schemas unspecified | Named stable known envelope fields conservatively and kept every inferred field optional (required-minimal) |
| Full-title payload | Official `/full/{date}/title-{title}.xml` response is XML; SPEC D7 excludes XML parsing | Modeled the 200 body as a typed raw string and decoded it with the HTTP text body accessor |
| Donor diff reference | MIT `us-legal-tools/packages/ecfr-sdk/v1-openapi3.json` | Used only to compare paths, parameters, media types, and descriptions; no donor axios/zod runtime was ported |

## 4. In-repo capability references

The `@beep/*` bricks this packet composes:

| Capability | Package path | Status |
| --- | --- | --- |
| eCFR driver (keyless exemplar: config/errors/service + bespoke `scripts/generate.ts` + committed spec + `src/_generated/*`) | `packages/drivers/ecfr` | **extend** — 2→15 operations + Stream helpers (P1) |
| Federal Register driver | `packages/drivers/federal-register` | **extend** — skeleton→finished (P2) |
| DOL driver | `packages/drivers/dol` | **extend** — skeleton→finished (P3, gated) |
| CourtListener driver | `packages/drivers/courtlistener` | **extend** — skeleton→finished (P4–P5, gated) |
| Shared transport (auth/retry/cache/rate-limit; `makeApiTransport`, `ApiAuth` union) | `packages/foundation/capability/api-transport` | **reuse** — all four `ApiAuth` branches (`NoAuth`, `ApiKeyQueryAuth`, `TokenHeaderAuth`, `ApiKeyHeaderAuth`) already implemented per predecessor Q5; wire + exercise offline; extend only on P0 evidence |
| Keyed-driver patterns (redacted Option config, `mapClientError`, cache) | `packages/drivers/govinfo` | **reuse** — pattern source only |
| Identity composers (`$EcfrId`, `$FederalRegisterId`, `$DolId`, `$CourtlistenerId`) | `packages/foundation/modeling/identity/src/packages.ts` | **reuse** — already exist |
| Schema kit (`TaggedErrorClass`, `LiteralKit`, annotations) | `@beep/schema`, `@beep/identity` | **reuse** |
| Offline test kit (`fcRuns`, fake `HttpClient` double pattern) | `@beep/test-utils` + `packages/drivers/{ecfr,govinfo}/test` | **reuse** |
| CI codegen-drift lane (`git diff --exit-code` after regenerate) | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` (`beep ci lane codegen` step list; dispatched by `.github/workflows/check.yml`) | **extend** — cover the three new generating packages (+ its test `packages/tooling/tool/cli/test/ci-lane.test.ts`) |

## 5. Cross-links & provenance

- **Predecessor packet:**
  [`SPEC.md`](../../gov-legal-data-driver-codegen/SPEC.md) (Q1–Q8 Decision
  Log) · [`PLAN.md`](../../gov-legal-data-driver-codegen/PLAN.md) (P2
  superseded by this packet per D1) ·
  [`research/SOURCES.md`](../../gov-legal-data-driver-codegen/research/SOURCES.md)
  (primary mined-source ledger) ·
  [`research/2026-06-30-ecfr-generator-spike.md`](../../gov-legal-data-driver-codegen/research/2026-06-30-ecfr-generator-spike.md)
  (bespoke-renderer decision this packet builds on).
- **Source exploration (grand-predecessor):**
  [`explorations/gov-legal-data-driver-codegen`](../../../explorations/gov-legal-data-driver-codegen).
- **This packet:** [`SPEC.md`](../SPEC.md) (D1–D7) · [`PLAN.md`](../PLAN.md)
  (P0–P6) · [`GOAL.md`](../GOAL.md) ·
  [`data-source-terms-matrix.md`](./data-source-terms-matrix.md) (D2 terms and
  propagation obligations) ·
  [`courtlistener-deltas.md`](./courtlistener-deltas.md) (official live
  surface, donor drift, and exclusions) ·
  [`ops/manifest.json`](../ops/manifest.json).
- **Deferred siblings:** `gov-legal-mcp` follow-on goal (predecessor Q3);
  patents work routes to `explorations/uspto-patent-driver-depth`.
