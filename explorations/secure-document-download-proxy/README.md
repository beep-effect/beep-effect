# Secure Document Download Proxy

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Serve authoritative File-Wrapper PDFs to the local-first desktop UI through
opaque, TTL-gated links so the LLM never receives raw bytes, identifiers stay
hidden, and the API key never leaves the server — combining an edge-gated
UUID-guarded resource route with an encrypted, auto-expiring opaque-link store.

## Next Open Question

None while graduated. The gated Box origin, viewer integration, and
additional-origin candidates remain MAP re-entry points; a fired gate reopens
this packet at `decompose`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Sources & provenance

[`research/SOURCES.md`](./research/SOURCES.md) — the provenance ledger tracing
every porting decision back to its gold nugget (upstream repo + `file:line`),
upstream license + port discipline, external research citation, and the
in-repo `@beep/*` brick it composes. Derived from the gold-intake cluster
"Secure document download proxy (opaque TTL-gated links)" (2 nuggets).

## Trail

- 2026-08-13: holding-pen convention ratified; the packet flipped to
  `graduated`. Its three gated MAP candidates remain re-entry points, and a
  fired gate reopens this packet at `decompose`.
- 2026-07-14: graduated `goals/secure-document-delivery`; exploration remains active for three gated candidates.
- 2026-07-14: align closed in one round — Q1-Q8 and fan-out ratified; brief and map drafted.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Secure document download proxy (opaque TTL-gated links)' (2 nuggets).
