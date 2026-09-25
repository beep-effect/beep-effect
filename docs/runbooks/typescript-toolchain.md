# TypeScript toolchain: which compiler runs where

Use this runbook when a tool, an editor, or a dependency bump asks "which
TypeScript is this repo on?" The answer is two versions on purpose, and the
Effect compiler is patched over one of them.

## Three packages, three roles

| Package (catalog) | Version | Role |
| --- | --- | --- |
| `typescript` | `^6.0.3` | Programmatic (JS) compiler API only. Never runs a repo typecheck; its `bin/tsc` is shadowed. |
| `@typescript/native` | `npm:typescript@^7.0.2` | The TypeScript 7 Go compiler. Owns the hoisted `node_modules/.bin/tsc`. |
| `@effect/tsgo` + seven `@effect/tsgo-<platform>` packages | `0.45.0` | The Effect language service build of TypeScript 7. Ships one binary per upstream TypeScript version. |

The root `prepare` script (`effect-tsgo unpatch && node scripts/prune-tsgo-backups.mjs && effect-tsgo patch`)
copies the Effect binary over the native package's Go binary, keeping the stock
one beside it as `tsc.original`. After install, both of these print
`Version 7.0.2+effect-tsgo.0.45.0`:

```text
node_modules/.bin/tsc      -> @typescript/native/bin/tsc  (patched Go binary)
node_modules/.bin/tsgo     -> tools/tsgo-shim/tsgo.js     (execs the Effect artifact directly)
```

`beep:build` (`tsc -p`), `beep:check` (`tsgo -p tsconfig.check.json`), docgen's
example compile, and every `lint:tsgo-rules` run therefore use the same Effect
compiler with Effect diagnostics. The shim bypasses the patch on purpose: a
preserved `.original` backup can make a newer patcher mistake an older Effect
compiler for the current one (`tools/tsgo-shim/tsgo.js`).

## Binary paths (Linux x64)

Verified 2026-09-24. Substitute the platform triple on other machines.

- `node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc` is the
  canonical Effect artifact. `effect-tsgo get-exe-path` returns it and the
  `tsgo` shim execs it. A `7.1.0-dev.*` sibling ships beside it; the shim
  selects by matching the native package's `gitHead` against
  `lib/upstream.json`.
- `node_modules/@typescript/typescript-linux-x64/lib/tsc` is the patched
  native binary, byte-identical to the artifact above after `prepare`.
  `tsc.original` beside it is stock TypeScript 7.0.2.

## Why `typescript@6` cannot go yet

TypeScript 7.0 shipped without the classic programmatic API that tools import
from the `typescript` module. Microsoft targets a stable API for 7.1. Until a
consumer releases against that API, it needs the 6.x package under the
`typescript` name. Consumers in this repo, checked 2026-09-24:

| Tool | Needs `typescript@6`? | Why |
| --- | --- | --- |
| typescript-eslint 8.70.x | yes | peer `>=4.8.4 <6.1.0` via typescript-estree and ts-api-utils; TS7 support tracked in typescript-eslint/typescript-eslint#10940 (open) |
| tstyche 7.x | yes | loads the classic API; its `>=5.4` peer range is open but no TS7 backend exists |
| commitlint (`cosmiconfig-typescript-loader`) | yes | peer `>=5` on the JS API |
| ts-morph 28 | no | `@ts-morph/common` vendors its own TypeScript 6.0.2 |
| knip 6 | no | parses with oxc-parser, no `typescript` dependency |

The hold lives in `syncpack.config.ts` (the "Held back" update group) so
`deps:update` cannot collapse the split. It ends when typescript-eslint and
tstyche ship releases against TypeScript 7.1; at that point drop `typescript@6`
and re-point anything that resolves the `typescript` name at the native package.

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
