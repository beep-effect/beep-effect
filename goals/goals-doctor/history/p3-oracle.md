# P3 Oracle — Doctor + yeet wiring

Date: 2026-07-11. Branch: `feat/goals-doctor`.

Oracle (from `PLAN.md`): `bun run beep goals doctor` exits 0 with committed
baseline; fixture test proves a synthetic new finding exits 1;
`bun run beep yeet verify` shows the new lanes green.

## Doctor exits 0 with the committed baseline

```text
[goals:doctor] packets=83 blocking_new=0 blocking_inherited=36 baseline_resolved=0 advisories=92
[goals:doctor] OK: no new blocking findings.
doctor_exit=0
```

Baseline (`goals/goals-doctor.baseline.jsonc`, 36 keys): 34 packets whose
README lacks a recognizable `Lifecycle:` line + 2 all-phases-complete-but-
active packets (beep-schema-topology, canvas). Runtime ~2.2s on 83 packets
(budget < 10s).

## Synthetic new finding exits 1

Live drift (goals-doctor manifest, lifecycle flipped to `paused`):

```text
[goals:doctor] NEW blocking findings (not in baseline):
- goals-doctor [lifecycle-mismatch] initiative.status "active" != lifecycle "paused".
error: script "beep" exited with code 1
drift_exit=1
clean_exit=0
```

Fixture tests (`test/goals-doctor.test.ts`): synthetic lifecycle-mismatch
exits 1 against an empty baseline, exits 0 when inherited, and the
`beep lint goal-packets` alias reproduces the ratchet; pure classification
tests cover introduced/inherited/resolved.

```text
 Test Files  3 passed (3)   (goals-doctor, goals-command, reflection-lint)
      Tests  26 passed (26)
```

## Reflection-gate integration (D7)

`ReflectionArtifact` now derives its completed set from the canonical
`GoalStatus` domain. Five pre-reflection-era packets newly entered the gate
(agent-effectiveness-loop, dedup-clone-engine, jsdoc-worker-eval,
nlp-adjunct-port, repo-quality-convergence); they carry an explicit
`reflectionRequired: false` opt-out, surfaced as non-fatal warnings — an
absent field still gates (exception recorded in `SPEC.md`'s ledger with a
removal condition).

```text
[reflection] blocking_findings=0
[reflection] advisory_findings=5
reflection_exit=0
```

## yeet verify lanes

`bun run beep yeet verify` (2026-07-11, run feat_goals-doctor-c5f14a08435c)
passed end-to-end with the new lanes green inside the root lint policy group:

```text
[beep-cli] goals:doctor: done in 2016.158358ms
[beep-cli] goals:index-check: done in 1886.226992ms
[goals:doctor] packets=83 blocking_new=0 blocking_inherited=36 baseline_resolved=0 advisories=92
verify_exit=0
outcome: success
failed lanes: NONE
```

Earlier verify rounds surfaced and burned down four integration failures —
verify-plan test expectations (21/22 policy steps), the stricter
check:tsgo:tests profile (async test callbacks, exact optional types),
effect-law compliance (terse-effect flow forms, native-runtime HashSet/
P.isString/R.has, schema-first S.Class contract), and the dual-arity
inventory entry for the reshaped classify helper.
