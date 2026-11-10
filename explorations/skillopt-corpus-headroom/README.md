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
measures the skill's effect. Its result decides which gate in
[`MAP.md`](./MAP.md) fires: corpus sizing on an effect, nothing further for law
skills on a null. A fired gate reopens this packet at `decompose`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`BRIEF.md`](./BRIEF.md) - the shaped pitch for the probe.
3. [`MAP.md`](./MAP.md) - the graduated goal and three gated follow-ups.
4. [`DECISIONS.md`](./DECISIONS.md) - the park, the unpark and the grilling log.
5. [`RESEARCH.md`](./RESEARCH.md) - the native eval harness and the in-repo bricks.
6. [`CAPTURE.md`](./CAPTURE.md) - the original evidence and the 2026-11-10 review.

## Trail

- 2026-11-10: operator review found the packet stale (trainer retired in
  PR #1898, deferred candidates tombstoned) and its diagnosis too coarse.
  Unparked, researched, grilled, shaped and graduated into
  `goals/skill-effect-probe`. Three follow-ups stay gated in the map.
- 2026-10-01: packet opened and parked from the harness-evidence-ledger close
  (PR #1362).
