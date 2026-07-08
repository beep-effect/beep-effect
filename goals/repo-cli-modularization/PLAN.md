# @beep/repo-cli Modularization Plan

## Status

This plan executes [SPEC.md](./SPEC.md). Discovery is complete
(2026-07-07, 38/41 workflow agents; the `cli-plumbing` and `proc-git` reuse
sweeps and one audit chunk failed on transport errors — their ground is covered
by the 27 per-file analyses and the synthesis pass). Waves are sequenced so
shared substrate lands before its consumers, pilot groups with the strongest
test safety nets go first, and each wave is independently verifiable.

Inventory: [ops/discovery/synthesis.json](./ops/discovery/synthesis.json)
(shared-module catalog, 28 ranked targets, rationale),
[ops/discovery/files/<Group>.json](./ops/discovery/files/) (per-file seams and
proposed splits), plus `reuse.json`, `audits.json`, `infra.json`, `tests.json`.

Audit snapshot: of 20 audited groups only 4 are topology-compliant. Groups with
no test coverage (Codegen, Codex, Docs, Fallow, TopoSort) get extra care:
mechanical moves only, no consolidation without a new focused test.

## Shared-Module Catalog (Waves 1-2 deliverables)

Condensed from `synthesis.json` (25 entries); locations are
`packages/tooling/tool/cli/src/` unless noted:

| Module | Home | Serves |
|---|---|---|
| StepExec subprocess runner (bounded capture, `QualityTaskStep` home, `collectText`) | `internal/process/StepExec.ts` | 14 groups |
| JSON output (`encodeCommandJson` export, `renderPrettyCommandJson`, `printJsonOrLines`) | `internal/cli/Json.ts` + `Printer.ts` (extend) | 10 groups |
| GitExec (git wrappers, changed-files, branch/ref safety) | `internal/repo-run/GitExec.ts` | 8 groups |
| Ratchet engine + artifact IO (`Ratchet.make`, `ArtifactIo`, truncated renderer) | `internal/ratchet/` + `internal/artifacts/` | 5 proofs |
| SchemaFirstPolicyFinding wire contract (+ severity kit) | `internal/quality/` | Lint, Yeet, AgentEffectiveness |
| gh GitHub plumbing (ghOutput, PR/actor/comment schemas, GraphQL pagination) | `internal/github/` | 4 groups |
| JSONC edit/parse (adopt `@beep/schema` `decodeJsoncTextAs`) | `internal/cli/Jsonc.ts` | 8 groups |
| Timing/error micro-helpers; RunMode kit; UnknownProbe; CommandErrorFields; Progress; FsGuards; Flags/Printer extensions; GlobPattern; EnvConfig; GeneratedFileDrift; JsonStringCodec | `internal/cli/`, `internal/artifacts/`, `internal/schema/` | 4-10 groups each |
| walkFiles + infallible exists + workspace-discovery extensions | `@beep/repo-utils` (existing owner) | 9 groups |
| `withAiMetricsDuckDb`, data-root constants, shellQuote adoption | `@beep/repo-ai-metrics` (existing owner) | 6 groups |
| ts-morph analysis kit (JSDoc extraction, owner resolver, project factory) | `internal/tsmorph/` (promotion deferred) | 4 groups |

## Phase 0 - Packet, Agents, Clean Tree (Wave 0)

- [x] Land pre-existing dirty edits (`AIMetrics.command.ts`,
  `AgentEffectiveness.command.ts` + `EvalScorer.ts`, `Corpus.recyclebin.ts`,
  `Fallow.command.ts`, `test/schema-first.test.ts`, `package.json`,
  `bun.lock`) as their own verified commit(s).
- [x] Commit this goal packet (`goals/repo-cli-modularization/`).
- [x] Add repo-general specialist agents under `.claude/agents/` and the
  `.agents/agents` symlink for Codex discovery.
- [x] Add the campaign changeset (non-empty, lists `@beep/repo-cli`; grows as
  library packages are touched).
