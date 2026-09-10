# Node22 runtime fixture launch correction

Bounded fixture-launch correction in progress. Production, templates, configuration and prior receipts remain immutable.

## Confirmed child-launch cause and authorized correction

Root's official Node22 receipt and constructor probe were inspected without network/install operations. The exact executable is the cached Node 22.22.3 binary identified in the command receipts. The same existing `trace-success` fixture was copied into a scoped diagnostic directory twice. The copy retained every original statement and added only a diagnostic console record of process version, worker execArgv and Float16Array availability; original fixture templates were never edited.

Before: forced `--pool=threads` exits **1**, reports **zero tests**, and reproduces the hosted thread-torn-down/never-initialized teardown error. After: omitting that one argument uses Vitest's canonical default pool, exits **0**, and passes **one intended trace-success test**. The worker reports Node 22.22.3, Float16Array type `function`, and execArgv retaining `--js-float16array`. No feature flag was stripped, relocated or globally changed. Both diagnostic child processes exited and their scoped temporary directories were removed; raw outputs, reports and copied probe source remain private.

The sole source edit is the fixture launch array: Node children receive no pool override; Bun retains `--pool=threads`. Existing local tests use `process.versions.bun !== undefined` to identify Bun; this inline use follows that established runtime boundary without introducing another helper. Graft found the existing pattern (estimated 8,864 tokens saved). Effect-first/schema-first guidance was reloaded. All other launch arguments, explicit child env overrides, extendEnv behavior, production code, templates, assertions, seeds, timeouts and global config remain unchanged.

## Focused validation and preservation

Exact Node22 parent regressions for the body-log watchdog and one absolute property deadline both pass (two selected tests; thirteen other parent cases filtered out only by the diagnostic name filter). No source skip mode changed. Focused tsgo and Biome pass. AST comparison retains all **130** assertion statements in the current parent test file, byte-equivalent after normalization and in the same order. The diff is precisely one launch-array element replaced by the runtime condition. The existing 52-registration full suites are now executing sequentially under all three pinned binaries, then normal local package verification.

The diagnostic fixture's capability line is private-only. Final full suites use the original untouched template and the owned launch selection. Each full run sets the existing BEEP_VITEST_RUNTIME_EVIDENCE transport to a distinct private directory so child JSON, raw diagnostics, phases and source copies survive normal scoped cleanup. PATH is pinned per invocation (Node22 for Node22 proofs; Node24 plus Bun1.4.2 for local canonical proofs), not globally changed.

The full exact Node22 runner matrix is now terminal green: **42 ordinary passes, four expected failures, two skips, four todo (52 registrations), two files**, exit 0 in **81.868 seconds**. Every production/template input still matches the before snapshot; only the authorized parent launch file differs. The targeted ESLint deprecated-apis profile also passes with --max-warnings=0. The default docs profile excludes test files, so it is not represented as an applicable JSDoc gate on this one-line argument change.

Node24 and Bun full suites and package verification continue sequentially. No failed runtime assertion or timeout has been weakened. Child result summaries are retained privately; intentionally failing child fixtures are evaluated by their unchanged parent assertions, not mistaken for package failures or rewritten into success.

The complete runtime matrix now passes on final bytes:

| Runtime | Wall seconds | Full runner result |
| --- | ---: | --- |
| Node 22.22.3 | 81.868 | 42 passed, 4 expected fail, 2 skipped, 4 todo; 52 registrations |
| Node 24.20.0 | 77.087 | Same 52 registrations and outcomes |
| Bun 1.4.2 | 47.028 | Same 52 registrations and outcomes |

Installed Vitest 4.1.11 resolves an unspecified pool to forks (`coverage.DM_a_rWm.js:180`); its CLI help also documents forks as default. This source evidence plus the Node22 worker execArgv/capability output confirms the successful diagnostic used the intended canonical path. The failed forced-thread receipt remains immutable; its zero-test outcome is not counted as a passing test.

The only remaining active step is required full package verification on pinned local Node24/Bun1.4.2. Root owns the later normal scoped Node22 coverage proof. No coverage or scanner/benchmark ran in this lane. The inherited Effect/@effect/vitest rc.113 versus Vitest4 peer qualification remains; runtime success is bounded compatibility evidence, not a change to the declared Vitest >=5 <6 support range.

## Terminal handoff

Full `bun run beep quality package-verify @beep/test-utils` exited **0** in **58.832 seconds**. Complete terminal summary: `ok audit 51.2s   ok docgen 3.3s`. Successful canonical rendering supplies step summaries rather than successful child stdout; no unobserved package-wide test total is invented. Runner child evidence was retained through the existing opt-in evidence transport. All launched child processes and the serial supervisor are joined.

Final source SHA256: `0b1b920cab59ee6fd139fded04f986695833f1eb39e1e2798967d738f592d67c`.

Preimage SHA256: `6d6ff918d355a14d019d102e847d54d804c05b93e601e105ae0944bc50411d33`.

