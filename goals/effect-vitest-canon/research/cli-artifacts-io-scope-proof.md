# Artifact IO fixture and lens repair — 2026-10-06

Source commit `1b9a3aebc5059a387b187b55c86f5a08fa8a553e` migrates the seven
`artifacts-io.test.ts` cases without changing their subjects or expected file
bytes. The five file cases now run under runner-owned `it.layer` blocks with
MemoryFileSystem and Path. Each obtains a scoped temporary directory in its
test effect. The five `Effect.runPromise` calls, manual acquire/use/release
wrapper, and native Node filesystem import are removed.

The absent-file case flips the typed failure and asserts the caller-mapped
`ArtifactTestError` directly. Success or a defect no longer bypasses the
assertion. The generated-file case uses a Ref-backed `onWrote` effect and
asserts that it ran, in addition to checking the bytes. These close the
resource and property lens findings without weakening the checks.

The focused suite passes all seven cases on Node and Bun. Direct package
test-project typechecking with the package root directory exits 0. The
Effect/Vitest scanner reports 1,925 current findings, exactly seven fewer
than the prior 1,932-row baseline and with no introduced row. The historical
seven detector IDs and two actionable lens IDs remain in the ledgers as
`fixed` at the source commit. Full repo-cli package verification is running
on the unchanged source; hosted proof is not yet claimed.

Issue #1461's separate review-round follow-up corrects the session-ledger
EV004 exception rationale: its `it.layer` build is shared across the block,
while the native Git/worktree helper retains its shorter cleanup scope. The
same source-bound ID, occurrence, and exception status are preserved.
