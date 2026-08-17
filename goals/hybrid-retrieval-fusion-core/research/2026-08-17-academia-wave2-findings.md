# Academia wave-2 findings — retrieval fusion

> Routed 2026-08-17 from `explorations/academia-corpus-mining` wave-2 synthesis
> (`synthesis/wave2-synthesis.md` in the machine-local academia-2026-07 research corpus; paper IDs below are
> `id`-keyed into that corpus's `text/`, `meta/`, and `notes/` directories,
> now also carrying DOIs/OA PDFs where recoverable via `resolved-index.jsonl`).
> Routing ratified by the operator 2026-08-17; proposals never auto-enter packets.

## Structural-validation context recording (high)

Record graph degree, entity frequency, validator availability, and
unseen-entity status on every candidate; require a non-graph fallback path.
Structural validation only helps in identifiable connectivity regimes — a
fusion core that assumes graph signal everywhere will mis-rank sparse-graph
entities. Shared with `goals/citation-extraction-engine`. Evidence:
`b7ab12db479a`, `c5b8b48f95ea`.
