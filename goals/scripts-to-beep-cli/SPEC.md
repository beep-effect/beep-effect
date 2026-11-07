# Retire ./scripts into beep CLI commands and a compiled beep binary for CI Spec

## Objective

Every file under `scripts/` either becomes a `beep` CLI command (Effect code in `@beep/repo-cli`
or its `beep-*` tools) or is deleted, except the single reviewed shell exception
`scripts/cloud/bootstrap.sh`. Hosted CI runs its pre-toolchain steps (change profile, runner
resources, apt-source pruning) through a compiled `beep` binary fetched before `bun install`, so
no shell logic lives in workflows or composite actions. A lint law fails on any other tracked
shell script outside the `.claude/`, `.codex/` and `.cursor/` hook directories.

Graduated 2026-11-06 from `explorations/pulumi-to-alchemy` (grill session decisions D10, D11,
D15); sibling of `infra-alchemy-rebuild` and `python-free-repo`.

## Non-Goals

- Rewriting the agent hook scripts under `.claude/hooks`, `.codex/hooks`, `.cursor/hooks` (they
  run inside the harness before any toolchain; allowlisted by directory).
- Changing what the CI steps compute; `beep ci change-profile` must emit the same variables
  `ci-change-profile.sh` emits today.
- The `scripts/` equivalents inside goal and exploration packets (`goals/*/ops/*.sh`): those are
  evidence, governed by `python-free-repo`'s triage rule only if the operator extends it.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

| Today | Becomes |
| --- | --- |
| `ci-change-profile.sh` (retired) | `beep ci change-profile <base>` (prints the same `eval`-able assignments) |
| `ci-runner-resources.sh` (retired) | `beep ci runner-resources <lane> -- <command>` |
| `ci-prune-apt-sources.sh` (retired) | `beep ci prune-apt` |
| the two GitHub App `create-*.ts` registration scripts + manifests (retired) | `beep github app mint <app>` over `@beep/github`; manifests move to the command's policy data |
| `prune-tsgo-backups.mjs` (retired) | `beep toolchain prune-tsgo-backups` in `packages/tooling/tool/cli/src/commands/Toolchain/` (root `prepare` calls it) |
| `regenerate-merge-driver.sh` (retired) | `beep git merge-driver regenerate` (the `check.yml` assertion updates) |
| `changeset-changelog.cjs` (retired) | `packages/tooling/tool/cli/src/ChangesetChangelog.ts`, referenced from `.changeset/config.json` |
| `test-gitleaks-observation-digest.py` (retired) | `packages/tooling/tool/cli/test/gitleaks-observation-digest.test.ts` (`python-free-repo` triage row) |
| `knowledge-refs-rewrite.rules.json`, `references.json` (moved) | `packages/tooling/policy-pack/repo-configs/data/` |
| the `agent-runs.slice` systemd units (retired) | `beep quality scheduler slice [--install]`, rendered from `packages/tooling/tool/cli/src/internal/repo-run/AgentRunsSlice.ts` |
| `scripts/cloud/bootstrap.sh`, `fetch.sh` (retired) | `bootstrap.sh` stays as the one exception; `fetch.sh` folded into it as its `--fetch-worker` mode |

New: a `release`/`main` workflow step that runs `bun build --compile` on the beep CLI and
publishes `beep-linux-x64` (and the runner image arch) as a release asset or cached action
artifact; `setup-monorepo-ci` fetches it before `bun install`. A lint law `tracked-shell-allowlist`
in `beep lint laws`.

## Constraints

- Commands are Effect CLI commands in the existing `Ci`, `Github`, `Git` and `Toolchain` groups
  per `07-non-slice-families.md` "Repo CLI Command Topology"; new groups only when the topology
  doc says so. `goals/beep-cli-composition` decides tool-package placement; this packet follows it.
- `beep github app mint` builds on `@beep/github` (`goals/repo-cli-gh-git-consolidation`); the
  minted app's id and private key feed `@beep/infra-github` as config (D10).
