# Academia wave-2 findings — claim-role verification

> Routed 2026-08-17 from `explorations/academia-corpus-mining` wave-2 synthesis
> (`synthesis/wave2-synthesis.md` in the machine-local academia-2026-07 research corpus; paper IDs below are
> `id`-keyed into that corpus's `text/`, `meta/`, and `notes/` directories,
> now also carrying DOIs/OA PDFs where recoverable via `resolved-index.jsonl`).
> Routing ratified by the operator 2026-08-17; proposals never auto-enter packets.

## Claim-role verification after exact copying (high)

Add claim-role verification after exact copying: subject, predicate, object,
qualifiers, polarity, and stance. Copied or graph-conditioned tokens can
still express the wrong proposition — span equality is necessary but not
sufficient for propositional fidelity. Shared with
`explorations/citation-grounding-hallucination-guard`. Evidence:
`7720720de5a3`, `e5d3ce19203a`, `93fa16c83e11`.
