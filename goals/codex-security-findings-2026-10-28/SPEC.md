# Codex Security Findings (2026-10-28) Spec

## Objective

Remediate every open Codex Cloud security finding visible at
`https://chatgpt.com/mcp-app/connector_openai_defense_factory/open_defense_factory#/findings` for
`kriegcloud/beep-effect` in the 7-finding batch captured on 2026-10-28. Publish
the work through Yeet, reach mergeable hosted state, merge, then resolve the
exact captured findings until no packet-applicable finding remains open.

The 2026-10-31 closeout adds all 20 newly observed Dependabot alerts in
`ops/dependabot.json`. Preserve the seven Cloud bindings; dependency IDs remain
a separate catalog. The prior session-only unmerged hold ended when #2333
merged and the operator requested full closure.

Current delivery: implementation PR #2389 is merged. Final receipt PR #2416
must capture genuine canonical readiness before merge, retain exact external
closure evidence, and yield verified post-merge receipts for both packets.
The twenty supplemental dependency alerts remain open despite fixed graph
versions; all fifteen Cloud findings are Fixed and code/secret inventories
show zero open alerts. The final PR changes evidence only.

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

- `goals/codex-security-findings-2026-10-28/**`.
- Gitignored raw evidence under `goals/codex-security-findings-2026-10-28/raw/**`.
- Maintained repo paths named by `findings/INDEX.md` after current-HEAD validation.
- Test-only restoration of inherited coverage gaps in
  `test/effect-schema-inventory.test.ts`, `test/refs-refresh-plan.test.ts` and
  `test/knowledge-doctor.test.ts`; production behavior and coverage floors stay
  unchanged.

## Constraints

- Default disposition is `remediate`. `already-fixed` or `false-positive`
  requires strict current-HEAD proof recorded in the finding and triage ledger.
- Minimal root-cause fixes plus one focused regression check per executable-code
  finding. Reuse canonical path-safety, schema, and bounds helpers after live
  source/barrel discovery.
- Schema-first and Effect-first laws govern all production changes.
- Security controls may not be simplified away for diff size.
- Captured summaries stay in ignored `raw/`; tracked records contain only sanitized
  metadata, summaries, validation, decisions, changed files, and proof.
- Browser closure happens after merge, against the exact 7-ID allowlist.
- Preserve unrelated work and stage only reviewed packet intent.

## Acceptance Criteria

- [ ] All 7 findings have sanitized tracked CSF records with Codex ID, severity,
      title, source commit, and public summary.
- [ ] Every finding has a current-HEAD verdict, disposition, lane, rationale,
      remediation state, changed-file set, and verification evidence.
- [ ] Every real finding is fixed at the shared root cause with a focused
      regression check where executable behavior changes.
- [ ] Packet counts, manifest, triage ledger, launcher size, sanitation, and
      whitespace checks pass.
- [ ] Yeet repair and verify are green on the complete remediation scope.
- [ ] Final receipt PR #2416 is published; its exact final head has genuine
      canonical readiness before merge, all reviews are closed, and it is merged.
- [ ] Both packets retain active declared lifecycle until verified post-merge
      completion receipts derive `completed-retained`; all supplemental dependency
      and scanning IDs are resolved with exact evidence and zero-open inventories.
- [ ] All 7 captured Codex findings are resolved after merge and the live view
      shows zero packet-applicable open findings.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/codex-security-findings-2026-10-28/GOAL.md)" -le 4000` | Pass |
| JSON shape | `jq .` over both files in `ops/` | Pass |
| Finding count | CSF file count equals 7 | Pass |
| Severity count | 1 Low, 6 Informational | Pass |
| Raw ignored | `git status --short -- .../raw` | Only `.gitignore` tracked |
| Sanitization | tracked packet secret/path pattern scan | No matches |
| Per-finding proof | command recorded in finding and triage ledger | Pass |
| Repo proof | `bun run beep yeet verify` | Green |
| Hosted proof | Yeet monitor and review closeout | Green and mergeable |
| Final closure | supported connector or signed-in in-app findings view | Zero packet-open |

## Stop Conditions

- The signed-in CSV export cannot be produced from the findings page.
- Tracked evidence contains a secret, signed URL, auth value, email address, or
  raw local path.
- A fix requires a product or architecture decision outside this packet.
- A proposed security control would rely on a platform-specific fail-open path.
- The same blocking condition repeats after reasonable investigation.

## Decision Log

- 2026-10-31: Strict completion requires the inherited Fallow and Lint Policy
  failures to be repaired. Shared PR #2399 owns those fixes and was consumed
  through main at `f16d82e9f16d72f64d42b40284bf2867566e796b`. A locally reviewed candidate is retained in branch
  history but excluded from the final change to avoid duplicate implementation.
  Keep the distinct test-only fixes for three inherited coverage gaps, with
  measured coverage, independent review and unchanged production behavior and
  floors. Require fresh final-head hosted readiness. Reversal is a reviewed
  corrective PR retaining the strict completion contract.

- 2026-10-31: Close the seven exact Cloud IDs after #2333 merge and current-main
  source proof. Capture 20 newer dependency alerts and fix all four affected
  libraries through upstream releases. Retain both packets and merge the
  remediation and final closure documentation through normal PR gates. Reversal
  is a reviewed follow-up PR; never restore a vulnerable dependency as rollback.


- 2026-10-29: Register the artifact collection and native Windows pipe jobs as
  explicit hosted-job inventory exemptions because their platform and artifact
  handoff cannot be replayed by the local CLI dispatcher. Keep policy diagnostics
  active and pin the read-only sparse checkout, handoff, Windows runner, and
  PowerShell regression command in a focused workflow test. Reversal: remove the
  two exemptions when equivalent dispatchable CI descriptors exist.

- 2026-10-29: Merge current `main` into the published feature branch to consume
  shared CLI and dependency repairs once. Preserve the published branch history.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |

## Supplemental scanning acceptance — October 31

The broader authenticated inventory also found four stale CodeQL alerts and
five secret-scanning alerts. Their separate sanitized catalog is
`ops/scanning.json`, with source validation and exact closure reasons in
`research/2026-10-31-scanning.md`. All nine must be resolved with evidence,
without accepted risk, before final completion. Preserve the original seven
Cloud IDs and twenty dependency IDs.

## Final receipt reconciliation — October 31

Implementation PR #2389 merged at `ac8993e7773065c55b11e6b71b0f1471a0105d2f`.
All 35 hosted check jobs ultimately passed on its accepted head; the separate
optional Vercel statuses report deployment rate limits. The merge preceded this
lane's positive canonical readiness capture. Later green checks do not supply
that missing historical observation.

Final closeout PR [#2416](https://github.com/beep-effect/beep-effect/pull/2416)
retains the merged implementation and must obtain genuine final-head canonical
`merge-ready: yes` while it is still open. Preserve that evidence before merge.
After #2416 merges and all exact external statuses are verified, run
`goals completion refresh` for both packets. Their declared lifecycle remains
`active` with prospective `completed-retained` until verified receipts derive
completion. No gate is weakened and no readiness receipt is fabricated.

Dependency IDs #450–#469 still require exact closure and a zero-open inventory;
fixed versions in the dependency graph alone do not establish closure. See the
[accepted closeout evidence](../codex-security-findings-2026-10-28/research/2026-10-31-accepted-closeout.md).
