# Changeset-status fixture scope migration — 2026-10-06

Source commit after stacking on #1445: `4312b7f65f3a7d129d952217cc43b86ec0e35d72`.
Pre-stack source commit: `b8432779e9813d6b2b2024bf2c5516a07858f165`.
Starting base: `26269bb0ec0094b1c255bab0a0451bd47415f22c` (`origin/main` at branch creation).
Current stacked base: #1445 head `c56eabbd4cc2866fdb2565c76937b60d62050cab`.

The five integration cases in `packages/tooling/tool/cli/test/changeset-status.test.ts`
now use `it.effect` inside per-case `it.layer` registrations. The layer provides
`MemoryFileSystem`, `Path`, `TestConsole`, and the existing captured Git spawner.
Each case obtains a temporary directory with `makeTempDirectoryScoped`, so the
test runner owns its release. A 30-second layer timeout bounds fixture setup.
The subject still receives the same changed-path and in-range changeset output.
The test file retains all 19 registrations and 39 `expect` calls.

Evidence for the pre-stack source revision, whose test-file content is unchanged
in the stacked source commit:

- `node node_modules/vitest/vitest.mjs run packages/tooling/tool/cli/test/changeset-status.test.ts`: 19/19 passed.
- `bunx --bun vitest run packages/tooling/tool/cli/test/changeset-status.test.ts`: 19/19 passed.
- `bun run beep quality package-verify @beep/repo-cli`: package audit passed in 820.4 seconds; docgen passed in 30.8 seconds.
- `bun run beep lint effect-vitest --rows ~/.cache/beep/effect-vitest-canon/cli-followup-rows`: no current detector rows for this file, down from its eight open historical rows (five EV001, two EV003, one EV010).

The eight original detector IDs, source evidence, and replacement sketches remain
in the ledger with `status: fixed`, the stacked source `fixSha`, and a shared reason.
The four human-lens `NONE` rows retain their historical no-finding judgments;
they are not new exceptions or independent proof of a complete package audit.

The starting `main` baseline had two unrelated EV006 findings in
`PatternOntology.test.ts`; #1445 changes that file and baseline. The branch is
now stacked locally on #1445, preserving its 1,941 baseline rows and subtracting
exactly these eight (1,933 remaining). `bun run beep goals doctor` passed before
the stack. The ratchet and full package gate must be rerun on the combined head.
This remains a local checkpoint, not a published or merge-ready wave. Full
package after-timing and hosted checks are also outstanding.