All **22 protected inputs** (production sources, ordinary runner test and original fixture templates) match the preimage hashes. Only the authorized parent test file changed. The scoped generated fixture directory scan finds zero remaining `.runtime-*` directories after all processes joined. Private retained copies are evidence artifacts, not live executable fixture directories.

The original 130 parent assertion statements are unchanged in order and normalized syntax. The one-line diff changes only pool-argument selection, preserving every registration, body, cancellation/finalizer/deadline assertion and the same scoped fixture cleanup. No environment scrub, feature-flag relocation, timeout, retry, global pool override or dependency change occurred. Node22 support is now demonstrated at both actual child and full parent-runner levels. Root still owns normal scoped Node22 coverage and hosted acceptance; this lane does not claim those unrun proofs.

## Exact receipts

Private prefix: `~/.cache/beep/effect-vitest-canon/pr1067-resume/node22-fixture-fix/`. Command receipts record exact executable/arguments/cwd, bounded PATH prefix, terminal exit, wall time, final test-source hashes and complete log hash. `runtime-identities.json` records observed executable versions and binary SHA256; Root's verified Node22 archive receipt is hash-linked in `root-input-hashes.json`. All wrapper commands ran from the worktree; direct diagnostic children used package cwd, matching the actual harness.

| Receipt | Exit | Seconds | Exact command |
| --- | ---: | ---: | --- |
| `forced-threads-receipt.json` | 1 | 10.345 | `~/.cache/beep/runtime-verification/node-22.22.3/node-v22.22.3-linux-x64/bin/node ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/node_modules/vitest/vitest.mjs run ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-node22-proof-4auymra2/runtime.test.ts --pool=threads --root ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/packages/tooling/test-kit/test-utils --reporter=json --reporter=~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-node22-proof-4auymra2/diagnostic-reporter.ts --outputFile=~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-node22-proof-4auymra2/result.json` |
| `canonical-receipt.json` | 0 | 3.981 | `~/.cache/beep/runtime-verification/node-22.22.3/node-v22.22.3-linux-x64/bin/node ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/node_modules/vitest/vitest.mjs run ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-node22-proof-90_seaj4/runtime.test.ts --root ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/packages/tooling/test-kit/test-utils --reporter=json --reporter=~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-node22-proof-90_seaj4/diagnostic-reporter.ts --outputFile=~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-node22-proof-90_seaj4/result.json` |
| `node22-regressions.json` | 0 | 8.741 | `~/.cache/beep/runtime-verification/node-22.22.3/node-v22.22.3-linux-x64/bin/node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.runtime.test.ts -t uses the body log and concrete name|uses one absolute deadline --reporter=verbose` |
| `compiler.json` | 0 | 0.380 | `~/.local/share/mise/installs/bun/1.4.2/bin/bun x --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/node22-fixture-fix/tsconfig.test.json` |
| `biome.json` | 0 | 2.513 | `~/.local/share/mise/installs/bun/1.4.2/bin/bun x --no-install biome check packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts` |
| `eslint.json` | 0 | 12.998 | `env BEEP_ESLINT_PROFILE=deprecated-apis ~/.local/share/mise/installs/bun/1.4.2/bin/bun x --no-install eslint packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts --max-warnings=0` |
| `node22-runners.json` | 0 | 81.868 | `~/.cache/beep/runtime-verification/node-22.22.3/node-v22.22.3-linux-x64/bin/node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose` |
| `node24-runners.json` | 0 | 77.087 | `~/.nvm/versions/node/v24.20.0/bin/node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose` |
| `bun-runners.json` | 0 | 47.028 | `~/.local/share/mise/installs/bun/1.4.2/bin/bun node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose` |
| `package-verify.json` | 0 | 58.832 | `~/.local/share/mise/installs/bun/1.4.2/bin/bun run beep quality package-verify @beep/test-utils` |

The forced-threads exit 1 is the required preserved negative control. Its actual existing child reports zero tests and never emits the capability line. The canonical child reports the passed `trace layer trace success` case and logs Node22/Float16Array/execArgv from inside the executing worker. The private diagnostic append does not change any original assertion or template byte. Both source copies and both result JSONs are retained.

The focused compiler extends the existing package test config without suppressions; Biome passes without writes. ESLint uses the repository's existing deprecated-apis profile for the owned test path with --max-warnings=0; the docs profile excludes tests and is not represented as applicable. A read-only source lookup initially used an unmatched shell glob for a Vitest config chunk; the actual default-pool location was then found by targeted search. No failed compiler/test gate was hidden or waived.

`before.ts`, `after.ts`, `source.diff`, `assertion-preservation.json`, before/final source hashes, all child results, raw child copies/logs, cleanup check, runtime identities and all terminal receipts are included in `manifest.json`. The manifest also hashes this report. Prior failed hosted evidence and earlier receipts remain immutable. No Git, network, coverage, scanner/benchmark, baseline or canonical inventory writer ran. Package command generated build effects are the normal authorized proof behavior, not hand-authored source changes.
