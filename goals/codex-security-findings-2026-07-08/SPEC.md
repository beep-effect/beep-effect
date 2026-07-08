# Codex Security Findings (2026-07-08) Spec

## Objective

Remediate or validly close every open Codex Cloud security finding visible at
`https://chatgpt.com/codex/cloud/security/findings/` for `beep-effect` in one
mergeable PR, then close the live Codex findings until the dashboard shows zero
open findings.

## Non-Goals

- No remediation of reference-only `.repos/**` findings; they close as
  out-of-scope false positives.
- No accepted-risk / `Won't fix` disposition.
- No tracking of raw reports, unsanitized evidence, cookie values, auth headers,
  signed URLs, secret paths, or Codex-provided patch bodies.
- No use of Codex's own "Create PR" or patch-apply buttons; fixes are manual and
  consolidated into one Yeet-driven PR.
- No second closeout PR after remediated findings are closed post-merge.
- No unrelated refactors or formatting churn.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, `findings/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `goals/codex-security-findings-2026-07-08/**` tracked packet files.
- Gitignored raw evidence under `goals/codex-security-findings-2026-07-08/raw/**`.
- Repo paths named by legitimate maintained-code findings during remediation.

## Constraints

- Capture all initially open findings and include any additional open findings
  that appear before final closeout.
- Use Chrome control for Codex UI capture and closure. If Chrome is not signed
  in, stop for sign-in rather than using alternate sources.
- Store full report and patch markdown only in the gitignored raw folder. Tracked
  finding files must be sanitized summaries.
- Disposition mapping:
  - `remediate` -> `Already fixed` after the PR merges.
  - `already-fixed` -> `Already fixed` when current code already contains the
    fix and the finding can be closed without repo changes.
  - `false-positive` -> `False positive`.
  - `out-of-scope` -> `False positive`.
- `.repos/**` findings are `out-of-scope` because `.repos` is reference subtree
  material for agents, not maintained product or tooling code.
- False-positive and already-fixed dispositions require strict proof: affected
  code absent, unreachable, non-shipped, outside maintained scope, or materially
  misunderstood by the report.
- No `accepted-risk`; every legitimate maintained-code finding must be fixed.
- Search live source and package barrels before adding helpers. Do not use
  retired `standards/repo-exports.catalog.*` surfaces.
- Repeated maintained-code vulnerability classes may use a shared helper only in
  the doctrine-correct home: package-local first, then tooling/driver/foundation,
  and `shared/*` only for deliberate shared product language with required
  promotion records.
- Sub-agents may validate findings and implement disjoint remediation lanes in
  batches of six. They must not write shared ledgers or perform browser closure.
- The main agent owns `ops/triage.json`, `findings/INDEX.md`, all Chrome writes,
  shared-helper integration, Yeet, PR merge, and post-merge closure.
- Drive the PR through Yeet to mergeability; never weaken check names, hosted
  checks, security lanes, or review gates to appear green faster.
- The tracked packet remains `active` in the single PR because final Codex
  closure happens after merge. Final zero-open evidence is local/untracked and
  reported in the final operator summary.

## Acceptance Criteria

- [ ] Every initially open and newly appearing Codex security finding is captured
      in raw local evidence and represented by a sanitized tracked CSF file.
- [ ] Every finding has a disposition, verdict, lane, close reason, rationale,
      and current Codex status in `ops/triage.json`.
- [ ] Every false-positive, out-of-scope, or already-fixed finding has strict
      proof and is closed in Codex by the main agent.
- [ ] Every legitimate maintained-code finding is remediated with changed files
      and targeted verification recorded.
- [ ] The branch is published as one PR, proven through Yeet, has green hosted
      checks, and has zero unresolved actionable review comments.
- [ ] The PR is merged with the repository default merge behavior.
- [ ] Remediated findings are closed in Codex as `Already fixed` after merge.
- [ ] The final live Codex findings view shows zero open findings.
- [ ] Sanitization scans are clean on tracked packet files and raw captures are
      not tracked.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/codex-security-findings-2026-07-08/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/codex-security-findings-2026-07-08/ops/manifest.json` | Passes |
| Triage JSON | `jq . goals/codex-security-findings-2026-07-08/ops/triage.json` | Passes |
| Finding count | tracked CSF count equals `catalog.capturedCount` | Passes |
| Raw ignored | `git status --short -- goals/codex-security-findings-2026-07-08/raw` | Only tracked `.gitignore` appears |
| Sanitization | secret-pattern `rg` over tracked packet files | No matches |
| Per-finding verify | each `remediate` row's verification command | Passes |
| Mergeable | `bun run beep yeet verify`, publish/monitor/closeout | Green |
| Hosted review | Yeet closeout summary | 5/5 Greptile, 0 issues, 0 actionable comments |
| Final closure | Chrome/Codex evidence | Zero open findings |
| Whitespace | `git diff --check -- goals/codex-security-findings-2026-07-08` | Passes |

## Stop Conditions

- Chrome cannot access the authenticated Codex security findings page.
- Sanitization scan finds a secret in tracked files, or raw evidence is staged.
- A legitimate maintained-code finding cannot be remediated without an explicit
  policy or architecture decision outside this packet.
- A proposed helper would violate architecture doctrine and no local fix is
  viable.
- Yeet or hosted CI exposes a security/check failure that cannot be attributed
  to environment or unrelated baseline after investigation.
- Required source files are missing or materially contradictory.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
