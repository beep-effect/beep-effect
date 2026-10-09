# GOAL: Repository Simplification and Confidence

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: retire tools without a demonstrated purpose, reach honest zero
actionable debt, and give operational claims current evidence, through the
operator's approved brief (2026-10-09).

This is a compact `/goal` launcher. The detailed contract is:

- `goals/repository-simplification-confidence/SPEC.md` (normative; locked
  dispositions, Decision Log, exceptions)
- `goals/repository-simplification-confidence/PLAN.md` (stages, lanes,
  owners, recovery, staged acceptance checklist)
- `goals/repository-simplification-confidence/research/BRIEF-2026-10-09.md`
  (the brief, verbatim)
- `goals/repository-simplification-confidence/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards SPEC.md
names. The approved brief (`research/BRIEF-2026-10-09.md`) ranks first;
otherwise higher-priority repo standards outrank packet prose (SPEC.md Source Hierarchy).

Scope:

- In: workstreams A-H in SPEC.md (retirements, standards and docs, script
  ports, private release notes, GitHub workflows, agent configuration,
  `.beep` storage and Turbo cache proof, H1-H4) and the `effect-vitest-canon`
  reconciliation.
- Out: bundler and SchemaCompiler decisions, TTC proof reuse, blanket 100%
  coverage, a Knip parity project, a general workstation configuration
  manager, another telemetry backend, and work other sessions own.

Workflow:

1. Refresh head-dependent facts against `research/baseline-2026-10-09.md`
   before editing; never adopt or discard another session's state.
2. Work in the lane PLAN.md assigns, on its model route; shared manifests go
   through the orchestrator lane.
3. Reuse existing command families, schemas, and quality workflows; follow
   the Graft discovery route first.
4. Resolve every in-scope actionable finding, including P2 and below (program
   review exception).
5. Write the lane handoff under `history/handoffs/` and record decisions in
   SPEC.md's Decision Log and friction in `research/OPPORTUNITIES.md`.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] SPEC.md acceptance criteria are satisfied with durable receipts naming
      revision or fingerprint, command, result, and timestamp.
- [ ] Each changed package passes `bun run beep quality package-verify`.
- [ ] Final-head hosted checks green, threads answered and re-read
      immediately before merge, review window elapsed, zero actionable
      program findings, PRs merged at the gate, lanes retired.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/repository-simplification-confidence/GOAL.md)" -le 4000
jq . goals/repository-simplification-confidence/ops/manifest.json
git diff --check -- goals/repository-simplification-confidence
bun run beep goals doctor
bun run beep lint reflection-artifacts
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and never break a demonstrated published or externally
consumed contract; private-only changes follow the workstream D release-note
policy (SPEC.md). Escalate only what AGENTS.md "Autonomy" lists.

Done only when the goal reaches `completed-retained` (acceptance passes,
verification is complete, closeout and reflection landed), or when a blocker
that needs the operator is reported with file/command evidence.
