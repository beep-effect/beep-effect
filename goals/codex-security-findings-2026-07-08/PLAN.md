# Codex Security Findings (2026-07-08) Plan

## Status

Status: `active` - branch `security/codex-findings-2026-07-08`. Current phase:
`P6 yeet-to-mergeable`.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Create branch and packet scaffold. | Branch from fresh `origin/main`; manifest, triage, raw ignore, and launcher valid. |
| P1 capture | complete | Use Chrome to capture every open Codex finding. | Raw markdown stored in ignored `raw/`; sanitized CSF files and index reconcile. |
| P2 validate | complete | Validate findings with sub-agents in batches of six. | Every finding has strict-proof disposition, verdict, rationale, and owner area. |
| P3 close-invalids | complete | Main agent closes invalid findings in Chrome. | False-positive, out-of-scope, and already-fixed findings closed with correct reason. |
| P4 lane-partition | complete | Partition legitimate findings into non-overlapping fix lanes. | Lanes recorded; shared-helper candidates owned by main agent. |
| P5 remediate | complete | Fix all legitimate maintained-code findings. | Changed files and targeted verification recorded for each remediated finding. |
| P6 yeet-to-mergeable | active | Drive one PR to mergeability through Yeet. | Yeet verify/publish/monitor/closeout green; no unresolved actionable comments. |
| P7 merge | pending | Merge the PR with repo default merge behavior. | PR merged; merge commit/SHA recorded locally. |
| P8 close-remediated | pending | Close remediated Codex findings after merge. | All remediated findings closed as `Already fixed`; zero open findings visible. |
| P9 local-closeout | pending | Reconcile local evidence and final report. | Local raw closeout note records final zero-open evidence; tracked packet remains active. |

## Execution Notes

- Chrome writes are serial and owned by the main agent.
- Validation sub-agents return structured verdicts only; they do not edit shared
  packet ledgers or close Codex findings.
- Remediation workers may edit only assigned disjoint paths and must account for
  concurrent edits rather than reverting them.
- Use live source/barrel search and repo doctrine before creating any helper.
- Preserve unrelated worktree changes and stage only reviewed intent.
- Treat `.repos/**` as out-of-scope reference material and close those findings
  as false positives.

## Verification Commands

```sh
test "$(wc -m < goals/codex-security-findings-2026-07-08/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-07-08/ops/manifest.json
jq . goals/codex-security-findings-2026-07-08/ops/triage.json
test "$(ls goals/codex-security-findings-2026-07-08/findings/CSF-*.md 2>/dev/null | wc -l | tr -d ' ')" = "$(jq -r '.catalog.capturedCount' goals/codex-security-findings-2026-07-08/ops/manifest.json)"
rg -n 'BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY|X-Amz-Signature=|[?&](sig|token|access_token|api_key|apikey)=[A-Za-z0-9._-]{12,}|Authorization: (Bearer|Basic) [A-Za-z0-9._+/=-]{12,}|Cookie: [^ ]+=[^ ]{8,}|eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}' goals/codex-security-findings-2026-07-08 --glob '!**/raw/**' --glob '!**/PLAN.md' --glob '!**/ops/manifest.json' && exit 1 || exit 0
git status --short -- goals/codex-security-findings-2026-07-08/raw
git diff --check -- goals/codex-security-findings-2026-07-08
```
