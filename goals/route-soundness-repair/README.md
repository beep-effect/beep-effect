# Route Soundness Repair

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Close the routing and proof soundness holes the ten-minute-certainty audit found, each with a mutation fixture or
replay, so later narrowing levers are admitted on a sound base: goal-data consumers on the code route, knowledge
policy on docs-only PRs, the `@beep/glob` setup closure, the bare-coverage self-judge, versioned final-check
receipts, Node 22 local coverage, base-ref CI patterns and one relevance model.

Source exploration: [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md)
(MAP goal 2; provides `ci/route-soundness`, requires nothing).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/route-soundness-repair/GOAL.md
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

P1 Implement — slice 1 (ROUT-03 census, `fix(ci): keep goal ops scripts, fixtures and research inputs on the
code route`) published; P0 re-checked lever status at `origin/main` 5e09d90a6da. Slices 2 and 3 complete the first wave;
slice 4 opens when slice 1 merges.

## Latest Evidence

- `packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts`: the generated census of consumed goal paths
  is red on the pre-slice patterns (548 consumed entries docs-only) and green after; change-profile gives
  `docs_only=false` for the frozen profile fixture, a citation ops `.py` probe, a `.ts` ops script and the ciops
  gate-order handoff JSON.

## Notes

- First slice, startable now: ROUT-03 slice 1, `fix(ci): keep goal ops scripts, fixtures and research inputs on
  the code route` (S, widening only). It has a deadline: if it cannot land by 2026-11-16, the #2999 docs-only
  widening is rolled back in full (exploration D8).
- First wave, all startable now: ROUT-03 slice 1, COVE-02 and YEET-08 slice 1 (three PRs, the packet limit).
- Every lever is open at graduation (checked against `origin/main` c90929b1ff1). #3008 made bare local coverage
  plan from the merge base without judging against it, so COVE-02 now applies to every bare run.
- Order: ROUT-03 first; TEST-10 re-records the cache-qualification baseline and
  reseals the policy fingerprint in its own PR; PERIH-10 waits for
  heavy-pool-diet's PERIH-11 pin bumps; ROUT-07 waits for certainty-scorecard's ROUT-05 and must report before
  PERIH-04, YEET-02 or ROUT-01's residual land (#3030 landed its empty-leg skips first), or TURB-03 if a goal adopts
  it (D24). Every repair lands with a mutation fixture or replay.
- ROUT-02's host is the small docs-policy job D8 rules; the operator kept it on 2026-11-09 and the Repo Sanity
  hosting proposal is closed.
- Siblings that require `ci/route-soundness` before a narrowing lever lands: hosted-setup-tax and
  local-proof-under-ten. certainty-scorecard runs alongside and reports the runner-minutes these repairs add.
