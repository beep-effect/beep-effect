# Runner Fallow repair

Bounded source repair in progress. Root retains aggregate Fallow and publication. Developer hook requires a narrow inbox acknowledgement linked to PR #1067, not a waiver.

## Source repair and focused checks

The shared `instrumentMethod` operation owns effect/layer wrapping and vendor fallback. Both adapters retain a single Proxy over the original target; the full adapter selects live before delegating all other properties. Direct target reads and Reflect.get(target, property, receiver) are unchanged, preserving getter receiver and prototype semantics. Public dual signatures, identity storage and instrumentation bodies are untouched. Runtime pool arguments are selected once at module initialization: Node supplies no override; Bun supplies --pool=threads.

All 130 assertion ASTs are unchanged in order. Source/test tsgo, Biome and applicable deprecated-apis ESLint profile exited 0; exact receipts are in the private evidence directory. Default docs ESLint excludes tooling internals/tests, so the existing applicable profile was used. No lint exclusions changed. Fallow help offers only reporting filters that still analyze the project, not isolated exact-path execution; aggregate proof remains Root-owned. Graft retrieval saved approximately 8,369 tokens across two calls.

The required narrow inbox acknowledgement succeeded; its log is retained. No waiver was made.

Node 22.22.3 complete runner suites: exit 0, 80.334s; 42 ordinary passes, 4 expected failures, 2 skips, 4 todo (52 registrations), two files passed. Node 24 and Bun follow sequentially.

## Source final — package proof starting

Checkpoint UTC: 2026-09-10T16:47:59.484964+00:00. No further source changes are planned. Root may publish these frozen bytes while the package proof runs.

- `packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts`: `813911d0ac2b625346b4ce1a6ba605d4f170701e993ea7280ddb93d2898fdbcf`
- `packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts`: `b696dee66ee78ebc19691c78a335ca8a5961b8f0b05ed79792e4a85427117064`

Node 24.20.0 exited 0 in 76.676s; Bun 1.4.2 exited 0 in 38.852s. Each has the same 42 ordinary passes, 4 expected failures, 2 skips, 4 todo, 52 registrations. All 40 snapshotted source/test/fixture inputs were checked; only the two owned paths changed.

Starting exact full command `bun run beep quality package-verify @beep/test-utils`, using the pinned Bun 1.4.2 executable and Node 24.20.0-first command PATH. All command arguments, wall times, exits and log hashes are retained privately.

## Terminal proof

Full package verification exited 0 in 48.002s: inner summary `ok audit 43.1s`, `ok docgen 3.2s`. Both owned sources still match the source-final checkpoint. All launched command sessions have terminated and been joined; no generated scoped runtime fixture directories remain. The other 38 snapshotted source/test/fixture inputs remain byte-identical. No original assertion, registration, fixture, timeout, seed, property floor, cancellation/finalizer behavior or public signature changed.

| Command (executed from repository root) | Exit | Seconds | Receipt |
| --- | ---: | ---: | --- |
| `~/.local/share/mise/installs/bun/1.4.2/bin/bun x --no-install biome check packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts` | 0 | 2.518 | `biome.json` |
| `~/.local/share/mise/installs/bun/1.4.2/bin/bun x --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-fallow-fix/source.json` | 0 | 0.638 | `source-compiler.json` |
| `~/.local/share/mise/installs/bun/1.4.2/bin/bun x --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-fallow-fix/test.json` | 0 | 0.375 | `test-compiler.json` |
| `env BEEP_ESLINT_PROFILE=deprecated-apis ~/.local/share/mise/installs/bun/1.4.2/bin/bun x --no-install eslint packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts --max-warnings=0` | 0 | 13.595 | `eslint.json` |
| `~/.cache/beep/runtime-verification/node-22.22.3/node-v22.22.3-linux-x64/bin/node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose` | 0 | 80.334 | `node22-runners.json` |
| `~/.nvm/versions/node/v24.20.0/bin/node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose` | 0 | 76.676 | `node24-runners.json` |
| `~/.local/share/mise/installs/bun/1.4.2/bin/bun node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose` | 0 | 38.852 | `bun-runners.json` |
| `~/.local/share/mise/installs/bun/1.4.2/bin/bun run beep quality package-verify @beep/test-utils` | 0 | 48.002 | `package-verify.json` |

Each runner receipt retains full verbose output and 23 raw/JSON child results; no child result has zero registered tests. The package run also retains 23 child results. Assertion AST correspondence is in `assertion-preservation.json`; all 130 are preserved in order. `structural-preservation.json` proves the instrumentation prefix and runtime generator content are unchanged apart from the pool spread. Source preimages, unified diff, runtime executable hashes, installed package manifest hashes, before/after source hashes and exact command/log hashes are preserved.

The implementation removes the repeated effect/layer/passthrough decisions and moves the process-constant pool decision out of the generator. It does not claim an aggregate Fallow verdict: Root owns that next proof, and installed help did not provide an isolated exact-path analysis route. No coverage command or baseline/policy write was performed. Installed Effect and @effect/vitest are rc.113; Vitest remains 4.1.11 with the inherited declared Vitest 5 peer mismatch. Successful behavior/compile/package evidence does not erase that version qualification or establish PR acceptance.

Private evidence root: `~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-fallow-fix/`. Entry points: `manifest.json`, `terminal.json`, `accepted-source-hashes.json`, `source.diff`, and the command receipts above. No source edits occurred after the source-final checkpoint. Root retains aggregate Fallow, scoped coverage, and publication judgment.
