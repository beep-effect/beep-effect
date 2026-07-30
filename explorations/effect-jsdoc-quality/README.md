# Effect-level JSDoc Quality

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Effect v4's IDE hovers teach — structured **When to use** / **Details** / titled
**Example** sections, described `@see` cross-links, output-annotated examples —
while beep-effect's JSDoc is mechanically complete (100%-clean inventory,
~18k documented exports) yet pedagogically thin. Close the gap so `@beep/*`
hovers read like Effect's.

## Next Open Question

Run `/grill-with-docs` with the human against `BRIEF.md` (drafted early as
interview input) + `research/options.md` (lead: Option B — grammar port with
compile validation preserved); record outcomes in `DECISIONS.md` and flip the
manifest stage. Before or during the grill: the 2-minute WebStorm hover
eyeball of `scratchpad/jsdoc-hover-lab.ts` (fills the pending rows of the
hover-fidelity matrix in `research/diff-effect-vs-beep.md` §10).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-30: research artifacts landed (pipeline map, diff, rubric, options
  A-D with Option B lead, RESEARCH synthesis, SOURCES ledger); BRIEF drafted
  early as grill input; DECISIONS pending grill; hover-fidelity lab written
  to `scratchpad/jsdoc-hover-lab.ts` awaiting the user's WebStorm eyeball.
  Stopped at the exploration's hard stop: no goal packet before
  `/grill-with-docs`.
- 2026-07-30: packet opened at research stage. Effect v4 mining banked: the
  quality is a machine-enforced grammar (`@effect/jsdocs`), `@example` is
  forbidden upstream, and v4 lost example typechecking (which `@beep/docgen`
  still has). Gap-fill workflow + artifact authoring in progress.
