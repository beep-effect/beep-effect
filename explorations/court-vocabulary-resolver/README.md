# Court Vocabulary Resolver

## Status

Stage: `graduate`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The `@beep/courtlistener` driver is a bare stub and beep has only placeholder
single-literal court/jurisdiction vocabularies, yet every citation, venue, and
provenance feature needs a real controlled court taxonomy plus a resolver that
turns messy free-text court mentions into canonical IDs. courts-db (~2,809
courts with CourtListener IDs, regex name variants, and a span-gated resolver)
is the ready-made seed for that vocabulary + resolver vertical.

## Next Open Question

**Resolver gate:** execute `court-reporter-vocabulary`; scaffold
`court-string-resolver` only after the versioned artifact, stable-ID lifecycle,
and compatibility contract are proven. Fuzzy ranking and SKOS remain gated.

## Sources & provenance

[`research/SOURCES.md`](./research/SOURCES.md) — the provenance ledger tracing
every decision back to its mined gold nugget (upstream repo + `file:line`), the
upstream repo + license, the external research citation, and the in-repo
`@beep/*` capability it composes. Derived from the gold-intake cluster "Court /
jurisdiction controlled vocabulary" (14 nuggets).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-14: shape gate signed off as drafted; graduated
  [`goals/court-reporter-vocabulary`](../../goals/court-reporter-vocabulary/README.md)
  and triggered the ratified deferred
  [`goals/citation-extraction-engine`](../../goals/citation-extraction-engine/README.md)
  scaffold. Court-string resolution, fuzzy ranking, and SKOS remain queued.
- 2026-07-14: align gate closed with all seven questions ratified; post-align
  BRIEF.md and MAP.md drafted; advanced to shape for sign-off.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Court / jurisdiction controlled vocabulary' (14 nuggets).
