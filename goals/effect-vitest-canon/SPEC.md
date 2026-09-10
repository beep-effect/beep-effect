# Canonical Effect Vitest tests

This packet executes Benjamin's contract locked on 2026-09-04. Execution began on
2026-09-08. The locked decisions remain normative; dated counts and checkout facts
are hypotheses to refresh, not acceptance evidence. Codex is the current
orchestrator. Codex CLI lanes perform bulk work and Grok performs research and
adversarial review as requested. Authorship records must describe the actual agent.

## Objective and acceptance

Migrate every test file in the D9 scope to canonical rc.113 idioms. Completion
requires zero detector findings, an empty baseline, every judgment finding fixed
or ledgered with a reason, package verification, before/after timing evidence,
and hosted proof. Preserve tests and property floors. No coverage-lane speed
improvement is promised.

## Source hierarchy

The user contract controls scope and gates. Repository AGENTS.md and governing
standards control implementation within that scope. SPEC.md holds the contract;
PLAN.md and ops/manifest.json record execution state; GOAL.md is the launcher.

## Execution anchors

- Initial branch: `@slop/09-02-26`, source HEAD `bf6014ae31531bf4dc18f7f6eedafa96a700d876`.
- Isolated branch: `feat/effect-vitest-canon` in the sibling worktrees root.
- Current Effect and Effect Vitest: `4.0.0-rc.113`, integrated from PR #1060
  on 2026-09-10. Both release tags resolve to
  `d3b837aee836f35d625d55205f7d6e61305fc198`.
- Main supplied Vitest `4.1.11`, outside rc.113's declared `>=5.0.0 <6.0.0`
  peer range. This PR retains main's test-stack versions and verifies the
  exercised behavior on that cohort. The peer mismatch remains explicitly
  qualified; a Vitest 5 / Storybook test-stack migration is separate scope.
- Current Bun pin/runtime: `1.4.2`; Node: `24.20.0`. Earlier Bun `1.4.1`
  and rc.112 receipts retain their original provenance.
- Historical census of 955 files will be reconciled with the live census.
- Packet slug uses the proposed default while the text question remains pending.
- Scratchpad deletion remains unapproved until Benjamin answers the open decision.

## Operational routing update, 2026-09-09

Benjamin's later AGENTS instructions supersede the original model/effort example:
all token-heavy Codex implementation, exploration, review and distillation uses
`gpt-6-astra` with explicit `medium` reasoning. This supersedes the September 8
`xhigh` default for new work. Preserve the Codex CLI lane and
Grok research/adversarial assignments in D10. Historical receipts retain their
actual model. This changes operational routing, not D1-D14 or acceptance gates.

## 0. Who does what (harness contract)

The orchestrator runs in the isolated sibling worktree. Codex fills that role
in this execution, as recorded in DECISIONS.md. Bulk file reading and remediation
stay in Codex CLI lanes; Grok performs adversarial review and web research.

| Lane | Does | Never |
| --- | --- | --- |
| **Orchestrator** | design, packet docs, judgment, decisions, gating, reading distilled lane outputs, `yeet` publish/monitor/reply | bulk file reading, remediation edits at scale, adversarial review of your own work |
| **Codex `codex exec` lanes** | repo reconnaissance dumps, detector implementation, lens audits (P1), remediation waves (P2), conformance-suite port | git commands inside a lane, edits outside the lane's owned files, `bun run check` when another lane shares the package |
| **Grok headless lanes** | the adversarial review rounds (P0f, P1 close) and every web research task (P0a) | editing repo files other than their own report path |

**Codex lane invocation** (explicit effort and the authorized session permission profile):

```bash
codex exec -m gpt-6-astra -c 'model_reasoning_effort="medium"' \
  -c 'approval_policy="never"' -c 'sandbox_mode="danger-full-access"' \
  --cd <worktree> "<lane prompt>" </dev/null
```

Use `medium` for token-heavy work under the later user instruction above. Lane prompt
contract (paste into every lane): disjoint file ownership with the full lane map; absolute
no-git-commands rule; create the report file within the first actions and append as you go; the
final message is a pointer to the report, never the report; package-verify is run by you (the
orchestrator), not by lanes that share a package.

