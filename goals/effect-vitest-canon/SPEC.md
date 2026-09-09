# Canonical Effect Vitest tests

This packet executes Benjamin's contract locked on 2026-09-04. Execution began on
2026-09-08. The locked decisions remain normative; dated counts and checkout facts
are hypotheses to refresh, not acceptance evidence. Codex is the current
orchestrator. Codex CLI lanes perform bulk work and Grok performs research and
adversarial review as requested. Authorship records must describe the actual agent.

## Objective and acceptance

Migrate every test file in the D9 scope to canonical rc.112 idioms. Completion
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
- Installed Effect and Effect Vitest: `4.0.0-rc.112`; installed Vitest: `4.1.11`.
- Reference tag commit verified as `2600f62f4532026928454dcea8d1c48557b3f942`.
- At P0a start, Bun runtime and .bun-version both selected `1.4.1`. During P0c,
  the workstation's `latest` runtime moved to `1.4.2`; the repository pin remains
  `1.4.1`. Use the installed pinned runtime for acceptance and record provenance.
- Historical census of 955 files will be reconciled with the live census.
- Packet slug uses the proposed default while the text question remains pending.
- Scratchpad deletion remains unapproved until Benjamin answers the open decision.

## Operational routing update, 2026-09-08

Benjamin's later AGENTS instructions supersede the original model/effort example:
all token-heavy Codex implementation, exploration, review and distillation uses
`gpt-6-astra` with explicit `xhigh` reasoning. Preserve the Codex CLI lane and
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
codex exec -m gpt-6-astra -c 'model_reasoning_effort="xhigh"' \
  -c 'approval_policy="never"' -c 'sandbox_mode="danger-full-access"' \
  --cd <worktree> "<lane prompt>" </dev/null
