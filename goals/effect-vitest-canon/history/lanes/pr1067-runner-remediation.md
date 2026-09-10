# PR 1067 runner remediation

Bounded foundation closeout continuation. Requested routing: gpt-6-astra / medium. Root owns Git, GitHub, packet state and aggregate/package proof. This lane owns the authorized runner source/tests/fixtures only. No P1/P2 or merge authorization. Earlier reports and receipts remain immutable.

Scope: four Docgen metadata failures and two hosted Fallow complexity findings; preserve all 172 assertions, registration modes, clocks, scopes, timeout values and property floors. New private evidence: `~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/`.

## Initial evidence and decisions

Current parser `packages/tooling/tool/docgen/src/Parser.ts:822` reads module documentation from the first statement's leading comments. Added distinct module headers to the error module and test seam, and a separate errors-category reexport block. The `it` export now uses a named binding to the exact same runtime property; its complete example remains intact.

Graft callers discovery found instrumentation callers and the runtime fixture helper. Parser lookup missed the module-level symbol and was resolved with targeted source search. Graft estimated 13,811 tokens saved. No graph writes. Current Effect/schema/JSDoc skills and conventions applied.

The developer P0 hook required an inbox acknowledgement despite lane ownership boundaries. Ran `bun run beep yeet inbox ack Heavy_Lint_Policy-849b780ad0a0 --thread-url https://github.com/beep-effect/beep-effect/pull/1067`, exit 0. This records the existing PR link, not a waiver or verification claim. The tool reported replacing an existing acknowledgement receipt; Root should review that narrow hook-required write.

Complexity changes extract lifecycle start/finish registration into `startTestLifecycle`, and scoped evidence registration into `retainFixtureEvidence`. Both remain private in existing modules. The evidence helper reads the current output at finalization; it does not capture an early string value. Registration order remains temporary directory, evidence finalizer, child process. Watchdog arming/race code and all test assertions remain in place.

## Bounded-check friction

The documented `bun run docgen:local -- --package @beep/test-utils` selected the right package, but the live planner expanded `--filter=...@beep/test-utils` into 123 dependent packages. This was not a missing selector: the log explicitly confirms selection and expansion. Stopped only that invocation's descendants as soon as the expansion was observed; retained the aborted receipt and complete log. No package/Yeet proof was requested. Generated doc/cache artifacts from the unintended expansion were not reverted because they may overlap Root's work. Root should review this planner boundary; a direct package `beep:docgen` invocation supplies the bounded replacement. The aborted aggregate is not green evidence.

Private two-file native Fallow checks reproduce CC11/cognitive9 and CC10/cognitive5. Their missing workspace test graph classifies coverage as none, so their advisory exits and CRAP values are deliberately not presented as hosted acceptance. Final raw complexity deltas and an explicitly conditional hosted-coverage calculation are recorded separately.

## Focused validation before runtime suites

Installed identities: Node v24.20.0, Bun 1.4.2, Effect and @effect/vitest 4.0.0-rc.112, Vitest 4.1.11. Exact executable paths and installed manifest hashes are in `runtime-identity.json`; pinned reference and configuration hashes are in `reference-hashes.json`. No dependency or configuration edits.

Source/test/copied-fixture `tsgo` checks all exited 0, using private configs extending the current canonical package overlays without changing plugins or diagnostic policy. Biome exited 0; both `.txt` templates also produced byte-identical TypeScript formatting output, exit 0, before final freeze. Oxlint exited 0 with the existing nine manual runtime boundary warnings in the copied scenario fixture, no errors and no suppressions. The direct package `bun run --cwd packages/tooling/test-kit/test-utils beep:docgen` exited 0 and validated all 17 modules / 42 examples. All original example fences remain byte-identical.

Native Fallow on immutable two-file pre/post snapshots: instrumentation inner generator CC11/cognitive9 → CC5/cognitive4; extracted lifecycle generator CC7/cognitive5. Runtime fixture generator CC10/cognitive5 → CC9/cognitive4. No threshold changes. Both isolated native runs exited 1 because absent import/test graph coverage yields unrelated-to-hosted CRAP=CC²+CC; they are measurement receipts, not a claimed quality pass. Holding the hosted estimated 40% coverage constant gives CRAP10.4 for the instrumentation generator, 17.6 for its lifecycle helper, and 26.5 for the runtime generator, below the unchanged 30 threshold. Root must confirm final graph-based scoring; this calculation is conditional, not new measured coverage.

