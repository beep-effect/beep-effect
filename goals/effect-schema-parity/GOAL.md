# GOAL: Bring @beep/schema to parity with upstream Effect rc.115

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every `@beep/schema` concept whose consumed surface upstream covers is
deleted with its consumers migrated, partly covered concepts are trimmed, and
a schema-first gate plus an rc-pinned inventory hold parity on every effect
bump, with the gate's backlog at zero.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/effect-schema-parity/README.md`
- `goals/effect-schema-parity/SPEC.md` (phase contract, boundary table, facet
  census gate, decision log)
- `goals/effect-schema-parity/PLAN.md` (PR list per phase, lanes)
- `goals/effect-schema-parity/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and
`standards/architecture/11-evolution-and-deprecation.md`. Higher-priority repo
standards outrank packet prose when they conflict.

Scope:

- In: `standards/architecture/11-evolution-and-deprecation.md`, `AGENTS.md`
  Code Laws line, `packages/foundation/modeling/schema/**`,
  `packages/tooling/tool/cli/src/commands/Lint/**`,
  `packages/tooling/tool/cli/src/commands/Quality/CheckCensus.ts`,
  `packages/tooling/tool/cli/test/fixtures/effect-schema-rc115/**`, every
  consumer of a retired or trimmed concept, tracked generated baselines under
  `standards/`, skill and agent prose naming LiteralKit.
- Out: the 77 KEEP concepts; persisted or externally served encodings
  (migration goals); new `@beep/schema` abstractions; the user's global rule
  files; a new workspace package; graft, `.repos/effect` or LLM dependencies
  in hosted CI.

Workflow:

1. Find the current phase in `PLAN.md`; each phase is one or more Yeet PRs
   with the done-signal and bounce condition from `SPEC.md` §Phase Contract.
2. Before any RETIRE over 100 consumers opens its PR, run the facet census in
   `SPEC.md` §Facet Census Gate and record the outcome in the decision log.
3. Before a group D or E PR, fill the boundary table rows it touches.
4. Make the smallest change that satisfies `SPEC.md`; retire in the same PR
   as the consumer migration, no alias.
5. Regenerate tracked generated baselines each PR; run
   `bun run beep quality package-verify` on touched packages.
6. Attach before/after `--extendedDiagnostics` on the three baseline packages
   to every retirement PR (P2, each P3 PR, P5); an instantiation increase on
   any bounces; check time is advisory within 5%.
7. At P5, write the closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/effect-schema-parity/GOAL.md)" -le 4000
jq . goals/effect-schema-parity/ops/manifest.json
git diff --check -- goals/effect-schema-parity
bun run beep lint schema-first
```

Stop and report before changing a persisted or served encoding, public API
outside the named surfaces, dependencies, lockfiles, or destructive state
unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
