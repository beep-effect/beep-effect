# Filesystem rc.113 Fallow cleanup

Bounded cleanup in progress. Only the shared helper and this report are repository write targets. Prior evidence remains immutable.

## Implementation and preservation

The accepted finding `dup:6f87acd9` duplicates numeric-read setup and nested scope scaffolding. Existing `openTextFixture` (lines 121–125) yields the subject filesystem, creates its scoped private text fixture, then opens it in the caller's scope. The numeric-read case now yields this existing operation directly in its outer generator. The outer `Effect.scoped` and direct `Effect.provide(layer)` remain. No work follows the removed inner scope, so cleanup still completes before the subject layer closes; no NotFound assertion or shorter-lived resource obligation is affected.

Both numeric-read assertions remain byte-for-byte in order. All **83** prior assertion statements remain in order, including the original 48, every rc.113 assertion, positive stream observation and failure-kind checks. All 26 registration templates remain, expanding to 36 cases. Twenty-five registration ASTs are identical; only the numeric-read template changes. No assertions were reordered and no helper was added or renamed. Options/defaults, dual API, MIT notice, D14 exception and subject-local fixture bytes are untouched.

Focused compiler, Biome and Oxlint pass. Node and Bun each pass 108/108 cases across Memory/Node/Bun subjects. Full Fallow audit (new-only against origin/main, matching Root's retained check command) and full health baseline check are running before package verification. Logs and exact terminal/source-hash receipts are private under `~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-fallow-fix/`. Graft estimated 6,953 tokens saved; no graph refresh or build was performed.

## Fallow results before package proof

`bun run fallow:audit --base origin/main --gate new-only` exited 0 in 5.948 seconds. Parsed verdict is `pass`: zero dead-code issues, zero complexity findings, zero duplication clone groups; introduced and inherited attribution counters are all zero. Fingerprint `dup:6f87acd9` is absent. This is the full configured audit command matching Root's prior evidence, not a file-restricted clone check.

`bun run fallow:health:baseline:check` exited 0 in 3.096 seconds. The full health analysis examined 4,503 files and 70,750 functions. Its existing threshold findings remain represented (152 functions above thresholds); passing the existing health baseline does not mean those historical findings disappeared. Baseline reports 184 entries, 183 matched and one stale entry, with overall stale=false. No baseline writer or threshold override ran. Complete raw logs and parsed JSON are preserved privately; the prior canonical raw artifacts are untouched.

Final-source focused suites have 108 Node passes and 108 Bun passes (three files each), with all 36 cases per adapter enabled. No coverage was rerun for this scaffolding-only reuse: Root's prior normal scoped coverage receipt remains historical acceptance, and Root owns final coverage/artifact judgment after this change. All 14 protected audit inputs still match their prior hashes. Runtime identity remains Node v24.20.0, Bun 1.4.2, Effect/@effect/vitest rc.113 and Vitest 4.1.11. The inherited @effect/vitest peer requirement >=5 <6 remains a qualification; these passes do not rewrite that declared support range.

## Final handoff and exact receipts

Required full `bun run beep quality package-verify @beep/test-utils` exited **0** in **49.815 seconds**, after both Fallow checks had passed. Complete terminal inner summary: `ok audit 44.8s   ok docgen 3.3s`. Successful canonical rendering exposes the step summary rather than child test stdout; no unobserved package test count is asserted. All launched processes have exited and been joined.

Source SHA256 before: `3ff320297b6b45ad3b6ab55a5873931b90d9666a71b9766d70b260520b2b2734`.

Source SHA256 after: `00f4f9b7c3c8be66dff6863d2169b16aa4b5be4d5cc0483213f6085605b227d2`.

Every proof receipt below records the exact command, terminal exit, wall time, before/after source hash and complete log hash. All commands ran from the worktree root. Adapter `--root packages/tooling/test-kit/test-utils` selects the canonical package configuration; focused compiler config extends the actual package check config without disabling diagnostics. Full package verification uses the unchanged package audit/docgen scripts. No proof required a source revision or failure waiver.

| Receipt | Exit | Seconds | Exact command |
| --- | ---: | ---: | --- |
| `compiler.json` | 0 | 0.324 | `bunx --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-fallow-fix/tsconfig.source.json` |
| `biome.json` | 0 | 2.664 | `bunx --no-install biome check packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` |
| `node-adapters.json` | 0 | 0.900 | `node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/FileSystemConformance.node.test.ts test/FileSystemConformance.bun.test.ts test/MemoryFileSystem/Conformance.test.ts --reporter=verbose` |
| `bun-adapters.json` | 0 | 0.730 | `bun node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/FileSystemConformance.node.test.ts test/FileSystemConformance.bun.test.ts test/MemoryFileSystem/Conformance.test.ts --reporter=verbose` |
| `oxlint.json` | 0 | 0.255 | `bunx --no-install oxlint packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` |
| `preservation.json` | 0 | 0.134 | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-fallow-fix/preservation-final.cjs` |
| `registration-preservation.json` | 0 | 0.130 | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-fallow-fix/registration-proof.cjs` |
| `fallow-audit.json` | 0 | 5.948 | `bun run fallow:audit --base origin/main --gate new-only` |
| `fallow-health.json` | 0 | 3.096 | `bun run fallow:health:baseline:check` |
| `package-verify.json` | 0 | 49.815 | `bun run beep quality package-verify @beep/test-utils` |

Private evidence prefix: `~/.cache/beep/effect-vitest-canon/pr1067-resume/filesystem-rc113-fallow-fix/`. The manifest hashes source preimage/final snapshot, exact diff, all logs/receipts, AST assertion and registration mappings, parsed Fallow results, runtime identity, protected-input comparison, private proof scripts/config and this report. The MIT notice and all changes outside the numeric-read template are preserved by the source diff. No other repository source/test/config, canonical inventory or baseline was authored. Canonical command-generated effects were not replaced with manual canonical writes.

The minimal existing-fixture reuse resolves the introduced duplicate without extracting helpers, renaming assertions or changing their order. No new coverage or CLI proof was launched. Root retains normal final scoped coverage, integration, publication and phase acceptance. The inherited Vitest peer qualification remains in force.