**Grok lane invocation** (`~/.local/bin/grok` 1.0.24, verified 2026-09-09):

```bash
grok --prompt-file <lane.prompt.md> --output-format streaming-json \
  --max-turns 60 --no-subagents --cwd <worktree>
```

For local adversarial source review, also pass `--disable-web-search`. Preserve
the configured Grok model route. The current CLI does not support the original
packet's `--no-auto-update` flag; omit it without changing runtime configuration.
The Codex permission flags above preserve Benjamin's current Full access /
Never ask authorization for these lanes.

Gotchas that have burned prior runs: never pass a `--tools` allowlist (it silently kills search);
pin an explicit output path and tell the lane to write the file itself; extract text with
`jq -rj 'select(.type=="text") | .data'` only as a fallback and keep the raw jsonl; for pure
reasoning rounds prefix `DO NOT USE ANY TOOLS. Everything you need is in this prompt.` and use
`--disable-web-search --max-turns 12`. Lanes with `max-turns` exhausted die before writing, so
report-first is mandatory.

Quota doctrine: Anthropic, OpenAI and xAI pools are separate. Routing is quota arbitrage.

## 1. Ground truth

The rc.113 amendment below follows Benjamin's explicit upgrade instruction.
Historical census and earlier proof sections retain their dates; they do not
establish compatibility with the current release.

### 1.1 Versions and pins

- Installed `effect` and `@effect/vitest`: **4.0.0-rc.113** (root catalog and
  frozen lockfile, verified 2026-09-10).
- Immutable tags `@effect/vitest@4.0.0-rc.113` and `effect@4.0.0-rc.113`
  both resolve to `d3b837aee836f35d625d55205f7d6e61305fc198`. Read tagged
  source from the provisioned reference repository or the verified archive,
  never its moving HEAD. For example, with the reference symlink available:

```bash
git -C .repos/effect show '@effect/vitest@4.0.0-rc.113:packages/vitest/src/internal/internal.ts' | rg -n '<pattern>'
```

  Installed index, utils, internal runner source and README match the tag byte
  for byte. Runtime proofs must also establish the installed dependency pair.

### 1.2 `it.layer` semantics at rc.113

The pinned graph records current source ranges. Each block caches one built
Layer context and closes its shared scope once. Each inner Effect test still
runs under its own scoped body with that context. Nested blocks fork the parent
memo map and reuse outer instances.

Named blocks acquire in beforeAll and release in afterAll. Anonymous blocks
collect their non-skipped tasks, acquire through filtered beforeEach hooks and
release after the last task through onTestFinished, with afterAll as a cleanup
fallback. Shared-layer cleanup does not inherit the last test's aborted signal.
Hook acquisition timeout and body timeout are separate limits.

TestClock and TestConsole are shared across the block unless test services are
excluded. Time advanced by one test remains visible to later tests. Plain
it.effect provides fresh test services per test; it.live supplies none.
Named layer suites accept a concurrent option, including nested overrides.
Anonymous layers inherit their enclosing suite's concurrency. Use ctx.expect
for concurrent assertion counts and snapshots; concurrency does not isolate
shared resources or the shared TestClock.

Per-test Effect.provide(layer) still builds into a fresh scope per run. Expensive
containers, temporary resources and servers therefore need the shared-layer
judgment specified by D14. Cheap pure stubs remain exempt.

### 1.3 `it.prop` at rc.113

Sync it.prop, it.effect.prop and it.live.prop all accept tuple or record inputs
containing Schemas or native Arbitrary values from effect/unstable/arbitrary.
FastCheck Arbitraries and the old fastCheck option are unsupported. The option
is arbitrary: Arbitrary.CheckOptions, with runs, seed, replay, size, maxDiscards
and maxShrinks. Preserve generator constraints and failure/shrinking semantics
when translating older tests; this is more than a field rename.

Use `{ arbitrary: fcRuns(n) }` for explicit repository run floors. The current
@beep/fc-runs helper returns native runs/seed options and honors BEEP_FC_NUM_RUNS
and BEEP_FC_SEED. Native Arbitrary has no global configuration, so omitting the
option does not inherit the CI floor. PR properties must retain the 400-run
floor and seed 20260708; nightly retains its higher floor.

