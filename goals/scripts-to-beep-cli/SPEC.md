# Retire ./scripts into beep CLI commands and a compiled beep binary for CI Spec

## Objective

Every file under `./scripts` either becomes a `beep` CLI command (Effect code in `@beep/repo-cli`
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
- The `./scripts` equivalents inside goal and exploration packets (`goals/*/ops/*.sh`): those are
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
| `scripts/ci-change-profile.sh` | `beep ci change-profile <base>` (prints the same `eval`-able assignments) |
| `scripts/ci-runner-resources.sh` | `beep ci runner-resources <lane> -- <command>` |
| `scripts/ci-prune-apt-sources.sh` | `beep ci prune-apt` |
| `scripts/github-app/create-*.ts` + manifests | `beep github app mint <app>` over `@beep/github`; manifests move to the command's policy data |
| `scripts/prune-tsgo-backups.mjs` | `beep toolchain prune-tsgo-backups` (root `prepare` calls it) |
| `scripts/regenerate-merge-driver.sh` | `beep git merge-driver regenerate` (the `check.yml` assertion updates) |
| `scripts/changeset-changelog.cjs` | `@beep/repo-cli` changeset changelog formatter referenced from `.changeset/config.json` |
| `scripts/test-gitleaks-observation-digest.py` | vitest in the owning package (`python-free-repo` triage row) |
| `scripts/knowledge-refs-rewrite.rules.json`, `scripts/references.json` | policy data under `packages/tooling/policy-pack/repo-configs` |
| `scripts/systemd/*` | installed by `beep` (the unit text becomes a rendered template in the owning command) |
| `scripts/cloud/bootstrap.sh`, `scripts/cloud/fetch.sh` | `bootstrap.sh` stays as the one exception; `fetch.sh` folds into it or into the compiled binary fetch |

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

- [ ] `ls scripts` shows only `cloud/bootstrap.sh` (and `cloud/` itself).
- [ ] `check.yml`, `heavy.yml`, `storybook.yml`, `release-desktop.yml` and
      `setup-monorepo-ci/action.yml` call `beep ci ...` through the fetched binary; a hosted run
      is green on each.
- [ ] `beep github app mint --help` exists and a dry-run reproduces today's manifests byte for byte.
- [ ] `bun run beep lint laws` fails on a tracked `.sh` outside the allowlist (fixture test) and
      passes on `main`.
- [ ] Root `prepare`, `.changeset/config.json` and the merge-driver assertion reference beep
      commands, not `scripts/`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/scripts-to-beep-cli/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/scripts-to-beep-cli/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/scripts-to-beep-cli` | Passes |
| Scripts gone | `git ls-files scripts \| grep -v '^scripts/cloud/bootstrap.sh$'` | empty |
| Shell law | `bun run beep lint laws` | Passes |
| Change-profile parity | `diff <(scripts/ci-change-profile.sh origin/main) <(beep ci change-profile origin/main)` before deletion | identical |

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

_No decision files yet._

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| `scripts/cloud/bootstrap.sh` stays shell | one file | packet owner | installs the toolchain the binary needs; vendor dashboards call it by path | a vendor-side way to run a fetched binary before any toolchain |
| `.claude/`, `.codex/`, `.cursor/` hook `.sh` files | hook dirs | harness owners | run inside the agent harness before any repo toolchain | harnesses accept TypeScript hooks without a runtime |
