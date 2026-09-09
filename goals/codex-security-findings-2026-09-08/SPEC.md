# Codex Security Findings (2026-09-08) Spec

## Objective

Remediate every open Codex Cloud security finding visible at
`https://chatgpt.com/codex/cloud/security/findings/` for
`kriegcloud/beep-effect` in the 11-finding batch captured on 2026-09-08. Publish
the work through Yeet, reach mergeable hosted state, merge, then resolve the
exact captured findings until no packet-applicable finding remains open.

## Non-Goals

- No accepted-risk or `Won't fix` disposition.
- No raw report bodies, signed artifact URLs, auth headers, cookie values,
  email addresses, secret material, or developer-local absolute paths in tracked
  files.
- No Codex Create PR or patch-apply actions.
- No unrelated refactors, dependency churn, or broad formatting.
- No weakening of quality, security, CI, or review gates.

## Source Hierarchy

1. The user objective that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture and package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, `findings/`, and `history/` files.

## Target Surfaces

- `goals/codex-security-findings-2026-09-08/**`.
- Gitignored raw evidence under `goals/codex-security-findings-2026-09-08/raw/**`.
- Maintained repo paths named by `findings/INDEX.md` after current-HEAD validation.

## Constraints

- Default disposition is `remediate`. `already-fixed` or `false-positive`
  requires strict current-HEAD proof recorded in the finding and triage ledger.
- Minimal root-cause fixes plus one focused regression check per executable-code
  finding. Reuse canonical path-safety, schema, and bounds helpers after live
  source/barrel discovery.
- Schema-first and Effect-first laws govern all production changes.
- Security controls may not be simplified away for diff size.
- Full reports stay in ignored `raw/`; tracked records contain only sanitized
  metadata, summaries, validation, decisions, changed files, and proof.
- Browser closure happens after merge, against the exact 11-ID allowlist.
- Preserve unrelated work and stage only reviewed packet intent.

## Acceptance Criteria

- [x] All 11 findings have sanitized tracked CSF records with Codex ID, severity,
      title, source commit, and public summary.
- [x] Every finding has a current-HEAD verdict, disposition, lane, rationale,
      remediation state, changed-file set, and verification evidence.
- [x] Every real finding is fixed at the shared root cause with a focused
      regression check where executable behavior changes.
- [x] Packet counts, manifest, triage ledger, launcher size, sanitation, and
      whitespace checks pass.
- [ ] Yeet repair and verify are green on the complete remediation scope.
- [ ] The branch is published, hosted checks and reviews are closed, and the PR
      is mergeable and merged.
- [ ] All 11 captured Codex findings are resolved after merge and the live view
      shows zero packet-applicable open findings.

These boxes record pre-merge evidence. Final local and hosted proof, the merge,
and the exact-ID closure receipt are recorded on PR #1026. The retained lifecycle
is proposed in that same PR and becomes effective on merge.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/codex-security-findings-2026-09-08/GOAL.md)" -le 4000` | Pass |
| JSON shape | `jq .` over both files in `ops/` | Pass |
| Finding count | CSF file count equals 11 | Pass |
| Severity count | 3 Low, 8 Informational | Pass |
| Raw ignored | `git status --short -- .../raw` | Only `.gitignore` tracked |
| Sanitization | tracked packet secret/path pattern scan | No matches |
| Per-finding proof | command recorded in finding and triage ledger | Pass |
| Repo proof | `bun run beep yeet verify` | Green |
| Hosted proof | Yeet monitor and review closeout | Green and mergeable |
| Final closure | signed-in Chrome findings view | Zero packet-open |

## Execution boundaries

- The signed-in CSV export cannot be produced from the findings page.
- Tracked evidence contains a secret, signed URL, auth value, email address, or
  raw local path.
- A proposed security control would rely on a platform-specific fail-open path.

The operator authorized all work necessary to resolve current findings in one
PR. Resolve implementation and environment issues within that intent; stale
archived-packet scope and approval gates do not constrain this batch. Refresh
the current findings before publication and include any additions in this PR.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