Callbacks receive generated values and TestContext. Effect/live callbacks return
Effect; synchronous callbacks must not return Effect or Promise. Returning false,
throwing or failing an Effect falsifies the property and triggers shrinking;
normal non-false completion passes. The test abort signal cancels generation,
evaluation and shrinking. Synchronous JavaScript that never returns cannot be
preempted. The instrumented runner must keep one lifecycle and one absolute
watchdog deadline across the complete property registration, including shrinking.

### 1.4 Repo census (rg, 2026-09-04, excluding `.claude/worktrees`)

| Surface | Count |
| --- | --- |
| Test files in scope (apps + packages 945, infra 10) | 955 |
| Stale copies under `.claude/worktrees/` (excluded) | 986 |
| `scratchpad/` tests (excluded, lab) / packet fixtures under goals+explorations (excluded) | 80 / 5 |
| Files importing `@effect/vitest` / plain `vitest` | 807 / 187 |
| Files using `it.effect` / `it.live` / `it.layer` / `it.flakyTest` | 494 / 40 / 27 / 0 |
| `it.prop` + `it.effect.prop` sites | 3 in 2 files (`drivers/pacer`, `capability/semantic-web`) |
| `fc.assert(` sites | 468 in 306 files |
| `Effect.runPromise` / `Effect.runSync` inside test files | 1,580 in 174 files |
| `Effect.provide(` inside test files | ~232 |
| `Effect.scoped` inside test files | 413 in 160 files |
| `Effect.exit(` / `Effect.result(` | 511 in 115 / 28 in 13 |
| Hand-rolled Option/Result/Exit assertions (`expect(O.isSome…)`, `toEqual(O.some…)`, …) | 631 in 196 files |
| Files importing `@effect/vitest/utils` | 1 |
| `it.effect` files using `expect` / using `assert.` | 480 / 40 |
| `withTempDirectory(` / `withTempWorkingDirectory(` / `withTempRepo(` / `withAdmissionTempRoot(` / `withEnvVar(` calls | 461 / 221 / 90 / 85 / 69 |
| `BunFileSystem` or `NodeFileSystem` in test files / raw `node:fs` imports | 74 / 6 |
| `Effect.sleep` in test files / files touching `TestClock` | 46 in 20 / 29 |
| `vi.mock` / `vi.spyOn` files | 22 |
| Test files that look retry-hand-rolled (`retry|attempts`) | 85 (needs judgment) |

Heaviest packages by test files: `foundation/modeling` 177, `tooling/tool` 165 (repo-cli, 2,977
tests, ~10 min under coverage), `apps/professional-desktop` 57, `tooling/library` 55,
`foundation/capability` 52, `foundation/ui-system` 46.

### 1.5 Existing kit (extend, never duplicate)

- `@beep/test-utils` (`packages/tooling/test-kit/test-utils/src`): `Entity.ts`,
  `FastCheckRuns.ts` (re-exports `@beep/fc-runs`), `Layer.ts` (`provideScopedLayer`),
  `Schema.ts` (`assertSchemaArbitraryDecodesToSelf`, 65 call sites), `SqlTest.ts`
  (`makeSqlTestLayer`, drivers bun-sqlite / node-sqlite / pglite-testcontainers /
  pglite-inprocess / pg-external, `TestDatabaseInfo` service), `SystemTemp.ts`.
- `@effect/vitest/utils` (tag `utils.ts`, 327 lines): `fail` 31, `deepStrictEqual` 41,
  `notDeepStrictEqual` 51, `strictEqual` 61, `assertEquals` 75, `doesNotThrow` 88,
  `assertInstanceOf` 102, `assertTrue` 117, `assertFalse` 127, `assertInclude` 137,
  `assertMatch` 151, `throws` 163, `throwsAsync`, `assertNone` 217, `assertDefined` 227,
  `assertUndefined` 242, `assertSome` 257, `assertSuccess` 275, `assertFailure` 289,
  `assertExitFailure` 307, `assertExitSuccess` 321.
