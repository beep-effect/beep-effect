# Effect Child-Process Hardening Verification — 2026-07-30

## Outcome

Implementation, local verification, and publication are complete. The work was
isolated from the unrelated shared checkout, published as
[PR #509](https://github.com/beep-effect/beep-effect/pull/509), and rebased onto
current `origin/main`.

## Static acceptance

- Repo CLI source has four direct `ChildProcess.make` calls: three in
  `internal/process/StepExec.ts` and the streamed-stdin Codex command.
- `packages/foundation/modeling/utils` has no `collectProcessOutput` match.
- An AST inventory of all current `ChildProcess.make` calls under `apps/` and
  `packages/` found explicit stdin ownership in every object-literal command
  option. The two identifier-based libpff calls share `spawnOptions`, which
  explicitly sets stdin to `"ignore"` and drains both output streams
  concurrently.
- Explicit Node spawner layers that remain are narrow filesystem/path test
  layers. Aggregate `NodeServices.layer` / `BunServices.layer` compositions no
  longer add a redundant child-process provider.
- Tailscale and timeout-bounded OpenClaw commands use a named two-second
  `forceKillAfter` grace.

## Green focused proof

| Proof | Result |
| --- | --- |
| Affected package typechecks | Green for ACP, AI provider CLI, 1Password CLI, OpenClaw, professional desktop, repo CLI, repo docgen, repo configs, Tailscale, Tika, and utils |
| Repo CLI process and explicit-stdin tests | 7 files, 165 tests passed |
| Driver tests | ACP 15, AI provider CLI 15, 1Password CLI 4, OpenClaw 52, Tailscale 14, and Tika 55 tests passed |
| Supporting package tests | utils 164, repo configs 43, and repo docgen 87 tests passed |
| Desktop picker tests | 5 tests passed |
| Package docgen | `@beep/openclaw` and `@beep/repo-cli` passed |
| Changeset graph | 127 workspaces, 268 changeset files, 718 references, zero missing |
| Frozen lockfile resolution | Passed |
| Packet mechanics | Launcher size, manifest JSON, scoped diff check, and reflection lint passed |

The repo CLI process suite includes a live child that emits 1 MiB to stdout and
1 MiB to stderr, proving concurrent drain without pipe deadlock. It also covers
nonzero Git branch resolution.

## Original shared-branch attribution

Before publication authorization, `bun run beep yeet verify` completed in
verify-only mode with no commit or push. The head-install preflight and
integration lane passed; the integration proof completed 171 tasks. Security,
secret, and Nix lanes also passed.

The full pre-push lane remained red because of concurrent work outside this
packet:

- `@beep/xai` build recursion (`TS2589`);
- provenance test-file typecheck drift;
- epistemic JSDoc/schema/changeset/type-test findings;
- the pre-existing repo CLI architecture migration fixture mismatch;
- unrelated tsconfig/boundary synchronization findings.

The verify run initially also identified one in-scope unused repo-docgen
dependency and process-related clone findings. Those were fixed afterward.
Current Knip output contains only four epistemic client/UI findings. Current
Fallow introduced findings contain only two epistemic dead dependencies, four
epistemic/langextract complexity findings, and one langextract/provenance clone;
no process-hardening file remains in the introduced findings.

`bun run docgen` now proves `@beep/repo-docgen` successfully and stops only at
the concurrent `@beep/epistemic-client` barrel missing `@since`.

`bun run beep goals doctor` reports no finding for this packet. It remains
branch-wide red only for invalid phase-status spellings in the concurrent
`citation-verified-span-substrate` and `epistemic-contradiction-triage`
manifests, plus inherited baseline debt.

Structured Yeet evidence:
`.beep/yeet/runs/feat_contradiction-source-highlight-6dbadf89ac1a/verdict.json`.

## Latest-main publication refresh

After publication authorization, the patch was reconstructed in a clean
worktree on `feat/effect-child-process-hardening` from `origin/main` at
`c83514a0f9`. This preserved the unrelated shared branch's 161 staged and 81
unstaged paths. One upstream refactor had moved the repo-config test's process
creation into a shared helper; the explicit `stdin: "ignore"` ownership was
ported into that helper.

Fresh proof on the isolated latest-main branch:

- Frozen install and Effect `tsgo` patch preparation passed.
- The 11 affected package checks completed 80 Turbo tasks successfully.
- The 11 affected package test lanes plus ACP integration passed 127 test files
  and 1,335 tests.
- The repo CLI package alone passed 53 files and 762 tests, including the live
  large-output process regression.
- An AST scan found 28 current `ChildProcess.make` calls. Every object-literal
  options argument explicitly owns stdin; the two identifier-based libpff
  calls use the audited `spawnOptions`.
- The repo CLI retains only four direct calls: three in `StepExec` and the
  streamed-stdin Codex command.

The canonical `bun run beep yeet publish --amend --no-edit --pr --monitor`
proof then passed locally:

- build: 127 packages;
- global check: 125 tasks;
- dtslint/tsgo: 137 files, 555 tests, and 1,949 assertions;
- test-file typecheck: 590 files across 122 packages;
- lint: all 26 policy parts;
- docgen: 123 packages;
- unit: 125 package tasks, including 53 repo CLI files and 762 tests;
- integration: 167 tasks;
- Fallow, changeset graph, secrets, OSV, Semgrep, Nix, and frozen-lockfile
  checks.

The command committed and pushed `d0aaa0f309` and opened PR #509. Hosted run
`30526298986` passed build, check, codegen drift, commitlint, coverage, docgen,
Fallow, JSDoc, Knip, lint, lint policy, Nix, desktop IPC stdio, property laws,
repo sanity, integration, SAST, secrets, security, and preview deployment. Its
first unit attempt hit only the unrelated five-second timeout in
`packages/tooling/tool/cli/test/lint-command.test.ts` ("reports redundant
LiteralKit const assertions"). A focused local rerun passed in 266 ms; the
failed hosted job was retried without a source change and passed.

The branch was then rebased without conflict onto `origin/main` at
`4cee4def49`; that upstream commit had no path overlap with this goal. The
rebased implementation commit is `a0a0d7994d`. The retained closeout reflection,
packet-state flip, and regenerated goal index ship in the same PR.
