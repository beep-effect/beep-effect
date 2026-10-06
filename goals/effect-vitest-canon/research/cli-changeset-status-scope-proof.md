# Changeset-status fixture scope migration — 2026-10-06

Source commit after rebasing on merged main: `ebf76a2d7d13f219450b17fceb1b54a8db008c9a`.
Pre-stack source commit: `b8432779e9813d6b2b2024bf2c5516a07858f165`.
Starting base: `26269bb0ec0094b1c255bab0a0451bd47415f22c` (`origin/main` at branch creation).
Current base: `9e7742176f`, containing the merged #1445, #1448 charter, #1444, #1451, and #1434.

The five integration cases in `packages/tooling/tool/cli/test/changeset-status.test.ts`
now use `it.effect` inside per-case `it.layer` registrations. The layer provides
`MemoryFileSystem`, `Path`, `TestConsole`, and the existing captured Git spawner.
Each case obtains a temporary directory with `makeTempDirectoryScoped`, so the
test runner owns its release. A 30-second layer timeout bounds fixture setup.
The subject still receives the same changed-path and in-range changeset output.
The test file retains all 19 registrations and 39 `expect` calls.

Evidence for the pre-stack source revision, whose test-file content is unchanged
in the rebased source commit:

- `node node_modules/vitest/vitest.mjs run packages/tooling/tool/cli/test/changeset-status.test.ts`: 19/19 passed.
- `bunx --bun vitest run packages/tooling/tool/cli/test/changeset-status.test.ts`: 19/19 passed.
- `bun run beep quality package-verify @beep/repo-cli`: package audit passed in 820.4 seconds; docgen passed in 30.8 seconds.
- `bun run beep lint effect-vitest --rows ~/.cache/beep/effect-vitest-canon/cli-followup-rows`: no current detector rows for this file, down from its eight open historical rows (five EV001, two EV003, one EV010).

The eight original detector IDs, source evidence, and replacement sketches remain
in the ledger with `status: fixed`, the rebased source `fixSha`, and a shared reason.
The four human-lens `NONE` rows retain their historical no-finding judgments;
they are not new exceptions or independent proof of a complete package audit.

PR #1460 P1 review exposed a type-level service gap in that layer:
`runChangesetStatus` requires `Crypto.Crypto` even when a focused runtime
case does not exercise its admission-workload path. Source commit
`b22c2e648a99562db01191c35263da7364225400` adds `NodeCrypto.layer`.
The direct package test-project typecheck now exits 0 with zero diagnostics;
the changeset-status and session-ledger suites pass 28/28 on Node and Bun,
and quick repo-cli lint/check pass. The standalone test `tsconfig.json`
inherits a source-only `rootDir`, so the direct typecheck explicitly sets
the package root directory on the command line.

The starting `main` baseline had two unrelated EV006 findings in
`PatternOntology.test.ts`; #1445 fixed them. Rebased main carried 1,941
baseline rows, and this wave subtracted exactly eight (1,933). A second
current-main model-test repair removes seven more to 1,926, with separate
lineage in `cli-models-main-delta-proof.md`. The detector ratchet passed on
the intermediate 1,933-row head and at the 1,926-row combined CLI head. The
pre-#1444 combined `@beep/repo-cli` package verification passed (audit 821.8
seconds, docgen 28.5 seconds). The exact current base is under a new package
proof; hosted checks and a new whole-package after-timing cohort remain
outstanding. This local branch is not yet published or merge-ready.
