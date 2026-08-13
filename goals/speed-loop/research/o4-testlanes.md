# Opportunities 4 + 5: integration concurrency groups and Coverage Regression

Research date: 2026-08-04. This is a source-only audit; no test, build, install, or
network command was run.

## Executive recommendation

1. Split the **executing** integration packages into two Turbo task names, not a
   free-form `beep.testGroup` tag: `test:integration:parallel` (22 packages) and
   `test:integration:serial` (3 packages). Run one normally bounded parallel
   pass, then a short serial pass with `--concurrency=1` and the root-provisioned
   SQL URI. Do not start two Turbo processes concurrently: their overlapping
   `^build` graphs could duplicate builds and race outputs.
   Keep package-local `test:integration` as the stable public command. This is
   smaller and harder to misroute than teaching the CLI to interpret arbitrary
   manifest metadata, and `--affected` continues to operate natively on both
   task graphs. The current root path provisions one SQL resource and puts every
   integration task behind one Turbo slot (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1546-1565`), while
   the static planner independently emits the same global constraint
   (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1280-1289`).
2. Make Coverage Regression a **summary-only, directly-changed-package PR
   ratchet**, with an explicit full-repo fallback when coverage infrastructure,
   root configuration, or lockfiles change. Keep the full ratchet on `main` and
   a scheduled run. Today a PR passes `--affected` into a package-per-process
   coverage fleet (`.github/workflows/check.yml:195-215`); a shared-package
   change can therefore expand to nearly all 127 coverage packages. The fleet
   sample records 127 cold coverage tasks whose task-time sum is 827,612 ms;
   `@beep/repo-utils` alone is 150,107 ms
   (`goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:7846-8075`, especially `:8036`).
3. Do **not** call the observed 25% failure rate “coverage regressions” yet. The
   six supplied excerpts contain no terminal failure payload: three files are
   empty, two stop during runner setup, and one stops after printing only the
   lane dispatch. Land failure classification first; then enable one
   coverage-only, same-seed retry for a narrowly enumerated timeout/worker-crash
   class. Never retry or soften ratchet metric drops.

## A. Integration concurrency inventory

### What is serialized today