- `@effect/vitest` public surface (rc.113 `index.ts`, 285 lines): namespace `Vitest` (`Test`,
  `Tester` with `skip/skipIf/runIf/only/each/fails/prop`, `MethodsNonLive`, `Methods`),
  `addEqualityTesters`, `effect`, `live`, `layer` (options `memoMap`, `timeout`,
  `excludeTestServices`, `concurrent`), `flakyTest`, `prop`, `it`, `makeMethods`, `describeWrapped`, and
  `export * from "vitest"`.
- Upstream canon to mirror: `packages/sql/pg/test/utils.ts` (`PgContainer` service with
  `layer`, `layerClient`… built with `Layer.unwrap` + `Layer.provide`), the nine
  `packages/sql/pg/test/*.test.ts` files (`it.layer(PgContainer.layer, { timeout: "30 seconds" })`,
  per-test connections inside the shared container), `packages/platform/node-shared/test/NodeFileSystem.test.ts`
  (cheap layer provided per test, `Deferred` + `Effect.forkChild` + `TestClock.withLive` for
  watch tests), `packages/effect/test/unstable/persistence/SqlCleanupTest.ts` (`Effect.repeat` +
  `Effect.timeout` + `TestClock.withLive` wait helper), and
  `packages/effect/test/FileSystem.test-utils.ts` (`testLayer`, 565 lines at rc.113).
  The shared helper now ports all 36 registrations, including the new
  invalid-size/cursor/stream cases. Node and Bun each pass all 108 adapter
  cases, with full package and unchanged coverage-floor proof. The 435-line
  rc.112 port remains historical evidence.

### 1.6 The Coverage Regression premise, corrected

The lane runs on `beep-ec2-heavy` with an 80-minute cap (`.github/workflows/heavy.yml`). Last 15
hosted runs: 680–972 s. The 2026-08-24 evidence sweep (25.7 % failure rate, 0 timeouts, 0 infra)
attributed ~93 % of failures to ratchet baseline content; #799 / #806 / #809 have since shipped
env pinning, dependents scope and scoped remediation. **Idiom migration is a correctness,
hang-prevention and idiom win with targeted speed wins where layers are expensive. It is not
promised as the lane fix.** Timings are evidence, measured per package (D1).

### 1.7 Doctrine drift you must resolve

`.patterns/testing-patterns.md:62` says "Never use expect with it.effect" while
`standards/architecture/08-testing.md:70` uses `expect` inside `it.effect`. D5 settles it.

### 1.8 MemoryFileSystem state

- `scratchpad/MemoryFileSystem/` — Benjamin's schema-first rewrite: `MemoryFileSystem.ts` facade
  (`make`, `layer`), `internal/memoryFileSystem.ts` (2,882 lines, `S.Class` inodes, `LiteralKit`),
  `scratchpad/test/MemoryFileSystem/MemoryFileSystem.test.ts` (224 lines) with a TODO for the
  upstream conformance suite. Committed in `aac17e843f`. No seed / fault / inspect API.
- `scratchpad/memfs/` — older facade (seeding, fault injection, sync inspection) over a vendored
  engine ported from Effect-TS/effect PR #6573 head `c0528bd5`; its adaptation ledger
  (`.claude/design/effected/packages/memfs.md`) no longer exists.
- Upstream v4 ships no in-memory `FileSystem` (only `FileSystem.layerNoop`).

### 1.9 Packet and CLI facts

- `beep goals bootstrap` has **no writer** (plan-only). Hand-author from `goals/_template`
  (`README.md`, `SPEC.md`, `PLAN.md`, `GOAL.md` ≤ 4,000 chars — verify with `wc -m`,
  `ops/manifest.json`, `research/SOURCES.md`, `history/reflections/`). Verify with
  `bun run beep goals doctor` and `bun run beep goals index`.
- Lint precedent to copy: `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts` +
  `internal/SchemaFirst{Detectors,Policy,Project,Scan,Store}.ts`, baseline
  `standards/schema-first.inventory.jsonc` (scope globs + entries with `status: exception` and
  `reason`), ratchet via `internal/ratchet` (`diffMembership`), registered in the cheap-gates lane
  (`commands/Quality/internal/GithubChecks.ts`, `cheap-gates:schema-first`).
