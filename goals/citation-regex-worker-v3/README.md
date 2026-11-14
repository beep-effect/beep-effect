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

B1 is locally verified and in review on `feat/citation-native-lane`. Owner ruling 3
resolves the admission/deadline stop: explicit lane reservation now runs at the
base acquisition points for regex, Diff and Xml. Both review race fixes remain.
[PR #3336](https://github.com/beep-effect/beep-effect/pull/3336) is open after the
owner merged A4 and main and published hosted round 1 repairs. The current local
review follow-through fixes record-local quarantine and synchronizes the overlap
proof, and adds the owner-requested bounded coverage tests. Six typed invariant
guards remain documented with measured rows. Owner publication remains separate.

## Latest Evidence

[Review follow-through and file-by-file evidence](history/evidence/2026-11-14-b1-native-lane.md#review-follow-through-after-owner-head-b749cd91e7e).

## Notes

The schemas and service contracts were designed and independently reviewed
before graduation: [`explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md).
Write no code that departs from it without a decision file.
