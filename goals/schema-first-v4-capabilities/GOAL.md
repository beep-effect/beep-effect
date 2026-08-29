# GOAL: Schema-first Effect v4 capabilities retained outcome

Repo: this `beep-effect` checkout.

Outcome: retain the shipped P0–P2 doctrine, steering, and enforcement plumbing.
P3 helper statics and remaining P4 waves are recorded deferrals; the
`SchemaRepresentation` spike is dropped.

This is a compact `/goal` launcher. Treat these packet files as the detailed
contract:

- `goals/schema-first-v4-capabilities/README.md`
- `goals/schema-first-v4-capabilities/SPEC.md`
- `goals/schema-first-v4-capabilities/PLAN.md`
- `goals/schema-first-v4-capabilities/research/reports/effect-v4-schema-capabilities.md`
- `goals/schema-first-v4-capabilities/reviews/round-01.md`
- `goals/schema-first-v4-capabilities/ops/manifest.json`

Read the scratch examples before editing production code:

- `scratchpad/index.ts` demonstrates Effect v4 Schema default combinators.
- `scratchpad/test/schema-arbitrary-fastcheck.test.ts` demonstrates
  `S.toArbitrary`, schema arbitrary annotations, FastCheck, and Faker.
- `scratchpad/test/schema-static-apis.test.ts` demonstrates `TaggedUnion`,
  `LiteralKit`, `MappedLiteralKit`, and schema-derived static APIs.

Scope:

- In: schema-first standards, schema-first skill/pattern docs, `beep lint
  schema-first` enforcement, Yeet issue surfacing, targeted schema remediation,
  and small reusable helpers where the repo has an obvious gap.
- Out: immediate repo-wide rewrites, Box generator replacement without a spike,
  public API migrations without a packet phase, and unrelated formatting churn.

Workflow: preserve the P0–P2 evidence and final false-positive/deferral ledger.
Reopen helper or remediation work only after repeated demand or a schema-heavy
wave exposes a v4 capability gap.

Acceptance:

- [x] P0–P2 evidence remains linked as the retained outcome.
- [x] Current enforcement failures are emitted by `beep lint schema-first` as
      structured `[schema-first:issue]` lines and P2 proves their Yeet issue
      shape. Future advisory rules remain phased work.
- [x] Remaining helper/remediation work and five arbitrary cases are recorded
      deferrals; the representation spike is explicitly dropped.

Verification:

```sh
test "$(wc -m < goals/schema-first-v4-capabilities/GOAL.md)" -le 4000
jq . goals/schema-first-v4-capabilities/ops/manifest.json
bunx tsc -p scratchpad/tsconfig.json --pretty false
bunx vitest run --config scratchpad/vitest.config.ts
bun run beep lint schema-first
bun run beep yeet verify --plan --json
gh pr view --json number >/dev/null 2>&1 && bun run beep yeet closeout --plan --json || true
git diff --check -- goals/schema-first-v4-capabilities scratchpad standards .claude package.json bun.lock packages/tooling/tool/cli
```

Stop and report before changing public API, schema wire formats, data
migrations, auth, infra, security behavior, generated driver output, or
dependencies beyond the packet's stated needs.
