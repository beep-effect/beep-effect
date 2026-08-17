# Codex Security Findings (2026-06-17) Spec

## Objective

Remediate all 71 Codex Cloud security findings from scan
`f4128216e9c08191b0431ea2a05322bb` in one PR on `security/6-17-2026`, and close
every finding in Codex with the correct close reason. Every remediated finding
carries a passing targeted verification; every dismissed or accepted-risk finding
carries a written rationale.

## Non-Goals

- No fresh branch; reuse the existing `security/6-17-2026`.
- No remediation of findings outside this scan.
- No tracking of raw captures or unsanitized evidence; never commit the cookie file.
- No `Won't fix` disposition without explicit written justification.
- No use of Codex's own "Create PR" / "Patch apply" buttons; remediation is
  manual and consolidated into one yeet-driven PR.
- No unrelated refactors or formatting churn.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `goals/codex-security-findings-2026-06-17/**` (this packet).
- Any repo paths named in a finding's Evidence Paths / `changedFiles` during
  remediation (security-sensitive code across foundation, drivers, tooling, and
  app packages).

## Constraints

- Default disposition is `remediate`; `accepted-risk` requires written
  justification recorded in the finding rationale and `ops/triage.json`.
- Disposition -> Codex close reason:
  - `remediate` -> `Already fixed` (after the fix lands).
  - `false-positive` (Codex misread / no real vuln) -> `False positive`.
  - `out-of-scope` (`.repos/`, gitignored, non-shipped, vendored) -> `False positive`.
  - `accepted-risk` (real but deliberately not fixing) -> `Won't fix` + justification.
- Capture BOTH the Report and the Patch per finding into the private raw root;
  patches enter `findings/patches/CSF-NNN.patch` only with the landed fix.
- Fix philosophy is hybrid: minimal scoped fixes by default; when >=2 findings
  share a class (SSRF / path-traversal / unvalidated-URL), propose a single
  canonical helper (search `standards/repo-exports.catalog.*` first; foundation
  home) as its own GATE-1 row before any cross-lane edit.
- Lanes: partition by file-ownership into non-overlapping parallel batches;
  serialize overlapping findings; no git worktrees; no merge step inside lanes.
- Two approval gates: GATE 1 after triage (disposition matrix + shared-helper
  proposals + public-disclosure posture) and GATE 2 before merge. STOP at each.
- Closure timing: non-remediated dispositions closed right after GATE 1;
  remediated findings closed after the PR merges. Two Chrome closure passes.
- Sanitize signed URLs, token-like params, auth headers, cookies, secret paths,
  and private keys from all committed content. Raw captures stay untracked in
  a machine-local scratch directory outside the repo.
- Keep unremediated findings' exploit detail, specific evidence paths, source
  commits, and patch material out of public tracking until fixes land
  atomically; tracked ledgers carry title + severity + disposition + justification.
- Drive to mergeable through the `yeet` operator path; never weaken check names.

## Acceptance Criteria

- [ ] All 71 findings captured (Report + Patch) to the private raw root;
      `capturedCount == 71`.
- [ ] Every finding has a disposition, verdict, lane, and Codex close reason.
- [ ] Every remediated finding has a passing targeted verification + recorded
      `changedFiles` in `ops/triage.json`.
- [ ] Every `accepted-risk` finding has explicit written justification.
- [ ] `bun run beep yeet` is green and the PR is mergeable (checks green incl.
      gitleaks/osv/semgrep, review bot pass, 0 unresolved actionable threads).
- [ ] Sanitization scan is clean on tracked files; cookie file is not tracked.
- [ ] All 71 findings closed in Codex (False positive / Already fixed / Won't fix).
- [ ] INDEX, manifest, and triage counts reconcile.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/codex-security-findings-2026-06-17/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/codex-security-findings-2026-06-17/ops/manifest.json` | Passes |
| Triage JSON | `jq . goals/codex-security-findings-2026-06-17/ops/triage.json` | Passes |
| Finding count | `ls goals/codex-security-findings-2026-06-17/findings/CSF-*.md \| wc -l` == 71 | Passes |
| Sanitization | secret-pattern `rg` over the packet | No matches |
| Cookie not tracked | `git ls-files --error-unmatch openai.com_cookies.txt` | Errors (untracked) |
| Per-finding verify | each `remediate` entry's `verificationCommand` | Passes |
| Mergeable | `bun run beep yeet verify` then hosted checks | Green |
| Whitespace | `git diff --check -- goals/codex-security-findings-2026-06-17` | Passes |

## Stop Conditions

- Post-triage GATE 1 not approved (hard stop / phase boundary).
- Pre-merge GATE 2 not approved (hard stop).
- `Won't fix` proposed without written justification.
- Sanitization scan finds a secret in tracked files, or the cookie file is staged.
- Enumerated Codex finding count != 71.
- A remediation fix would require editing a file outside its lane without an
  approved shared-helper row.
- Required source files missing or materially contradictory.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
