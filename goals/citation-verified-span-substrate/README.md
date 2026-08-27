# Citation Verified Span Substrate

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver the generic matter-scoped verified-span substrate: deterministic
locator normalization recovers canonical raw offsets, and only an exact raw
source slice may become a verified `TextAnchor`.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/citation-verified-span-substrate/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited implementation provenance.
6. [`history/`](./history/) - evidence and closeouts, when present.
7. [`citation-grounding-hallucination-guard`](../../explorations/citation-grounding-hallucination-guard/README.md) - source exploration.

## Current Phase

P2 Verify: implementation and the owned acceptance matrix are green. The new
append-only history retains raw candidates, source and engine versions, typed
negative outcomes, drift failures, and exact re-anchor receipts across
persistence restart. The packet remains active until the exact-head Yeet proof
and hosted merge-ready gate pass.

## Coordinated Consumer

The same implementation PR coordinates a full-source consumer outside this
packet's owned packages: the file-processing source-text resolver and its
workspace-local provider page the exact extracted source by
`SourceTextIdentity`. Provenance remains a pure identity/anchor model, while
langextract receives the reconstructed full raw text and never owns file or
workspace access.

## Latest Evidence

[`history/p0/2026-07-29-hostile-text-contract.md`](./history/p0/2026-07-29-hostile-text-contract.md)
records the pre-contract executable spike, its initially caught ligature
offset mistake, the final 9/9 pass, and the conversion contract now binding P1.

[`history/p1/2026-07-29-provenance-langextract-substrate.md`](./history/p1/2026-07-29-provenance-langextract-substrate.md)
records green package audits and docgen for the provenance identity/verified
anchor/receipt split and langextract strict raw-mapping slice. P1 remains
the foundation for the completed history work; the coordinated
resolver/consumer is complete.

[`history/p2/2026-08-27-persistence-reanchor-proof.md`](./history/p2/2026-08-27-persistence-reanchor-proof.md)
records the 18 provenance tests, 77 langextract tests, persistence restart,
negative attempt, source-drift, re-anchor, schema-law, docgen, and Yeet repair
proof. Full verify and hosted closeout remain.

## Notes

The legal extraction engine and law-practice guard remain queued. This packet
contains no legal citation vocabulary and does not wait on court vocabulary.
