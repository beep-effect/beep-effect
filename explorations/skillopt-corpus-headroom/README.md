# SkillOpt Corpus Headroom

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The harness-evidence-ledger rerun showed that the SkillOpt corpus cannot
separate a better skill from noise at Opus 5.5. The 2026-11-10 review found a
question underneath that one: nobody had measured whether the skill changes
the model's output at all.

## Next Open Question

None open. [`goals/skill-effect-probe`](../../goals/skill-effect-probe/README.md)
returned Insensitive on 2026-11-13: the archived completion contract cannot
be reached without tools. [`goals/skill-lane-probe`](../../goals/skill-lane-probe/README.md)
now measures the skill on the corpus's continuous score. Its result decides
which gate in [`MAP.md`](./MAP.md) fires next: corpus sizing on an Effect,
nothing further for law skills on a Null. The activation probe is decomposed
after it reports a fired rate.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`BRIEF.md`](./BRIEF.md) - the shaped pitch for the first probe, and the lane-probe addendum.
3. [`MAP.md`](./MAP.md) - the two graduated goals and three gated follow-ups.
4. [`DECISIONS.md`](./DECISIONS.md) - the park, the unpark and the grilling log.
5. [`RESEARCH.md`](./RESEARCH.md) - the native eval harness and the in-repo bricks.
6. [`CAPTURE.md`](./CAPTURE.md) - the original evidence and the 2026-11-10 review.

## Trail

- 2026-11-13: `skill-effect-probe` closed Insensitive and fired the
  activation gate, reopening this packet at `decompose`. The operator chose
  the lane probe first; four design questions were settled and it graduated
  as `goals/skill-lane-probe`.
- 2026-11-10: operator review found the packet stale (trainer retired in
  PR #1898, deferred candidates tombstoned) and its diagnosis too coarse.
  Unparked, researched, grilled, shaped and graduated into
  `goals/skill-effect-probe`. Three follow-ups stay gated in the map.
- 2026-10-01: packet opened and parked from the harness-evidence-ledger close
  (PR #1362).
