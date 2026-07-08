# Codex Security Findings (2026-07-08)

Repo root: the current working directory - the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: close every open Codex Cloud security finding for this repo, with all
maintained-code findings fixed in one merged Yeet-driven PR and the live Codex
security dashboard ending at zero open findings.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/codex-security-findings-2026-07-08/README.md`
- `goals/codex-security-findings-2026-07-08/SPEC.md`
- `goals/codex-security-findings-2026-07-08/PLAN.md`
- `goals/codex-security-findings-2026-07-08/ops/manifest.json`
- `goals/codex-security-findings-2026-07-08/ops/triage.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, the `yeet` skill, and any
governing standards named by `SPEC.md`. Higher-priority repo standards outrank
packet prose when they conflict.

Scope:

- In: this packet, Chrome capture/closure of Codex findings, legitimate
  maintained-code remediation, Yeet publish/monitor/closeout, PR merge, and
  post-merge Codex closure.
- Out: `.repos/**` remediation, accepted-risk / `Won't fix`, raw evidence in
  git, Codex patch-apply/Create PR buttons, second closeout PRs, unrelated churn.

Workflow:

1. Capture all open findings from the authenticated Codex security page into the
   ignored `raw/` folder and sanitized tracked CSF files.
2. Validate findings in sub-agent batches of six. Sub-agents return verdicts;
   the main agent writes ledgers and closes invalid findings.
3. Close `.repos/**`, false-positive, out-of-scope, and already-fixed findings
   in Chrome with the correct reason.
4. Partition legitimate findings into disjoint lanes and fix all maintained-code
   findings. Search live source and barrels before adding helpers.
5. Record changed files and targeted proof per remediated finding.
6. Use Yeet to repair, verify, publish one PR, monitor checks, close out review
   gates, and merge only when mergeable.
7. After merge, close remediated Codex findings as `Already fixed` and verify
   the live findings view shows zero open findings.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Raw captures are ignored and tracked packet files are sanitized.
- [ ] Full Yeet proof, hosted checks, and review closeout are green.
- [ ] The PR is merged and the Codex security findings view has zero open items.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/codex-security-findings-2026-07-08/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-07-08/ops/manifest.json
jq . goals/codex-security-findings-2026-07-08/ops/triage.json
git diff --check -- goals/codex-security-findings-2026-07-08
```

Stop and report if Chrome cannot access the authenticated Codex findings page,
if tracked files contain secrets/raw evidence, if a maintained-code finding
requires an architecture/policy decision outside this packet, or if the same
blocker repeats after reasonable investigation.
