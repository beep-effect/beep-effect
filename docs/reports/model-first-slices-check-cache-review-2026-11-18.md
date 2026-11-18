# Cache review for the `check:model-first-slices` root task

Reviewed on `ci/model-first-slices-check` with `main` @ 4c8ff79287b merged in. Reviewer:
Claude Opus 5.5 (model-first-slices check wiring lane). This record covers two states of the lane.

## First record (on `main` @ 6af28031738)

`bun run beep cache audit` reported 38 blocking findings, all in the root subject `//`: an
`unreviewed-expansion` on the new `//#check:model-first-slices` and a `configuration-drift` on 37
cached root computations from the new root script bytes. With the root `package.json` restored to
`main` and every other change kept, the audit reported 0 blocking findings. That record was
written with this file's earlier text.

## Final record (this revision)

After `main` @ 4c8ff79287b was merged in, the lane changed one thing: the root `postinstall`
runs the prototype's install only when `CI` is unset, so a hosted job does not download the
prototype's dependencies. The task's inputs are unchanged.

`bun run beep cache audit` reports 38 blocking `configuration-drift` findings, all in `//`:
`check:model-first-slices`, `config-sync:check`, `fallow:boundaries:advisory`,
`fallow:boundaries:config-check`, `fallow:dead-code:check`, `fallow:fix-preview:advisory`,
`fallow:flags:advisory`, `fallow:health:advisory`, `fallow:health:check`,
`fallow:security:advisory`, `goals:index-check`, `jsdoc:inventory:check`, `jsdoc:ratchet:check`,
`lint:allowlist`, `lint:circular`, `lint:deprecated-imports`, `lint:ecosystem-polarity`,
`lint:effect-imports`, `lint:effect-vitest`, `lint:holds`, `lint:identity-registry`,
`lint:jsdoc:root`, `lint:judge-rubric`, `lint:native-runtime:roots`, `lint:package-scripts`,
`lint:package-test-typecheck`, `lint:policy-fingerprint`, `lint:reflection-artifacts`,
`lint:roadmap-refs`, `lint:schema-catalog`, `lint:schema-first`, `lint:tsconfig-overlay`,
`lint:tsgo-rules`, `repo-sanity:changeset-graph`, `repo-sanity:sherif`, `repo-sanity:syncpack`,
`repo-sanity:versions`, `topo-sort`. These are measured against the first record.

All 38 drift on the `postinstall` bytes alone: with the root `package.json` restored to the first
record's bytes and every other change kept, the audit reports 0 blocking findings. The merge of
`main` changed only prototype files, none of them an input of another cached root task, and the
task's own input set is a function of the tree, not a recorded configuration.

## Cause

The lane adds three root scripts to `package.json`:

- `install:model-first-slices` runs `bun install --frozen-lockfile` in the standalone prototype
  `scratchpad/model-first-slices`, which has its own `bun.lock` and is not a root workspace member;
- `postinstall` gains `if [ -z "${CI:-}" ]; then bun run install:model-first-slices; fi`. A local
  root install (a clone, a worktree, the Yeet head-install preflight) installs the prototype and
  fails when its lockfile is out of date. A hosted install, where GitHub Actions sets `CI=true`,
  skips it. Package scripts run under the system shell (`/bin/sh`), so the test is POSIX;
- `check:model-first-slices` runs that install unconditionally, then the prototype's `check`
  (`effect-tsgo tsrs -p` over its 17 projects) and the toolchain guard tests in
  `scratchpad/model-first-slices/shared/tooling`.

The root manifest's bytes are part of the reviewed configuration of every cached root
computation, so each drifts on them.

## The computation `//#check:model-first-slices`

`cache: true`, `outputs: []`, no `dependsOn`, no `env` or `passThroughEnv`. The command runs no
`beep` code, so it has no policy-fingerprint seal, like `//#repo-sanity:syncpack`. The Lint Policy
lane runs it in its medium phase; pull requests select it with `--affected` only when one of its
inputs changed. `CI` is not part of its key and need not be: the task installs the prototype
itself, so its result does not depend on whether the root `postinstall` did.

`bunx turbo run check:model-first-slices --dry-run=json` on this head hashes 613 files:

| Input | Files | Why the result depends on it |
| --- | --- | --- |
| prototype `.ts`, `.tsx`, `.json` (and other script extensions), its `bun.lock`, `bunfig.toml` and the patch files under `scratchpad/model-first-slices/patches` | 379 | the checked programs, their tsconfig files and manifests; the lockfile, install settings and the two patched dependencies decide the prototype's node_modules |
| root `tsconfig.base.json` | 1 | every prototype project extends it; it carries the `@effect/tsgo` rule map the guard test asserts is not overridden |
| root `package.json` | 1 | the guard test compares the prototype's `@effect/tsgo` and `tsrs` pins with the root `catalog`, which the generated root projection does not carry |
| root `bun.lock` | 1 | pins the root node_modules copies of `effect` and `type-fest` that the linked monorepo sources resolve |
| `@beep/identity`, `@beep/schema`, `@beep/utils` and `@beep/types` manifests and sources | 225 | the prototype links `@beep/identity` and `@beep/schema` as source; `tsrs --listFilesOnly` over all 17 projects reads files from those two and from `@beep/utils` and `@beep/types`, which they import |
| global inputs (`.bun-version`, `.nvmrc`, the root projection, `tsconfig.json`, `tsconfig.packages.json`, `turbo.json`) | 6 | inherited from the global configuration |

The prototype's Markdown notes and `.txt` files (the two old probes are now `.ts.txt` text records)
are not inputs: neither the compiler nor the guard tests read them (the tests read `package.json`,
tsconfig files and TypeScript sources, and skip `tmp` folders). node_modules is excluded. The guard
test now writes its canary project, from text held in the test file (an input), into a git-ignored
`tmp` folder under `scratchpad/model-first-slices/shared/tooling` for the length of one test. That
folder stays an input: no checked project includes it, so leftover files from an interrupted run
can only re-key the task, never replay a wrong result. The vitest setup writes outcome records under the prototype's
node_modules cache, which no input reads.

Hash checks (`--dry-run=json` and real runs, local cache): on the first record's head an edit to
a prototype source file, `tsconfig.base.json`, `@beep/identity` source, `@beep/schema` source, the
prototype `bun.lock` or the root `bun.lock` each turned the task from HIT to MISS, and an edit to
the prototype `README.md` kept it a HIT. A planted type error in
`scratchpad/model-first-slices/shared/kernel/src/Capability.ts` failed the task with TS2322. On
this head a second run is a hit and an edit to a prototype source file is a miss.

## Judgement

The change adds one cached root task and two script words that are not Turbo tasks, and gates
one of those words on `CI`. No other task command, cache flag, input glob, output glob or
environment variable changed. Recording the computation and the manifest-byte drifts grants reuse
on the existing legacy terms and no qualification.