`terminal-preservation-structural.json` retains all 172 assertion ASTs (26 ordinary runner, 131 runtime parent, 15 copied fixture), all registration names, and all timeout/seed/numRuns/fcRuns expressions with no removals. Existing tests/templates remain unchanged except `runFixture` helper composition. Full runtime suites now run serially on `final-source-hashes.json` bytes and preserve verbose, JSON and raw child diagnostics.

## Structural preservation and first runtime receipt

Beyond the 172-assertion AST comparison, `critical-block-preservation.json` proves byte-identical watchdog body construction, failure capture, deadline arming, raceFirst winner selection and terminal outcome handling. Every runtime test registration and body below the `it.layer` boundary is byte-identical. The child command arguments, environment, output drain and exit-code acquisition are also byte-identical. The callable `it` value remains `InstrumentedVitestRuntime.it`, now expressed as a parser-visible named declaration.

The complete Node suites exited 0 in 81.157 seconds on the frozen final source: 31 ordinary passes, one expected failure, two skips and four todos. No new test, timeout, assertion or registration mode was introduced. Generated docgen pages retained privately confirm a documented `it` section under testing and both failure reexports under errors; module metadata and all example compilation passed.

## Final handoff

All six assigned findings have code repairs within the five changed owned files. Both complete runner suites pass on identical final bytes: **Node and Bun each retain 31 ordinary passes + 1 expected fail + 2 skips + 4 todos (38 registrations)**. All 172 assertions and complete examples are preserved. The Bun suite exited 0 in 41.564 seconds. Each suite retained 23 child evidence directories, including raw errors, phase/abort records, JSON reports and scope-exit artifacts. `runtime-evidence.json` hashes every retained child file.

The isolated Fallow 3.23.0 measurements used native defaults (cognitive threshold 15), while the immutable hosted receipt uses threshold 8. The measured final cognitive values 4/5 are below both. No repository policy was changed; isolated exits were not promoted to hosted acceptance. Root retains the graph-based audit, package proof and final PR judgment.

Changed source paths and exact preimage/final identities:

| Path | Before SHA256 | After SHA256 |
| --- | --- | --- |
| `packages/tooling/test-kit/test-utils/src/Vitest.ts` | `a36ae2eacbd246210bf65cae4427301d78862a92d1d05b53f09df32f9d4f87f2` | `fcb65b1a1d86ee8e9c6ccc9e78cdf42dad230aadd9578af59b6836eb1c2885d7` |
| `packages/tooling/test-kit/test-utils/src/Vitest.errors.ts` | `f554bc3c6803ff19a31c6fdcf330538504a968170a6950f124dd8e9868ca7fe5` | `6e691362f10ddbaa4b1d7c9c10f1f8bf134f4c695aadf90f93c32484755cd974` |
| `packages/tooling/test-kit/test-utils/src/test/Vitest.test-kit.ts` | `31042562606b951bfdd2ac39dbedf38bd2fd6b40817e1abd053bdd33f9e75268` | `986bcb1ce7edf69df8848c0a6c77cd6dbb4dbc1e1595535fa825dfce75ecaf61` |
| `packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts` | `bc4a160deff0f8917564370f29bdce92e5ddf69f8cbc33b19e7f80cd2623a94b` | `b38ab17f14e1fc8c735eb8a8deae145e50acc603856b223c4dfcaddccce1d961` |
| `packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts` | `eae87c3af064180abee6807409f100751a8e6176524b5c312bf97b05195057d9` | `5214c9d4793fcd49634e553e6ba7f8c87e2f579e1cf88703e2a6a41429271964` |

`before/`, `after/`, `before-hashes.json`, `final-source-hashes.json`, and `owned.diff` preserve exact source state. The other three snapshotted runner test/template files are byte-identical. `final-drift.json` checks 42 frozen package source/test/config inputs separately from Root's historical snapshots: no unexpected source/config drift and no surviving temporary runtime fixture directories. The original 42-input selection also captured one generated page because its path contains a `test` component: `packages/tooling/test-kit/test-utils/docs/modules/test/Vitest.test-kit.ts.md` changed as expected during docgen and is explicitly classified in the receipt. The original snapshot is retained, not redefined. This check does not comprehensively cover generated documentation/cache artifacts from the stopped planner expansion or another lane's disjoint package.

Commands and outcomes (full argv and log SHA256 are retained in `command-index.json`; private path prefix below is `~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/`):

