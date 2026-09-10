# C3.2b implementation results

## Stage A

Implemented the sweep switch on `ttc/c3-2b-typed-programs`, starting from
`a7a86832a453a1152e5974e4eedbdd3ac8760c0b`. The required configuration selects `shards`.
Stage A does not enable the per-package full sweep or retire the shard program.

### Decisions and rejected alternatives

1. Added `PolicySweepProgram = LiteralKit(["shards", "turbo"])` and the annotated
   `LintPolicySweeps` class before wiring runtime behavior. The version is required and literal;
   the program has no decoding default. Rejected optional fields and malformed-file fallbacks.
2. Located the existing JSONC boundary: `internal/cli/Jsonc.ts` re-exports
   `decodeJsoncTextAs` from `@beep/schema/Jsonc`. The module-level
   `decodeLintPolicySweeps = decodeJsoncTextAs(LintPolicySweeps)` uses that helper instead of
   strict `S.fromJsonString`, accepting comments and trailing commas without stripping comments
   by hand. `readLintPolicySweeps` maps both file-read and decode failures to
   `QualityTaskConfigurationError`, including the file path and cause in its message.
3. `runRootLintPolicyTaskInternal` reads the file once, before changed-file discovery or step
   execution, and passes the decoded selection to
   `rootRepoLintPolicySteps(repoRoot, files, base, sweeps)`. The builder never consults CI:
   undefined base plus `shards` yields the existing `repoCliStep`; undefined base plus `turbo`
   yields the existing full-scope Turbo step; a supplied base always yields affected Turbo.
   The caller retains responsibility for folding CI into full scope. Docs lint retains its
   existing full/affected behavior. Rejected changing scope from inside the planner.
4. The standalone command reads the same required file for non-package execution. Explicit
   full scope or CI uses its program; local affected execution keeps the caller base.
   `runRootDeprecatedApisTask` accepts an omitted base to reuse the full Turbo step.
   Package workers and shard implementation remain unchanged. Pure testing plans retain an
   explicit shard selection when no test override is provided; the legacy aggregate root lint
   plan delegates through the standalone command, which validates the file at execution.
   This is not a runtime fallback for an unreadable file.
5. Added the sweep file to the fingerprint generator's existing `rootConfigs`, since it is a
   root configuration read by the policy checker. Ran `beep lint policy-fingerprint --write`
   to regenerate both the structural fingerprint and `//#lint:policy-fingerprint.inputs`.
   A real Turbo dry-run fixture changes the sweep selection and checks that a dependent
   policy-task hash changes, then restores the file and checks the original hash returns.
   Rejected hand-editing generated input lists or changing `^transit` in Stage A.
6. Reused `policyTurboStep` / `policyTurboScmBase` for planner assertions. Covered full shard
   and Turbo selection, unchanged affected scope, full/CI standalone Turbo routing, JSONC
   comments/trailing commas, missing files, invalid syntax, missing fields, wrong version,
   invalid program, and standalone failure before process execution. Existing command
   fixtures now declare a `bun.lock` root marker and the required config; worker filesystem
   mocks preserve real root discovery. No git setup is needed for these fixture repairs.
7. Used the parent checkout's existing Effect reference because this worktree lacks
   `.repos/effect`; checked Schema and Effect APIs there without provisioning a symlink.
   Applied the schema-first and Effect-first skills. No graft commands, git write commands,
   new source-role files, or sibling C3.3 changes were made.

### Stage A — files

