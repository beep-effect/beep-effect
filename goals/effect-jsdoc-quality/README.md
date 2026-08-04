# Effect-level JSDoc Quality

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make `@beep/*` IDE hovers teach like Effect v4's by porting Effect's
machine-checked JSDoc section grammar into repo law + kind-aware inventory
rules — while keeping the example compile validation Effect v4 lost — proven
on a three-package pilot and ratcheted for new/touched code only.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/effect-jsdoc-quality/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - carried provenance ledger.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Complete (2026-08-02). All phases P0-P4 executed on
`chore/effect-jsdoc-quality`; see phase reports under
[`research/`](./research/) and hover evidence under
[`history/outputs/`](./history/outputs/).

## Latest Evidence

- P0 baseline verification: [`research/P0-baseline-check.md`](./research/P0-baseline-check.md)
  (8/10 packet facts verified, 2 drift corrections recorded).
- P1 law + skill + hygiene: [`research/P1-summary.md`](./research/P1-summary.md).
- P2 inventory rules, cleanup-on-touch ratchet, docgen section fixture,
  baseline fold: [`research/P2-summary.md`](./research/P2-summary.md).
- P3 pilot trio conversion (47 exports), 127-tag carrier migration, kind-aware
  presence rule with zero baseline: [`research/P3-summary.md`](./research/P3-summary.md).
- Hover fidelity: before/after WebStorm screenshots for `SemanticVersion`,
  `encodeEffect`, `extractFencedCodeBlocks`, and `ApplicationNumber` in
  [`history/outputs/`](./history/outputs/), captured from an isolated
  WebStorm instance.
- Closeout reflection:
  [`history/reflections/2026-08-02-claude.md`](./history/reflections/2026-08-02-claude.md).

Provenance: graduated 2026-07-30 from
[`explorations/effect-jsdoc-quality/`](../../explorations/effect-jsdoc-quality/README.md)
(twelve grilled decisions in its
[`DECISIONS.md`](../../explorations/effect-jsdoc-quality/DECISIONS.md);
WebStorm hover-fidelity lab settled the example-carrier choice).

## Notes

- Implementation must NOT re-mine Effect — the grammar is cited to path:line
  in the exploration's `research/` legs and summarized normatively in SPEC.
- Planning/implementation separation is deliberate: this packet landed with
  zero implementation; all code changes belong to this goal's execution PRs.