The root test command always acquires or reuses one PostgreSQL-compatible
resource, exports it as `BEEP_TEST_DATABASE_URL`, and starts Turbo with
`--concurrency=1` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1078-1091`, `:1115-1139`, `:1546-1565`).
The SQL helper's default gate selects that external URI when present
(`packages/tooling/test-kit/test-utils/src/SqlTest.ts:1591-1641`). Each external test layer does receive a
random schema (`packages/tooling/test-kit/test-utils/src/SqlTest.ts:1023-1079`), but this audit accepts the
operator invariant that the shared external lane must remain serialized.

There are **87 manifests** with `test:integration`: 25 have tests selected by
their command, one has an orphaned integration-named file that its command does
not select, and 61 execute `--passWithNoTests`. The proposed split removes the
61 empty Vitest startups from the root lane without deleting their conventional
package-local scripts.

### Packages with selected integration suites (25)

`Group` is the proposed root scheduling group. “Parallel” means safe relative
to other packages in this fleet; conditional live dependencies are still called
out explicitly.

| Package | State touched by the selected suite | Group | Evidence |
|---|---|---|---|
| `@beep/professional-desktop` | Temp/file-backed PGLite, loopback HTTP on OS-assigned port 0; sidecar subprocess suites are separately env-gated. No fixed port or shared DB in the default suite. | parallel | manifest `apps/professional-desktop/package.json:39`; in-process DB `test/integration/chat-persist.pglite.test.ts:46-51`; loopback port `test/integration/support/ontology-mcp-harness.ts:118-125`; sidecar gate `test/integration/sidecar-ipc-stdio.test.ts:13-28` |
| `@beep/db-admin` | Five migration suites, each explicitly in-process PGLite; reads committed migration files. | parallel | manifest `packages/_internal/db-admin/package.json:20`; layers `test/integration/ArchitectureLabMigration.pglite.test.ts:11-19`, `EpistemicContradictionMigration.pglite.test.ts:23-26` |
| `@beep/architecture-lab-server` | Explicit in-process PGLite with a fresh layer. | parallel | manifest `packages/architecture-lab/server/package.json:32`; `test/integration/WorkItemDrizzleRepository.pglite.test.ts:19-26` |
| `@beep/documents-server` | Explicit in-process PGLite with a fresh layer. | parallel | manifest `packages/documents/server/package.json:32`; `test/integration/SyncRepositoriesDrizzle.pglite.test.ts:44-50` |
| `@beep/acp` | A child Bun mock peer connected over in-memory stdio; no server port. | parallel | manifest `packages/drivers/acp/package.json:38`; `test/integration/client.integration.test.ts:16-38` |
| `@beep/box` | Conditional, authenticated **read-only** Box `getUserMe`; skips without a resolved token. | parallel-live-read | manifest `packages/drivers/box/package.json:39`; `test/integration/Box.live.test.ts:7-18`, `:29-40` |
| `@beep/drizzle` | `makePgliteLayer` consumes the root external URI and shared server. | **serial-sql** | manifest `packages/drivers/drizzle/package.json:35`; `test/integration/Drizzle.pglite.test.ts:11`, `:64` |
| `@beep/exiftool` | Local executable plus uniquely allocated temp directories/files. | parallel | manifest `packages/drivers/exiftool/package.json:35`; `test/integration/Exiftool.live.test.ts:52-55`, `:152-165` |
| `@beep/ffmpeg` | Local ffmpeg/ffprobe subprocesses plus per-test temp directories. | parallel | manifest `packages/drivers/ffmpeg/package.json:35`; `test/integration/FFmpeg.capture.integration.test.ts:43-59`, `:118-126` |
| `@beep/firecrawl` | Conditional, authenticated **read-only** queue/credit calls; skips without a resolved key. | parallel-live-read | manifest `packages/drivers/firecrawl/package.json:36`; `test/integration/Firecrawl.live.test.ts:7-25`, `:27-46` |
| `@beep/libpff` | Conditional local PST input and local `pffexport`; writes only a scoped temp export root. | parallel | manifest `packages/drivers/libpff/package.json:36`; `test/integration/Libpff.pffexport.live.test.ts:21-43`, `:81-99` |
| `@beep/m365` | Conditional, authenticated **read-only** Graph list/download/get calls and a shared token-cache file. | parallel-live-read, but add token-cache lock if multiple M365 packages acquire this suite | manifest `packages/drivers/m365/package.json:36`; `test/integration/M365.live.test.ts:15-33`, `:46-78` |
| `@beep/nlp-mcp` | Per-test temp directories/files; no MCP server is opened. | parallel | manifest `packages/drivers/nlp-mcp/package.json:36`; `test/integration/Streaming.test.ts:14-40` |
| `@beep/obs` | Conditional read-only connection to the singleton OBS websocket on `127.0.0.1:4455`; it does not start/stop recording. | parallel-live-read | manifest `packages/drivers/obs/package.json:35`; `test/integration/Obs.live.test.ts:7-31`, `:41-52` |
| `@beep/openclaw` | Real binary/network staging into one persistent cache, then scoped temp workbenches. The cache check/install is not locked. | parallel **only because this is the sole package owner**; add a filesystem lock before adding another consumer | manifest `packages/drivers/openclaw/package.json:35`; cache contract `test/integration/OpenclawBinary.acceptance.test.ts:1-17`; unchecked stage `:106-132`; temp workbench `:251-269` |
| `@beep/pglite` | Two unique temp data directories; local file-backed PGLite only. | parallel | manifest `packages/drivers/pglite/package.json:36`; `test/integration/PgliteClient.persistent.test.ts:63-87` |
| `@beep/postgres` | `makePgliteLayer` consumes the root external URI and shared server. | **serial-sql** | manifest `packages/drivers/postgres/package.json:35`; `test/integration/Postgres.pglite.test.ts:24`, `:62-66` |
| `@beep/runpod` | Conditional, authenticated **read-only** pod list/OpenAPI calls. | parallel-live-read | manifest `packages/drivers/runpod/package.json:37`; `test/integration/Runpod.live.test.ts:7-19`, `:26-52` |
| `@beep/tika` | Conditional shared Tika server, read-only extraction requests; fixture files are temp-scoped. | parallel-live-read | manifest `packages/drivers/tika/package.json:36`; `test/integration/Tika.server.live.test.ts:27-38`, `:46-76` |
| `@beep/venice-ai` | Conditional, authenticated **read-only** model listing. | parallel-live-read | manifest `packages/drivers/venice-ai/package.json:36`; `test/integration/VeniceAI.integration.test.ts:9-23`, `:25-46` |
| `@beep/epistemic-server` | Six default suites use explicit in-process/temp-backed PGLite. Two real-Postgres race suites use separate opt-in URLs and skip when absent; they use fixed migration-schema names, so a second concurrent run against the same opt-in servers is unsafe. | parallel in the normal root lane; give the two opt-in `.pg` files their own future external-PG task | manifest `packages/epistemic/server/package.json:31`; in-process examples `test/integration/EdgeAuthority.pglite.test.ts:41-47`, `ContradictionTriage.p0.pglite.test.ts:25-31`; opt-in gates `EdgeAuthority.pg.test.ts:41-59`, `:207-208`, `ContradictionTriage.pg.test.ts:63-87`, `:292-293` |
| `@beep/pandoc-ast` | Read-only committed fixtures; no subprocess/server. | parallel | manifest `packages/foundation/modeling/pandoc-ast/package.json:37`; `test/integration/Pandoc.integration.test.ts:1-22` |
| `@beep/qa-capture` | Conditional local ffmpeg subprocess and a unique temp video directory. | parallel | manifest `packages/tooling/library/qa-capture/package.json:36`; `test/integration/ClockCorrelator.integration.test.ts:94-130` |
| `@beep/test-utils` | Deliberately covers the root shared external DB, Docker/Testcontainers, and an `isolation: "none"` external layer. | **serial-sql** | manifest `packages/tooling/test-kit/test-utils/package.json:38-44`; `test/integration/SqlTest.pglite.test.ts:35-54`, `:56-105` |
| `@beep/workspace-server` | Explicit in-process PGLite with a fresh layer. | parallel | manifest `packages/workspace/server/package.json:32`; `test/integration/ThreadStoreDrizzleRepository.pglite.test.ts:22-28` |

### Orphaned suite (not selected)

`@beep/agents-server` has `test/ProviderInstance.integration.test.ts`, which
would use `makePgliteLayer` and therefore the shared external URI
(`packages/agents/server/test/ProviderInstance.integration.test.ts:29-45`). Its
script, however, runs only the `test/integration` path
(`packages/agents/server/package.json:22-23`), so the file is currently absent
from both unit and integration commands. Treat this as a correctness bug: move
it under `test/integration/` and classify the package `serial-sql`, or rename it
as a unit test and pin its layer to `mode: "in-process"` before putting it in the
parallel group.

### Script exists, but no selected suite (61)

These are self-contained **no-ops today**, not evidence-bearing integration
suites. They should retain package-local compatibility if desired, but should
not receive either root Turbo group script until a real suite is added.

- `@beep/architecture-lab-proof` (`apps/architecture-lab-proof/package.json:32`)
- `@beep/agents-client`, `@beep/agents-tables`
  (`packages/agents/client/package.json:32`, `packages/agents/tables/package.json:32`)
- `@beep/architecture-lab-client`, `-config`, `-domain`, `-tables`, `-ui`,
  `-use-cases` (`packages/architecture-lab/client/package.json:31`,
  `config/package.json:32`, `domain/package.json:32`, `tables/package.json:32`,
  `ui/package.json:32`, `use-cases/package.json:32`)
- `@beep/documents-domain`, `-tables`, `-use-cases`
  (`packages/documents/domain/package.json:32`, `tables/package.json:32`,
  `use-cases/package.json:32`)
- `@beep/ai-provider-cli`, `@beep/courtlistener`, `@beep/discord`,
  `@beep/doc-text`, `@beep/dol`, `@beep/ecfr`, `@beep/face-detection`,
  `@beep/federal-register`, `@beep/gov-legal-mcp`, `@beep/govinfo`,
  `@beep/hubspot`, `@beep/m365-mcp`, `@beep/onepassword-cli`,
  `@beep/openai-compat`, `@beep/pacer`, `@beep/phoenix`, `@beep/pretext`,
  `@beep/protobuf`, `@beep/sanity`, `@beep/tailscale`, `@beep/uspto-mcp`,
  `@beep/uspto`, `@beep/wink`, `@beep/xai` (their script anchors are respectively
  `packages/drivers/ai-provider-cli/package.json:35`,
  `courtlistener/package.json:35`, `discord/package.json:35`,
  `doc-text/package.json:36`, `dol/package.json:35`, `ecfr/package.json:39`,
  `face-detection/package.json:35`, `federal-register/package.json:35`,
  `gov-legal-mcp/package.json:37`, `govinfo/package.json:36`,
  `hubspot/package.json:35`, `m365-mcp/package.json:36`,
  `onepassword-cli/package.json:35`, `openai-compat/package.json:35`,
  `pacer/package.json:36`, `phoenix/package.json:35`, `pretext/package.json:35`,
  `protobuf/package.json:35`, `sanity/package.json:35`, `tailscale/package.json:35`,
  `uspto-mcp/package.json:36`, `uspto/package.json:36`, `wink/package.json:36`,
  `xai/package.json:36`)
- `@beep/epistemic-client`, `-config`, `-tables`, `-ui`
  (`packages/epistemic/client/package.json:32`, `config/package.json:32`,
  `tables/package.json:33`, `ui/package.json:32`)
- `@beep/api-transport`, `@beep/file-processing`, `@beep/mcp-kit`
  (`packages/foundation/capability/api-transport/package.json:37`,
  `file-processing/package.json:37`, `mcp-kit/package.json:37`)
- `@beep/html`, `@beep/lexical-schema`, `@beep/ontology`
  (`packages/foundation/modeling/html/package.json:37`,
  `lexical/package.json:37`, `ontology/package.json:33`)
- `@beep/dock-react`, `@beep/dock`, `@beep/editor`
  (`packages/foundation/ui-system/dock-react/package.json:37`,
  `dock/package.json:36`, `editor/package.json:37`)
- `@beep/law-practice-tables` (`packages/law-practice/tables/package.json:32`)
- `@beep/ontology-client`, `-config`, `-domain`, `-server`, `-ui`, `-use-cases`
  (`packages/ontology/client/package.json:33`, `config/package.json:32`,
  `domain/package.json:32`, `server/package.json:32`, `ui/package.json:32`,
  `use-cases/package.json:32`)
- `@beep/ai-sync`, `@beep/fc-runs`
  (`packages/tooling/library/ai-sync/package.json:41`,
  `packages/tooling/test-kit/fc-runs/package.json:36`)
- `@beep/workspace-tables`, `@beep/workspace-use-cases`
  (`packages/workspace/tables/package.json:32`,
  `packages/workspace/use-cases/package.json:32`)

### Wiring design

Preferred implementation:

- In the 22 parallel manifests add
  `"test:integration:parallel": "bun run beep:test:integration"`; in
  `@beep/drizzle`, `@beep/postgres`, and `@beep/test-utils` add the serial name
  instead. When the agents-server orphan is repaired, add it to serial unless it
  is pinned in-process.
- Register both task names in `turbo.json` with the same `cache: false`,
  `dependsOn: ["^build"]`, env, and inputs currently owned by
  `test:integration` (`turbo.json:125-140`). Keep the old task entry for
  package-local/backward compatibility during migration.
- In `runRootTestTask`, run the parallel Turbo command with normal bounded CI
  concurrency. Then acquire the SQL resource and run the serial Turbo command
  with `--concurrency=1`. Only the serial subprocess receives
  `sqlIntegrationEnv`. Collect failures from both passes before returning,
  preserving the existing collect-all behavior (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1550-1568`).
  Update `rootTestSteps` too so dry-run/static planning cannot drift from
  execution. Sequential passes avoid two Turbo processes contending over the
  same `^build` outputs; the saving comes from parallelism *within* the 22-owner
  pass and from omitting 61 empty packages.
