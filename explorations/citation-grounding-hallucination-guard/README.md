# Citation Grounding & Hallucination Guard

## Status

Stage: `graduate`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Legal/IP answers must never cite from memory: an eyecite-style citation parser
emits exact char spans, every citation must resolve to a real authority and
carry a verbatim-verified grounding span before it may be emitted, and that
ground-before-cite contract is the hallucination guard the legal runtime
hangs everything else on.

## Next Open Question

**Guard gate:** execute the verified-span and vocabulary prerequisites, then the
scaffolded citation engine. `citation-ground-before-cite` remains queued behind
all three contracts.

## Sources & provenance

[`research/SOURCES.md`](./research/SOURCES.md) — provenance ledger joining the 11
mined gold nuggets (with upstream repo + file:line + license) to the external
research citations and the in-repo `@beep/*` bricks this packet composes. Start
there to trace any decision back to its source. Derived from the gold-intake
cluster "Citation lookup + verbatim-span grounding (hallucination guard)".

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-25: received a corpus dispatch note
  ([`research/2026-07-25-academia-corpus-mining-note.md`](./research/2026-07-25-academia-corpus-mining-note.md))
  from the `academia-corpus-mining` align dispatch — shapes the
  anchor-to-stance-to-authority-to-admission follow-on and carries master
  align Q7 (where the qualifier-aware stance layer lives, and the minimum
  qualifiers before two claims may be compared).
- 2026-07-14: scaffolded
  [`goals/citation-extraction-engine`](../../goals/citation-extraction-engine/README.md)
  per the ratified campaign revisit; it is blocked by
  `citation-verified-span-substrate` and `court-reporter-vocabulary`. The guard
  remains queued.
- 2026-07-14: graduated the first program lane into
  [`goals/citation-verified-span-substrate`](../../goals/citation-verified-span-substrate/README.md)
  and product doctrine into
  [`docs/product/citation-grounding.md`](../../docs/product/citation-grounding.md);
  engine and guard scaffolds remain queued, with the engine revisited when
  `court-vocabulary-resolver` graduates later in this campaign.
- 2026-07-14: align closed — 8 decisions locked, including the port-not-adopt
  user override grounded in the existing law-practice citation taxonomy;
  BRIEF.md and MAP.md drafted for shape sign-off.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Citation lookup + verbatim-span grounding (hallucination guard)' (11 nuggets).