- [x] Record the pre-existing test-failure baseline for
  `packages/tooling/tool/cli` ([ops/test-baseline-P0.md](./ops/test-baseline-P0.md):
  fully green — 39 files / 547 tests).

## Phase 1 - In-Package Shared Substrate (Wave 1)

Purely additive modules inside `@beep/repo-cli`; no group files move.

- [x] `internal/cli/Json.ts`: export `encodeCommandJson`; add
  `renderPrettyCommandJson` (jsonc pretty + 500k cap, 7 copies today).
- [x] `internal/cli/Printer.ts`: `printJsonOrLines`, tagged logger,
  duration formatting.
- [x] `internal/process/StepExec.ts`: captured / must-succeed / best-effort /
  inherited-stdio subprocess variants, bounded output fold, caller-supplied
  error mapper; absorbs `QualityTaskStep` + `collectText`.
- [x] `internal/repo-run/GitExec.ts`: `runGitOutput`/`runGitLines`/path-list
  helpers, changed-files-since-base, branch/ref safety.
- [x] `internal/cli/`: `Timing.ts`, `RunMode.ts`, `UnknownProbe.ts`,
  `CommandErrorFields.ts`, `Progress.ts`, `FsGuards.ts`, `Flags.ts` extensions.
- [x] Pilot adoption at 2-3 low-risk call sites per helper (e.g. Worktree git
  capture, Ci duration format) to prove shapes.
- [x] Unit tests for pure logic (bounded fold, glob translation, run-mode
  resolution); full JSDoc rubric on all new exports.

## Phase 2 - Cross-Package Seeds & Contracts (Wave 2)

- [x] `@beep/repo-utils`: `walkFiles`, infallible `exists`, workspace-discovery
  extensions (existing-owner adoption; own changeset + tests).
- [x] `@beep/repo-ai-metrics`: `withAiMetricsDuckDb`, data-root constants;
  commands adopt its existing `shellQuote`.
- [x] `internal/ratchet/` + `internal/artifacts/ArtifactIo.ts` +
  `GeneratedFileDrift.ts`: generic fail-on-growth lifecycle parameterized by
  finding schema/key/renderers/tag.
- [x] `internal/quality/SchemaFirstPolicyFinding.ts` (+ severity kit):
  single wire contract for the `[schema-first:issue]` lines (3 diverged copies
  today); divergent optionality reconciled via explicit schema, emitted format
  unchanged.
- [x] `internal/github/`: gh plumbing; `internal/cli/Jsonc.ts`,
  `EnvConfig.ts` (absorbs `Quality/internal/Config.ts`), `GlobPattern.ts`.

## Phase 3 - Pilot Groups: Files + Docgen (Wave 3)

Strongest safety nets (Files: vitest + the package's only dtslint file;
Docgen: 4000-line test via test-kit).

- [x] Files: split `Files.service.ts` (5680) into service +
  `Files.plan.ts`/`Files.render.ts` + semantic `internal/` modules;
  `Files.schemas.ts` (2486) into concept-grouped schema modules;
  `Files.media.ts` consolidation onto shared helpers.
- [x] Docgen: `internal/Operations.ts` and `internal/Quality.ts` re-seamed;
  worker evals adopt shared JSON/exec helpers; `Docgen.command.ts` thinned to
  wiring; tests migrate to facade/test-kit imports (SPEC test policy).
- [x] Playbook writeup in `ops/` if any step deviates from SPEC assumptions.

## Phase 4 - Quality Family (Wave 4)

Largest offender (13k LOC, four 1000+ files) and the package dependency hub.

- [x] `Quality/Tasks.ts` -> `Quality.schemas.ts` + internal modules; step
  runner delegates to `StepExec`.
- [x] Migrate `QualityTaskStep` consumers (Graphiti `ProxyOps`, Lint root
  policy) onto `internal/process`; update Quality test-kit star-exports.
- [x] `Quality.command.ts` (2901) -> schemas/plan/render + semantic internals.
- [x] `FallowQuality.command.ts` (2347) -> internal modules, `$match` tables
  colocated; propose (not decide) Fallow group extraction in the commit
  message.
