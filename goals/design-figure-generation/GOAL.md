# GOAL: Generate design-patent figure sets from one parametric solid

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `bun run beep drawings render --spec <spec.json> --out <dir>` emits
eight USPTO-compliant design-patent sheets (two perspectives, two plans, four
elevations) projected from one B-rep solid, `beep drawings validate` proves
37 CFR 1.84 / Patent Center compliance, and (slice 2) shading, a judge rubric,
and an attorney sign-off event land.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/design-figure-generation/README.md`
- `goals/design-figure-generation/SPEC.md`
- `goals/design-figure-generation/PLAN.md`
- `goals/design-figure-generation/ops/manifest.json`
- `explorations/patent-drawing-pipeline/DECISIONS.md` (eight locked decisions)

Read those first, then `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`,
and `goals/agentic-cad-patent-tooling/SPEC.md` (D6–D9 and its scoped D9 exception; shared bricks).
Higher-priority repo standards outrank packet prose when they conflict.

Scope:

- In: new `packages/drivers/*` for the replicad/OCCT kernel and pdf tools
  (`bun run beep create-package`), `packages/law-practice/{domain,use-cases,server}`
  schemas and services, `packages/tooling/tool/cli/src/commands/Drawings/`,
  a QA judge drawing rubric, synthetic fixture + golden sheets in `test/`.
- Out: image-model generation, photo→CAD, email intake, desktop surface,
  utility numeral grammar, fold features, any real article geometry/photos/
  renders in the repo.

Workflow:

1. P1 first: spike perspective HLR through replicad's public API; record the
   result in `research/` and fix the route for perspective figures.
2. Schema → `Context.Service` contract → implementation. Effect v4 only,
   `effect/process` for subprocesses, `LiteralKit` for view names.
3. Build and prove on the synthetic fixture (two-run hash stability, validator
   negatives) before touching the live matter under `BEEP_OPPOLD_CORPUS_ROOT`.
4. Run `bun run beep quality package-verify <pkg>` for every touched package.
5. Publish via yeet; keep the PR DRAFT until final. Record friction in
   `research/OPPORTUNITIES.md` as it happens.
6. At P5 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/design-figure-generation/GOAL.md)" -le 4000
jq . goals/design-figure-generation/ops/manifest.json
git diff --check -- goals/design-figure-generation
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it. Stop if any step would commit
client material.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
