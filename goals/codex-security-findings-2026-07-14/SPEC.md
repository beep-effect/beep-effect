# Codex Security Findings (2026-07-14) Spec

## Objective

Remediate every open Codex Cloud security finding visible at
`https://chatgpt.com/codex/cloud/security/findings/` for `kriegcloud/beep-effect`
(the 9-finding batch captured 2026-07-14) in one mergeable PR, then resolve the
live Codex findings until the dashboard shows zero open findings applicable to
this packet.

## Non-Goals

- No accepted-risk / `Won't fix` disposition; every finding is remediated.
- No tracking of raw reports, unsanitized evidence, cookie values, auth headers,
  signed URLs, secret paths, or absolute developer-local paths.
- No use of Codex's own "Create PR" or patch-apply buttons; fixes are manual and
  consolidated into one Yeet-driven PR.
- No second closeout PR after remediated findings resolve post-merge.
- No unrelated refactors or formatting churn.
- No remediation of `.repos/**` (none appear in this batch).

## Source Hierarchy

1. User objective that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, `findings/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `goals/codex-security-findings-2026-07-14/**` tracked packet files.
- Gitignored raw evidence under `goals/codex-security-findings-2026-07-14/raw/**`.
- Repo paths named by the 9 findings during remediation (see `findings/INDEX.md`).

## Constraints

- All 9 findings are `remediate`. Disposition mapping: `remediate -> Already
  fixed` after the PR merges (accepting scanner auto-close where the scanner has
  already recorded `Fixed`).
- Locked remediation decisions (from grill, 2026-07-14):
  - CSF-002 Grafana MCP: remove from repo config (`.mcp.json`, `.codex/config.toml`,
    `.claude/settings.json` `enabledMcpjsonServers`); operator re-adds at user level.
  - CSF-009 lockfile: dedupe `bun.lock` to `next@16.3.0-canary.83`; Fable owns
    this global-file change and runs it last.
  - Code findings CSF-001/003/004/005/006: minimal scoped fix matching the Codex
    suggested remediation plus one regression test each; no broad refactors.
- Store full report markdown only in the gitignored raw folder. Tracked finding
  files are sanitized summaries.
- Search live source and package barrels before adding helpers. A shared helper
  is allowed only for a repeated maintained-code class and only in the
  doctrine-correct home (package-local first, then tooling/driver/foundation).
- Token-heavy validation and remediation run on codex GPT-5.6 Sol at medium
  reasoning, one agent per disjoint lane. Sub-agents return changed files +
  verification and never write shared ledgers, `bun.lock`, or the dashboard.
- Fable (main agent) owns `ops/triage.json`, `findings/INDEX.md`, `bun.lock`
  dedupe, all browser closure (via codex's Chrome extension), Yeet, PR merge, and
  final zero-open verification.
- Drive the PR through Yeet to mergeability; never weaken check names, hosted
  checks, security lanes, or review gates to appear green faster.
- The tracked packet remains `active` through merge; final Codex closure happens
  after merge. Final zero-open evidence is local/untracked and reported in the
  operator summary and packet history.

## Acceptance Criteria

- [ ] All 9 captured findings are represented by sanitized tracked CSF files with
      full raw evidence held only under gitignored `raw/`.
- [ ] Every finding has a disposition, verdict, lane, close reason, rationale, and
      current Codex status in `ops/triage.json`.
- [ ] Every finding is remediated with changed files and targeted verification
      recorded; each code finding ships one regression test.
- [ ] CSF-002 grafana MCP config is removed; CSF-009 lockfile is deduped and
      `apps/oip-web` still builds.
- [ ] The branch is published as one PR, proven through Yeet, has green hosted
      checks, and zero unresolved actionable review comments.
- [ ] The PR is merged with the repository default merge behavior.
- [ ] All 9 Codex findings are resolved (accepting scanner auto-close) after merge.
- [ ] The final live Codex findings view shows zero packet-applicable open findings.
- [ ] Sanitization scans are clean on tracked packet files; raw captures are not tracked.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/codex-security-findings-2026-07-14/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/codex-security-findings-2026-07-14/ops/manifest.json` | Passes |
| Triage JSON | `jq . goals/codex-security-findings-2026-07-14/ops/triage.json` | Passes |
| Finding count | tracked CSF count equals `catalog.capturedCount` (9) | Passes |
| Raw ignored | `git status --short -- goals/codex-security-findings-2026-07-14/raw` | Only tracked `.gitignore` appears |
| Sanitization | secret-pattern + absolute-path `rg` over tracked packet files | No matches |
| Per-finding verify | each finding's recorded verification command | Passes |
| Grafana removal | `! rg -n "grafana|mcp/grafana" .mcp.json .codex/config.toml .claude/settings.json` | No matches |
| Lockfile dedupe | `! rg -n "next@16.3.0-canary.82" bun.lock` | No matches |
| Mergeable | `bun run beep yeet verify`, publish/monitor/closeout | Green |
| Final closure | codex Chrome evidence | Zero packet-applicable open findings |
| Whitespace | `git diff --check -- goals/codex-security-findings-2026-07-14` | Passes |

## Stop Conditions

- Codex's Chrome extension cannot access the authenticated findings page.
- Sanitization scan finds a secret or absolute local path in tracked files, or
  raw evidence is staged.
- A finding cannot be remediated without an explicit policy or architecture
  decision outside this packet.
- A proposed helper would violate architecture doctrine and no local fix is viable.
- Yeet or hosted CI exposes a security/check failure not attributable to
  environment or unrelated baseline after investigation.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