| Receipt | Command | Exit | Seconds | Log SHA256 |
| --- | --- | --- | --- | --- |
| `biome-receipt.json` | `node_modules/.bin/biome check packages/tooling/test-kit/test-utils/src/Vitest.ts packages/tooling/test-kit/test-utils/src/Vitest.errors.ts packages/tooling/test-kit/test-utils/src/test/Vitest.test-kit.ts packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts packages/tooling/test-kit/test-utils/test/Vitest.test.ts packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts` | 0 | 2.333 | `96e9898496fb78bddeee17cd66ce07961686e4ae8b9db27b9a54c5b3c6bc52a7` |
| `complexity-after-receipt.json` | `node_modules/.bin/fallow health --root ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/complexity-after --complexity --format json --no-cache` | 1 | 0.074 | `508e2e64aca3a2f12d56c89a955b40fc369e873c54f93405183388694c338f7d` |
| `complexity-before-receipt.json` | `node_modules/.bin/fallow health --root ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/complexity-before --complexity --format json --no-cache` | 1 | 0.070 | `4ee5f717b99ba3feba80a27bd5eecf0419eee6ee7da7d2abbf4e01e4f9782515` |
| `docgen-package-receipt.json` | `bun run --cwd packages/tooling/test-kit/test-utils beep:docgen` | 0 | 3.441 | `6991431cd5b3a3c356de738862b5a2818ca99dc28ae11abe21409450bd0100ab` |
| `docgen-receipt.json` | `bun run docgen:local -- --package @beep/test-utils` | 130 | 75.874 | `9f9bd8ce10f9a1297e3295e4a7c16ccfee612fe745827571a6e8db63f789f82f` |
| `fixtures-receipt.json` | `node_modules/.bin/tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/tsconfig.fixtures.json` | 0 | 0.677 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `oxlint-receipt.json` | `node_modules/.bin/oxlint --config .oxlintrc.json packages/tooling/test-kit/test-utils/src/Vitest.ts packages/tooling/test-kit/test-utils/src/Vitest.errors.ts packages/tooling/test-kit/test-utils/src/test/Vitest.test-kit.ts packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts packages/tooling/test-kit/test-utils/test/Vitest.test.ts packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/runtime.test.ts ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/diagnostic-reporter.ts` | 0 | 0.329 | `d22d7d07901f2c009970aa611b96dc53f4dbf1aeb7b45d2e975fe92c72a420ee` |
| `preservation-receipt.json` | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/preservation.mjs` | 0 | 0.169 | `ffee9ec393bca17dfce539f579cc875b7999eb47859dacf39ec130ff0cfc83ad` |
| `runner-bun-receipt.json` | `~/.local/share/mise/installs/bun/1.4.2/bin/bun node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils/ test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose --reporter=json --outputFile=~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/runner-bun-result.json` | 0 | 41.564 | `22fbeaf7157d4befc77d0a5b5434f92707d0e7e26a088d27acdaee268803e6f8` |
| `runner-node-receipt.json` | `~/.nvm/versions/node/v24.20.0/bin/node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils/ test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose --reporter=json --outputFile=~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/runner-node-result.json` | 0 | 81.157 | `4dbe2fcd3b2643b5f22e7155c83bb957a1c029f8ee4cccaaa685f16c5b099373` |
| `source-receipt.json` | `node_modules/.bin/tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/tsconfig.source.json` | 0 | 0.661 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `tests-receipt.json` | `node_modules/.bin/tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-remediation/tsconfig.tests.json` | 0 | 0.704 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The two template Biome stdin checks each exited 0 with exact byte equality (`template-format.json`). Initial five-file `biome check --write` exited 0 and formatted only the two refactored owned modules. Discovery/help commands were read-only; the unsuccessful shell `command -v fallow` probe exited 1 because the binary is package-local, subsequently resolved as `node_modules/.bin/fallow`. Exact runtime and compiler configuration identities are retained. The developer-required inbox acknowledgement and the aborted docgen-local expansion are disclosed above; neither is a waiver or a proof success.

No source-only export guard, public production clock binding, TestEnv, watchdog arithmetic, scope lifetime, terminal race policy, timeout, property floor, seed or skip mode changed. No Git, publication, merge, detector scan, package-verify, baseline or dependency change was performed by this lane. The stopped docgen-local attempt remains exit 130 evidence; the direct package docgen replacement is green. Prior package failures and attribution receipts remain immutable. Correctness of aggregate deadline handling still does not imply universal event-loop preemption. No P1/P2 or mergeable/phase acceptance is claimed; Root owns the remaining combined and hosted proof.
