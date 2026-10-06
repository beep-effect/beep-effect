# Changeset-status fixture scope migration — 2026-10-06

Source commit after rebasing on merged main: `3abc4e042794de1f7e6adc79b922cfd6ef598f35`.
Pre-stack source commit: `b8432779e9813d6b2b2024bf2c5516a07858f165`.
Starting base: `26269bb0ec0094b1c255bab0a0451bd47415f22c` (`origin/main` at branch creation).
Current base: `788dda66b5`, containing the merged #1445 and #1448 charter.

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

The starting `main` baseline had two unrelated EV006 findings in
`PatternOntology.test.ts`; #1445 fixed them. Rebased main carried 1,941
baseline rows, and this wave subtracted exactly eight (1,933). A second
current-main model-test repair removes seven more to 1,926, with separate
lineage in `cli-models-main-delta-proof.md`. The detector ratchet passed on
the intermediate 1,933-row head. The exact post-model combined package proof
and hosted checks remain outstanding, as does a new whole-package after-timing
cohort. This local branch is not yet published or merge-ready.
