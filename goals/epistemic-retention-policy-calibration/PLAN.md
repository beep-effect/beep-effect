# Retention Policy Calibration Plan

Status: `active` — explicitly launched. P0–P2 complete; P3 in progress; preparation is not execution proof.

| Phase | Status | Work | Exit criteria |
| --- | --- | --- | --- |
| P0 | complete | Reverify source, freeze G0/G1 protocol and evidence handling | Baseline pinned, access scoped, splits/labels/metrics/criteria fixed before tuning |
| P1 | complete | Implement native offline evaluation and candidate validation | Reusable harness, inert baseline, negative controls, no production wiring |
| P2 | complete | Run frozen protocol and independent replay/review | Complete G2 evidence with supported recommendation or insufficient-evidence verdict; authority/rebuild proof |
| P3 | in-progress | Deliver calibration through Yeet | Final-head hosted checks, review/window readiness and merged PR; no activation |
| P4 | in-progress | Reflect, verify completion and retire execution lane | Reflection/state synchronized, matching completion receipt, lane retired |

## Execution order

1. Inventory exact checkout/head/dirt and merged predecessor. Select an isolated
   execution lane before changing code. Read governing architecture and load
   skills required by touched surfaces. Record source drift; never copy a
   historical receipt as new-head proof.
2. Freeze ops/EVIDENCE.md's protocol and G0 access scope. Start with synthetic
   fixture controls if product data is unavailable. Product data requires its
   own explicit scoped authorization; keep raw data outside the public repo.
3. Discover existing schemas/report helpers before implementation. Resolve the
   offline analysis seam without changing the real CLI's inert registry. Freeze
   fixture/candidate IDs, digest encodings and output identity rules.
4. Build/run tuning and held-out evaluation, sensitivity and negative controls.
   Log every attempted candidate and exclusion. Re-tuning after held-out review
   invalidates that holdout for subsequent claims; version the next protocol.
5. Independently replay exact inputs/policy; destroy the complete owned output
   directory and rebuild at two coordinates, comparing bytes/answers and all
   authority rows. Run focused tests and package verification for touched code.
6. Assemble the G2 report and recommendation/insufficient-evidence verdict.
   Review against pre-registered criteria; list G3/G4 as absent unless genuine
   evidence exists. Do not request activation approval during preparation or
   fabricate approval to complete the goal.
7. Use Yeet for calibration delivery. Retain exact-head evidence and reflection
   in the final PR with proposedCloseout; keep lifecycle operative until the
   required hosted/readiness/review/window/merge gate and completion refresh
   succeed. Finish retirement from the execution lane through the repo workflow.

## Completion versus activation

P4 closes calibration, not production rollout. Activation is excluded even if
G3 approval is later recorded. A follow-on must bind the exact G2 bundle and
G3 approval, test G4 registry admission/revocation/rollback, and obtain specific
authorization for deployment. No schedule or standing monitor is requested.

## Packet checks

```sh
test "$(wc -m < goals/epistemic-retention-policy-calibration/GOAL.md)" -le 4000
jq . goals/epistemic-retention-policy-calibration/ops/manifest.json
rg -n "epistemic-retention-policy-calibration|GOAL.md|agentLaunchers|packetAnchorDocument" goals/epistemic-retention-policy-calibration
git diff --check -- goals/epistemic-retention-policy-calibration
bun run beep lint reflection-artifacts
```

Final delivery PR: #2357. The manifest declares prospective closeout; its active
state is intentional until the matching completion receipt verifies.
