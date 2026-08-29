# Codex Security Findings (2026-06) Plan

## Status

Status: `active` — branch `@slop/june-8-2026`. Current phase: `P1 extract`.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Scaffold packet on `@slop/june-8-2026`. | Manifest/index/triage stubs valid; jq passes. |
| P1 extract | active | Capture Report + Patch for all 52 findings. | 52 sanitized md + patches committed; `capturedCount==52`; sanitization clean. |
| P2 triage | pending | Assign disposition, verdict, lane per finding. | Every finding triaged; lanes partition all 52; INDEX summaries reconcile. |
| GATE approval-gate | pending | Human approves disposition matrix. | STOP until approved; `meta.gateApprovedAt` set. |
| P3 close-invalids | pending | Chrome pass 1: close non-remediated dispositions. | False-positive / already-fixed / accepted-risk closed in Codex. |
| P4 lane-partition | pending | Color the conflict graph; assign lanes. | `lanes` + `serializedChains` recorded; remediate findings assigned. |
| P5 remediate-by-lane | pending | Fix remediate findings by lane; serialize overlaps. | Each fix has targeted verify + `changedFiles` in `ops/triage.json`. |
| P6 yeet-to-mergeable | pending | `bun run beep yeet` to mergeable PR. | yeet green; PR open and mergeable; Greptile 5/5; 0 unresolved threads. |
| P7 close-remediated | pending | Chrome pass 2: close remediated findings. | "Already fixed" set in Codex with PR evidence; all 52 closed. |
| P8 closeout | pending | Reconcile packet + write evidence. | All 52 closed; counts reconcile; history note written. |

## Execution Notes

- GATE is a hard stop; do not start P3/P4/P5 before approval.
- Chrome runs serially on the single authenticated session; yeet runs serially
  under the global `.beep/yeet/quality-lock`. Only triage (P2) and remediation
  (P5) fan out, capped at 6 concurrent agents.
- Preserve unrelated worktree changes; stage only reviewed intent.
- Raw captures stay in a machine-local scratch directory outside the repo; commit only
  sanitized markdown + patches.

## Verification Commands

```sh
test "$(wc -m < goals/codex-security-findings-2026-06/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-06/ops/manifest.json
jq . goals/codex-security-findings-2026-06/ops/triage.json
rg -n 'BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY|X-Amz-Signature=|[?&](sig|token|access_token|api_key|apikey)=[A-Za-z0-9._-]{12,}|Authorization: (Bearer|Basic) [A-Za-z0-9._+/=-]{12,}|Cookie: [^ ]+=[^ ]{8,}|eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}' goals/codex-security-findings-2026-06/findings && exit 1 || true
git diff --check -- goals/codex-security-findings-2026-06
```
