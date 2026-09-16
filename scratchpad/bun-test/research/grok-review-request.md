# Adversarial Grok review: Bun tests in this Turbo monorepo

The operator explicitly requested independent Grok and Codex investigations
before trusting a Bun test migration benchmark. Act as the Grok reviewer.
Challenge the proposal; do not assume native Bun is faster or better configured.

Read-only investigation. Do not edit files, run benchmarks or tests, launch CI,
install dependencies, change services, resolve credentials, or spawn agents.
Return the complete report in your final response. Use primary Bun, Turborepo,
Vitest and Effect documentation, with direct URLs and retrieval dates. Inspect
the local files listed below; distinguish source facts, official claims, and
inferences. Do not read secret files or user configuration outside this repo.
Do not inspect the separate Codex review.

## Question and decisions

Would promoting `scratchpad/bun-test` to a canonical repo package and adopting
it where beneficial lower total CI cost per successful PR by at least 10%,
with the uncertainty range also supporting that threshold? At most 10%
regression in CI completion time or local peak memory is acceptable; no new
OOMs or correctness regressions. Partial adoption is acceptable, including
retaining Vitest for coverage.

First milestone is a local `@beep/schema` pilot: ordinary tests, the property
workload, and bounded coverage. Aggregate benchmark execution is capped at
60 minutes, including warm-ups and failed/timed-out attempts. Implementation
and analysis time are separate. There are no benchmark results yet.

## Source entry points

- `scratchpad/bun-test/BENCHMARK.md`, `index.ts`, `internal/internal.ts`,
  `utils.ts`, and `scratchpad/test/bun-test/index.test.ts`.
- `turbo.json`, `bunfig.toml`, root `package.json`, `.bun-version`, `.nvmrc`.
- `packages/foundation/modeling/schema/package.json`, `vitest.config.ts`,
  `test/JSONSchema.test.ts`, `test/ProtobufScalars.test.ts`,
  `test/TaggedError.equivalence.test.ts`, `test/Number.test.ts`,
  `test/codecStatics.test.ts`.
- `vitest.shared.ts`, `vitest.setup.ts`, `vitest.aliases.generated.json`.
- `packages/tooling/test-kit/fc-runs/src/FastCheckRuns.ts` and
  `packages/tooling/test-kit/test-utils/src/Schema.ts`.
- `.github/workflows/check.yml`, `.github/workflows/heavy.yml`.
- `standards/architecture/08-testing.md`, `standards/ARCHITECTURE.md`,
  `.claude/skills/turborepo/SKILL.md` and relevant references.

For code searches, use the repo's graft skill first; config/docs reads may use
ordinary file tools. Never trigger a paid/deep graft build or wiring change.

## Known facts to verify rather than assume

Installed versions previously read: Bun 1.4.2, Vitest 4.1.11, Effect and
@effect/vitest rc.113. Ordinary package tests already use
`bunx --bun vitest run`. Coverage uses Node/V8; hosted coverage pins Node
22.22.3 with worker Float16Array flags supplied by the shared config.

The current Turbo `test` task depends on `^transit` and is cacheable by default.
`test:property` also depends on `^transit`, hashing BEEP_FC_NUM_RUNS and
BEEP_FC_SEED. `coverage` is not cacheable but depends on `^build` and writes
coverage artifacts. Ordinary test and property inputs include the root Vitest
setup/shared files; they do not yet explicitly model a scratchpad Bun adapter.

Proposed pilot uses one arm at a time, identical selected source/tests, fixed
property floor/seed, fresh per-trial cgroup accounting, explicit workers,
test-level concurrency and isolation. A local run cannot establish total
billed savings or emulate EC2 simply by copying its CPU count.

## Adversarial questions

1. Could Turbo return cached success, omit files, filter property variables,
   miss adapter/preload/config changes, or restore stale coverage and make the
   candidate appear faster? Specify exact invalidation and execution checks.
2. What is the proper package-task/dependency/export arrangement for a pilot
   and later canonical adoption? The repo generates package script blocks;
   do not recommend hand-editing production script keys or a monolithic root
   test command. Identify dependency graph and source-import pitfalls.
3. How should we separate task-result caching, transpilation/module caches,
   and OS page cache? What comparison preserves equal work while allowing each
   runner defensible optimization? Distinguish diagnostic direct-run timings
   from real Turbo task/CI savings.
4. Match package/task parallelism, runner processes, within-file concurrency,
   isolation, mocks, preload hooks and transitive imports. Give concrete ways
   equivalent-looking flags can execute different work.
5. Is native Bun coverage an equivalent replacement for the repo's source
   inclusion, statement/branch denominators, artifacts and regression checks?
   How can a local experiment detect false green coverage? Distinguish native
   Bun coverage from hosting Vitest's V8 provider on Bun.
6. Are runtime type assertions, @beep aliases, Node/Bun API shims, module reset,
   property floors/seeds/shrinking, interruption and teardown preserved?
7. Which remaining claims require executable qualification? Propose minimal
   negative controls and a no-benchmark-until-qualified checklist.
8. What would falsify the migration hypothesis? Account for unchanged builds,
   CI cache hit rates, setup/teardown, retry costs and representative workload
   share rather than projecting a tiny-test speedup onto the entire AWS bill.

## Output

Give a short verdict, prioritized findings with file:line or primary-source
URL, a baseline/candidate configuration matrix, minimal qualification checks,
and unresolved facts. Flag disagreements between docs and installed versions.
State what you did not execute. Prefer a precise bounded report over an
exhaustive generic tutorial. Do not claim 100% correctness from inspection.
