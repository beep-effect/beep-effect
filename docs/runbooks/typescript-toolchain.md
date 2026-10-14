# TypeScript toolchain: which compiler runs where

Use this runbook when a tool, an editor, or a dependency bump asks "which
TypeScript is this repo on?" The answer is two versions on purpose, and the
Effect compiler is patched over one of them.

## Four packages, four roles

| Package (catalog) | Version | Role |
| --- | --- | --- |
| `typescript` | `^6.0.3` | Programmatic (JS) compiler API only. Never runs a repo typecheck; its `bin/tsc` is shadowed. |
| `@typescript/native` | `npm:typescript@^7.0.2` | The TypeScript 7 Go compiler. Owns the hoisted `node_modules/.bin/tsc`. |
| `@effect/tsgo` + seven `@effect/tsgo-<platform>` packages | `0.51.1` | The Effect language service build of TypeScript 7. Ships one binary per upstream TypeScript version. Pinned to the effect-tsgo version that tsc-rs ports (see below). |
| `tsc-rs` + six `@tsc-rs/<platform>` optional packages | `0.6.0` | The Rust port of the TypeScript 7 compiler ([pingdotgg/ts-rust](https://github.com/pingdotgg/ts-rust)) with the Effect rules of one effect-tsgo version compiled in (0.6.0 ports 0.51.1) and its own TypeScript pinned (`7.1.0-dev.20261008.1`). Runs every `beep:build`, `beep:check` and `beep:check:tests`, the root `check:configs`, and infra's `-b` build. |

The root `prepare` script (`effect-tsgo unpatch && node scripts/prune-tsgo-backups.mjs && effect-tsgo patch`)
copies the Effect binary over the native package's Go binary, keeping the stock
one beside it as `tsc.original`. After install, both of these print
`Version 7.0.2+effect-tsgo.0.51.1`:

```text
node_modules/.bin/tsc      -> @typescript/native/bin/tsc  (patched Go binary)
node_modules/.bin/tsgo     -> tools/tsgo-shim/tsgo.js     (execs the Effect artifact directly)
```

Docgen's example compile, `beep quality test-tsgo`, `beep quality tsgo-smoke`,
every `lint:tsgo-rules` run and the editors therefore use the Effect compiler
with Effect diagnostics. The shim bypasses the patch on purpose: a preserved
`.original` backup can make a newer patcher mistake an older Effect compiler for
the current one (`tools/tsgo-shim/tsgo.js`).

The typecheck and build gates run on `tsc-rs` instead (adopted 2026-10-14,
`goals/tsc-rs-gates`):

```text
node_modules/.bin/tsc-rs   -> tsc-rs/bin/tsc-rs  (Go's JS launcher; execs @tsc-rs/<platform>/bin/tsc-rs)
```

`beep:build` (`tsc-rs -p tsconfig.json && bun run babel`), `beep:check`
(`tsc-rs -p tsconfig.check.json`), `beep:check:tests`
(`tsc-rs -p tsconfig.test.json --noEmit`), the root `check:configs` and infra's
`tsc-rs -b tsconfig.json` all run the Rust compiler. Measured on 2026-10-13
against tsgo 0.47.2 (`goals/tsc-rs-gates/research/measurements-2026-10-13.md`):
3.7× geomean faster on the 150 check projects at about half the peak RSS, and
identical diagnostics, Effect rules included, on 283 of 284 projects (the one
exception was upstream 7.1-dev behaviour, fixed in #1670). Rules of the road:

- The bin is Go's JavaScript launcher, not the sh/JS polyglot the package's
  postinstall would write: bun blocks the postinstall because `tsc-rs` is not
  in `trustedDependencies`, and the launcher costs about 22 ms per run. Keep it
  that way rather than trusting an install script for 22 ms.
- `--fast` stays off in generated scripts and CI (−7 % wall for +35 % CPU and
  +4.7 GB peak on the test projects; it spawns up to 16 checkers). If it is
  ever added, it goes after `-b`: `tsc-rs -b --fast`, never `--fast -b`.
- A failing `tsc-rs` exits 2, not 1. Yeet's issue parser keys on the
  diagnostic text, so the code does not matter to the gates.
- `tsc-rs --version` prints `Version 7.1.0-dev`; the `.bin/tsc` ↔ `.bin/tsgo`
  version test (`EffectTsgoEffectFnPolicy.test.ts`) is about the Effect
  compiler and does not cover it.

## Binary paths (Linux x64)

Verified 2026-10-13 at 0.51.1. Substitute the platform triple on other machines.

- `node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc` is the
  canonical Effect artifact. `effect-tsgo get-exe-path` returns it and the
  `tsgo` shim execs it. A `7.1.0-dev.*` sibling ships beside it; the shim
  selects by matching the native package's `gitHead` against
  `lib/upstream.json`.
- `node_modules/@typescript/typescript-linux-x64/lib/tsc` is the patched
  native binary, byte-identical to the artifact above after `prepare`.
  `tsc.original` beside it is stock TypeScript 7.0.2.

## Version coupling with tsc-rs

`@effect/tsgo` is held at the effect-tsgo version that
[tsc-rs](https://github.com/pingdotgg/ts-rust) ports (0.51.1 for tsc-rs 0.6.0),
because tsc-rs compiles the Effect rules in and the editor and the gate must
agree on rule names and defaults. Both pins sit in the same `syncpack.config.ts`
held-back group; bump them in one change, to the tsc-rs release that ports the
new rule set. The next effect-tsgo release, 0.52.0, adds six rules. Do not
register their names while running 0.51.1: unknown keys produce TS377134
warnings, and `ignoreEffectWarningsInTscExitCode: false` makes those warnings
fail the gate. The planned severities and the deferred `schemaClassMissingBrand`
decision are recorded beside the version hold in `syncpack.config.ts`. Include
lab apps in the next rule sweep because `bun run check` filters them out.

## Programmatic access

Run sync API consumers with Node: the upstream transport requires Node private
stdio handles and currently cannot run under Bun. Native-parser tests therefore
run on Node after the remaining Bun test suite.

First-party compiler tools use `TsNativeApi` from `@beep/repo-utils/TsNativeApi`.
Provide `TsNativeApi.layer(TsNativeConfig.make({ cwd, tsconfig }))` with platform
filesystem/path/child-process services at the entrypoint (for example,
`NodeServices.layer`). The layer owns one Go API process
and closes it when its scope ends. Its default executable is the installed
`@effect/tsgo` artifact; `executable` accepts an explicit override.

Call `program(tsconfig)` or `sourceFile(path)` inside `Effect.scoped`; native
handles remain valid only within that scope. `parseSource(fileName, text)` uses
a distinct virtual path per parse for syntax controls and research walkers.
Walk nodes with `node.forEachChild` and guards from
`@typescript/native/unstable/ast`. `diagnostics(tsconfig)` returns detached,
schema-decoded diagnostics. Binary resolution, protocol and missing-file
failures have typed errors. These unstable API calls are validated against the
installed package declarations and require review when upgrading TypeScript.
The programmatic API uses the Go compiler; check/build gates remain on tsc-rs.

## Why `typescript@6` cannot go yet

TypeScript 7.0 shipped without the classic programmatic API that tools import
from the `typescript` module. Microsoft targets a stable API for 7.1. Until a
consumer releases against that API, it needs the 6.x package under the
`typescript` name. The tstyche row was refreshed 2026-10-14; other rows were
checked 2026-09-24:

| Tool | Needs `typescript@6`? | Why |
| --- | --- | --- |
| typescript-eslint 8.70.x | yes | peer `>=4.8.4 <6.1.0` via typescript-estree and ts-api-utils; TS7 support tracked in typescript-eslint/typescript-eslint#10940 (open) |
| tstyche 8.0.0-beta.0 | no, for effect-drizzle's explicit targets | downloads `5.9.3` and `6.0.3` (hosted matrix) plus `next` (on demand) to its own store; TS7 backend uses the 7.1 sync/ast API. No root `typescript@6` API is loaded for this matrix. |
| commitlint (`cosmiconfig-typescript-loader`) | yes | peer `>=5` on the JS API |
| ts-morph 28 | no | `@ts-morph/common` vendors its own TypeScript 6.0.2 |
| knip 6 | no | parses with oxc-parser, no `typescript` dependency |

The hold lives in `syncpack.config.ts` (the "Held back" update group) so
`deps:update` cannot collapse the split. Reassess the root `typescript@6` hold
when typescript-eslint and the remaining
classic-API consumers support TypeScript 7.1; only then drop `typescript@6` and
re-point consumers that resolve the `typescript` name at the native package.
The separate exact tstyche beta hold ends when stable 8.0 passes the same
effect-drizzle assertions.

Effect-drizzle's hosted matrix is `5.9.3 || 6.0.3`, both exact, so `beep:check`
stays reproducible. TypeScript 7 coverage is an on-demand local run:
`bun run --cwd packages/ecosystem/effect-drizzle beep:type-test --target next`.
On 2026-10-14 `next` resolved to `7.1.0-dev.20261014.1` and all 78 assertions
passed. It stays out of the hosted matrix because `next` moves daily and the beta
refuses exact prerelease targets, including the tsc-rs pin
`7.1.0-dev.20261008.1`. When tstyche lists a 7.1 beta or stable, add that exact
version to the hosted matrix. The beta intentionally excludes 7.0, including
7.0.2. Only the `*` target selects the installed TypeScript; explicit targets
use stock store compilers, without the repo's Effect patch.
See `goals/ts7-tstyche8-type-tests` for the errors and migration evidence.

Microsoft's `@typescript/typescript6` bridge (alias `typescript` to 7 and give
old consumers 6 under a second name) was blocked by a Bun alias-resolution bug
(oven-sh/bun#33834). The fix merged 2026-08-06 and Bun 1.4.0 shipped after it,
so the bridge is now available on the repo's Bun pin. Adopting it is a separate
decision; nothing here depends on it.

## Editors

WebStorm's **Languages & Frameworks > TypeScript** picker only lists packages
named `typescript` that carry `lib/tsserver.js`. Native TypeScript 7 has no
`tsserver.js`, so that picker can never host the Effect compiler and will keep
showing `node_modules/typescript` at 6.0.3. Leave it there, or choose
JetBrains' bundled "TypeScript 7 (Native)" entry for plain TS diagnostics.

Effect diagnostics come from the Effect JetBrains plugin's language server,
which launches the native binary with `--lsp --stdio`. Point its **Binary mode**
at `MANUAL` with the `artifacts/typescript/7.0.2/tsc` path above, never at the
`effect-tsgo` CLI wrapper. `MANUAL` keeps the editor on the catalog's exact
`@effect/tsgo` version; `LATEST` pulls whatever npm tags latest, which can run
ahead of the repo. The plugin setting is stored in the machine-local
`.idea/effect.intellij.xml`, which `beep worktree new` copies into sibling
worktrees (`standards/git-worktrees.md`). A `MANUAL` path is absolute, so a
copied file still points at the source worktree's `node_modules`; re-point it
per worktree if the worktrees drift in `@effect/tsgo` version.
