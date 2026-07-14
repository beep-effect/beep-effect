# Codex Security Findings (2026-07-14) Plan

## Status

Status: `active` - branch `security/codex-findings-2026-07-14`. Current phase:
`P5 remediate complete`; entering P6 yeet-to-mergeable.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Create branch and packet scaffold. | Branch from fresh `origin/main`; manifest, triage, raw ignore, and launcher valid. |
| P1 capture | complete | Capture the 9 open Codex findings via codex Chrome. | Raw markdown in ignored `raw/`; sanitized CSF files and index reconcile (9). |
| P2 validate | complete | Confirm each finding reproduces at HEAD. | Every finding has a strict-proof `remediate` disposition, verdict, rationale, owner area. |
| P3 close-invalids | complete | (No invalid/out-of-scope findings in this batch.) | Nothing to close. |
| P4 lane-partition | complete | Partition findings into disjoint fix lanes. | RL-001..RL-004 recorded; global `bun.lock` owned by Fable. |
| P5 remediate | complete | Fix all 9 findings via codex lanes + Fable lockfile. | Changed files + targeted verification recorded; one regression test per code finding; all targeted tests pass. |
| P6 yeet-to-mergeable | pending | Drive one PR to mergeability through Yeet. | Yeet proof, hosted checks, review closeout green; PR mergeable. |
| P7 merge | pending | Merge the PR with repo default merge behavior. | PR merged to main. |
| P8 close-remediated | pending | Resolve all 9 Codex findings after merge. | Each of the 9 Codex IDs resolved (scanner auto-close accepted); no non-packet finding touched. |
| P9 local-closeout | pending | Reconcile local evidence and final report. | Closeout records the 9 IDs, zero-applicable-open result, and any browser blocker. |

## Execution Notes

- Browser capture and closure route through codex's Chrome extension (delegated
  via a `codex:codex-rescue` agent, model `gpt-5.6-sol`, medium reasoning), not
  Claude `claude-in-chrome`.
- Remediation runs one codex `gpt-5.6-sol`/medium agent per lane on disjoint
  paths; each returns changed files + verification. Fable integrates, owns all
  shared ledgers, and runs the `bun.lock` dedupe last to avoid conflicts.
- Use live source/barrel search and repo doctrine before creating any helper.
- Preserve unrelated worktree changes and stage only reviewed intent.
- Minimal scoped fixes matching each Codex suggested remediation; one regression
  test per code finding (CSF-001/003/004/005/006).

## Verification Commands

```sh
test "$(wc -m < goals/codex-security-findings-2026-07-14/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-07-14/ops/manifest.json
jq . goals/codex-security-findings-2026-07-14/ops/triage.json
test "$(ls goals/codex-security-findings-2026-07-14/findings/CSF-*.md 2>/dev/null | wc -l | tr -d ' ')" = "$(jq -r '.catalog.capturedCount' goals/codex-security-findings-2026-07-14/ops/manifest.json)"
rg -n 'BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY|X-Amz-Signature=|[?&](sig|token|access_token|api_key|apikey)=[A-Za-z0-9._-]{12,}|Authorization: (Bearer|Basic) [A-Za-z0-9._+/=-]{12,}|Cookie: [^ ]+=[^ ]{8,}|eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}|/home/[a-z][a-z0-9_-]+/|/Users/[A-Za-z0-9_-]+/' goals/codex-security-findings-2026-07-14 --glob '!**/raw/**' --glob '!**/PLAN.md' --glob '!**/ops/manifest.json' && exit 1 || exit 0
! rg -n 'grafana|mcp/grafana|network=host' .mcp.json .codex/config.toml .claude/settings.json
! rg -n 'next@16.3.0-canary.82' bun.lock
git status --short -- goals/codex-security-findings-2026-07-14/raw
git diff --check -- goals/codex-security-findings-2026-07-14
```
