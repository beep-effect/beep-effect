# Codex Security Findings (2026-08-24) Plan

## Status

Status: `completed-retained`. All 19 findings were validated. PR #783 contains
15 repo-side remediations, 13 dashboard IDs were closed as Already fixed on
2026-08-24, two IDs remain held for `runner-trust-boundary` P1 deployment
proof, and four IDs are transferred to that packet's admission and
workload-identity lanes.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Create feature branch and packet scaffold. | Branch and launcher exist; packet JSON parses. |
| P1 capture | complete | Capture all live findings via the signed-in CSV export. | 19 IDs reconcile: 5 High, 4 Medium, 5 Low, 5 Informational. |
| P2 validate | complete | Reproduce each report at current HEAD. | All 19 items have strict verdict, disposition, rationale, and owner surface. |
| P3 lane-partition | complete | Group shared root causes and disjoint paths. | All 19 items are assigned to 12 remediation lanes. |
| P4 remediate | complete | Fix or transfer all real findings with focused checks. | Fifteen repo-side fixes are recorded; four runner findings have a named receiving arc and required external proof. |
| P5 repo-proof | complete | Run packet validation and Yeet repair/verify. | Repository proof for the 15 remediations is retained with PR #783. |
| P6 publish | complete | Publish one intentional PR through Yeet. | PR #783 is the published remediation record. |
| P7 monitor | complete | Close hosted checks and actionable reviews. | PR #783 reached the terminal delivery state used for dashboard closure. |
| P8 merge-and-close | complete | Close or transfer every captured finding. | Thirteen IDs closed as Already fixed; two held and four transferred to `runner-trust-boundary` with exact proof requirements. |
| P9 close | complete | Record evidence, reflection, and lifecycle. | Packet is `completed-retained`; the closeout reflection validates. |

## Execution Rules

- Validate before repairing; classify failures as introduced, inherited,
  unrelated, or environment-only.
- Prefer one shared root-cause fix when multiple reports traverse the same code.
- Keep global files and ledgers serialized.
- Use focused tests first, then package checks, then Yeet.
- Never stage ignored raw evidence.

## Runner trust-boundary handoff

CSF-001, CSF-004, CSF-005, and CSF-006 remain confirmed and dispositioned
`remediate`. They are not accepted risk or dashboard closure. Complete repair
requires a trust boundary outside pull-request-editable workflow content and no
usable cloud identity during runner jobs. The runner-admission/workload-identity
goal is [`goals/runner-trust-boundary`](../runner-trust-boundary/README.md). It
owns these findings until organization-owned controls and external GitHub
runner-group plus AWS deployment proof verify the resulting boundary.

## Held deployment proof

The repository changes for CSF-003 and CSF-009 are complete, but the dashboard
IDs remain open. `runner-trust-boundary` P1 owns this proof:

1. Bake a fresh runner AMI with `bun run beep runners bake` and the production
   region, subnet, and security-group inputs. Retain the generated report and
   require its bake-complete marker.
2. Apply the report's `pulumiPinCommand`, deploy the controller change to the
   shadow fleet, and confirm that the new AMI is the configured runner image.
3. Run `goals/ci-fleet-endgame/ops/redteam-verify.sh <deployed-ref>`. Require
   exactly one PASS for Gates A, B, C, D, and `E_RUNNER_IMDS_HOOK`, then verify
   runner deregistration and EC2 teardown with operator AWS credentials.
4. Inspect the deployed worker's setup-action log. The baked fast path may be
   accepted only after the Bun binary and sealed-cache ownership, mode, and
   digest checks pass.

Local proof covers generated script content, Pulumi input content, YAML syntax,
and gate accounting. It does not prove AL2023 ownership after a real bake,
registration ordering during live boot, or deployed IMDS behavior.

On complete P1 proof, the receiving packet closes the two held exact IDs as
Already fixed and records the dashboard state. This packet needs no further
phase work.

## Packet Verification

```sh
test "$(wc -m < goals/codex-security-findings-2026-08-24/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-08-24/ops/manifest.json
jq . goals/codex-security-findings-2026-08-24/ops/triage.json
jq . goals/codex-security-findings-2026-08-24/ops/closures.json
test "$(find goals/codex-security-findings-2026-08-24/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = 19
git diff --check -- goals/codex-security-findings-2026-08-24
```