- Update the package generator's integration-script template so a newly
  generated package does **not** silently join either root group until it owns a
  selected integration suite; the current template emits the conventional
  pass-with-no-tests script for every generated package
  (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1391-1407`). Add a repo-sanity invariant: every
  package defining a group task defines exactly one of parallel/serial and also
  defines `test:integration`.

Why not `beep.testGroup`? Existing `beep` objects describe package family/kind
(for example `packages/tooling/test-kit/test-utils/package.json:25-28`), but
Turbo cannot filter on arbitrary manifest fields. The CLI would have to discover
packages and synthesize many positive filters, including subtle intersection
semantics with caller-provided `--affected`/`--filter`. Two task names express
the scheduling property directly in Turbo and make omissions inspectable.

### Wall-time size and confidence

- Hosted baseline: Test Integration success p50 is 277 s and p95 is 345 s
  (`goals/quality-speedup/research/quality-time-inventory.md:56-69`).
- The fleet task TSV has only **one** integration-task observation:
  `@beep/test-utils#test:integration`, cold, 3.282 s
  (`goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:6890`). Because that package remains serial,
  the fleet TSV alone proves **0 seconds of realizable saving** and cannot
  produce a defensible central estimate for the other 24 packages.
- A strict bound is therefore **0–274 s at p50** (current 277 s less the only
  observed serial task), before shared setup/teardown. A planning estimate of
  **2–4 minutes saved (low confidence)** is reasonable only as a hypothesis:
  22 real packages plus 61 no-op startups leave the global chain, while three
  SQL owners remain serial. Do not book that estimate until a Turbo summary
  captures all 25 package durations.

Falsification/acceptance:

1. Capture current and split Turbo summaries on the same SHA/runner, three cold
   runs each. Require every selected suite exactly once; compare p50 wall and
   peak RSS. Reject if saving is <60 s or RSS exceeds the runner budget.
2. Add planner tests asserting parallel has no SQL env, serial has the shared
   URI and `--concurrency=1`, `--affected --base` reaches both commands, and a
   failure from either group fails the aggregate.
3. Add overlap sentinels proving two parallel fixture packages overlap in time,
   while two serial SQL fixtures never overlap. Run the serial fixtures against
   one shared external resource and assert setup/teardown leaves no schema.
4. Add an inventory test that fails on the agents-server path mismatch and on
   any package defining both group scripts or neither group script while owning
   selected integration tests.

Estimated implementation size: **M (3–5 engineer-days)**: 25 manifest edits,
Turbo/CLI wiring, generator policy, and adversarial orchestration tests. Put it
in one PR because half-migrated task names would silently drop suites.

## B. Coverage Regression diagnosis

### What the lane computes

The lane is a **per-package four-metric ratchet**, not a single repo coverage
percentage:

1. The CI descriptor maps `coverage` to the required “Coverage Regression”
   check (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:388-395`) and invokes root Turbo coverage at concurrency
   3 (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:818`). Pull requests add `--affected --base origin/<base>`;
   pushes do not (`.github/workflows/check.yml:195-215`).
2. Before execution, the CLI deletes every workspace package's `coverage/`
   directory (`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:298-317`). It then launches
   `turbo run coverage`; coverage packages depend on upstream builds and are
   explicitly uncached (`turbo.json:141-155`; `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1033-1043`).
3. The CLI pins CI identity, a deterministic fast-check seed, larger Node heap,
   and `VITEST_COVERAGE_RATCHET=1` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:526-558`). Package scripts
   run plain-Node `vitest`, so the common provider is V8, not Bun/Istanbul
   (`vitest.config.ts:3-9`, `vitest.shared.ts:16-18`). Coverage includes each
   package's `src/**/*.{ts,tsx}` and emits text, HTML, LCOV, and JSON summary
   (`vitest.shared.ts:165-183`).
4. After tests complete, it discovers every workspace with a `coverage` script,
   reads any `coverage/coverage-summary.json`, maps `Unknown` to zero, and keeps
   line/statement/branch/function percentages
   (`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:215-230`, `:251-296`, `:327-340`).
5. It compares those values with the committed baseline at 0.001 percentage
   points tolerance. A lower metric fails; in an unscoped run a missing summary
   also fails; in a scoped run missing non-selected packages are ignored. A new
   package is warning-only (`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:437-495`, `:505-578`). The
   current baseline was generated at SHA `4794c6d...` on 2026-07-30 and contains
   package-local metrics (`standards/coverage.regression-baseline.jsonc:1-17`).

### Why it is slow

It is not unconditionally full-repo on PRs, but it is **de facto full-repo for
wide/shared changes**:

- There are 128 manifests with a coverage script, and Turbo starts a separate
  Vitest process for each selected package. In the fleet sample, 127 coverage
  tasks are cold misses and total 827.6 task-seconds. At concurrency 3 the ideal
  work-only floor is 275.9 s, before process startup, instrumentation, four
  reporter formats, Turbo scheduling, and comparison. The hosted p50 of 692 s
  demonstrates that the ideal floor is not reached.
- The long tail is material: `@beep/repo-utils` 150.107 s,
  `@beep/lexical-schema` 39.674 s, and `@beep/ontology-server` 29.883 s
  (`goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:7965`, `:7998`, `:8036`). These three are 26.5%
  of all observed coverage task work.
- Upstream builds are not the observed sample's bottleneck: its 103 build tasks
  were cache hits totalling only 123 ms. The dominant cost is executing and
  instrumenting package tests, especially the three packages above.
- The lane also duplicates correctness execution already present in Test Unit.
  That is unavoidable for instrumentation, but a test timeout/assertion failure
  currently aborts before the ratchet comparator, so the check name conflates
  “tests under coverage failed” with “coverage percentage regressed.” A prior
  committed incident documents a fixed lexical fixture timing out under
  coverage while passing locally (`goals/one-round-loop/research/research-facts.md:90-110`).

### Failure taxonomy

| Class | Current behavior | Diagnosis signal / disposition |
|---|---|---|
| True metric regression | One or more actual metrics is lower than baseline by >0.001. | `[coverage-ratchet] coverage dropped below baseline` and package/metric values (`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:505-526`). Hard fail; fix tests/source or intentionally regenerate and review baseline. Never retry. |
| Baseline drift | New coverage package is absent (warning only); stale high entries can produce expected failures; stale low entries silently weaken the ratchet. Deleted/renamed packages fail as missing only on unscoped runs. | New-package/missing-summary renderers at `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:512-535`; scoped suppression at `:476-487`. Fix with reviewed baseline regeneration, ideally bot-authored after main goes green. |
| Package-local fixed threshold | Some package configs retain fixed thresholds in addition to the root ratchet; baseline regeneration disables them, normal ratchet execution does not. | Example conditional threshold config: `packages/tooling/test-kit/test-utils/vitest.config.ts:4-23`. Classify separately from comparator output. |
| Test defect | Deterministic assertion/setup failure under coverage. | Vitest failure with a stable test/file; reproduces package-locally with the exact coverage env. Hard fail, not baseline drift. |
| Coverage-only flake | Timeout, worker crash/OOM, timing-sensitive fake timer, or nondeterministic ordering; same SHA/seed passes on focused retry. | The lane pins the property seed but still enables concurrent sequencing and 300 s coverage timeouts (`vitest.shared.ts:49-52`, `:165-177`). Retry only enumerated signatures and record the incident. |
| Environment/infra | Runner setup/download/disk cancellation, missing browser/global, or provider/runtime mismatch. | Failure happens before ratchet output or reproduces only under one runtime. The historical oip-web localStorage mismatch is recorded at `goals/one-round-loop/history/p0-parity-evidence.md:245-254`. |
| Missing/corrupt output | Coverage script exits green but summary absent/corrupt; cleanup/read/parse fails. | Full run: missing summary is ratchet failure; scoped run can mask a selected package that emitted nothing because `scoped` suppresses all missing actuals (`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:266-296`, `:476-482`). This is a correctness gap. |

### Supplied failure excerpts: classification

The job table proves all six were Coverage Regression failures lasting 458–1321
seconds (`goals/quality-speedup/research/data/ci-lane-timings.tsv:174`, `:194`, `:318`, `:385`, `:433`, `:508`), but
the supplied excerpts cannot identify the causes:

- `run-30720326504.txt`, `run-30726878601.txt`, and
  `run-30731873588.txt`: **empty (0 lines)** — unclassifiable.
- `run-30729119152.txt` and `run-30734822037.txt`: **setup-only**; both stop at
  `Run '/setup.sh'` after 20 lines (`../coverage-failures/run-30729119152.txt:1-20`,
  `../coverage-failures/run-30734822037.txt:1-20`). Unclassifiable, not evidence
  that setup itself failed.
- `run-30735824339.txt`: **dispatch-header-only**; it proves the PR command was
  `beep ci lane coverage --affected ... --summarize`, then stops before output
  (`../coverage-failures/run-30735824339.txt:1-20`). Unclassifiable.

Result: **0/6 baseline drift, true regression, or flake classifications can be
made from these excerpts.** Any percentage assigned to those buckets would be
invented. The extraction process likely requested only the first log page/20
lines instead of the failed step's tail.

### Proposed coverage architecture

**PR gate (required):**

1. Compute package owners from changed files, not Turbo reverse-dependents.
   Run coverage for directly changed packages that own a coverage script.
   Coverage percentage measures that package's own `src/**`; behavior in
   dependents remains protected by affected Test Unit. Escalate to full coverage
   when root `vitest*`, `turbo.json`, package manager/lock/toolchain files,
   coverage CLI/comparator code, shared setup, or the baseline changes.
2. Add a ratchet-only reporter mode that emits `json-summary` plus concise text,
   not HTML and LCOV. Keep full reporters for an optional artifact/nightly job.
3. Treat an explicitly selected package with no summary as a hard configuration
   failure even in scoped mode. The comparator must receive the expected
   selected-package names rather than a single `scoped: boolean`.
4. Keep full-repo coverage on `main` and nightly. Partition it into stable
   weighted shards using measured package duration, each invoking the same
   comparator for its expected package set; do not raise per-run Turbo
   concurrency blindly. This preserves the full safety net without putting its
   11.5-minute p50 on every PR.
5. Create a scheduled/main-only baseline tightening bot: if actual metrics rise,
   open a reviewed baseline-only PR. New packages should be a hard failure until
   their baseline entry lands, eliminating warning-only drift.

Expected size: **L (7–10 engineer-days)** split across CLI scope modeling,
reporter configuration, CI full-run placement/sharding, and fixture tests.
Expected PR critical-path saving is **large but shape-dependent**: the full-ish
fleet sample has 827.6 task-seconds; a one-package PR typically pays only that
package's 4–10 s task plus setup, while a root-infra PR intentionally pays the
current full cost. Validate on 20 PRs; target Coverage Regression p50 <120 s for
non-infra PRs and no reduction in true-regression catches.

Falsification tests:

- Synthetic source/test change in package A selects A and catches the established
  synthetic metric drop; a change only in dependent B selects B, not A.
- A root Vitest/shared setup/coverage-comparator/baseline change selects all
  baseline packages. Compare its package set byte-for-byte with current full
  discovery.
- A selected script that emits no/corrupt summary fails even though the run is
  scoped; an unrelated baseline package missing from a one-package run does not.
- Run current and proposed commands on a stratified corpus (leaf, mid-graph,
  shared foundation, root infra). Reject if any current true metric regression
  becomes green or if p50 target is missed.
- Compare JSON-summary-only metrics with the current four-reporter metrics on
  the same SHA; require exact equality for every package/metric.

### Proposed failure-rate fix

Land structured failure attribution before policy:

- Emit a small artifact with phase (`setup`, `vitest`, `summary`, `compare`),
  package/task, exit/signal, timeout/worker-crash signature, whether ratchet
  output was reached, and retry outcome. Fix the hosted log collector to retain
  the failed step tail.
- In coverage mode only, allow **one same-seed focused retry inside the failing
  package** for an allowlist of timeout/worker-exit signatures. If it passes,
  rerun/complete that package's coverage summary, record `flake-recovered`, and
  let comparison proceed. Assertion failures, threshold failures, missing or
  corrupt summaries, and ratchet drops remain immediate hard failures.
- Keep a rolling flake budget: any package with >2 recoveries in 20 runs becomes
  hard-failing/quarantined to an owner rather than permanently consuming retry.
  This converts genuinely intermittent 692-second whole-workflow reruns into a
  focused package retry without hiding coverage loss.

Expected size: **M (3–5 engineer-days)** for classification, focused retry,
artifact upload, and tests. Do not claim a numeric failure-rate reduction until
20–40 complete failure logs are classified; the supplied sample is unusable.
The acceptance target is <5% unclassified failures and <10% total hosted failure
rate, with zero ratchet drops recovered by retry.

Falsification tests:

1. Fixture test times out once then passes: exactly one focused retry, stable
   seed/env, `flake-recovered` artifact, final summary compared.
2. Fixture assertion fails twice or fails once with a non-allowlisted signature:
   no green result. A synthetic metric drop after green tests always fails and
   is never retried.
3. Worker exits before writing summary, focused retry passes, but stale output
   from attempt one cannot be consumed (the root cleanup and per-attempt package
   cleanup are asserted).
4. Run the same failing package 20 times; prove the budget changes repeated
   recoveries back to hard failure and names an owner/package.

## PR placement

1. **PR I1 — integration task split (M, atomic):** package manifests,
   `turbo.json`, `Quality/Tasks.ts`, `quality-tasks.test.ts`, generator policy,
   and inventory/sentinel tests. Include the agents-server orphan repair here so
   the migration cannot certify a lane that still drops a suite.
2. **PR C1 — coverage observability/failure taxonomy (M):** no scope change.
   Add structured phase/package output, complete failed-log-tail collection, and
   dashboards. Observe 20–40 failures/runs before enabling retry.
3. **PR C2 — direct-package PR ratchet + expected-summary contract (M/L):** CLI
   scope model, full-trigger list, summary-only reporter, and two-way synthetic
   proofs. Keep `main` full coverage unchanged in this PR.
4. **PR C3 — full-lane placement/sharding + measured retry policy (M):** main/
   nightly weighted shards, baseline-tightening automation, and only the retry
   signatures justified by C1 data.

This ordering keeps each behavioral change falsifiable and avoids using a
failure-rate optimization to conceal an unmeasured mix of real regressions and
infrastructure defects.
