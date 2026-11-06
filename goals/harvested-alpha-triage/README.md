# Harvested Alpha Triage

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Judge the harvest ledger with three separate provider sessions (Opus 5.5 high, Grok 4.7 xhigh, GPT-6.1 Sol medium) into row-keyed verdict JSONL, merge deterministically, and seed a new exploration packet `harvested-alpha-2026-11` at stage `shape` so its MAP graduates the still-open alpha into concrete goals.

Graduated from [`explorations/packet-archive-and-alpha-harvest`](../../explorations/packet-archive-and-alpha-harvest/README.md). Starts when `packet-archive-mechanics` P0 has committed the ledger; does not wait for the sweep.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/harvested-alpha-triage/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — not started.

## Latest Evidence

Not started.

## Notes

- Panel pins are an operator ruling (exploration `DECISIONS.md`, 2026-11-06 'panel pins'): Opus 5.5 `high` for this judging task only; record argv as a decision file.
- Reviewer separation: three sessions, none sees another's verdicts before the merge step.
