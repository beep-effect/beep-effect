# CLI runner import migration

The 57-file runner-import batch moves test registration to `@beep/test-runner`
and ordinary Vitest helpers to `@effect/vitest`. An AST comparison against
commit `2a732ff497` confirms that every non-import statement remains unchanged
after formatting. Existing assertions, property options, fixtures, test titles,
and deadlines are retained.

The exact cohort contains 1,004 tests. Both Node and Bun pass all of them with
no failures or pending cases, and the before/after registration multisets match.
The corrected after commands took 244.170 seconds on Node and 132.006 seconds
on Bun. The corresponding before commands took 246.355 and 125.329 seconds.
These are observed whole-command timings under concurrent workstation load,
not evidence of a causal speed improvement. Runtime versions, load, pressure,
limits, commands, and source hashes are retained with the timing receipts.

An earlier after script accidentally changed one filename while replacing
prose and omitted four tests. Its 1,000-test results are preserved separately
and do not count toward cohort completion. The corrected script checks every
selected file exists, compares its selection against the baseline command,
and checks exact registrations and source stability.

`lint-workers.test.ts` retains only `vi` from native Vitest because it uses
`vi.hoisted` and static `vi.mock` registrations. The installed Vitest 5.0.1
transformer, `@vitest/mocker/dist/chunk-hoistMocks.js`, recognizes `vitest`
and `vite-plus/test` as hoisted import sources; it does not recognize
`@effect/vitest`. The registration and other helpers in this file use the
canonical runner and Effect Vitest facade. Its existing EV011 finding is a
reasoned native-transformer exception, not a remaining plain runner migration.

Private evidence receipts: `cli-runner-final-preservation.json`,
`cli-runner-imports-after-cohort-parity.json`, and the
`cli-runner-imports-{before,after}-{node,bun}` reports and context files.
This proof covers the import batch only. The rest of the CLI resource,
assertion, property, flake, and observability inventory remains separate work.
