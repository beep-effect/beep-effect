# GOAL: Advance the agentic professional runtime

Repo root: the current working directory - the `beep-effect` checkout you are
running in. Do not assume an absolute path. All paths below are repo-relative.

Outcome: advance one tracked law-practice phase or rung while preserving the
runtime's evidence, candidate-write, approval, and privilege boundaries.
Wealth management remains a dormant proof fixture.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/agentic-professional-runtime/README.md`
- `goals/agentic-professional-runtime/SPEC.md`
- `goals/agentic-professional-runtime/PLAN.md`
- `goals/agentic-professional-runtime/ops/manifest.json`

Read those first, then `AGENTS.md` and the standards named by `SPEC.md`.
`SPEC.md` is normative. Confirm every target against live source before editing.

Scope:

- In: the selected open phase or implementation rung; currently P1 product
  interview tightening, multi-reference section 103 plus section 101/112
  office-action handling, or P4 native first-run onboarding design.
- Preserve: deterministic tests, synthetic/public fixtures, span-bearing
  `GroundedExtraction[]`, `IrToLaw`, epistemic admission, strict candidate
  review, matter/tenant privilege boundaries, and explicit service Layers.
- Out: autonomous legal advice, silent authoritative agent writes, production
  compliance claims, restoring retired apps/packages, activating the dormant
  wealth vertical, or broad topology changes not required by the selected rung.

Workflow:

1. Read the source-of-truth order in `SPEC.md`; select one open manifest phase
   or implementation rung and state it before implementation.
2. Search live packages, barrels, tests, and docs for current symbols and
   boundaries. Do not rely on retired paths or historical package names.
3. Make the smallest schema-first, Effect-first change satisfying that phase's
   exit criteria. Use typed errors and service composition.
4. For office-action work, keep extraction provider-neutral and add
   deterministic happy-path and non-happy-path tests for each doctrine shape.
5. Preserve unrelated user/worktree changes. Update packet status/evidence only
   when the tracked phase or rung actually changes readiness.
6. Use the repo's Yeet workflow for repair, verification, publishing, and
   monitoring when shipping is authorized.

Acceptance:

- [ ] The selected phase or rung's recorded exit criteria are satisfied.
- [ ] P1 and P4 remain open unless the user's product decisions are captured.
- [ ] Agent output remains evidence-bounded candidate state pending approval.
- [ ] Required checks pass, or unrelated baseline failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors, retired topology, or formatting churn.

Verification:

```sh
test "$(wc -m < goals/agentic-professional-runtime/GOAL.md)" -le 4000
jq . goals/agentic-professional-runtime/ops/manifest.json
node goals/agentic-professional-runtime/fixtures/runtime-data-loop/validate-fixtures.mjs
git diff --check -- goals/agentic-professional-runtime
```

Stop and report before changing auth, privilege policy, tenancy boundaries,
public API outside the selected target, dependencies, lockfiles, generated
files, infrastructure, external systems of record, or destructive state.

Done only when acceptance and verification complete, or a blocker is reported
with file and command evidence.
