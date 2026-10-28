# Epistemics Foundation Extraction

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Move tenant-free epistemic vocabulary into foundation/modeling @beep/epistemics so party and other slices build claims on it

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/epistemics-foundation-extraction/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current phase

P0-P3 extraction work shipped in #2017 (`ab6000add2`); #2019 and #2021
fixed its Docgen, Lint Policy and JSDoc failures. The implementation repair shipped in #2315 (`559dcb6d2e`). P4 closeout verification
continues in documentation-only PR #2325. Achievement requires
verified readiness and merge evidence.

The 2026-10-28 acceptance audit found the claim factory lacked the logical-key
function required by `SPEC.md`. The closeout change supplies it, rejects
inconsistent keys, and includes a private-workspace migration note. Both required package audits
and documentation checks pass on the revised implementation.

## Latest evidence

- Historical implementation PR [#2017](https://github.com/beep-effect/beep-effect/pull/2017)
  merged as `ab6000add2e779508f5b76e6c774a872cf3e629a`, accepted head
  `62fdeb3680c711f6218655ae8ef8d35f6b0ae71d`.
- Fresh completion refresh with the original readiness job returned `unsatisfied`.
  Required `Heavy / Docgen` was red before the merge; the merge-time rule suite
  `4656800042` records failed required status checks. The declared Yeet verdict
  is absent. Later remediation cannot prove readiness before that merge.
- Fresh local audits: `quality package-verify @beep/epistemics` and
  `quality package-verify @beep/epistemic-domain` pass, including tests and docgen.
- Detailed audit: [`research/2026-10-28-acceptance-audit.md`](research/2026-10-28-acceptance-audit.md).
- Reflections: the original `history/reflections/2026-10-22-claude.md` and the
  recovery reflection `history/reflections/2026-10-28-codex.md`.
- PR [#2315](https://github.com/beep-effect/beep-effect/pull/2315) passed all 15 required hosted contexts before merge. Its interrupted monitor did not retain a readiness verdict; completion refresh therefore returned `unknown`. See [`history/2026-10-28-hosted-acceptance.md`](history/2026-10-28-hosted-acceptance.md).
- Final closeout PR [#2325](https://github.com/beep-effect/beep-effect/pull/2325) must supply passing accepted-head hosted checks and a
  retained Yeet readiness verdict. Until completion refresh verifies that merge,
  `initiative.status` stays `active`; a proposal is not achievement.

## Local proof disposition

Both required package audits and docgen checks pass; the foundation has 39 passing
tests. Local lint and changed-file formatting pass. The publication preflight and
scoped policy replay each exceeded ten minutes and were cancelled. Under the
constrained-compute rule, the final-check receipt names skips for `cheap-gates`,
`lint-policy`, `repo-sanity`, `check`, `docgen`, `fallow` and `coverage`.
The PR body records each skip; exact-head hosted CI must prove these gates before
strict merge. A receipt containing skips does not claim those local gates ran.

## Evidence retention

At merge readiness, copy the tool-produced final lane verdict to
`.beep/goals/epistemics-foundation-extraction/readiness-verdict.json`. Retain
that file, the final lane's `status.json`,
and readiness job records in the owning clone before retiring the lane. Bind
the manifest to that run and the final closeout PR before its last push.
Do not overwrite #2017's historical failure with inferred readiness.
