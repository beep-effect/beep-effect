# GOAL: CI-Ops Ontology Pipeline

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Operate the ratified CI operational ontology as a pipeline: project live admission and wave-order data through the S7 engine, hold CQ regression green, ratify auditor run 4, and state the fleet time-to-certainty verdict.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/ciops-ontology-pipeline/README.md`
- `goals/ciops-ontology-pipeline/SPEC.md`
- `goals/ciops-ontology-pipeline/PLAN.md`
- `goals/ciops-ontology-pipeline/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict. The exploration `explorations/beep-ci-operational-ontology`
is the prior record: its `BRIEF.md`, `MAP.md`, `DECISIONS.md` (graduation sitting
2026-10-01, Rulings 1-11) and `research/auditor-run4-intake.md`.

Scope:

- In: `apps/labs/ciops/**`; the exploration's `ontology/**` and `research/scripts/**`
  (append under new run or pin roots only), `research/control-interventions.yaml`,
  `research/kpi-measurement-rules.md` and the S7 contract §3.2/§6; this packet;
  `.claude/skills/ontology-foundational-auditor/**` only if optional W2 is chosen.
- Out: frozen pins and any existing byte under `ontology/extraction/**`; re-runs of
  runs 1-3 or the S5/S6/S7 baselines; S8 (IRI scheme, OWL 2 RL, rules compilation);
  any scheduler, lock or repo-cli integration of the lab; proof-reuse enforcement;
  `goals/time-to-certainty` artifacts beyond dated receipts; moving the ontology tree.

Workflow:

1. Inspect referenced files and current repo state.
2. Take the next unchecked PLAN item in order (W1 → W9); W6 opens with the S7 seam
   amendment, and run 4 waits on the graduation Ruling 1 gate.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output;
   new rulings land in `research/decisions.md`.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/ciops-ontology-pipeline/GOAL.md)" -le 4000
jq . goals/ciops-ontology-pipeline/ops/manifest.json
git diff --check -- goals/ciops-ontology-pipeline
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