```

Use `xhigh` for token-heavy work under the later user instruction above. Lane prompt
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

## 1. Ground truth (verified 2026-09-04 — do not re-derive, do re-verify anchors at the tag)

### 1.1 Versions and pins

- Installed `effect` and `@effect/vitest`: **4.0.0-rc.112** (root `package.json` catalog).
- Reference checkout `.repos/effect` → `~/YeeBois/dev/effect` (fork, branch `main`). Its
  `packages/vitest/src` has **moved past rc.112** (`it.prop` engine rewrite to
  `effect/unstable/arbitrary`). Everything in this packet pins to the tag
  `@effect/vitest@4.0.0-rc.112` = `2600f62f4532026928454dcea8d1c48557b3f942` (2026-08-25).
  Read source at the tag, never at HEAD:

```bash
git -C .repos/effect show '@effect/vitest@4.0.0-rc.112:packages/vitest/src/internal/internal.ts' | rg -n '<pattern>'
```

  The installed dist `node_modules/@effect/vitest/dist/internal/internal.js` is the runtime truth
  and matches the tag.

### 1.2 `it.layer` semantics (tag `internal.ts`, verified line by line)

- `layer` starts at line 213. One `Scope` per block (242); the build is `Effect.cached` (245) so
  the layer is built **once per block**, finalizers run once when the block scope closes.
- Every inner `it.effect` runs its body under its **own** `Effect.scoped` and then
  `Effect.provide(context)` with the cached built `Context`, not the Layer (263-264). Nothing is
  rebuilt per test.
- Nested `it.layer` forks the memo map (275): outer instances are reused by the inner block.
- Named form `it.layer(L)("name", …)` builds in `beforeAll` (318) and closes in `afterAll`.
  Unnamed form builds lazily on the block's first test and closes after its last test (298-305).
- **TestClock is shared across the block**: `TestEnv` (line 44, TestConsole + TestClock) is merged
  into the shared build unless `excludeTestServices: true`. Time advanced in test 1 persists into
  test 2. Plain `it.effect` provides a fresh `TestEnv` per test (356); `it.live` provides no test
  services at all (357).
- The build runs inside a vitest hook (default hook timeout). Upstream passes
  `{ timeout: "30 seconds" }` for containers.
- `it.flakyTest` (331) = `Effect.scoped` + `Effect.sandbox` + `Effect.retry(Schedule.recurs(10)`
  while elapsed ≤ timeout, default 30 s)` + `Effect.orDie`.

Per-test `Effect.provide(layer)` (`.repos/effect/packages/effect/src/internal/layer.ts:8-22`,
read at HEAD — re-verify at tag `effect@4.0.0-rc.112`): `scopedWith` opens a **fresh scope per
run** and `buildWithScope` rebuilds the layer into it. N tests = N acquisitions and N releases of
the container, temp dir, pglite instance or server. The `withXyz(...)` wrappers do the same thing
by hand, e.g. `packages/tooling/tool/cli/test/yeet.test.ts:237` (`acquireUseRelease` of a real
temp dir **plus** a rebuilt platform layer per call). 37 test files define their own copy.

### 1.3 `it.prop` at rc.112 (differs from checkout HEAD)

- Sync `it.prop(name, arbs, fn)` uses FastCheck directly and **throws
  `"Schemas are not supported yet"`** for Schema inputs; it needs `fc` Arbitraries.
- `it.effect.prop` / `it.live.prop` accept Schemas (`Schema.toArbitrary(schema)(fc)`) or `fc`
  Arbitraries; the options key is `fastCheck?: FC.Parameters<…>` (numRuns, seed…), **not**
  `arbitrary`. HEAD's README paragraph about shrinking and interruption does not apply to rc.112.
- Repo floors: `fcRuns(n)` from `@beep/fc-runs` are floors raised by `BEEP_FC_NUM_RUNS` (PR
  Property lane 400 + `BEEP_FC_SEED=20260708`, nightly 1000); root `vitest.setup.ts` installs the
  global floor and `addEqualityTesters()`. `it.prop` sites that pass no params inherit the global
  floor; sites that pass `fastCheck.numRuns` must use `fcRuns` to keep the floor.

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
- `@effect/vitest` public surface (tag `index.ts`, 259 lines): namespace `Vitest` (`Test`,
  `Tester` with `skip/skipIf/runIf/only/each/fails/prop`, `MethodsNonLive`, `Methods`),
  `addEqualityTesters`, `effect`, `live`, `layer` (options `memoMap`, `timeout`,
  `excludeTestServices`), `flakyTest`, `prop`, `it`, `makeMethods`, `describeWrapped`, and
  `export * from "vitest"`.
- Upstream canon to mirror: `packages/sql/pg/test/utils.ts` (`PgContainer` service with
  `layer`, `layerClient`… built with `Layer.unwrap` + `Layer.provide`), the nine
  `packages/sql/pg/test/*.test.ts` files (`it.layer(PgContainer.layer, { timeout: "30 seconds" })`,
  per-test connections inside the shared container), `packages/platform/node-shared/test/NodeFileSystem.test.ts`
  (cheap layer provided per test, `Deferred` + `Effect.forkChild` + `TestClock.withLive` for
  watch tests), `packages/effect/test/unstable/persistence/SqlCleanupTest.ts` (`Effect.repeat` +
  `Effect.timeout` + `TestClock.withLive` wait helper), and
  `packages/effect/test/FileSystem.test-utils.ts` (`testLayer`, 435 lines, identical at tag and
  HEAD — the FileSystem conformance suite).

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
| D11 | **Knowledge graph** = `standards/effect-vitest.primitives.jsonc`, one entry per export and README section, pinned to the rc.112 tag, decoded by an `S.Class` in the lint command, used for remediation hints, and the lint command **fails when the installed `@effect/vitest` version no longer matches the pin**. |
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
  example: string,                                    // compiles at rc.112
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

Belief, kept from the draft: a schema whose checks are loose enough that a failing value can cross
its boundary is a glorified type, not a schema. Actionable rules: `it.effect.prop` for
Schema-driven properties at rc.112 (sync `it.prop` needs `fc` Arbitraries); `fc.assert` sites
migrate to `it.prop` / `it.effect.prop` with `fastCheck: fcRuns(n)`-style floors preserved; when a
generated value is invalid or surprising, sharpen the production schema or its `toArbitrary`
annotation — never a weaker test-only schema; bound generators (sparse recursive positions,
`maxLength`, memoized `S.toArbitrary`) instead of lowering runs or raising timeouts;
`assertSchemaArbitraryDecodesToSelf` for round-trip laws; reproduce the CI lane with
`BEEP_FC_NUM_RUNS=400 BEEP_FC_SEED=20260708 bunx --bun vitest run <file>`.

### 6.4 All Seeing Eye (owns D7; P2 observability step)

Design the instrumented `it` in `@beep/test-utils` from public API only: wrap `it.effect` and
`it.live` testers (`Vitest.Tester` shape: call, `skip`, `skipIf`, `runIf`, `only`, `each`,
`fails`, `prop`) so each test body is `Effect.raceFirst(body, watchdog)` where
`watchdog = Effect.sleep(limit).pipe(TestClock.withLive, Effect.andThen(Effect.die(new TestHang({ testName, lastLog }))))`
(a TestClock-driven timeout never fires under `it.effect`, so the watchdog must run on the live
clock), with start / end / duration / outcome logged through `Effect.log` + `Effect.annotateLogs`
and a `Logger.layer([Logger.consolePretty()])` provided only when `BEEP_TEST_TRACE=1` or CI.
Wrap `it.layer` too, so the `it` handed to a layer block callback is instrumented as well. Keep
`TestEnv` semantics untouched. Validate every API against the tag before writing. Durations for
evidence come from the vitest JSON reporter, not from this wrapper.

## 7. Initial detector rule table (counts are rg estimates from 2026-09-04; detectors recount)

| Rule | Class | Estimate | Replacement (KG id) |
| --- | --- | --- | --- |
| EV001 | `Effect.runPromise` / `runSync` / `runFork` inside a test callback | 1,580 / 174 files | `it.effect` or `it.live` (module-scope `runSync` for pure fixture construction is allowed) |
| EV002 | `Effect.provide(<non-stub layer>)` inside an `it.effect` / `it.live` body (D14) | ~232 | `it.layer` |
| EV003 | `withXyz(...)` as the test body root, or a wrapper definition in a test support module | 461 + 221 + 90 + 85 + … | `it.layer` + scoped inner resource, `MemoryFileSystem` |
| EV004 | `Effect.scoped` inside an `it.effect` / `it.live` body | 413 / 160 | delete (runner owns the scope) |
| EV005 | `Effect.result` used to assert an outcome | 28 / 13 | `Effect.exit` + `assertExitSuccess` / `assertExitFailure` / `assertSuccess` / `assertFailure` |
| EV006 | Hand-rolled Option / Result / Exit assertions via `expect` | 631 / 196 | `utils.assertSome` / `assertNone` / `assertSuccess` / `assertFailure` / `assertExit*` |
| EV007 | Direct `fc.assert(fc.property|asyncProperty(...))` inside a test | 468 / 306 | `it.prop` / `it.effect.prop` with `fastCheck` floors |
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
