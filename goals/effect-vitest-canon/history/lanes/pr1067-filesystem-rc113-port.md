# Filesystem rc.113 conformance port

Implementation and proof in progress. Ownership is limited to the shared conformance helper and this report. Prior audit and receipts remain immutable.

The initial port adds the exact upstream parameter arrays (4 stream, 4 seek, 5 readAlloc) and two ordinary tests using public `it.effect.each`/`it.effect`. Subject-local fixtures replace upstream host paths; every new registration provides the subject layer per test and scopes resources. Truncate-to-five and the eleven-byte write result are now asserted. Attribution advances to rc.113 without changing the MIT notice. Graft found the existing fixture (estimated 5,417 tokens saved); no new helper module was added.

Initial focused compiler exited 1: introduced `missedPipeableOpportunity` at the nested Option assertion in the upstream port. This is a local style diagnostic to fix without changing the assertion. Complete receipt: private `compiler.json` / `compiler.log`. No adapter execution has occurred yet.

Focused final-source results: compiler, Biome and Oxlint exit 0. Node and Bun adapter commands each exit 0 with **108/108 passing**, three files, no skips: 36 cases per Memory/Node/Bun subject. Every new case executes under both actual runtimes. The plain Node execution of the Bun alias is compatibility evidence; the Bun execution supplies actual Bun runtime evidence. The initial compiler diagnostic was resolved by naming the Option-presence boolean before asserting it, preserving TypeScript narrowing and the upstream assertion meaning.

The required full package-verify command is running on the same source bytes. No independent rerun of the unrelated runner child suites was launched; their normal package execution remains part of required verification.

## Final outcome

The exact rc.113 additions are ported. All **36 cases × three adapters × two runtimes pass (216 focused executions)**. Required full `bun run beep quality package-verify @beep/test-utils` exits **0** in **70.853 seconds**, on unchanged final source. Its complete terminal summary is `ok audit 64.1s   ok docgen 4.3s`. The canonical renderer prints successful step summaries and only expands failed step output (`Quality/internal/PackageVerify.ts` 681–703); consequently this receipt does not expose individual package-test counts or successful child stdout. No invented inner test counts are claimed and no duplicate package run was started to manufacture them. Audit includes package build, source/test check, tests and lint per the inspected package scripts; docgen supplies export/example validation.

Only `packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` and this report were authored in the repository. All processes launched by this lane have exited and been joined. No Memory/platform implementation repair was needed. Root retains coverage, PR integration and final acceptance; this result is not a phase closure or universal filesystem conformance claim.

## Exact upstream mapping

Reference: `pr1067-resume/effect-rc113-review-reference/packages/effect/test/FileSystem.test-utils.ts`, commit `d3b837aee836f35d625d55205f7d6e61305fc198`. Paths and line spans below identify final source bytes.

| Upstream lines | Final helper lines | Instances | Assertions and scope |
| --- | --- | ---: | --- |
| 244–269 | 441–466 | 4 | Both invalid chunk sizes with undefined/zero bytesToRead; no chunks, failure exit, RangeError defect, no typed failure. Subject-local scoped fixture, direct subject provision. |
| 271–282 | 468–480 | 1 | Numeric read result 5 and decoded lorem. Upstream inner file scope retained; outer scope supplies fixture cleanup and subject lifetime. |
| 308–343 | 495–528 | 4 | Exact four negative offsets/origins; full BadArgument attribution; unchanged cursor and subsequent bytes; valid backward recovery. Inner file scope and outer fixture scope retained. Public Fs.SeekMode types the finite test table without casts. |
| 345–372 | 530–558 | 5 | Exact five invalid readAlloc values; typed error, no defect, exact module/method; cursor six and next ipsum read. Named Option-presence boolean preserves the upstream assertion and compiler narrowing. Inner file and outer fixture scopes. |
| 374–389 | 560–576 | 1 | readAlloc(0) None before EOF; unchanged cursor six; next ipsum read. Inner file and outer fixture scopes. |
| 93–112 | 299–320 | Existing | Numeric path truncate to five, decoded hello, followed by unchanged default truncate/empty assertion. Existing resource lifetime unchanged. |
| 423 | 598 | Existing | Single write returns numeric eleven; no retry/writeAll substitution. Existing write helper and scopes unchanged. |

All new registrations use the same native public `it.effect` adapter as existing cases. The three parameter arrays contain 4 + 4 + 5 instances; the two ordinary registrations bring the increase to exactly 15. No skip, timeout, property floor, option, cleanup catch-all or diagnostic suppression was added. The sole existing strictEffectProvide skip-file directive remains at its original location and still documents the D14 exception: each test constructs its subject filesystem layer independently because lifecycle/isolation are under test.

The portable fixture still writes exactly 27 bytes, `lorem ipsum dolar sit amet\n`, through the subject. Upstream host reads are replaced solely by that private fixture. This means setup uses subject write/temp operations before the read/stream assertion, as already established by the accepted port; setup failure cannot falsely pass an error assertion because fixture construction occurs before the captured stream/read operation. Failed streaming is scoped for handle cleanup. Existing short inner scopes that release resources before NotFound checks and outer cleanup for surviving unscoped resources are untouched.

