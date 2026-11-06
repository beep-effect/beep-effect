# Party Slice

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Graduate the scratchpad party model into a domain-agnostic packages/party slice (domain, use-cases, server) on @beep/epistemics

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/party-slice/GOAL.md
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

P3 Yeet: PR to mergeable — complete (2026-11-03).
[PR #2658](https://github.com/beep-effect/beep-effect/pull/2658) merged the
implementation while its coverage comparison was red. The final delivery is
[PR #2676](https://github.com/beep-effect/beep-effect/pull/2676), which restores
the existing coverage floors with additional behavioral tests, migrates renamed
file identities, and retains the failed hosted evidence. The base-pinned local
comparison passes for party-domain and law-practice-domain. #2676's completion
receipt verified after the merge, and the closeout was adopted as a committed `closeout` by `goals set-status` in [#2703](https://github.com/beep-effect/beep-effect/pull/2703).

## Latest Evidence

- Coverage follow-up: [2026-11-03 remediation](history/2026-11-03-coverage-remediation.md).

- Competency migration: [2026-11-03 mapping](history/2026-11-03-competency-migration.md).
- Local verification: [2026-11-03 gates](history/2026-11-03-local-verification.md).
- Local continuation: `history/2026-11-02-completion-progress.md` (partial implementation, not completion evidence).
- Grill rulings: 2026-10-22, recorded in the `SPEC.md` Decision Log.
- Design evidence: `scratchpad/party/PARTY-DATA-MODEL.md`, and the `@beep/epistemics` envelope and factories (#2017).

## Notes

All corpus and workflow fixtures used for this implementation are synthetic.
Local results do not substitute for the required published-head readiness receipt.
