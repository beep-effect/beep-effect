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

P1 Implement: the hostile-text gate and the coordinated full-source consumer
are green. The public contracts now preserve the locked UTF-16,
locator-to-raw, ambiguity, straddle, stale-source, and live re-verification
behavior. The packet remains active for its broader re-anchor history and
negative-attempt persistence contract.

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
active for the packet-owned re-anchor history and negative-attempt persistence
work; the coordinated resolver/consumer is complete.

## Notes

The legal extraction engine and law-practice guard remain queued. This packet
contains no legal citation vocabulary and does not wait on court vocabulary.