- The compiled binary is produced from a tagged `main` commit, checksum-pinned in the action, and
  never built on the PR's own head (supply-chain boundary: the binary that gates a PR is not the
  PR's code).
- Workflows invoke `beep ci ...` only; no inline shell beyond the fetch and `eval` lines.
- Shell is allowed only in `scripts/cloud/bootstrap.sh` and the hook directories; the lint law
  encodes exactly that allowlist, no wildcards.

## Acceptance Criteria

- [x] `ls scripts` shows only `cloud/bootstrap.sh` (and `cloud/` itself).
- [ ] `check.yml`, `heavy.yml`, `storybook.yml`, `release-desktop.yml` and
      `setup-monorepo-ci/action.yml` call `beep ci ...` through the fetched binary; a hosted run
      is green on each.
- [x] `beep github app mint --help` exists and a dry-run reproduces today's manifests byte for byte.
- [x] `bun run beep lint laws` fails on a tracked `.sh` outside the allowlist (fixture test) and
      passes on `main`.
- [x] Root `prepare`, `.changeset/config.json` and the merge-driver assertion reference beep
      commands, not `scripts/`.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/scripts-to-beep-cli/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/scripts-to-beep-cli/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/scripts-to-beep-cli` | Passes |
| Scripts gone | `git ls-files scripts \| grep -v '^scripts/cloud/bootstrap.sh$'` | empty |
| Shell law | `bun run beep lint laws` | Passes |
| Change-profile parity | shell output captured before deletion; `packages/tooling/tool/cli/test/ci-bootstrap-parity.test.ts` holds it as golden strings | passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add scripts-to-beep-cli --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug scripts-to-beep-cli`; add a `kind: decision` file there, never edit this block._

### Compiled CI binary is a slim bin-ci entry, not the full CLI, 2026-11-07

Probe 2026-11-06: `bun build --compile src/bin-main.ts` bundles 6687 modules (163 MB) and dies at start with `Cannot find module '@duckdb/node-api'`; even the full `ci` group drags in vite. A probe entry holding only `CiOperational` bundles 672 modules (110 MB) and starts in about 0.15 s. So `src/bin-ci.ts` registers a root `beep` with a `ci` group of the pre-toolchain commands (change-profile, runner-resources, prune-apt, patterns, job-env); the same command values are registered in the full `ci` group, so `beep ci <x>` is byte-identical in both.

Lane `goals/scripts-to-beep-cli`

Reverse: Compile src/bin-main.ts with native externals and fix its eager DuckDB load

### Port the #2850 cache-pilot scripts into beep ci commands in PR 2, 2026-11-07

#2850 (e9187a295fe) added `ci-cache-native-sandbox.sh`, `ci-cache-pilot-cleanup.sh`, `ci-cache-pilot-inputs.sh` and `ci-cache-local-summary.py` (with a Python test) under scripts/ after PR 1 branched. SPEC acceptance requires scripts/ to hold only `cloud/bootstrap.sh` and the tracked-shell law rejects them, so PR 2 ports each to a `beep ci` subcommand with identical behaviour, moves the Python test to vitest, and switches heavy.yml to `bun --no-env-file run beep ci <command>`. Every call runs after `setup-monorepo-ci`, and the pinned CI binary predates the new commands, so they run from the checkout; `cache-sandbox` and `cache-pilot-cleanup` are also registered in the bootstrap set, so a later pin bump can move them onto the binary. Their workflow semantics stay owned by the cache-pilot lane.

Lane `goals/scripts-to-beep-cli-p2`

Reverse: Restore the four scripts/ci-cache-* files and their heavy.yml calls from #2850

### change-profile reads the checkout's pattern file and fails open like the shell, 2026-11-07

Parity with the retired ci-change-profile.sh: pinned `BEEP_CI_PR_BASE_SHA`/`BEEP_CI_PR_HEAD_SHA` win over positional base/head; a missing pin or failed diff on a pull_request warns and keeps every profile active; patterns come from the checkout's `CiOperational.patterns.json` when present (fail closed on an invalid file) because the binary is main's code but must classify the PR's tree.

Lane `goals/scripts-to-beep-cli`

