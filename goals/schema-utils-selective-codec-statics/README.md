# Selective Schema Codec Statics

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Replace broad `SchemaUtils` codec-static bundles with safe, selected, hoisted
statics and migrate all existing usages to the minimal required set.

## Current State

P0 alignment and migration census are in progress. Implementation is blocked
until the `/grilling` decision frontier is empty and the operator confirms
shared understanding.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/schema-utils-selective-codec-statics/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`DECISIONS.md`](./DECISIONS.md) - `/grilling` answers, rationale, and
   rejected options.
4. [`PLAN.md`](./PLAN.md) - active execution plan.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing and
   remaining decision frontier.
6. [`research/SOURCES.md`](./research/SOURCES.md) - source and evidence ledger.
7. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction
   receipts captured during the goal.
8. [`history/`](./history/) - verification and closeout evidence.

## Next Action

Answer the current questions in `DECISIONS.md`. After each round, append the
settled answers and replace `openQuestions` in the manifest with the newly
unblocked frontier.

## Latest Evidence

- The repository goal bootstrap planner accepted this slug, title, mission,
  and date with no conflicts on 2026-08-30.
- The initial design review is preserved in
  `scratchpad/schema-utils-codec-statics-design.md` and distilled into
  `SPEC.md`.
- A live source census is being recorded before migration quantities become
  acceptance baselines.
