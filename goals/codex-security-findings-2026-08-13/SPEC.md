# Codex Security Findings (2026-08-13) Spec

## Objective

Remediate every open Codex Cloud security finding visible at
`https://chatgpt.com/codex/cloud/security/findings/` for
`kriegcloud/beep-effect` in the 19-finding batch captured on 2026-08-13. Publish
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

- `goals/codex-security-findings-2026-08-13/**`.
- Gitignored raw evidence under `goals/codex-security-findings-2026-08-13/raw/**`.
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
- Browser closure happens after merge, against the exact 19-ID allowlist.
- Preserve unrelated work and stage only reviewed packet intent.
- CSF-002, CSF-007, CSF-009, CSF-010, CSF-013, and CSF-014 are merged.
  Consolidate CSF-012, CSF-015, CSF-016, CSF-017, CSF-018, and CSF-019 into
  PR #712. The six runner findings remain held pending architecture and
  external proof.

## Known P4 Architecture Blocker

CSF-001, CSF-003, CSF-004, CSF-005, CSF-006, and CSF-008 require a runner trust
boundary enforced outside pull-request-editable workflow content and no usable
cloud identity during job execution. P2/P3 have landed, but these findings
remain `remediate` pending external GitHub organization runner-group and AWS deployment proof;
the packet does not reinterpret the stop condition as accepted risk or an
eligible closeout disposition.

## Acceptance Criteria

- [x] All 19 findings have sanitized tracked CSF records with Codex ID, severity,
      title, source commit, and public summary.
- [x] Every finding has a current-HEAD verdict, disposition, lane, rationale,
      remediation state, changed-file set, and verification evidence.
- [ ] Every real finding is fixed at the shared root cause with a focused
      regression check where executable behavior changes.
- [ ] Packet counts, manifest, triage ledger, launcher size, sanitation, and
      whitespace checks pass.
- [ ] Yeet repair and verify are green on the complete remediation scope.
- [ ] Each remaining branch is published, hosted checks and reviews are closed,
      and its PR is mergeable and merged.
- [ ] All 19 captured Codex findings are resolved after merge and the live view
      shows zero packet-applicable open findings.

## Verification Matrix

| Check             | Command or evidence                                                                                               | Required result                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Launcher size     | `test "$(wc -m < goals/codex-security-findings-2026-08-13/GOAL.md)" -le 4000`                                     | Pass                                    |
| JSON shape        | `jq .` over both files in `ops/`                                                                                  | Pass                                    |
| Finding count     | CSF file count equals 19                                                                                          | Pass                                    |
| Severity count    | 7 High, 6 Medium, 2 Low, 4 Informational                                                                          | Pass                                    |
| Raw ignored       | `git status --short -- .../raw`                                                                                   | Only `.gitignore` tracked               |
| Sanitization      | tracked packet secret/path pattern scan                                                                           | No matches                              |
| Per-finding proof | command recorded in finding and triage ledger                                                                     | Pass                                    |
| Release metadata  | changeset status accepts every changed package and intentional no-release entry                               | Pass                                    |
| Repair proof      | `bun run beep yeet repair`                                                                                        | 9/9 lanes and verdict outcome `success` |
| Repo proof        | `bun run beep yeet verify`                                                                                        | Green                                   |
| Hosted proof      | Yeet monitor and review closeout                                                                                  | Green and mergeable                     |
| Final closure     | signed-in Chrome findings view                                                                                    | Zero packet-open                        |

## Stop Conditions

- The signed-in CSV export cannot be produced from the findings page.
- Tracked evidence contains a secret, signed URL, auth value, email address, or
  raw local path.
- A fix requires a product or architecture decision outside this packet.
- A proposed security control would rely on a platform-specific fail-open path.
- The same blocking condition repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --------- | ----- | ----- | --------- | ----------------- |
| None      | N/A   | N/A   | N/A       | N/A               |
