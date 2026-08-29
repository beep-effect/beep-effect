# GOAL: Port Effect v4's JSDoc section grammar into beep law + tooling

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `@beep/*` hovers teach like Effect v4's — section grammar in law and
skill, kind-aware inventory rules on the existing ratchet, docgen compiling
examples from both carriers, proven on a three-package pilot with before/after
WebStorm hover screenshots.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/effect-jsdoc-quality/README.md`
- `goals/effect-jsdoc-quality/SPEC.md`
- `goals/effect-jsdoc-quality/PLAN.md`
- `goals/effect-jsdoc-quality/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Higher-priority repo standards outrank packet prose when they
conflict. All decisions are pre-grilled
(`explorations/effect-jsdoc-quality/DECISIONS.md`, 2026-07-30) — implement
them; do not reopen carrier/enforcement questions and do NOT re-mine
`.repos/effect` (grammar is cited to path:line in the exploration's
`research/` legs).

Scope:

- In: `.patterns/jsdoc-documentation.md` rewrite; the
  `jsdoc-annotation-specialist` skill; new rules in
  `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`;
  section-fence harvesting in `packages/tooling/tool/docgen/`; `tsdoc.json`
  hygiene; `standards/jsdoc-totals.regression-baseline.jsonc`; pilot JSDoc in
  `packages/foundation/modeling/schema`, one tooling package, one
  law-practice values slice.
- Out: mass JSDoc rewrites; `{@link}` resolution; rubric-v1 CI wiring;
  `runExamples`; category-vocabulary repair; LLMS corpus; real-semver
  `@since`; named-import examples; any `@effect/jsdocs` dependency.

Workflow:

1. Inspect referenced files and current repo state (P0).
2. P1 law + skill + hygiene; P2 inventory rules + docgen harvesting folded
   into the baseline; P3 pilot trio + hover screenshots to
   `history/outputs/`; smallest changes that satisfy `SPEC.md`.
3. Preserve unrelated user/worktree changes; stage explicit paths only.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status as phases complete.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/effect-jsdoc-quality/GOAL.md)" -le 4000
jq . goals/effect-jsdoc-quality/ops/manifest.json
git diff --check -- goals/effect-jsdoc-quality
bun run beep quality jsdoc-inventory
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