Reverse: Drop the runtime pattern read and the fail-open branch; use the compiled-in patterns

### Binary ships as a checksum-pinned GitHub release asset built from main, 2026-11-07

A workflow on `push` to `main` (paths: the CLI and its workspace deps, plus `workflow_dispatch`) compiles `bin-ci.ts` for linux-x64 and publishes release `beep-ci-<short sha>` with a `.sha256`. `setup-monorepo-ci` and the bare-runner steps fetch a pinned tag and verify the pinned sha256 before running it; a pin bump is its own PR. The PR's own head never builds the binary that gates it (SPEC constraint). Cut over in two PRs: PR 1 lands the commands and the publisher, PR 2 pins the first published asset and switches the workflows.

Lane `goals/scripts-to-beep-cli`

Reverse: Delete the publish workflow and restore the shell steps from git history

### New command groups toolchain, git and github in @beep/repo-cli, 2026-11-07

No existing group fits the tsgo backup prune, the merge driver or GitHub App registration. Until goals/beep-cli-composition moves groups into beep-<group> tools, every group stays in @beep/repo-cli (07-non-slice-families Repo CLI Command Topology).

Lane `goals/scripts-to-beep-cli`

Reverse: Fold the commands into existing groups and remove the three groups

### Root prepare calls the beep command and the command never fails install, 2026-11-07

Workspace exports resolve to src, so `bun run beep` works during `prepare` without built dists. The command catches every failure and exits 0 with a warning, matching the old script's try/catch: pruning is an optimization, never an install gate.

Lane `goals/scripts-to-beep-cli`

Reverse: Restore the former prune-tsgo-backups.mjs node script in package.json prepare (from git history)

### tracked-shell-allowlist exempts packet evidence, infra/ and two named fixtures, 2026-11-07

On 2026-11-07 `git ls-files '*.sh'` outside the hook dirs lists 84 files: packet evidence under `goals/` and `explorations/` (a SPEC non-goal), seven under `infra/` (deleted by `infra-alchemy-rebuild`), two test fixtures (`packages/tooling/tool/cli/test/fixtures/models/locators.sh`, `packages/tooling/tool/docgen/test/fixtures/section-example/tsc-wrapper.sh`), and the `scripts/` files this packet deletes. The law therefore allows exact roots `.claude/`, `.codex/`, `.cursor/`, `goals/`, `explorations/`, `infra/` (removal condition: infra-alchemy-rebuild retires `infra/`), plus exact file paths `scripts/cloud/bootstrap.sh` and the two fixtures. No glob patterns; every entry carries an owner and a removal condition in the Exception Ledger.

Lane `goals/scripts-to-beep-cli`

Reverse: Remove the extra roots from the law's allowlist once their owners delete the shell

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| `scripts/cloud/bootstrap.sh` stays shell | one file | packet owner | installs the toolchain the binary needs; vendor dashboards call it by path | a vendor-side way to run a fetched binary before any toolchain |
| `.claude/`, `.codex/`, `.cursor/` hook `.sh` files | hook dirs | harness owners | run inside the agent harness before any repo toolchain | harnesses accept TypeScript hooks without a runtime |
| `goals/`, `explorations/` packet `.sh` files | packet roots | packet owners | packet evidence and ops replays, a SPEC non-goal | the operator extends `python-free-repo`'s triage rule to packet shell |
| `infra/` `.sh` files | `infra/` root (10 files on 2026-11-07) | `infra-alchemy-rebuild` | Pulumi-era infra scripts the Alchemy rebuild replaces | `infra-alchemy-rebuild` retires `infra/` |
| `packages/tooling/tool/cli/test/fixtures/models/locators.sh` | one test fixture | `@beep/repo-cli` | `models-check.test.ts` locates model pins inside a shell source | the models manifest stops listing shell locator fixtures |
| `packages/tooling/tool/docgen/test/fixtures/section-example/tsc-wrapper.sh` | one test fixture | `@beep/docgen` | `Core.test.ts` proves docgen runs a configured compiler wrapper | docgen drops the wrapped-compiler configuration |