- Inventory precedent: `goals/repo-crispening-orchestration/ops/inventory/S1/beep__acp.json`
  (per-package arrays of `{ruleId,file,line,symbol,smell,proposedTarget,confidence,mechanization,…}`).
- `bun run beep topo-sort` prints 145 workspace names, dependencies first.
- Worktrees: `bun run beep worktree new <name> -b <branch>` creates a sibling worktree from the
  current HEAD. This checkout is on `@slop/09-02-26` @ `67ff02b538`, clean.
- Packet prose gates: inline spans like `beep <net-new-subcommand>` or a
  not-yet-existing `standards/<file>` path fail the knowledge gates on committed markdown. Put
  net-new commands in fenced blocks or write `beep lint effect-vitest` without `bun run`.

## 2. Locked decisions — do not relitigate, do not re-grill

| # | Decision |
| --- | --- |
| D1 | **Objective** = canonical idiom migration across every in-scope test file. Acceptance = zero remaining detector findings + every judgment finding fixed or ledgered. Per-package before/after test durations are recorded as evidence; lane speed is measured, never promised. |
| D2 | **Inventory artifacts** = one schema-validated JSONL finding row per (file, line, lens, rule) under `goals/<slug>/ops/inventory/<lens>/<package>.jsonl` plus one markdown digest per package. Never per-test-file markdown. |
| D3 | **Mechanical detectors first**; the four LLM lenses audit only the residue (judgment classes). |
| D4 | **Detector home** = new `beep lint effect-vitest` in repo-cli — the cheapest strict medium: ts-morph **syntax-only** project over the test globs (`skipAddingFilesFromTsConfig`, no type checker, no full-repo project), full scan every run (target ≤ 10 s), registered in the **cheap-gates** lane next to `schema-first`, committed baseline `standards/effect-vitest.inventory.jsonc`, ratchet fails on any new instance, exceptions require `reason`, and the baseline must be **empty** when the packet closes (zero tolerance from then on). |
| D5 | **Assertions inside `it.effect`**: Option / Result / Exit values are asserted with `@effect/vitest/utils` helpers (`assertSome`, `assertNone`, `assertSuccess`, `assertFailure`, `assertExitSuccess`, `assertExitFailure`, …); `expect` stays legal for plain values. Correct `08-testing.md` examples and soften `.patterns/testing-patterns.md` to match. |
| D6 | **Flakes**: root cause first (TestClock, event-driven waits, scope). `it.flakyTest` only for external nondeterminism (container start, network, OS timing), each with a `reason` row and a follow-up. Never a longer timeout as a fix. |
| D7 | **Observability** = an instrumented `it` in `@beep/test-utils` composed from public `@effect/vitest` API (`makeMethods`, tester wrapping): start/end/duration/outcome logs through a Logger layer gated by `BEEP_TEST_TRACE=1` or CI, plus a live-clock watchdog under the vitest timeout that fails naming the test and the last log line. `it.live` is reserved for tests that genuinely need the live clock or console. No `it.live` conversions for logging. |
| D8 | **MemoryFileSystem** enters as **P0.5**: port upstream `testLayer` into `@beep/test-utils`, run it against Node, Bun and Memory, promote `scratchpad/MemoryFileSystem` to `@beep/test-utils` only when green. Fold the `memfs` seed/fault/inspect facade on top only if P1 rows show codemod/generator tests need seeded volumes. Resource Authoritarian owns it. |
| D9 | **Scope** = `apps/**`, `packages/**`, `infra/**` test files (955) plus `**/test/**/*.ts` support modules for wrapper-definition findings. Excluded: `scratchpad/**` (lab; only the MemoryFileSystem test graduates with its module), `.claude/**`, `goals/**`, `explorations/**`, `docs/**`, `node_modules`. |
| D10 | **Harness** = Fable orchestrates; Codex `codex exec` lanes do heavy lifting; Grok headless does adversarial rounds and web research. Lens charters live in `goals/<slug>/ops/prompts/*.md` and are injected into lane prompts — **not** `.claude/agents` subagent files. |
| D11 | **Knowledge graph** = `standards/effect-vitest.primitives.jsonc`, one entry per export and README section, pinned to the rc.113 tag, decoded by an `S.Class` in the lint command, used for remediation hints, and the lint command **fails when the installed `@effect/vitest` version no longer matches the pin**. |
| D12 | **P2 lens order per package** = scope → assertions → property → flake → observability. |
| D13 | **PRs** = one per topological wave capped near 150 changed files; `foundation/modeling` and `tooling/tool` ship alone. Each PR carries package-verify proofs and before/after timings. |
| D14 | **Provide rule** = `it.layer` required for any scoped or effectful layer (`Layer.effect`, `Layer.scoped`, `Layer.unwrap`, `acquireRelease`, containers, filesystems, servers, every `withXyz` wrapper). Per-test `Effect.provide` allowed only for pure `Layer.succeed` / `Layer.mock` stubs. Unresolvable constructors go to the Resource lens for judgment. |

