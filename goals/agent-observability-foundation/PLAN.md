# Trustworthy agent observability foundation — plan

Execution: **active**, explicitly launched 2026-10-27. Preserve the recovery hold throughout implementation and verification.

| Phase | Status | Work | Exit evidence |
| --- | --- | --- | --- |
| P0 Research | complete | Refresh audit, dependencies and exact source; reproduce assigned failure mechanics | Bounded plan and synthetic regression receipts |
| P1 Implement | complete | Implement the smallest legal changes in SPEC, reuse existing components | Acceptance implementation and rollback ready |
| P2 Verify | in-progress | Fixture, integration, privacy, interpretation and route proof | Required checks and explicit residual limitations |
| P3 Yeet: PR to mergeable | in-progress | Publish through current Yeet policy, answer reviews, hosted readiness and merge gate | Current exact-head delivery evidence |
| P4 Close | in-progress | Reflection, source/goal status and operational handoff | Merged delivery and accepted closeout; then completed-retained |

## First actions on explicit launch

1. Read SPEC, source exploration and independent reviews; inspect working-tree state and preserve other work.
2. Verify dependency proof: none. Establish owned routes and scope before touching services.
3. Turn unexecuted candidate reproductions into meaningful tests before repair.
4. Run Synthetic source/identity tests; fixed-clock actual-encoder fixture; receiver/journal/partial-ack crash tests; disposable collector/Phoenix read-back; Ansible render and backup/retention mocks; touched-package quality verification. No production disruption as a test.
5. Refresh evidence after every source/config change; do not repeat broad suites without a reason.

## P4 closeout

PR2364 and PR2508 retain unsatisfied historical completion receipts. PR2578
retains canonical **unknown** after external merge without positive readiness.
Preserve those results as supporting delivery. PR2595 has separate post-merge
source qualification; its observer did not establish pre-merge readiness.

The operator reserved final PR2612 for this chat and directed other merge
activity for it to stop. Ship current source applicability, the new reflection
and a coherent prospective declaration while lifecycle remains active. Publish
a reviewable draft; only this owner may make it ready and merge it. A draft
monitor's `ready-pending-flip` result does not replace final readiness.

Require all non-Vercel checks to pass, resolved review threads and the normal
review window. Attribute Vercel failures only with actual build-rate-limit
evidence. Archive terminal readiness and a positive exact-head canonical Yeet
verdict **before** strict merge; no S11, admin or forced-window exception.

After qualified merge, run `bun run beep goals completion refresh --slug
agent-observability-foundation` from the clone retaining that verdict. Inspect
an actually verified accepted-head result and complete merge-time required-check
inventory before completion. Later observations cannot establish missing
historical readiness. Preserve historical originals, the recovery hold and
unrelated work. Source delivery remains separate from production enrollment.
