# Effect-level JSDoc Quality

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

Graduated 2026-07-30 → [`goals/effect-jsdoc-quality/`](../../goals/effect-jsdoc-quality/README.md)

## Spark

Effect v4's IDE hovers teach — structured **When to use** / **Details** / titled
**Example** sections, described `@see` cross-links, output-annotated examples —
while beep-effect's JSDoc is mechanically complete (100%-clean inventory,
~18k documented exports) yet pedagogically thin. Close the gap so `@beep/*`
hovers read like Effect's.

## Next Open Question

None — graduated. Execution continues in
[`goals/effect-jsdoc-quality/`](../../goals/effect-jsdoc-quality/README.md)
(launch via its `GOAL.md`); this packet is the research/decision record.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-30: `/grill-with-docs` session with the human closed all twelve
  decisions (approach B; carrier B2 transitional; @remarks retired;
  shape-checked opt-in enforcement; kind-split example law; pilot trio;
  0.0.0 @since; namespace imports; described-@see day-one; hygiene rides the
  law PR; no architecture ADR; decisions-before-implementation). Hover-lab
  eyeball supplied the decisive carrier evidence. BRIEF finalized, MAP
  decomposed, packet graduated to `goals/effect-jsdoc-quality/` in the same
  PR — implementation deliberately NOT started.
- 2026-07-30: research artifacts landed (pipeline map, diff, rubric, options
  A-D with Option B lead, RESEARCH synthesis, SOURCES ledger); BRIEF drafted
  early as grill input; DECISIONS pending grill; hover-fidelity lab written
  to `scratchpad/jsdoc-hover-lab.ts` awaiting the user's WebStorm eyeball.
- 2026-07-30: packet opened at research stage. Effect v4 mining banked: the
  quality is a machine-enforced grammar (`@effect/jsdocs`), `@example` is
  forbidden upstream, and v4 lost example typechecking (which `@beep/docgen`
  still has). Gap-fill workflow + artifact authoring in progress.
