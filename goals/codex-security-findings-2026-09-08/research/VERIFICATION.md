# Verification evidence

- `bun run beep quality package-verify @beep/freshbooks`: audit and docgen passed.
- `bun run beep quality package-verify @beep/ai-sync`: audit and docgen passed.
- `bun run beep quality package-verify @beep/repo-cli`: full audit passed in
  629.7 seconds and docgen passed in 26.9 seconds. This includes build, typecheck,
  the complete Vitest suite, Python tests, TypeScript lint, and Python lint.
- `python3 -m unittest discover -s goals/time-to-certainty/research/scripts
  -p test_economics.py`: all 15 tests passed.
- `bun run beep lint reflection-artifacts`: zero blocking or advisory findings.

Per-finding focused commands appear in the CSF records and triage ledger.
After merging main, the first repository repair run passed all 139 package
test-type checks, 132 docgen tasks, 35 build and check tasks, and the CLI's
3,159 tests. Its only failure was the stale ignored goals index; regeneration
and the index check passed. That failed aggregate is not final acceptance.

The refreshed ten-finding snapshot added CSF-010. Its focused cache tests pass
(six tests), and the packet-write, CSV, and sensitivity and refresh suites pass (87 tests).
The updated `bun run beep quality package-verify @beep/repo-cli` passed:
audit 342.1 seconds and docgen 18.0 seconds. Repository proof remains required.

Repository-wide Yeet proof, publication, hosted checks, merge, and exact-ID
Codex closure remain pending. Earlier interrupted runs are not acceptance proof.

Main integration: merged the Graft agent configuration from `b8eb96213c`.
The permission domain retains all eight scoped Graft commands and denies
arbitrary stash deletion (57 approved grants). Updated AI Sync package
verification passed: audit 9.5 seconds and docgen 2.9 seconds.

PR #1026 review follow-up:

- Corrected the inherited FreshBooks decoder category after the hosted Docgen
  failure. Package verification passed (audit 13.2 seconds, docgen 3.8 seconds),
  followed by the scoped CI Docgen command.
- Worktree parsing now returns a typed schema failure for nonempty non-NUL
  input. Command and removal callers report it as a worktree error; the tolerant
  fleet scanner warns and retains an unlisted clone. The command and reap suites
  passed all 49 tests; the fleet suites passed 41 more tests.
- Non-UTF-8 plain and gzip evidence now produces a path-specific hygiene error.
  All 16 economics tests passed; only the reproduction-script receipt changed.
