# Codex Security Findings (2026-07-14)

Repo root: the current working directory - the `beep-effect` checkout you are
running in. Do not assume an absolute path. All paths below are repo-relative.

Outcome: close every open Codex Cloud security finding for this repo (the 9-finding
batch of 2026-07-14), with all findings fixed in one merged Yeet-driven PR and the
live Codex dashboard ending at zero packet-applicable open findings.

This is a compact `/goal` launcher. Treat the packet files as the detailed contract:

- `goals/codex-security-findings-2026-07-14/README.md`
- `goals/codex-security-findings-2026-07-14/SPEC.md`
- `goals/codex-security-findings-2026-07-14/PLAN.md`
- `goals/codex-security-findings-2026-07-14/ops/manifest.json`
- `goals/codex-security-findings-2026-07-14/ops/triage.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, the `yeet` skill, and standards
named by `SPEC.md`. Higher-priority repo standards outrank packet prose.

Scope:

- In: this packet, codex-Chrome capture/closure of Codex findings, remediation of
  all 9 findings, Yeet publish/monitor/closeout, PR merge, post-merge closure.
- Out: `.repos/**` (none in batch), accepted-risk / `Won't fix`, raw evidence in
  git, Codex patch-apply/Create PR buttons, second closeout PRs, unrelated churn.

Locked decisions (grill 2026-07-14):

- CSF-002 Grafana MCP: remove from repo config (`.mcp.json`, `.codex/config.toml`,
  `.claude/settings.json` enabledMcpjsonServers); operator re-adds at user level.
- CSF-009 lockfile: dedupe `bun.lock` to `next@16.3.0-canary.83`; Fable owns it, last.
- CSF-001/003/004/005/006: minimal scoped fix per Codex hint + one regression test each.
- Post-merge closure via codex Chrome; accept scanner auto-close; match exact ID allowlist.

Division of labor: Fable drives ledgers, `bun.lock`, browser, Yeet, merge. Codex
GPT-5.6 Sol (medium) does per-lane validation + remediation on disjoint paths.

Lanes: RL-001 CSF-001 (agents + ai-provider-cli); RL-002 CSF-003, CSF-005
(documents server + doc-text + desktop runtime); RL-003 CSF-004, CSF-006 (ontology
+ shacl/rdf/semantic-web); RL-004 CSF-002, CSF-007, CSF-008, CSF-009 (config, cli,
docs, lockfile). CSF-004 and CSF-006 share a lane (same Session.validation.ts file).

Workflow:

1. Confirm each finding reproduces at HEAD; record `remediate` in `ops/triage.json`.
2. Spawn one codex gpt-5.6-sol/medium agent per lane on disjoint paths; fix per the
   suggested remediation; add one regression test per code finding.
3. Fable integrates changed files, runs the `bun.lock` dedupe last, records changed
   files + targeted proof per finding.
4. Use Yeet to repair, verify, publish one PR, monitor checks, close out review
   gates, and merge only when mergeable.
5. After merge, resolve all 9 Codex findings via codex Chrome and verify the live
   findings view shows zero packet-applicable open findings.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Raw captures are ignored and tracked packet files are sanitized.
- [ ] Full Yeet proof, hosted checks, and review closeout are green.
- [ ] The PR is merged and the 9 Codex findings are resolved (zero packet-open).
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/codex-security-findings-2026-07-14/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-07-14/ops/manifest.json
jq . goals/codex-security-findings-2026-07-14/ops/triage.json
git diff --check -- goals/codex-security-findings-2026-07-14
```

Stop and report if codex Chrome cannot access the authenticated Codex findings
page, if tracked files contain secrets/raw evidence/absolute local paths, if a
finding needs an architecture/policy decision outside this packet, or if the same
blocker repeats after reasonable investigation.
