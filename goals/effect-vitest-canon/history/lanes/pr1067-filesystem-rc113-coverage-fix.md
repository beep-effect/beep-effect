# Filesystem rc.113 coverage repair

Bounded repair in progress. Prior port and coverage receipts remain immutable. Only the shared conformance helper and this report are repository write targets.

## Attribution and repair

The retained LCOV map identifies exactly two uncalled functions, anonymous_50 and anonymous_51, both at old line 453: the Stream.tap observer and its Effect.sync thunk. Line 453 is uncovered. Two branch outcomes were missing: line 460's alternate Exit-tag branch and line 290's existing false `tempFileScopedRemovesDirectory` option. The latter remains intentional supported option behavior and is not newly introduced. Root's named coverage-final.json was absent from the evidence directory; the first map-reading attempt failed with FileNotFoundError. The retained lcov.info supplied the exact function/line/branch map instead; its relevant block is preserved privately as before.lcov.info. No prior artifact was overwritten.

Each of the same four invalid-stream cases now runs a valid five-byte-chunk stream through the **same observer callback**, asserts the complete known 27-byte fixture content, clears the captured chunks, and then runs the original invalid stream. This proves observer wiring using genuine subject IO. The original empty-chunks, failed-exit, RangeError-defect and no-typed-error assertions remain. A direct fail-fast `assert(exit._tag === "Failure")` supplies TypeScript narrowing after the existing strictEqual assertion; all Cause assertions then run unconditionally. No success branch remains after an asserted failure. This removes unreachable control flow without changing failure-kind semantics or production behavior.

Applicable Effect-first/schema-first guidance was reloaded. Graft located the existing observer (estimated 6,867 tokens saved). No schemas, options, helper modules, exports, test registrations, timeouts or suppression comments changed. Initial compiler errors in the draft were local: standalone curried Stream.tap inferred unknown, and a native array is not pipeable. The corrected version shares the observer function itself through Stream.tap at each use and uses public pipe/A.map/A.join. Compiler and lint now pass without exclusions or casts.

## Focused results

Node v24.20.0 and Bun 1.4.2 each pass **108/108** cases across MemoryFileSystem, NodeFileSystem and BunFileSystem: all 36 registrations per adapter, no skips or deletions. The Node run also collected private focused coverage with the canonical package configuration/provider and a command-scoped include for only FileSystemConformance.ts. It reports **341/341 lines, 346/346 statements, 84/84 functions and 4/5 branches: 100/100/100/80 percent**, meeting the existing file floors in this diagnostic. The remaining uncovered branch is the unchanged false directory-cleanup option. No baseline or threshold was written; Root owns the normal scoped coverage rerun and acceptance.

AST proof retains all **81** pre-repair assertion statements in order, including the 48 assertions preserved by the prior port. Two new assertions strengthen the positive control and failure narrowing, giving 83 template assertion statements. All prior registration names and all 15 rc.113 additions remain. The registration AST comparison isolates the change to the invalid-stream parameterized template. Source snapshots, exact assertion correspondence and the diff are preserved privately. Full package verification is currently running on final bytes.

## Final handoff

Full `bun run beep quality package-verify @beep/test-utils` **exited 0**, wall **55.476 seconds**; complete terminal inner summary: `ok audit 48.7s   ok docgen 4.8s`. The canonical successful renderer exposes these step summaries, not successful child stdout/test counts. No package test counts beyond the retained terminal evidence are invented. All launched processes have terminated and been joined.

Final source SHA256: `3ff320297b6b45ad3b6ab55a5873931b90d9666a71b9766d70b260520b2b2734`.

Accepted pre-repair source SHA256: `b378e557f5dfecaf2eb8079816ec8996efe42f90df06ff44d9964c97a1c87ecd`.

The MIT notice is byte-identical. All 14 protected reference/core/test/manifest/barrel inputs checked against the accepted audit still match. The only repository implementation change is `packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts`: add the core `pipe` import, strengthen the stream observation template, and remove its redundant conditional after fail-fast narrowing. All 26 source registration templates remain (expanding to 36 cases); 25 template ASTs are identical. Options/defaults, dual public API, per-test subject provision and cleanup lifetimes are unchanged. No Memory or platform implementation defect was exposed.

The exact source change is retained in `source.diff`; `before.ts` and `after.ts` are immutable source snapshots. `assertion-preservation.json` and `registration-preservation.json` provide old/new lines and normalized AST correspondence. `before.lcov.info` and `uncovered-after.json` identify the before/after coverage paths. `coverage/` holds private JSON, JSON summary and LCOV diagnostics; these are not the normal package-scoped ratchet proof. Root owns that final rerun. This handoff does not claim baseline adoption, whole-PR acceptance, phase closure or publication.

Installed versions remain Effect/@effect/vitest 4.0.0-rc.113, Vitest 4.1.11, Node v24.20.0 and Bun 1.4.2. The inherited adapter peer declaration requires Vitest >=5 <6. The focused and package passes provide bounded compatibility evidence; they do not remove that declared version mismatch. No dependency or configuration was changed.

## Exact command receipts

Private prefix: `~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-coverage-fix/`. All commands ran from the worktree root. Adapter `--root` selects the existing package configuration and generated aliases. Focused compiler config extends the actual package check config, selecting only the owned source; full package verification uses the unchanged complete package scripts. Every receipt records the command, cwd, terminal exit, wall time, source hashes and complete log hash. Formatting was limited to the owned file.

| Receipt | Exit | Seconds | Command |
| --- | ---: | ---: | --- |
| `compiler.json` | 1 | 0.310 | `bunx --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-coverage-fix/tsconfig.source.json` |
| `biome.json` | 0 | 2.392 | `bunx --no-install biome check packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` |
| `format.json` | 0 | 2.358 | `bunx --no-install biome check --write packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` |
| `compiler-final.json` | 0 | 0.323 | `bunx --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-coverage-fix/tsconfig.source.json` |
| `node-adapters.json` | 0 | 1.089 | `node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/FileSystemConformance.node.test.ts test/FileSystemConformance.bun.test.ts test/MemoryFileSystem/Conformance.test.ts --reporter=verbose --coverage --coverage.include=src/FileSystemConformance.ts --coverage.reporter=json --coverage.reporter=json-summary --coverage.reporter=lcov --coverage.reportsDirectory=~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-coverage-fix/coverage` |
| `bun-adapters.json` | 0 | 0.731 | `bun node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/FileSystemConformance.node.test.ts test/FileSystemConformance.bun.test.ts test/MemoryFileSystem/Conformance.test.ts --reporter=verbose` |
| `oxlint.json` | 0 | 0.238 | `bunx --no-install oxlint packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` |
| `preservation.json` | 0 | 0.128 | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-coverage-fix/preservation-final.cjs` |
| `registration-preservation.json` | 0 | 0.138 | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-coverage-fix/registration-proof.cjs` |
| `package-verify.json` | 0 | 55.476 | `bun run beep quality package-verify @beep/test-utils` |

The initial compiler exit 1 is fully attributed above and retained; final compiler exit 0 supersedes it only for corrected bytes. Initial missing-input map extraction is likewise retained as a documented discovery failure, not represented as a source failure. The formatter's source-before/source-after differ because it formatted the draft; every subsequent behavioral/compiler/package proof names the final hash. No failed acceptance condition was waived.

`manifest.json` hashes every private evidence file plus this report and the final repository source. No previous receipt, normal coverage output, baseline, graph, census or other lane source was overwritten. All evidence writes are confined to the owned new private directory and this report, apart from normal generated effects of the explicitly required canonical package command.
