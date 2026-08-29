# Academia wave-2 findings — extraction/KG evaluation

> Routed 2026-08-17 from `explorations/academia-corpus-mining` wave-2 synthesis
> (`synthesis/wave2-synthesis.md` in the machine-local academia-2026-07 research corpus; paper IDs below are
> `id`-keyed into that corpus's `text/`, `meta/`, and `notes/` directories,
> now also carrying DOIs/OA PDFs where recoverable via `resolved-index.jsonl`).
> Routing ratified by the operator 2026-08-17; proposals never auto-enter packets.

## 1. Evaluation additions (high)

Add pooled adjudication, macro/micro reporting, relation-cardinality slices,
and incomplete-label handling to extraction/KG evaluation. This packet is the
closest acceptance surface for end-to-end candidate, relation, and evidence
evaluation. Evidence: `ba4f26059f9f`, `11b51701b7df`.

## 2. Structural-validation context recording (high)

Record graph degree, entity frequency, validator availability, and
unseen-entity status; require a non-graph fallback. Structural validation is
useful only in identifiable connectivity regimes. Shared with
`goals/hybrid-retrieval-fusion-core`. Evidence: `b7ab12db479a`, `c5b8b48f95ea`.

## 3. Schema-prompt benchmarking (low)

Benchmark schema prompts as one extraction configuration, with
full-supervision and model/version baselines. Few-shot improvements are real
in older generic tasks but are not universal, and are unproven on current
legal evidence. Evidence: `c5ab54e1b185`, `2bdd45ca5b17`.
