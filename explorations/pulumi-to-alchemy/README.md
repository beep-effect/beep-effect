# Pulumi to Alchemy

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The TS7 exit (#1833) left `infra/` as the last place that still needs TypeScript 6: a literal `typescript ^6.0.3` pin for the ghaRunners SDK build and an exact-version patch that points `@pulumi/pulumi` at the `@typescript/typescript6` bridge. Replacing the Pulumi stacks with Alchemy (TypeScript-native infrastructure as code) would remove both and the Pulumi CLI dependency with them.

## Next Open Question

Grill session (align, reopened 2026-11-02): is the target "no TypeScript 6 in `infra/`" (finish the isolation by precompiling, option C) or "no Pulumi" (full or converging migration)? The eight-question frontier is in [`ops/manifest.json`](./ops/manifest.json) `openQuestions` and at the end of [`RESEARCH.md`](./RESEARCH.md) "2026-11-02 — Recommendation". Recommendation on the table: C now, Alchemy-first-for-new as policy (B), full migration (A) held behind named gates.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-11-02: reopened at research on the operator's request (dedicated investigation session), then advanced to align. Research refreshed against the Alchemy checkout at `450702936d` (beta.84 + 246) and `llms.txt`: six Pulumi programs inventoried, 40 resource kinds covered / 9 gaps / 1 partial, per-gap options, three options (full, hybrid, Pulumi-stays-precompiled) with state and rollback plans, recommendation C + B policy. No infra change, no deploy, no secrets. Next: grill session over the eight frontier questions.
- 2026-10-15: killed at align. The operator ruled out an Alchemy migration ("isolate it to infra"); Pulumi's TypeScript 6 need is being confined to `infra/` as a TS7 exit follow-up.
- 2026-10-15: research inventoried five Pulumi programs, pinned provider/TS6 obligations and Effect reuse bricks; fetched Alchemy beta.83 docs/source/licenses, mapped coverage gaps, and retained unanswered align questions. No deployment or publication performed.

- 2026-10-15: packet opened from the TS7 exit program after #1833 merged; capture filed; next is research.
