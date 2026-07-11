# Gov/Legal Data Driver Delivery

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

Born from a grilled design session on 2026-07-11 (no explorations/ packet);
the delivery follow-on to
[`goals/gov-legal-data-driver-codegen`](../gov-legal-data-driver-codegen)
(substrate-complete), whose P2 this packet supersedes.

## Mission

Finish the four gov/legal data drivers on the substrate the predecessor
proved: grow `@beep/ecfr` to full endpoint parity, build
`@beep/federal-register` (keyless), and — once the P0 data/source-terms
matrix unlocks them — build `@beep/dol` and `@beep/courtlistener` (keyed) to
full parity with their committed official specs, with offline tests, Stream
pagination helpers, and green docgen throughout.

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
3. [`PLAN.md`](./PLAN.md) - active execution plan (P0–P6).
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

**P1 — ecfr breadth (2→15 operations).** P0 (matrix + specs) completed
2026-07-11.

## Latest Evidence

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

## Notes

- P3–P5 (dol, courtlistener) are hard-gated on the data/source-terms matrix
  (SPEC D2, inherited Q8 default-deny). Do not start them before it exists.
- CourtListener: literal `Authorization: Token` (not Bearer); synthetic-only
  committed fixtures; in-process/ephemeral cache only.
- The DOL auth mechanism (header vs query `X-API-KEY`) is contradicted across
  predecessor documents — P0 verifies it against developer.dol.gov before any
  DOL code exists.
- Exemplars to mirror: `packages/drivers/ecfr` (keyless raw-client shape +
  bespoke renderer), `packages/drivers/govinfo` (keyed config patterns).
  All four `ApiAuth` branches (incl. `TokenHeaderAuth`, `ApiKeyHeaderAuth`)
  already exist in `@beep/api-transport` — wire and exercise them; extend
  the union only if the P0-verified DOL mechanism requires a new shape.
- `gov-legal-mcp` remains a deferred follow-on goal (predecessor Q3), not
  this packet.
