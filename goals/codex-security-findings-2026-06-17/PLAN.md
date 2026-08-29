# Codex Security Findings (2026-06-17) Plan

## Status

Status: `active` - branch `security/6-17-2026`. Current phase: `P0 bootstrap` ->
`P1 extract`.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Scaffold packet on `security/6-17-2026`; gitignore cookie; supersede 2026-06 packet. | Manifest/index/triage stubs valid; jq passes; `*cookies*.txt` ignored. |
| P1 extract | active | Capture Report + Patch for all 71 findings into the private raw root. | 71 sanitized md + INDEX committed; `capturedCount==71`; sanitization clean. |
| P2 triage | pending | Assign disposition, verdict, lane per finding. | Every finding triaged; lanes partition all remediate findings; INDEX reconciles. |
| GATE 1 approval-gate | pending | Human approves disposition matrix + shared-helper proposals. | STOP until approved; `meta.gateApprovedAt` set. |
| P3 close-invalids | pending | Chrome pass 1: close non-remediated dispositions. | False-positive / won't-fix closed in Codex with reason + context. |
| P4 lane-partition | pending | Color the conflict graph; assign lanes; lock shared helpers. | `lanes` + `serializedChains` recorded; remediate findings assigned. |
| P5 remediate-by-lane | pending | Fix remediate findings by lane; serialize overlaps. | Each fix has targeted verify + `changedFiles` in `ops/triage.json`. |
| P6 yeet-to-mergeable | pending | `bun run beep yeet` to mergeable PR. | yeet green incl. security lanes; PR open + mergeable; review clean. |
| GATE 2 merge-gate | pending | Human approves before merge. | STOP until approved; PR merged. |
| P7 close-remediated | pending | Chrome pass 2: close remediated findings. | "Already fixed" set in Codex with PR evidence; all 71 closed. |
| P8 closeout | pending | Reconcile packet + write evidence + reflection. | All 71 closed; counts reconcile; closeout reflection written. |

## Execution Notes

- GATE 1 and GATE 2 are hard stops; do not start P3/P4/P5 before GATE 1, and do
  not merge before GATE 2.
- Chrome runs serially on the single authenticated session; yeet runs serially
  under the global `.beep/yeet/quality-lock`. Only triage (P2) and remediation
  (P5) fan out, capped at ~6-8 concurrent agents.
- Preserve unrelated worktree changes; stage only reviewed intent.
- Raw captures + the cookie file stay in a machine-local scratch directory outside the repo;
  commit only sanitized markdown + (post-fix) patches.

## Verification Commands

```sh
test "$(wc -m < goals/codex-security-findings-2026-06-17/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-06-17/ops/manifest.json
jq . goals/codex-security-findings-2026-06-17/ops/triage.json
rg -n 'BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY|X-Amz-Signature=|[?&](sig|token|access_token|api_key|apikey)=[A-Za-z0-9._-]{12,}|Authorization: (Bearer|Basic) [A-Za-z0-9._+/=-]{12,}|Cookie: [^ ]+=[^ ]{8,}|eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}' goals/codex-security-findings-2026-06-17/findings && exit 1 || true
git ls-files --error-unmatch openai.com_cookies.txt 2>/dev/null && echo LEAK && exit 1 || true
git diff --check -- goals/codex-security-findings-2026-06-17
```
