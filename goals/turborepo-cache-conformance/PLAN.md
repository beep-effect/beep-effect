# Turborepo cache conformance plan

## Status

Status: `pending`
Lifecycle: `paused`

Authored but not started. An explicit launch begins P0 and uses
`bun run beep goals set-status turborepo-cache-conformance active`.
The user approved the program scope on 2026-09-08; no repeated shape approval
is needed.

## Phases

| Phase | Status | Work | Exit criteria |
| --- | --- | --- | --- |
| P0 Pins, corpus and budget plan | pending | Refresh exact releases/licenses, inventory the source contract, agree receipt interfaces and derive the lab deployment plan. | Immutable pins and case mapping; numeric cost/TTL/load bounds precede any deployment. |
| P1 Local differential runner | pending | Generate baseline cases and add semantic/adversarial fixtures behind Cache. | Spec/stable/canary verdicts remain separate; direct receipts expose fail-soft behavior. |
| P2 Disposable AWS lab | pending | Review the bounded deployment preview and provision isolated comparison topologies through repo infra. | Scoped lab is healthy, expiring, budgeted, and has a reproducible teardown. |
| P3 Execute and compare | pending | Run identical cases/load across incumbent, evolved incumbent, Bruno and Ducktors; consume trust fixes and rerun. | Every case is attributed; frozen rubric yields a recommendation or a substantiated no-eligible result. |
| P4 Verify and tear down | pending | Prove upgrade regeneration, fault reproducibility, artifact retention and lab teardown; hand off signed-boundary receipts. | Package/protocol checks pass, deletion targets are verified, cost and cleanup receipts exist. |
| P5 Yeet: PR to mergeable | pending | Publish through Yeet and resolve hosted failures and reviews. | Yeet monitor reports merge-ready: yes on final head. |
| P6 Close | pending | Land comparison, reflection and lifecycle with final implementation work. | Reproducible evidence and same-PR closeout. |

## First action

Refresh exact source/client/backend pins and compile the existing 32-case corpus plan into an executable local fixture design.

## Dependency gates

Use qualification's early tuple/policy interface and trust's result/producer
receipt contract. Run baseline fixtures before trust remediation, then rerun
the same cases after it. Do not wait for production trust rollout to exercise
the disposable lab. Shared infra files have one writer per implementation
slice; sequence trust adapter changes and lab topology integration.

[SPEC.md](./SPEC.md) governs authority and the [program map](../../explorations/turborepo-quality-cache/MAP.md)
governs handoffs. A sibling's accepted milestone can unblock work before its
whole goal closes.

## Evidence to produce

pin manifest; generated/adversarial case manifest; deployment preview and
numeric budget; run receipts and comparison matrix; immutable topology
references; cost/expiry inventory; teardown proof and Yeet closeout.

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
   `bun run beep goals set-status turborepo-cache-conformance completed-retained` only once
   completion conditions hold, in the final implementation PR.
5. Regenerate/check the goal index and preserve exploration links. Completion
   of this goal alone does not establish the whole cache program's completion.

## Rollback and resume

Use SPEC's rollback at the affected boundary. Record the failed gate, remaining
work and safe resume action. Retain paused state with explicit conditions when
external evidence/authority is missing; do not label that pause complete.
