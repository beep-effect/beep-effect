# Codex Security Findings (2026-08-24) Spec

## Objective

Account for every open Codex Cloud security finding visible at
`https://chatgpt.com/codex/cloud/security/findings/` for
`kriegcloud/beep-effect` in the 19-finding batch captured on 2026-08-24. Publish
the bounded remediation through Yeet, reach mergeable hosted state, and merge.
Close 13 exact IDs as Already fixed and transfer the six runner-boundary IDs to
`goals/runner-trust-boundary` under its exact proof and closure gates.

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

- `goals/codex-security-findings-2026-08-24/**`.
- Gitignored raw evidence under `goals/codex-security-findings-2026-08-24/raw/**`.
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
- Browser closure happens after merge, against the exact 13-ID allowlist in
  `ops/closures.json`.
- Preserve unrelated work and stage only reviewed packet intent.

## Completion by handoff

This packet completes with the named handoff even though six dashboard IDs
remain open. Handoff is neither accepted risk nor dashboard closure. The
receiving packet `goals/runner-trust-boundary` owns these exact IDs:

| Source record | Codex ID | Receiving gate |
| --- | --- | --- |
| CSF-001 | `08ee74d0eb18819187fd02f570b4d57c` | Admission and boundary proof |
| CSF-003 | `9459410104b881919cd820b97c673b67` | P1 deployment proof, then post-merge closure |
| CSF-004 | `a3a281b2a3d881919fdcbf68ee2364f0` | Admission and boundary proof |
| CSF-005 | `c799c2269d748191997ff176ce4bfd48` | Workload-identity and boundary proof |
| CSF-006 | `33cd94a12d788191afbec1edc25c433f` | Workload-identity and boundary proof |
| CSF-009 | `d1f026deb21881919d853e63780734fe` | P1 deployment proof, then post-merge closure |

The handoff satisfies this source packet's completion contract. CSF-003 and
CSF-009 may close only after the receiving packet's P1 proof and merge gate.
The other four IDs remain open until that packet proves and ships their runner
trust-boundary remediation. `ops/closures.json` is the auditable ledger for the
13 IDs this packet closed on 2026-08-24 citing PR #783.

## Acceptance Criteria

- [x] All 19 findings have sanitized tracked CSF records with Codex ID, severity,
      title, source commit, and public summary.
- [x] Every finding has a current-HEAD verdict, disposition, lane, rationale,
      remediation state, changed-file set, and verification evidence.
- [x] Every real finding is fixed at the shared root cause with a focused
      regression check where executable behavior changes, or transferred by
      exact ID to `goals/runner-trust-boundary` for external proof.
- [x] Packet counts, manifest, triage ledger, closure ledger, launcher size,
      sanitation, and whitespace checks pass.
- [x] Yeet repair and verify are green on the complete remediation scope.
- [x] The branch is published, hosted checks and reviews are closed, and the PR
      is mergeable and merged.
- [x] The 13 IDs in `ops/closures.json` are closed as Already fixed citing PR
      #783; the six exact open IDs above are transferred to the named packet.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/codex-security-findings-2026-08-24/GOAL.md)" -le 4000` | Pass |
| JSON shape | `jq .` over all three JSON files in `ops/` | Pass |
| Finding count | CSF file count equals 19 | Pass |
| Severity count | 5 High, 4 Medium, 5 Low, 5 Informational | Pass |
| Raw ignored | `git status --short -- .../raw` | Only `.gitignore` tracked |
| Sanitization | tracked packet secret/path pattern scan | No matches |
| Per-finding proof | command recorded in finding and triage ledger | Pass |
| Repo proof | `bun run beep yeet verify` | Green |
| Hosted proof | Yeet monitor and review closeout | Green and mergeable |
| Final accounting | `ops/closures.json` plus receiving-packet transfer table | 13 closed; six exact open IDs handed off |

## Stop Conditions

- The signed-in CSV export cannot be produced from the findings page.
- Tracked evidence contains a secret, signed URL, auth value, email address, or
  raw local path.
- A fix requires a product or architecture decision outside this packet.
- A proposed security control would rely on a platform-specific fail-open path.
- The same blocking condition repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
