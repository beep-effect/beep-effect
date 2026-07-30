# `effect/unstable/process` Inventory — 2026-07-29

## Baseline

Static search of TypeScript under `apps/` and `packages/` found 83 module
consumers: 67 production files, 15 test/dtslint files, and one script. Forty
files construct commands, with 51 `ChildProcess.make` calls: 41 production,
nine test, and one script.

The inventory intentionally excludes `.repos/effect`, prose/JSDoc-only
mentions, generated output, and native `Bun.spawn` / `node:child_process`.

## Consumer files

### Applications

- `apps/professional-desktop/src/intake/VaultDirectoryPickerOrchestrator.ts`
- `apps/professional-desktop/test/vault-directory-picker.test.ts`

### Drivers

- `packages/drivers/acp/dtslint/Acp.tst.ts`
- `packages/drivers/acp/scripts/generate.ts`
- `packages/drivers/acp/src/AcpClient.service.ts`
- `packages/drivers/acp/src/internal/stdio.ts`
- `packages/drivers/acp/test/helpers.ts`
- `packages/drivers/acp/test/integration/client.integration.test.ts`
- `packages/drivers/acp/test/protocol.test.ts`
- `packages/drivers/ai-provider-cli/src/AiProviderCli.service.ts`
- `packages/drivers/ffmpeg/dtslint/FFmpeg.tst.ts`
- `packages/drivers/ffmpeg/src/FFmpeg.service.ts`
- `packages/drivers/ffmpeg/test/FFmpeg.service.test.ts`
- `packages/drivers/libpff/src/Libpff.pffexport.ts`
- `packages/drivers/onepassword-cli/src/OnePasswordCli.service.ts`
- `packages/drivers/openclaw/src/OpenclawCli.service.ts`
- `packages/drivers/openclaw/src/OpenclawSystemd.service.ts`
- `packages/drivers/openclaw/src/internal/spawn.ts`
- `packages/drivers/openclaw/test/integration/OpenclawBinary.acceptance.test.ts`
- `packages/drivers/tailscale/src/Tailscale.service.ts`
- `packages/drivers/tailscale/test/tailscale.test.ts`
- `packages/drivers/tika/src/Tika.tikaapp.ts`

### Foundation and tooling libraries/policy

- `packages/foundation/modeling/utils/src/Stream.ts`
- `packages/tooling/library/repo-utils/src/ProcessArgs.ts`
- `packages/tooling/library/repo-utils/src/schemas/BiomeJson.ts`
- `packages/tooling/policy-pack/repo-configs/test/EffectTsgoEffectFnPolicy.test.ts`

### Repo CLI source

- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalLawLanes.ts`
- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalScorer.ts`
- `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`
- `packages/tooling/tool/cli/src/commands/Codex/Codex.command.ts`
- `packages/tooling/tool/cli/src/commands/Corpus/Corpus.service.ts`
- `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts`
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`
- `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts`
- `packages/tooling/tool/cli/src/commands/Docgen/internal/RunDocgen.ts`
- `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.scope.ts`
- `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts`
- `packages/tooling/tool/cli/src/commands/Files/Files.render.ts`
- `packages/tooling/tool/cli/src/commands/Files/Files.service.ts`
- `packages/tooling/tool/cli/src/commands/Files/internal/Apply.ts`
- `packages/tooling/tool/cli/src/commands/Files/internal/ImageCuration.ts`
- `packages/tooling/tool/cli/src/commands/Files/internal/MediaExec.ts`
- `packages/tooling/tool/cli/src/commands/Files/internal/Process.ts`
- `packages/tooling/tool/cli/src/commands/Image/Image.service.ts`
- `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`
- `packages/tooling/tool/cli/src/commands/Quality/ChangesetGraph.ts`
- `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts`
- `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts`
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/KnipRatchet.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts`
- `packages/tooling/tool/cli/src/commands/Research/Research.service.ts`
- `packages/tooling/tool/cli/src/commands/Research/internal/Daily.ts`
- `packages/tooling/tool/cli/src/commands/Research/internal/RepoCards.ts`
- `packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts`
- `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.service.ts`
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Closeout.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/HeadInstallPreflight.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/IssueArtifacts.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/GhCollect.ts`
- `packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts`
- `packages/tooling/tool/cli/src/internal/github/GhCommand.ts`
- `packages/tooling/tool/cli/src/internal/process/StepExec.ts`
- `packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts`
- `packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts`

### Repo CLI tests and docgen

- `packages/tooling/tool/cli/test/changeset-graph.test.ts`
- `packages/tooling/tool/cli/test/docgen.test.ts`
- `packages/tooling/tool/cli/test/image-command.test.ts`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `packages/tooling/tool/cli/test/worktree-command.test.ts`
- `packages/tooling/tool/docgen/src/Core.ts`

## Export and option usage

Used command exports are `make`, `isStandardCommand`, and command types. Used
spawner exports are the service tag, `spawn`, handle stdout/stderr/all/stdin and
`exitCode`; test doubles also use `make`, `makeHandle`, `ProcessId`, and
`ExitCode`.

No current requirement was found for `pipeTo`, `prefix`, command
transformations, custom file descriptors, `streamString`, `streamLines`,
manual `kill`, `isRunning`, `unref`, or handle `pid`. The convenience
`string` / `lines` helpers do not expose exit status and stdout-only collection
does not own a piped stderr, so they are not suitable replacements for callers
that validate exits or retain separate diagnostics.

Production commands use executable-plus-argv construction. No production call
uses `shell: true`. Existing environment choices are intentional: OpenClaw is
hermetic, while provider CLI overlays extend the inherited environment.

## Findings

1. Eight production commands and the ACP generator leave an output pipe
   unread. Large child output can fill the OS pipe and prevent exit.
2. Tailscale and OpenClaw impose `Effect.timeout` without `forceKillAfter`.
   The platform finalizer waits for child exit, so a SIGTERM-resistant child can
   delay timeout completion indefinitely.
3. `CiLane.currentGitBranch` waits for but ignores a nonzero Git exit.
4. `collectProcessOutput` exposes an unstable child-process handle from
   `foundation/modeling/@beep/utils`; its three production consumers are all
   drivers.
5. The completed repo CLI modularization packet declares `StepExec` the single
   sanctioned process home, but 19 other CLI source files still construct
   commands directly.
6. Aggregate `NodeServices.layer` / `BunServices.layer` compositions include
   `ChildProcessSpawner`; 17 tests plus the repo CLI and docgen entrypoints add
   redundant explicit spawner layers.
7. Upstream defaults all three stdio descriptors to `"pipe"`. Noninteractive
   callers should not leave stdin or output ownership implicit.

## Locked remediation

- Consume every opened output pipe concurrently or configure it as ignored /
  inherited.
- Default capture stdin to ignored and exit-only stdin to its stdio mode.
- Pair Tailscale/OpenClaw timeouts with `Duration.seconds(2)` escalation.
- Localize the three driver collectors; delete the private utility export.
- Migrate compatible CLI calls to `StepExec` / `GitExec`; retain direct
  construction only for `StepExec` and Codex streamed stdin.
- Remove redundant provider layers but retain narrow layers where no aggregate
  exists.
- Prove process mechanics with deterministic mocks plus one live large-output
  regression.
