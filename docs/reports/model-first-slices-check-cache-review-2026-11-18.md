# Cache review for the `check:model-first-slices` root task

Reviewed on `ci/model-first-slices-check` based on `main` @ 6af28031738. Reviewer:
Claude Opus 5.5 (model-first-slices check wiring lane).

`bun run beep cache audit` reports 38 blocking findings, all in the root subject `//`:

- `unreviewed-expansion` on `//#check:model-first-slices`, the new task;
- `configuration-drift` on 37 cached root computations: `config-sync:check`,
  `fallow:boundaries:advisory`, `fallow:boundaries:config-check`, `fallow:dead-code:check`,
  `fallow:fix-preview:advisory`, `fallow:flags:advisory`, `fallow:health:advisory`,
  `fallow:health:check`, `fallow:security:advisory`, `goals:index-check`, `jsdoc:inventory:check`,
  `jsdoc:ratchet:check`, `lint:allowlist`, `lint:circular`, `lint:deprecated-imports`,
  `lint:ecosystem-polarity`, `lint:effect-imports`, `lint:effect-vitest`, `lint:holds`,
  `lint:identity-registry`, `lint:jsdoc:root`, `lint:judge-rubric`, `lint:native-runtime:roots`,
  `lint:package-scripts`, `lint:package-test-typecheck`, `lint:policy-fingerprint`,
  `lint:reflection-artifacts`, `lint:roadmap-refs`, `lint:schema-catalog`, `lint:schema-first`,
  `lint:tsconfig-overlay`, `lint:tsgo-rules`, `repo-sanity:changeset-graph`,
  `repo-sanity:sherif`, `repo-sanity:syncpack`, `repo-sanity:versions`, `topo-sort`.

It also lists one non-blocking `configuration-source-drift` row for `turbo.json`, which gains the
new task.

## Cause

The lane adds three root scripts to `package.json`:

- `install:model-first-slices` runs `bun install --frozen-lockfile` in the standalone prototype
  `scratchpad/model-first-slices`, which has its own `bun.lock` and is not a root workspace member;
- `postinstall` gains `bun run install:model-first-slices`, so a root install also installs the
  prototype and fails when its lockfile is out of date;
- `check:model-first-slices` runs that install, the prototype's `check` (`effect-tsgo tsrs -p` over
  its 17 projects) and the toolchain guard tests in `scratchpad/model-first-slices/shared/tooling`.

The root manifest's bytes are part of the reviewed configuration of every cached root
computation, so each of the 37 drifts. With the root `package.json` restored to `main` and every
other change kept, the audit reports 0 blocking findings: the new task has no script, so it is not
a computation, and nothing else drifts.

## The new computation `//#check:model-first-slices`

`cache: true`, `outputs: []`, no `dependsOn`, no `env` or `passThroughEnv`. The command runs no
`beep` code, so it has no policy-fingerprint seal, like `//#repo-sanity:syncpack`. The Lint Policy
lane runs it in its medium phase; pull requests select it with `--affected` only when one of its
inputs changed.

`bunx turbo run check:model-first-slices --dry-run=json` on this head hashes 617 files:

| Input | Files | Why the result depends on it |
| --- | --- | --- |
| prototype `.ts`, `.tsx`, `.json` (and other script extensions), its `bun.lock`, `bunfig.toml` and the patch files under `scratchpad/model-first-slices/patches` | 383 | the checked programs, their tsconfig files and manifests; the lockfile, install settings and the two patched dependencies decide the prototype's node_modules |
| root `tsconfig.base.json` | 1 | every prototype project extends it; it carries the `@effect/tsgo` rule map the guard test asserts is not overridden |
| root `package.json` | 1 | the guard test compares the prototype's `@effect/tsgo` and `tsrs` pins with the root `catalog`, which the generated root projection does not carry |
| root `bun.lock` | 1 | pins the root node_modules copies of `effect` and `type-fest` that the linked monorepo sources resolve |
| `@beep/identity`, `@beep/schema`, `@beep/utils` and `@beep/types` manifests and sources | 225 | the prototype links `@beep/identity` and `@beep/schema` as source; `tsrs --listFilesOnly` over all 17 projects reads files from those two and from `@beep/utils` and `@beep/types`, which they import |
| global inputs (`.bun-version`, `.nvmrc`, the root projection, `tsconfig.json`, `tsconfig.packages.json`, `turbo.json`) | 6 | inherited from the global configuration |

The prototype's Markdown notes and `.txt` evidence files are not inputs: neither the compiler nor
the guard tests read them (the tests read `package.json`, tsconfig files and TypeScript sources
only). node_modules is excluded everywhere; both lockfiles determine it. The vitest setup writes
outcome records under the prototype's node_modules cache, which no input reads.

Hash checks on this head (`--dry-run=json`, local cache warm): an edit to a prototype source file,
`tsconfig.base.json`, `@beep/identity` source, `@beep/schema` source, the prototype `bun.lock` or the
root `bun.lock` each turns the task from HIT to MISS; an edit to the prototype `README.md` keeps it
a HIT. A planted type error in `scratchpad/model-first-slices/shared/kernel/src/Capability.ts` fails the task with TS2322.

## Judgement

The change adds one cached root task and two script words that are not Turbo tasks. No existing task command,
cache flag, input glob, output glob or environment variable changed. Recording the new computation
and the 37 manifest-byte drifts grants reuse on the existing legacy terms and no qualification.
