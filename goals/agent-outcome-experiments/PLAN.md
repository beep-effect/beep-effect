# Useful agent outcomes and Phoenix experiments — plan

Execution: **paused, authored but not started**. All phase work is pending.

| Phase | Status | Work | Exit evidence |
| --- | --- | --- | --- |
| P0 Research | pending | Refresh audit, dependencies and exact source; reproduce assigned failure mechanics | Bounded plan and synthetic regression receipts |
| P1 Implement | pending | Implement the smallest legal changes in SPEC, reuse existing components | Acceptance implementation and rollback ready |
| P2 Verify | pending | Fixture, integration, privacy, interpretation and route proof | Required checks and explicit residual limitations |
| P3 Yeet: PR to mergeable | pending | Publish through current Yeet policy, answer reviews, hosted readiness and merge gate | Current exact-head delivery evidence |
| P4 Close | pending | Reflection, source/goal status and operational handoff | Merged delivery and accepted closeout; then completed-retained |

## First actions on explicit launch

1. Read SPEC, source exploration and independent reviews; inspect working-tree state and preserve other work.
2. Verify dependency proof: agent-observability-foundation, harness-telemetry-enrollment. Establish owned routes and scope before touching services.
3. Turn unexecuted candidate reproductions into meaningful tests before repair.
4. Run Typed rubric/evaluator fixture tests; Phoenix version-specific API tests in disposable backend; curated-example privacy review; five-example pilot report; paired experiment manifest/results; user-facing interpretation review and touched-package quality checks.
5. Refresh evidence after every source/config change; do not repeat broad suites without a reason.

## P4 closeout

Use the repo reflection workflow/template. Keep operative lifecycle until exact-head merge evidence exists, then use the canonical goal status writer. Record runtime rollout separately from source merge. No new raw transcripts or credentials in evidence.
