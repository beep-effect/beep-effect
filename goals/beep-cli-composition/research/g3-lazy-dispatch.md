# G3 — argv-first lazy dispatch

Status: landed with the G3 PR. The bin now reads argv, picks one route from a
static manifest, and imports only that group's `commands/<Group>` facade. The
other groups render from help-only stubs, so the command surface is unchanged.

## Design

Schema, then service, then implementation:

| Layer | Module | What it holds |
| --- | --- | --- |
| Schema | `packages/tooling/tool/cli/src/internal/dispatch/Dispatch.schemas.ts` | `RuntimeService` (`fs-utils`, `ts-morph`, `memory-stats`), `CommandGroupHelp` (name, description, short description, alias, unlisted), `DispatchTarget` (`group`, `root`, `full-tree`, `quality-task`). |
| Manifest | `.../internal/dispatch/Dispatch.manifest.ts` | 44 routes in `beep --help` order. Each has static help, its runtime service keys, and a dynamic import of its facade. Plus the quality-task route. |
| Dispatch | `.../internal/dispatch/Dispatch.ts` | `resolveDispatchTarget` (argv only), `dispatchRuntimeServices`, `loadDispatchTarget`, `makeStubCommand`, `makeRootCommand`. |
| Bin | `.../src/bin-main.ts` | Builds the platform base plus only the declared service Layers, loads the target, runs the composed root. The `CliRuntime.main` failure rendering from #2309 is unchanged. |

Choices:

- **Stubs, not a help renderer.** A stub is `Command.make(name)` with the
  group's description, short description, alias and unlisted bit. Those are
  the only fields `effect/cli` reads from a subcommand when it renders the
  parent's help and its unknown-subcommand suggestions. The real renderer
  produces the output, so nothing in the formatter is copied.
- **Pure dispatch, not a `Context.Service`.** Dispatch runs before any Layer
  exists, so it is plain functions over argv and the manifest. Group runtime
  Layers are still Effect Layers, built per route.
- **Typed per-group Layers.** Each loader's command type must have its
  requirements covered by the base (Bun services, HTTP client, crypto, scope)
  plus the keys it declares. A missing key is a compile error. On the first
  pass this caught `lint`, which also needs `TSMorphService`. Two facades are
  exported with their requirements cast away (`lawsCommand`,
  `researchCommand`). Their keys were set by hand from their uncast types:
  Laws needs `ts-morph`, Research needs only the base.
- **The fast paths are now routes.** The `ci` fast path is the `ci` group
  route (`fs-utils`, as before). The quality-task fast path is the
  `quality-task` target, with the same fallback to the command groups when
  the invocation does not parse. The `lint --fix` no-op stays in `bin.ts`,
  which runs before any Effect module loads.
- **Full tree when needed.** `--completions` and `--wizard` walk every group,
  so they load the whole tree, as before.
- **Moves unchanged.** The manifest has only type imports and dynamic
  imports, so W8 moves it to the composition app by rewriting the import
  specifiers alone. `test/lint-subcommand-allowlist.test.ts` now asserts this.

## Surface proof

- Before and after, every one of the 501 command paths from the real tree
  (`walk(rootCommand)`) ran as `bun src/bin.ts <path> --help`. Output and exit
  code were captured per path. `diff -r` of the two snapshot directories was
  empty: all 501 are byte-identical.
- Edge cases, each compared against HEAD's bin: no arguments, `--version`,
  `-v`, an unknown group, an unknown subcommand, `--completions zsh`,
  `--completions=bash` (351 KB and 476 KB scripts), `--log-level debug yeet
  --help`, `--log-level=debug docs --help`, `-h lint`, `build --help`, `check
  --help`, `ci --help`, `ci nonsense`, `yeet reply --nope`, `goals`, `quality
  --bogus`, `--`, `-- -- yeet --help`, `-- -- nope` and `reviewer --help`. All
  were identical. `-- yeet` and `test --dry-run-nonexistent` differed only in
  timestamps and durations.
- `test/dispatch-manifest.test.ts` fails CI on drift. It checks:
  - the manifest names every registered group, in root order;
  - each entry's help fields equal the real command's;
  - each loader returns the same command object the eager root registers;
  - root help, unknown-group output and every group's `--help` render
    identically through the stub root and the eager root;
  - the argv resolution cases above.

  Changing one manifest description fails two of its tests.

## Startup

Measured on DankStation, 2026-10-31, with `bun 1.4.4`. Each command ran seven
times as `bun packages/tooling/tool/cli/src/bin.ts <args>` (the `bun run
beep` script adds its own constant). The table shows medians, from GNU `time`
`%e` (wall) and `%M` (max RSS). Before is HEAD `2c1ff256c1`'s bin, run back to
back with after.

| Command | Wall before | Wall after | RSS before | RSS after |
| --- | --- | --- | --- | --- |
| `beep --help` | 1.61 s | 0.25 s | 511 MB | 115 MB |
| `beep yeet --help` | 1.62 s | 1.03 s | 518 MB | 384 MB |
| `beep lint laws --help` | 1.49 s | 0.97 s | 517 MB | 344 MB |
| `beep docs --help` | 1.53 s | 0.41 s | 516 MB | 174 MB |
| `beep lint package-scripts` (real policy run) | 2.18 s | 1.59 s | 962 MB | 635 MB |

An earlier before run in the same session gave 1.43, 1.36, 1.35, 1.35 and
1.89 s, with the same RSS within 10 MB.

What remains is each group's own import graph. `yeet` and `lint` each still
load about 0.7 s of their own modules. That is the per-group cost G4 and the
W-wave splits act on, not dispatch. The 2026-10-21 "~0.9 s floor" was mostly
the eager tree: `beep docs --help` builds `FsUtilsLive`, so it loads the
`@beep/repo-utils` barrel, and still runs in 0.41 s. Root help loads no group
and no barrel, and runs in 0.25 s.
