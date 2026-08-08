# GOAL: give three governance laws an owner with enforcement

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: three repo-wide laws are stated in `standards/` and enforced — a
minting process cannot raise its own ceiling (schema, min-composed at use),
capped walks declare per-**edge** lifetime caps and record a `StopReason`, and
every law scanner asserts its own scan matched something.

This is a compact `/goal` launcher. The packet files are the contract:

- `goals/agentic-governance-laws/README.md`
- `goals/agentic-governance-laws/SPEC.md`
- `goals/agentic-governance-laws/PLAN.md`
- `goals/agentic-governance-laws/ops/manifest.json`
- `goals/agentic-governance-laws/research/SOURCES.md`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Repo standards outrank packet prose when they conflict.

Scope:

- In: `standards/` (the three law statements + the Q6 determinism-tier
  sentence, one edit); the four scan paths in
  `packages/tooling/tool/cli/src/commands/Laws/`; a ceiling declaration schema
  at the site P0 chooses; a `StopReason` `LiteralKit`; violating fixtures
  under `packages/tooling/tool/cli/test/`.
- Out: any control-plane surface, policy UI, or runtime beyond the shipped
  TierGate clamp; the Q8 adherence instrument; Q10 envelope work; a graded
  sensitivity taxonomy; the `LawScan` code fix itself (it lands in the
  amendment pass — cite it, never redo it). Full list: SPEC Non-Goals.

Workflow:

1. P0: re-verify the four scan paths at current HEAD against SPEC Constraints;
   decide the legitimate-zero vs vacuous boundary (`effect-fn.test.ts:258`
   asserts a lawful `scannedFiles === 0`); choose the first ceiling
   declaration site from live evidence and record it as a dated SPEC decision
   entry. Never invent a site — stop and report if none is defensible.
2. P1: schema → Effect `Context.Service` contract → implementation, in that
   order. Ceiling schema (`declaredCeiling` optional, effective authority
   min-composed at use, absence = most-restrictive) and `StopReason`
   (`completed` / `cap-reached` / `blocked`, `LiteralKit` from `@beep/schema`)
   come first, before any consumer or scanner.
3. P2: prove each law by violating it — a nothing-glob fixture must make its
   scanner fail; each `StopReason` member must be reachable and recorded.
   Rule 5 is the exception: its enforcement is the schema plus the existing
   clamp, so no scanner proves it.
4. Preserve unrelated user/worktree changes; keep decisions tied to evidence.
5. Update packet evidence/status as readiness changes.
6. At P4 Close, write the closeout reflection via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/agentic-governance-laws/GOAL.md)" -le 4000
jq . goals/agentic-governance-laws/ops/manifest.json
git diff --check -- goals/agentic-governance-laws
```

Stop and report before changing public API, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` requires it — and stop if the work would weaken the
shipped TierGate clamp.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
