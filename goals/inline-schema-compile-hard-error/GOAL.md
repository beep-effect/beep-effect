# GOAL: Inline Schema Compiler Hard Error

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: eliminate all remaining inline Effect Schema compiler calls governed
by `beep(no-inline-schema-compile)`, preserve behavior by compiling once at
module scope, and promote the rule from warning to error.

Read first:

- `goals/inline-schema-compile-hard-error/SPEC.md` — normative contract.
- `goals/inline-schema-compile-hard-error/PLAN.md` — sequencing.
- `goals/inline-schema-compile-hard-error/ops/manifest.json` — lifecycle.
- `goals/inline-schema-compile-hard-error/research/SOURCES.md` — 2,931-finding
  baseline and predecessor provenance.
- `packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts`
  — rule implementation and configured severity.
- `AGENTS.md`, `CLAUDE.md`, and required schema/effect skills.

Scope:

- Reproduce and classify the 2,931-finding opening census by compiler, package,
  ownership family, and generated/authored source.
- Hoist or attach each compiler once at module declaration scope without
  changing schema identity, parse options, dependency requirements, or errors.
- Fix generators before generated outputs and prevent count regression after
  each migration family.
- Remove every governed warning, promote the rule to an error, and add tests
  proving both detection and accepted module-scope patterns.
- Keep unrelated schema design, public APIs, and broad refactors out of scope.

Workflow:

1. Preserve unrelated worktree changes and verify the current census before
   editing.
2. Build a reproducible family inventory and lock zero-growth baselines.
3. Migrate generators first, then authored consumers in reviewable families.
4. Attribute every verification failure before changing unrelated code.
5. Run affected package checks, lint-rule tests, docgen, and canonical Yeet
   verification/publish/monitor.
6. Record sanitized friction in packet research when it occurs.
7. Close with `/reflect` and synchronized packet state.

Acceptance:

- [ ] The complete `SPEC.md` contract is satisfied.
- [ ] The lint rule reports zero warnings at repository scope.
- [ ] The rule is configured as an error and its focused tests are green.
- [ ] Generated sources remain reproducible from updated generators.
- [ ] Required local and hosted checks are green.

Verification:

```sh
test "$(wc -m < goals/inline-schema-compile-hard-error/GOAL.md)" -le 4000
jq . goals/inline-schema-compile-hard-error/ops/manifest.json
git diff --check -- goals/inline-schema-compile-hard-error
bun run beep goals doctor
bun run beep goals index --check
```

Stop and report if a compiler cannot be hoisted without changing behavior, the
census is not reproducible, generated ownership cannot be found, or work would
exceed the named scope.

Done only when the implementation PR is merge-ready through Yeet and the packet
is closed with a validated reflection.