- `packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts` — sweep domain and class.
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` — module-level decoder, required
  reader, explicit planner contract, and full Turbo task support.
- `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts` — standalone selection and
  fingerprint root-config registration.
- `packages/tooling/tool/cli/test/quality-tasks.test.ts` — scope/program and JSONC/error tests;
  required config in the existing full-policy runtime fixture.
- `packages/tooling/tool/cli/test/lint-workers.test.ts` — standalone switch/error coverage and
  root-discovery mock repair.
- `packages/tooling/tool/cli/test/lint-command.test.ts` — required shard fixture configuration
  and a non-git root marker.
- `packages/tooling/tool/cli/test/policy-fingerprint-turbo-inputs.test.ts` — declared-input and
  dependent-hash regression for the sweep file.
- `standards/lint-policy.sweeps.jsonc` — new versioned configuration, `deprecatedApis: "shards"`.
- `standards/policy-tools.fingerprint.json` — generated structural input addition.
- `turbo.json` — generated root fingerprint input addition, Biome formatted.
- `goals/time-to-certainty/research/OPPORTUNITIES.md` — immediate fixture/root-reference receipt.
- `goals/time-to-certainty/research/c3-2b-implementation.md` — this Stage A handoff.

### Verification commands and exit codes

Vitest commands run from `packages/tooling/tool/cli`; other commands run from the repository
root. `<touched>` means the ten changed TypeScript/JSON/JSONC files listed above;
`<touched TS>` means the three source and four test files. Local command logs are under
`/tmp/c3-2b-stage-a/`; they are disposable evidence, not tracked artifacts.

| Command | Exit | Result |
| --- | ---: | --- |
| `bun run beep lint policy-fingerprint --write` | 0 | Generated both fingerprint input lists. |
| `bunx biome check <touched>` | 0 | Ten files checked, no fixes in final check. |
| `bunx oxlint --quiet --disable-nested-config <touched TS>` | 0 | Seven TypeScript files, no diagnostics. |
| `bunx --no-install vitest run --pool=forks --maxWorkers=1 test/lint-command.test.ts` | 0 | 58 tests passed; 11.86 s. Initial exit 1: four introduced fixture-root failures, repaired. |
| `bunx --no-install vitest run --pool=threads test/lint-workers.test.ts test/policy-fingerprint-turbo-inputs.test.ts` | 0 | Final run: 28 tests passed in 40.87 s, including the sweep hash regression. Initial exit 1: two introduced mock-root failures, repaired. |
| `bunx --bun vitest run --pool=threads test/quality-tasks.test.ts -t 'policy Turbo\|plans repo-wide root lint\|deprecated\|sweep'` | 0 | Six selected tests passed, 201 skipped; 3.67 s. Git-writing tests were not selected. |
| `bun run beep lint schema-first` | 0 | 90 live/tracked entries; no missing/stale entries or reported advisories. |
| `bun run beep quality fallow audit --check --base origin/main --quiet` | 0 | Final `.beep/fallow/audit.check.json`: `exitStatus: 0`, `status: "ok"`, zero findings. |
| `bun run beep quality fallow health --check --base origin/main --quiet` | 0 | Final `.beep/fallow/health.check.json`: `exitStatus: 0`, `status: "ok"`, zero findings. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| `bunx --bun --no-install tsgo -p packages/tooling/tool/cli/tsconfig.c3-2b-stage-a.tmp.json` | 0 | Final source-resolving config covers all four touched tests and imports; no diagnostics. |
| `git diff --check` (read-only) | 0 | No whitespace errors. |

The disposable tsgo config extends the CLI's `tsconfig.json`, sets `references: []`,
`exclude: []`, includes the four touched test paths, sets the repository as `rootDir`, and
uses `composite/declaration/declarationMap/emitDeclarationOnly/incremental/sourceMap: false`,
`noEmit: true`, and `types: ["node", "bun"]`. It is removed after verification. This resolves
workspace source without requiring upstream `dist` artifacts and emits no build outputs.

### Measurements

Stage A measures correctness only. It does not measure or claim cheaper typed programs.
The unchanged hosted reference from C3.2 round 3 is **538.3 s** for 28 deprecated-API shards
inside a **632 s** Lint Policy lane; the C3.2b brief's acceptance budget is **538 s**.
The earlier per-package run completed only 52 of 141 tasks at the 15-minute cap.
Those are inherited packet measurements, not new Stage A runs. The switch stays `shards`.

### Blockers and verification split

No unresolved Stage A implementation or sandbox-verification blockers. All required sandbox
commands completed with exit 0 after the documented fixture repairs. The final selected
test total is 92 passing tests (58 command, 28 worker/fingerprint, six policy-plan/config).

Fable owns full `package-verify @beep/repo-cli`, Node coverage, and the hosted lane per the
brief. The rest of `quality-tasks.test.ts` includes git-writing fixtures and was deliberately
not run. Stages B, C, and D were not started: no overlay-based worker, dependency-edge change,
benchmark fleet, hosted switch, or shard retirement was performed. Stop after Stage A.