Two items remain open for Benjamin (ask once, at P0b): the packet slug (proposed
`effect-vitest-canon`), and whether the P0.5 promotion PR deletes both scratchpad copies
(recommended: yes, one source of truth).

## 4. Non-goals and stop conditions

Non-goals: coverage ratchet policy, CI lane topology, production code changes other than schema
sharpening demanded by property findings (each such change is its own finding row and is called
out in the PR body), Bun's test runner, editing `.repos/effect`.

Ask Benjamin before: promoting MemoryFileSystem without green conformance, deleting any test,
adding `it.flakyTest`, changing vitest configs or timeouts globally, touching the
`vitest.setup.ts` floors, writing any coverage baseline row for a package the PR did not touch,
merging anything.

## 5. Artifact schemas (author as `S.Class` in the lint command; JSONL rows are encoded forms)

### 5.1 Finding row (`EffectVitestFinding`)

```ts
{
  id: string,                 // `${ruleId}:${file}:${line}` or a lens-minted uuid for judgment rows
  lens: "detector" | "resource" | "flake" | "property" | "observability",
  ruleId: string,             // EV001… for detectors; L-RES-01… for lens rules
  package: string,            // @beep/* owner from the census
  file: string, line: number, endLine?: number,
  symbol?: string, testName?: string,
  class: string,              // short class name, or "no-findings"
  evidence: string,           // ≤ 200 chars, the offending snippet
  replacement: { primitive: string /* KG id */, sketch: string },
  severity: "blocker" | "major" | "minor" | "info",
  confidence: number,         // 0..1
  mechanization: "detector" | "judgment",
  status: "open" | "fixed" | "exception",
  reason?: string,            // required when status = exception or ruleId is a flakyTest wrap
  fixSha?: string
}
```

### 5.2 Package digest (`ops/inventory/digests/<package>.md`)

Sections: totals per lens and severity; top 10 files by row count; the package's layer topology
(which shared resources exist, which are rebuilt per test today); MemoryFileSystem candidates;
flake history for the package (hosted failures in the last 30 days, from `gh run` / lane
timings); recommended wave order inside the package.

### 5.3 KG entry (`EffectVitestPrimitive`)

```ts
{
  id: string,                 // e.g. "it.layer", "utils.assertSome", "readme.resource-safety"
  name: string,
  kind: "method" | "tester-method" | "function" | "type" | "option" | "readme-section",
  file: string, startLine: number, endLine: number,   // at the pinned tag
  signature: string,
  description: string, whenToUse: string, whenNotToUse: string,
  replaces: ReadonlyArray<string>,                   // ruleIds from §7
  example: string,                                    // compiles at rc.113
  gotchas: ReadonlyArray<string>
}
```

### 5.4 Timing summary (`ops/inventory/timings/{baseline,after}/<package>.json`)

`{ package, runner: "node-vitest", capturedAt, totalMs, testCount, files: [{ file, ms, tests }],
slowest: [{ file, testName, ms }] }` derived from the vitest JSON reporter output.

