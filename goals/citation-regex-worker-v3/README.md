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

B1 merged as #3336 (`fa8f0f0757`): one native lane per invocation and limits policy v2.
B2 is in review on [PR #3352](https://github.com/beep-effect/beep-effect/pull/3352): protocol v3
and `CitationRegexSession`, one regex child process per invocation, taking ten plain-text calls
from 291 regex children to 10. B3 (delete v2, rewrite spawn-count assertions, re-record shard
timings) follows once B2 merges.

## Latest Evidence

[B2 regex session evidence](history/evidence/2026-11-14-b2-regex-session.md), including five
independent review rounds and the full file-by-file run.

## Notes

The schemas and service contracts were designed and independently reviewed
before graduation: [`explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md).
Write no code that departs from it without a decision file.
