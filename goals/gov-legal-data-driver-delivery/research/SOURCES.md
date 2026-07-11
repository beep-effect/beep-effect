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
  `research/data-source-terms-matrix.md` — does not exist yet; DOL and
  CourtListener phases are default-deny until it lands.

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
| dol spec | DOL v4 OpenAPI (6 GET ops: datasets, get/{agency}/{endpoint} json/xml/csv + metadata; `filter_object` DSL; limit/offset + array-tail pagination metadata) | `packages/dol-sdk/openapi-v4.yaml` (+ `scripts/fix-openapi-spec.ts`) | port-with-attribution as bootstrap spec; P0 checks for an official upstream equivalent |
| CL spec | CourtListener v4 OpenAPI (53 ops, 133 models; cursor pagination; `RateLimitError`/`wait_until`) | `packages/courtlistener-sdk/courtlistener-openapi.json` (+ `api-data.json`) | diff reference; P0 commits the current official `/api/schema/` output |
| CL auth shape | Literal `Authorization: Token <env>` axios mutator (DRF TokenAuthentication, not Bearer) | `packages/courtlistener-sdk/src/api/client.ts` | pattern only (already captured as predecessor nugget us-legal-tools#3) |
| DOL quirks | Last-array-element pagination metadata; `filter_object` JSON filter DSL (`eq/neq/gt/lt/in/not_in/like` + `and`/`or` nesting) | `packages/dol-sdk/src/api/generated/model/*` JSDoc | model as first-class tagged-union schemas (SPEC AC#4) |
| fedreg agency enum | ~470 agency slugs as a const enum | `packages/federal-register-sdk/src/api/generated/model/agency.ts` | reference for the P2 agency-slug domain decision (LiteralKit vs branded string) |

**Known donor inaccuracies (do not port):** the dol-sdk README documents
`createApiClient`/`getAgencies` symbols that do not exist; the donor never
actually injects the DOL API key. The DOL auth mechanism (header vs query
`X-API-KEY`) is also contradicted between the predecessor SPEC ("agency-native
header") and its research cautions ("api.data.gov query param") — **P0
verifies against developer.dol.gov and records the fact here.**

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
- DOL API beginners guide / user guide —
  https://developer.dol.gov/beginners-guide/ ·
  https://www.dataportal.dol.gov/pdf/dol-api-user-guide.pdf ·
  https://usdepartmentoflabor.github.io/DOLAPI/
- api.data.gov developer manual — https://api.data.gov/docs/developer-manual/
- Donor repo — https://github.com/beshkenadze/us-legal-tools

P0 adds: the exact URL each committed spec was fetched from, fetch date, and
any conversion steps (recorded per spec file).

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
  (P0–P6) · [`GOAL.md`](../GOAL.md) · [`ops/manifest.json`](../ops/manifest.json).
- **Deferred siblings:** `gov-legal-mcp` follow-on goal (predecessor Q3);
  patents work routes to `explorations/uspto-patent-driver-depth`.