## 6. Lens charters (compact; expand into `ops/prompts/*.md` in P0e)

### 6.1 Resource & Dependency Authoritarian (owns D8, D14; P2 scope step)

Rules: share the expensive outer resource through `it.layer`, keep the per-test inner resource
scoped to the test body (`fs.makeTempDirectoryScoped()`, a fresh connection, a distinct table);
no `Effect.scoped` inside `it.effect` / `it.live` bodies (the runner owns the scope); every
`withXyz` wrapper is deleted in favor of `it.layer` + scoped resources or `MemoryFileSystem`;
`{ timeout: "30 seconds" }` on container / server layers; nested `it.layer` for sub-dependencies;
SQL fixtures go through `makeSqlTestLayer` inside `it.layer`; `provideScopedLayer` call sites are
audited (most become `it.layer`). Gotchas to enforce: TestClock persists across a block (reset per
test or `excludeTestServices: true` + explicit provide when tests adjust time); `Layer` values are
memoized by identity inside a block, so a shared `MemoryFileSystem.layer` is one volume (make a
fresh layer per block when isolation matters); an `it.layer` build failure dies the whole block
(`Effect.orDie`), which is desired.

Canonical shape:

```ts
import { assert, it } from "@effect/vitest"
import { Effect, FileSystem } from "effect"
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem"

it.layer(MemoryFileSystem.layer)("PackageGenerator", (it) => {
  it.effect("writes the barrel", Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = yield* fs.makeTempDirectoryScoped()   // released by this test's own scope
    yield* generatePackage(dir)
    assert.isTrue(yield* fs.exists(`${dir}/src/index.ts`))
  }))
})
```

### 6.2 Flake Detective (owns D6; P2 flake step)

Attribute before touching: did the commit touch the package, did the job pass on an earlier run of
the branch, what is the local duration vs the CI timeout. Known repo classes: wall-clock polling of
an Atom registry (fixed in #975 by subscribing; TestClock cannot drive the detached registry
scheduler, so such tests are `it.live` with a named `Effect.timeoutOrElse`), `Effect.sleep` or a
`Schedule` under `it.effect` with no `TestClock.adjust` (hangs until the vitest timeout), unseeded
property tests surfacing latent bugs, EPIPE teardown in spawned writers, suite-order coverage arms,
container startup exceeding the hook timeout. Evidence sources: `gh run list` / `gh run view`,
`bun run beep ci lane-timings --runs 30`, the hosted job logs
(`gh api repos/{owner}/{repo}/actions/jobs/<id>/logs`). `it.flakyTest` only per D6, always with a
`reason` row and a follow-up issue.

### 6.3 Property Tester (P2 property step)

Use production Schemas with it.prop for synchronous laws or it.effect.prop for
Effect-returning laws. Migrate direct legacy or native arbitrary checks into
these registrations with `{ arbitrary: fcRuns(n) }`, preserving seeds, floors,
replay and domain coverage. When a generated value crosses an invalid production
boundary, sharpen that production schema or its native arbitrary annotation.
Do not substitute a weaker test-only schema. Bound recursive generators and
collections with valid domain constraints instead of reducing trials or raising
timeouts. Reuse assertSchemaArbitraryDecodesToSelf for round-trip laws where it
fits. Reproduce the CI floor and seed with BEEP_FC_NUM_RUNS=400 and
BEEP_FC_SEED=20260708.

### 6.4 All Seeing Eye (owns D7; P2 observability step)

Design the instrumented it in @beep/test-utils using public APIs. Preserve the
complete tester surface, named/anonymous/nested layer callbacks and their
TestEnv behavior. Record start, end, duration, outcome and last observed log
through Effect logging, enabled only by BEEP_TEST_TRACE=1 or CI. Preserve user
loggers, test-console behavior, failures, interruption and finalizers.

Use a live-clock watchdog that beats the resolved Vitest task timeout. Use
TestClock.withLive only when TestClock is installed; live and excluded-test-service
modes need the actual live clock without that assumption. Do not advance virtual
time or change global limits. Each property registration shares one absolute
deadline across setup, trials and shrinking, with isolated state for overlapping
registrations. A layer acquisition timeout does not determine the body deadline.
Disabled timeouts require explicit handling. Validate every public integration
seam against the tag and installed runtime. P1/P2 timing evidence comes from the
Node Vitest JSON reporter, not instrumentation duration.

