# Turborepo quality cache adoption plan

## Status

Status: `pending`
Lifecycle: `paused`

Authored but not started. An explicit launch begins P0 and uses
`bun run beep goals set-status turborepo-quality-cache-adoption active`.
The user approved the program scope on 2026-09-08; no repeated shape approval
is needed.

## Phases

| Phase | Status | Work | Exit criteria |
| --- | --- | --- | --- |
| P0 Population, feature and value audit | pending | Refresh actual scripts/lanes/workflow definitions and relevant stable/canary features; consume lane-economics baseline. | Every population/feature has an owner and disposition; prioritized cohorts have explicit evidence gaps. |
| P1 Graph and pure boundaries | pending | Implement proof-backed task graph, input/output/env repairs and pure decomposition through qualification's contract. | Negative invalidation and output-ownership tests pass; no unreviewed enablement. |
| P2 Local and worktree adoption | pending | Qualify high-value cohorts and adopt local reuse inside proven profiles. | Fresh/replay/shadow equivalence and worktree portability evidence pass. |
| P3 Hosted cohorts and warming | pending | Consume production trust readiness; roll named hosted cohorts, archive transport fixes and demand-based warming. | Required jobs emit fresh statuses; resolved workflow identity, useful hits and bounded warm receipts are proven. |
| P4 Broader observation and final census | pending | Expand supported profiles, complete representative observation and reconcile every computation. | Eligible work is qualified/adopted, exclusions are justified, no unexplained or silently deferred entries remain. |
| P5 Yeet: PR to mergeable | pending | Publish through Yeet, verify exact-head hosted proof and resolve reviews. | Yeet monitor reports merge-ready: yes; no cache result substitutes for hosted acceptance. |
| P6 Close | pending | Land final value/disposition report, reflection and lifecycle in final implementation PR. | Whole-program acceptance and same-PR closeout evidence are complete. |

## First action

Refresh actual task/lane/workflow population and create the stable/canary feature and computation-disposition matrices using the existing owners' baselines.

## Dependency gates

P0 and feature/source inventory can start independently. P1 consumes the
qualification contract; broad promotion waits for its validated runner/pilot.
P3 requires passing protocol and current production trust readiness. Coordinate
cohort execution with trust's rollout rather than introducing a cycle between
whole-goal completion gates. Replacement cutover, if selected, stays in the
conditional migration goal; keep safe independent local improvements moving.

[SPEC.md](./SPEC.md) governs authority and the [program map](../../explorations/turborepo-quality-cache/MAP.md)
governs handoffs. A sibling's accepted milestone can unblock work before its
whole goal closes.

## Evidence to produce

full population and feature disposition matrices; per-cohort qualification
receipts; effective config/archive diffs; resolved workflow/required-status
receipts; baseline and before/after value; warming decisions; representative
observation, rollback and final Yeet proof.

Store compact receipts in research/history and large raw evidence in bounded
artifacts. Record source/tool/profile/epoch identity, command/case, result and
retention. Register new reports in the manifest. Record friction immediately
in [OPPORTUNITIES.md](./research/OPPORTUNITIES.md). Missing evidence is unfinished
work, not an implied pass.

## Verification and attribution

Apply the SPEC matrix to actual changes. Package editors run package-verify
before handoff. Attribute failures as introduced, inherited, unrelated or
environment-only before repair. Preserve dirty work and use canonical
admission/worktree workflows for heavy experiments.

## P6 closeout checklist

P6 preparation can occur during P5 so final reflection/lifecycle land with the
final implementation. Acceptance still requires final Yeet proof. Do not defer
closeout to an unrelated state-only PR.

1. Confirm every SPEC criterion and applicable representative observation.
2. Use the reflect skill and copied reflection template to record tooling
   friction, implementation opportunities and prompt critique.
3. Run `bun run beep lint reflection-artifacts`.
4. Update phase evidence and use
   `bun run beep goals set-status turborepo-quality-cache-adoption completed-retained` only once
   completion conditions hold, in the final implementation PR.
5. Regenerate/check the goal index and preserve exploration links. Completion
   of this goal alone does not establish the whole cache program's completion.

## Rollback and resume

Use SPEC's rollback at the affected boundary. Record the failed gate, remaining
work and safe resume action. Retain paused state with explicit conditions when
external evidence/authority is missing; do not label that pause complete.
