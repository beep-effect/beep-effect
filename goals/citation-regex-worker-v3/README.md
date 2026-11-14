# Citation Regex Worker V3

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Serve a request's regex jobs from one child process at a time in a per-invocation native lane, under a parent timer per job, keeping SIGKILL retirement and capacity release only on confirmed death.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/citation-regex-worker-v3/GOAL.md
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

All three slices are merged: B1 #3336 (one native lane per invocation, limits policy v2), B2
#3352 (protocol v3 and `CitationRegexSession`, one regex child process per invocation) and B3
#3355 (protocol v2 deleted, law-practice shard plan re-recorded). Ten plain-text calls start 10
regex child processes instead of 291, with 291 evaluations unchanged. The packet is closed; the
reflection is [history/reflections/2026-11-14-claude.md](history/reflections/2026-11-14-claude.md).

## Latest Evidence

[Replay acceptance](history/evidence/2026-11-14-replay-acceptance.md): the five serial replays
finish at 10% to 20% of their watchdog on hosted CI and on beep-worker, with identical asserted
results.

## Notes

The schemas and service contracts were designed and independently reviewed
before graduation: [`explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md).
Write no code that departs from it without a decision file.