## 7. Initial detector rule table (counts are rg estimates from 2026-09-04; detectors recount)

| Rule | Class | Estimate | Replacement (KG id) |
| --- | --- | --- | --- |
| EV001 | `Effect.runPromise` / `runSync` / `runFork` inside a test callback | 1,580 / 174 files | `it.effect` or `it.live` (module-scope `runSync` for pure fixture construction is allowed) |
| EV002 | `Effect.provide(<non-stub layer>)` inside an `it.effect` / `it.live` body (D14) | ~232 | `it.layer` |
| EV003 | `withXyz(...)` as the test body root, or a wrapper definition in a test support module | 461 + 221 + 90 + 85 + … | `it.layer` + scoped inner resource, `MemoryFileSystem` |
| EV004 | `Effect.scoped` inside an `it.effect` / `it.live` body | 413 / 160 | delete (runner owns the scope) |
| EV005 | `Effect.result` used to assert an outcome | 28 / 13 | `Effect.exit` + `assertExitSuccess` / `assertExitFailure` / `assertSuccess` / `assertFailure` |
| EV006 | Hand-rolled Option / Result / Exit assertions via `expect` | 631 / 196 | `utils.assertSome` / `assertNone` / `assertSuccess` / `assertFailure` / `assertExit*` |
| EV007 | Direct `fc.assert(fc.property|asyncProperty(...))` inside a test | 468 / 306 | `it.prop` / `it.effect.prop` with native `arbitrary: fcRuns(n)` floors |
| EV008 | `Effect.sleep` / `Schedule` under `it.effect` with no `TestClock.adjust` in the same test | ⊂ 46 / 20 | `TestClock.adjust`, or `it.live` with a reason |
| EV009 | `it.live` with no evident live-clock / live-console need | 40 files | `it.effect` (+ instrumented `it` for logs) |
| EV010 | `node:fs`, `BunFileSystem` / `NodeFileSystem` layers, `os.tmpdir` in tests whose subject only needs `FileSystem` | 74 + 6 files | `MemoryFileSystem.layer` via `it.layer`; real platform layers only for platform-lifecycle assertions |
| EV011 | `from "vitest"` in a test file that imports `effect` | ⊂ 187 | `@effect/vitest` (`export * from "vitest"` covers the rest) |
| EV012 | `vi.mock` / `vi.spyOn` on Effect services | 22 files | `Layer.mock` / `Layer.succeed` stubs |
| EV013 | Hand-rolled retry / attempt loops in tests | 85 files (judgment) | root cause, or `it.flakyTest` with reason (D6) |
| EV014 | `it.layer` over a container / server / scoped layer without a `timeout` option | ⊂ 27 | `{ timeout: "30 seconds" }` |
| EV015 | `TestClock.adjust` inside an `it.layer` block without per-test reset | judgment | reset per test or `excludeTestServices` |

Every rule: precise AST predicate, at least one positive and one negative fixture test, a
false-positive escape hatch (`status: exception` + `reason`), and the KG `replaces` back-link.

## 8. Delivery rules (repeat in every lane and every PR)

- Yeet is the only publish path: `bun run beep yeet publish --start-pr-early --monitor --pr --message "..."`,
  then `bun run beep yeet monitor` until `merge-ready: yes`; answer every review thread via
  `bun run beep yeet reply`; never merge unless Benjamin asks.
- Merge `origin/main` into the branch before every publish (stale-base guard); never force-push.
- Commit trailers: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; PR footer:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Attribute red checks before repairing; a `Coverage Regression` red on an untouched package is
  never fixed by writing its baseline from this branch.
- Docgen: `bun run docgen:local` in edit loops; JSDoc on every new export per
  `.patterns/jsdoc-documentation.md` (titled **Example** sections, never `@example`).
- Every workspace package a lane edits gets `bun run beep quality package-verify <@beep/pkg>`
  before handoff.
