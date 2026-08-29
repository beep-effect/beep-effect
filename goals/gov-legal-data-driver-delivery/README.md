# Gov/Legal Data Driver Delivery

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

Born from a grilled design session on 2026-07-11 (no explorations/ packet);
the delivery follow-on to
[`goals/gov-legal-data-driver-codegen`](../gov-legal-data-driver-codegen)
(substrate-complete), whose P2 this packet supersedes.

## Mission

Deliver the research foundation and first product-pulled driver on the substrate
the predecessor proved: committed source/terms research plus `@beep/ecfr` at
15-operation parity. Federal Register, DOL, and CourtListener resume
individually only when a product feature pulls that driver.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/gov-legal-data-driver-delivery/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (Locked Decisions D1–D7
   + inherited predecessor Q2/Q5/Q7/Q8).
3. [`PLAN.md`](./PLAN.md) - terminal execution and deferral record (P0–P6).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - provenance ledger + (from P0) the
   data/source-terms matrix.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Source material

The predecessor packet's
[`research/SOURCES.md`](../gov-legal-data-driver-codegen/research/SOURCES.md)
remains the primary mined-source ledger (gold nuggets, upstream licenses,
port discipline). This packet's [`research/SOURCES.md`](./research/SOURCES.md)
joins the delivery-specific provenance: the `us-legal-tools` donor SDKs (MIT
— patterns and committed specs only, never the axios/zod runtime), official
API documentation per upstream, and the in-repo bricks this packet composes.
Licenses are load-bearing: AGPL upstreams are clean-room pattern references
only.

## Current Phase

**Terminal as descoped.** P0 (research specs) and P1 (`@beep/ecfr` breadth)
are the accepted deliverable. P2 Federal Register, P3 DOL, and P4/P5
CourtListener are explicit won't-do-until-product-pull deferrals. Each resumes
independently from the committed research named below; P6 close bookkeeping is
complete.

The empty Federal Register, DOL, and CourtListener workspace scaffolds were
deleted by [`goals/honest-repo-signal`](../honest-repo-signal/README.md). Resume
those drivers from
[`goals/honest-repo-signal/research/FOLLOW-UPS.md`](../honest-repo-signal/research/FOLLOW-UPS.md)
when a product feature pulls them; recreate the package in the same PR as the
first real surface. Committed research under [`research/`](./research/) is
unchanged.

## Latest Evidence

P1 (2026-07-11): `@beep/ecfr` at 15/15 official operations (admin, search,
versioner families; `basePath ""` with family-prefixed paths; agencies
corrected to admin; full-title XML as typed raw string per D7;
`searchResultsAll` via `Stream.paginate` per D5), 30 generated models,
byte-deterministic regenerate, offline fake-HttpClient tests for every
endpoint group + multi-page search stream, docgen green. Official spec
authority committed at
[`research/specs/ecfr-official-v1.json`](./research/specs/ecfr-official-v1.json).

P0 (2026-07-11):

- [`research/data-source-terms-matrix.md`](./research/data-source-terms-matrix.md)
  — five upstream rows, D2 columns, per-upstream verdicts + propagation
  obligations; registered in manifest `currentSourceOfTruth[]`.
- [`research/specs/`](./research/specs/) — official FedReg OpenAPI
  (14 operations, fetched from federalregister.gov) and the CourtListener
  official machine-readable capture (v4 API root, 47 endpoints; 23
  anonymous OPTIONS docs; access map).
- DOL auth mechanism verified against the live portal
  (dataportal.dol.gov; developer.dol.gov is dead): `X-API-KEY` is a
  **query parameter** → P3 wires `ApiKeyQueryAuth`.
- [`research/courtlistener-deltas.md`](./research/courtlistener-deltas.md)
  — CourtListener publishes **no official OpenAPI schema endpoint** (dated
  D4 correction in `SPEC.md`); SCOTUS visualizations officially deprecated
  → excluded from P4/P5 generation; v4.3/v4.4/v4.5 change-log deltas.
- Predecessor cross-links (P2 supersession) verified already landed.

Deferred per-driver restart points (2026-07-14):

- **P2 Federal Register:** resume from
  [`research/specs/federal-register-openapi.json`](./research/specs/federal-register-openapi.json).
- **P3 DOL:** resume from
  [`research/data-source-terms-matrix.md`](./research/data-source-terms-matrix.md)
  and [`research/SOURCES.md`](./research/SOURCES.md).
- **P4/P5 CourtListener:** resume from
  [`research/specs/courtlistener/api-root.v4.json`](./research/specs/courtlistener/api-root.v4.json),
  [`research/specs/courtlistener/options-status.tsv`](./research/specs/courtlistener/options-status.tsv),
  and [`research/courtlistener-deltas.md`](./research/courtlistener-deltas.md).

## Notes

- P2–P5 are won't-do until a product feature pulls a named driver. Resume one
  driver at a time from its committed research restart point.
- CourtListener: literal `Authorization: Token` (not Bearer); synthetic-only
  committed fixtures; in-process/ephemeral cache only.
- P0 resolved the predecessor's DOL auth contradiction: the live portal uses a
  query-parameter `X-API-KEY` and the restart point records `ApiKeyQueryAuth`.
- Exemplars to mirror: `packages/drivers/ecfr` (keyless raw-client shape +
  bespoke renderer), `packages/drivers/govinfo` (keyed config patterns).
  All four `ApiAuth` branches (incl. `TokenHeaderAuth`, `ApiKeyHeaderAuth`)
  already exist in `@beep/api-transport` — wire and exercise them; extend
  the union only if the P0-verified DOL mechanism requires a new shape.
- `gov-legal-mcp` remains a deferred follow-on goal (predecessor Q3), not
  this packet.
