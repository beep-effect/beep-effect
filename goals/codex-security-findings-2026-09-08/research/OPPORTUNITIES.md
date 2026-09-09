# Execution friction

- The provenance regression found that `writeContainedFileString` produced mode
  `0644` although its documented contract promised a private temporary file.
  Explicitly restricting the empty temporary file before writing its contents
  prevents metadata exposure. The regression checks new and replacement files.
- `economics.py --from-inputs` encountered inherited drift in the optional run2
  corpus. The pristine replay test also found an inherited stale reproduction
  script receipt. Preserve the ratified compact inputs, validate their replay in
  an isolated fixture, and update only the reproduction script receipt. A
  dedicated embedded-only replay mode would avoid the optional corpus coupling.
- Overlapping local proof commands terminated with exit codes 143, 137, and 130
  while host memory was constrained. The CLI build and typecheck passed before
  its test process stopped. The terminating actor was not established. Run the
  required proofs serially and retain their logs across task continuation;
  interrupted runs never count as acceptance evidence.
- Refreshing the packet after a tenth report appeared failed because the
  document scanner treated the reflection's YAML frontmatter delimiter as a
  spreadsheet formula. Scope that rule to imported fields and non-Markdown
  documents; retain all private-content checks on Markdown. Writer, CSV, and
  sensitivity regressions passed, and canonical refresh then preserved the
  original nine records and appended CSF-010.
- Hosted Docgen rejected inherited `FreshbooksDecode` metadata because its
  category was `decoders`. Package docgen had passed, but the hosted scoped
  entry point also checks canonical categories. Use `decoding`; validate the
  same `docgen:local -- --base origin/main --head HEAD` entry point as CI.

- PR #1026 coverage found lower command and service coverage after worktree
  boundary checks were added. Package tests passed, but did not enforce the
  per-file coverage floor. Add rejection-path tests and verify the unchanged
  coverage ratchet before treating package success as repository acceptance.

- A live refresh after publication found another report in newly merged Graft
  wiring. The generated shims carried an initializing-user path and selected
  installations by version. Keep a repo-owned trusted loader and regression
  tests so integration regeneration cannot silently restore cross-account imports.

- GitHub GraphQL exhausted its shared quota after an early push succeeded.
  Yeet then failed its PR lookup although PR #1026 already contained the commit.
  REST confirmed the head and accepted the review reply. An exhausted GraphQL
  lookup should preserve the known PR identity and report a retryable monitor
  delay instead of attempting to create another PR.

- PR #1026 Heavy / Check reported five `TS377032` diagnostics in the new Graft
  tests. Runtime tests and the package source check passed, but neither runs the
  repository's test-file Effect diagnostics. Compose `NodeServices.layer` at
  the `@effect/vitest` suite boundary and run `quality test-tsgo-package` for
  test changes before publication. Keep the diagnostic enabled.