- [x] Ratchet internals (`JSDocRatchet`, `KnipRatchet`, `CoverageRegression`,
  `JSDocDocumentationInventory`) adopt `internal/ratchet` + `ArtifactIo`;
  baselines byte-stable except where regeneration rule applies.

## Phase 5 - Lint + Laws (Wave 5)

- [x] Extract ts-morph analysis kit (`internal/tsmorph/`) from SchemaFirst /
  DualArity / JSDoc inventory sources.
- [x] `Lint/SchemaFirst.ts` (2169) split (schemas/render + internal detectors,
  store, scan); adopts wire contract + ratchet engine; fix the silent
  JSONC parse-swallow by adopting `decodeJsoncTextAs` (behavior-visible: record
  in commit message).
- [x] Lint topology: rule modules under `internal/`, `SchemaCatalog` command
  consolidation.
- [x] `Laws/DualArity.ts` (1504) split + Laws role files; severity literal
  divergence (`warn` vs `warning`) preserved via kit parameters, unification
  proposed explicitly.

## Phase 6 - Yeet (Wave 6)

Strongest behavioral invariants (publish scope, stash restore, proof locks);
goes after its dependencies are battle-tested.

- [x] `Yeet.schemas.ts` extraction; `internal/Handler.ts` (2897) split
  (TurboQuery, PublishScope, ProofState, PullRequest) adopting GitExec/gh/JSON
  helpers.
- [x] `internal/QualityIssueIndex.ts` adopts the wire contract;
  `internal/Closeout.ts` (1316) split; `PacketRenderer` -> `Yeet.render.ts`;
  test-kit updates.

## Phase 7 - Metrics/Data Family (Wave 7)

- [x] AIMetrics (3839): schemas/errors/config roles +
  internal/{Window,Install,Ingest,Forwarder,Scorecard}; DuckDb provider from
  `@beep/repo-ai-metrics`.
- [x] AgentEffectiveness: role files + `EvalScorer` (1294) split; adopts wire
  contract + shared exec.
- [x] Corpus: `Corpus.service.ts` (3150) -> semantic internals;
  `Corpus.schemas.ts` (1574) re-seamed.

## Phase 8 - Config-Sync Family (Wave 8)

- [ ] TsconfigSync (1784): schemas/plan/render/service split.
- [ ] CreatePackage: `Handler.ts` (1496) -> command/schemas/render +
  internals; rewrite `create-package-identity-template.test.ts` against the
  extracted identity-registration module.
- [ ] VersionSync + SyncDataToTs: `Models.ts` -> `.schemas.ts` renames,
  render/service promotion, RunMode-kit adoption.

## Phase 9 - Long Tail + Closing Sweep (Wave 9)

- [ ] Graphiti (`ProxyOps` 1454, `ProxyServices` 1090), Research
  (`Research.service.ts` 1385), Skills (960), Worktree (875), Architecture
  (`OperationPlan.ts` 2764 -> schemas/plan + internal manifests), Ci/Codegen
  minor role extractions.
- [ ] Closing sweep: schema-primitives adoption (`withKeyDefaults`, `ISOStr`,
  `NonNegativeInt`, path normalization) where behavior-identical.
- [ ] Final: full `bun run beep yeet verify`, changeset review,
  `bun run beep yeet publish --message`, PR monitor to mergeable.
- [ ] `/reflect repo-cli-modularization`.

## Per-Wave Verification (every wave)

1. `bun run --cwd packages/tooling/tool/cli check`
2. `bun run --cwd packages/tooling/tool/cli test` — no NEW failures vs the
   Phase 0 baseline
3. `bun run docgen:local` — JSDoc rubric compliance on the diff
4. `bun run beep lint schema-catalog --write` when schemas moved; ratchet
   `--write` only under the SPEC regeneration rule
5. `bun run beep yeet verify` at the wave boundary; wave-sized commit with the
   consolidation/facade/unification notes SPEC requires