## Preservation proof

AST comparison of the live preimage and final source finds **48 prior assertion statements**, all retained in order with identical normalized syntax. Final source has **81 assertion statements**: 31 in new test templates plus the two strengthened assertions. These are source-template counts, not expanded runtime assertion counts. The earlier historical 46-assertion receipt is not substituted for the current 48-assertion preimage.

All 21 prior registration names remain. Nineteen complete registration ASTs are identical; only `truncate` and `should track the cursor position when writing` differ, precisely by the authorized strengthening. Thus every other prior assertion, flag, conditional branch and scope is structurally unchanged. `assertion-preservation.json` retains each assertion's old/new line and normalized expression; `registration-preservation.json` retains every prior registration's old/new range and identity result. The full source diff and both preimage/final snapshots are retained.

The full MIT notice is byte-identical to the preimage. Only version/commit/source-hash attribution changed to the exact rc.113 source. The options schema, true defaults, false/omission handling, dual dispatch, public exports and private fixture operations remain unchanged. Fourteen protected inputs from the accepted audit (core, tests, package manifest, barrels and pinned/installed reference sources) match their prior hashes. That is a bounded input check, not a claim of a repository-wide snapshot.

Source SHA256 before: `25dd61fc93f97edff982c9d7f2366a693ee5c9a23bf82b05bd740933198d1356`.

Source SHA256 after: `b378e557f5dfecaf2eb8079816ec8996efe42f90df06ff44d9964c97a1c87ecd`.

## Command receipts and runtime qualification

All commands ran from the worktree root. Adapter commands use `--root packages/tooling/test-kit/test-utils`, which loads its existing canonical Vitest configuration and root-generated aliases. The focused compiler uses a real private config extending the existing package `tsconfig.check.json`, selecting only the owned source; it does not disable diagnostics. Package verification uses the unmodified package scripts and full canonical source/test scopes.

Installed runtime evidence (`runtime.json`): Node v24.20.0, Bun 1.4.2, Effect/@effect/vitest 4.0.0-rc.113, Vitest 4.1.11. The pinned adapter declares Vitest `>=5.0.0 <6.0.0`; this inherited peer mismatch remains unresolved as a dependency-policy matter. These observed passes qualify compatibility for the executed scenarios, not general support for the out-of-range combination. Dependencies/configuration were not changed.

Every receipt below stores the exact command, worktree cwd, wall time, terminal exit, before/after source hash and complete log hash. Private prefix: `~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-port/`.

| Receipt | Exit | Seconds | Exact command |
| --- | ---: | ---: | --- |
| `compiler.json` | 1 | 0.498 | `bunx --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-port/tsconfig.source.json` |
| `compiler-final.json` | 0 | 0.377 | `bunx --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-port/tsconfig.source.json` |
| `biome.json` | 0 | 2.658 | `bunx --no-install biome check packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` |
| `node-adapters.json` | 0 | 1.125 | `~/.nvm/versions/node/v24.20.0/bin/node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/FileSystemConformance.node.test.ts test/FileSystemConformance.bun.test.ts test/MemoryFileSystem/Conformance.test.ts --reporter=verbose` |
| `bun-adapters.json` | 0 | 0.929 | `bun node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/FileSystemConformance.node.test.ts test/FileSystemConformance.bun.test.ts test/MemoryFileSystem/Conformance.test.ts --reporter=verbose` |
| `oxlint.json` | 0 | 0.315 | `bunx --no-install oxlint packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` |
| `preservation.json` | 0 | 0.156 | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-port/preservation-final.cjs` |
| `registration-preservation.json` | 0 | 0.193 | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-port/registration-proof.cjs` |
| `package-verify.json` | 0 | 70.853 | `bun run beep quality package-verify @beep/test-utils` |

Initial formatting command `bunx --no-install biome check --write packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` exited 0 and formatted only the owned helper. The first private AST script failed with a TypeError because it inspected the absent first argument of zero-argument calls. Its original script is retained; `preservation-final.cjs` adds the missing node guard and passes. This was evidence-script friction, not a repository test failure. One source-location lookup used the wrong non-internal PackageVerify path and returned rg exit 2; Graft's actual `internal/PackageVerify.ts` path resolved the renderer behavior. No verification assertion was relaxed. Graft estimated 17,356 tokens saved across the two read-only queries; no graph refresh/build was performed.

## Evidence inventory and limits

`before.ts`, `after.ts`, `source.diff`, `assertion-preservation.json`, `registration-preservation.json`, `protected-input-check.json`, `runtime.json`, the private compiler config and scripts, and all named command logs/receipts are preserved. `manifest.json` hashes these private artifacts and identifies the final report/source. Original audit and prior runner evidence remain immutable. No whole-repo coverage, scanner/census, timing acceptance or publication ran. Canonical package verification's normal generated build/inbox effects were not replaced by hand-authored canonical state; this lane performed no separate inbox operation or waiver.
