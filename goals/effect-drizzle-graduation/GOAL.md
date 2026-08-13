# GOAL: graduate scratchpad/bsl into @beep/effect-drizzle (ecosystem family)

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the effect v4 + drizzle SQL DSL proven in `scratchpad/bsl` ships as
`@beep/effect-drizzle` (member root `packages/ecosystem/effect-drizzle/**`,
created in P1) inside a newly chartered `ecosystem` package family, with
family doctrine, gates, and quality lanes landed.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/effect-drizzle-graduation/README.md`
- `goals/effect-drizzle-graduation/SPEC.md`
- `goals/effect-drizzle-graduation/PLAN.md`
- `goals/effect-drizzle-graduation/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`,
`goals/effect-drizzle-graduation/research/bsl/graduation-decisions.md` (locked
operator decisions — constraints, not suggestions), and
`standards/architecture/14-ecosystem-packages.md` once P0 lands. Higher-
priority repo standards outrank packet prose when they conflict.

Scope:

- In: `standards/ARCHITECTURE.md`, `standards/architecture/**`,
  `packages/shared/tables/README.md` (one contract line),
  `packages/ecosystem/effect-drizzle/**`, the retired `scratchpad/bsl/**`
  source, this packet's `research/bsl/**`, repo lint/gate wiring for the
  family, this packet, `goals/INDEX.md`.
- Out: beep adoption of the package (BaseEntity parity, EntityTable
  replacement — a future packet), actual npm publication, new DSL features,
  any repo-wide type-test reintroduction.

Workflow:

1. Inspect referenced files and current repo state; find the active phase in
   `PLAN.md`.
2. Make the smallest change that satisfies `SPEC.md` for that phase.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Each phase lands as its own PR driven to mergeable via yeet
   (`bun run beep yeet: repair -> verify -> publish --pr -> monitor`).
6. At P2 close, write the reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect` and flip
   packet state in the same PR as the final work;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria for the active phase are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/effect-drizzle-graduation/GOAL.md)" -le 4000
jq . goals/effect-drizzle-graduation/ops/manifest.json
git diff --check -- goals/effect-drizzle-graduation
bun run beep goals index --check
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
