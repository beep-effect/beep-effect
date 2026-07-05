# GOAL: Cut agent context friction and time-to-mergeable-PR in one PR

Repo root: the current working directory — the `beep-effect` checkout you are
running in. All paths are repo-relative.

Outcome: agents (Claude + Codex) share single-sourced laws and lean skills;
PR reviews are greptile-only; PR CI reads the turbo cache; main is green;
yeet is instrumented, rebenchmarked, and hosted-parity; `beep worktree`
exists — all landed as ONE PR.

Contract files (read first, in order):

- `goals/agent-pipeline-velocity/SPEC.md` (normative)
- `goals/agent-pipeline-velocity/PLAN.md` (phases)
- `goals/agent-pipeline-velocity/ops/manifest.json`
- Provenance: `explorations/agent-pipeline-velocity/` (DECISIONS.md = 9 locked
  decisions; research/baseline-*.md = grounding)

Then `AGENTS.md`, `CLAUDE.md`, standards named by SPEC. Higher sources win.

Sequencing gate: PR #291 (`codex/yeet-verify-repair`) must be merged before
code-touching phases. Browser-side review-bot deactivation may proceed first.

Scope:

- In: check.yml cache policy; Yeet internal {Planner,Closeout,Handler,Status};
  Quality/Tasks.ts parity lanes; new commands/Worktree; root instruction files
  + generator + 14 nested instruction files; 3 heavyweight skills +
  skills-lock + .codex/config.toml; .claude/settings.json; 4 superseded goal
  manifests; standards/git-worktrees.md; yeet SKILL.md.
- Out: branch protection; multi-PR; full crispen cleanup; external tooling
  swaps (rqt-010 waiver); full jsdoc backlog; net growth of always-loaded
  context; weakening any gate.

Workflow:

1. P0: merge/verify PR #291; trim closeout gates to
   hosted-checks+review-threads+greptile; PR read-only remote cache
   (CSF-001 amendment comment); main green → check-runs 0 failures.
2. P1: single-source generator emitting CLAUDE.md+AGENTS.md + `--check` drift
   gate; audit nested instruction files; progressive disclosure for the 3
   heavyweight skills (SKILL.md lean + references/, re-pin hashes); curated
   permissions.allow; record context-tooling verdict.
3. P2 (FABLE-DIRECT — do not delegate analysis to Codex/lower tiers):
   instrument yeet phase wall-times, record baseline; benchmark feedback
   concurrency 3→{8,16,24} watching memory; add lint-policy + BASE-gitleaks +
   fallow-advisory parity to verify full tier; attack rqt leftovers by
   measured win; scoped-crispen only what optimizations require, ledger the
   rest (history/crispen-debt.md). Record rqt-011+ deltas in history/.
4. P3: `beep worktree new/remove/doctor` per standards/git-worktrees.md;
   smoke round-trip; update the standard.
5. Preserve unrelated worktree changes; conventional commits only.
6. P4: yeet repair → verify → publish --pr → monitor; greptile closeout.
7. P5: /reflect closeout; update README/manifest; REPO_RATING delta note.

Acceptance (SPEC is authoritative):

- [ ] Main check-runs: 0 failures. PR lanes: cache HITs, zero uploads.
- [ ] Gate defaults greptile-only; generated instruction files pass drift
      check; heavyweight skills ≥50% lighter; allowlist smoke passes.
- [ ] Baseline + post-change yeet timings recorded; parity lanes in verify;
      no gate weakened; worktree smoke green.
- [ ] Reflection written; `bun run beep lint reflection-artifacts` passes.

Verification:

```sh
test "$(wc -m < goals/agent-pipeline-velocity/GOAL.md)" -le 4000
jq . goals/agent-pipeline-velocity/ops/manifest.json
git diff --check -- goals/agent-pipeline-velocity
bun run beep yeet verify
```

Stop and report before changing public API, schema, auth, infra, security
behavior, dependencies, lockfiles, or destructive state unless SPEC requires
it; stop if a change would weaken any proof/gate, or if concurrency increases
cause memory thrash (record the measured ceiling instead).

Done only when acceptance passes and verification is complete, or a blocker is
reported with file/command evidence.
