# D1 repo-cli test inputs review

Time-to-certainty D1 (rulings 76-78) adds a repo-cli fixture,
`packages/tooling/tool/cli/test/gate-order-handoff.test.ts`, that reads two
committed files: `goals/time-to-certainty/research/economics.json`, the pinned
A1 baseline its gate-order seed pointers resolve in, and
`goals/time-to-certainty/research/gate-order-handoff.json`, the handoff
document its file snapshot guards.

What changed: `packages/tooling/tool/cli/turbo.json` declares both files as
inputs of `@beep/repo-cli#test` and `@beep/repo-cli#test:property`. Both tasks
run the same vitest command, so both run the fixture.

Why: without these inputs a pull request that changes only one of the two files
leaves the repo-cli test cached green, and main turns red later as an inherited
failure. A `goals/*/research/*.json` path is not docs-only for Heavy
admission, so such a pull request still runs the repo-cli tests.

Why this is not blanket cache-key tuning: it names the two files one fixture
reads, so each task's key covers what the task tests. It moves no hit rate on
purpose and changes no other key.

Accept only the two named inputs on those two tasks. Preserve the scope, the
profile and the epoch as they stand in the baseline at re-record time. Today
that is the four excluded computations `@beep/identity#lint`,
`@beep/types#lint`, `@beep/fc-runs#lint` and `@beep/test-runner#lint`, the
`local-linux-x64-bun1.4.2` profile and the `qualification-v2` epoch; if main
has changed any of them by a later re-record, copy main's values instead. Do
not change commands, cache flags, output declarations, global configuration, or
the qualification ledger. Compare the generated projection with the previous
baseline and require zero remaining cache-policy findings before publication.
Later re-records after a merge of main reuse this note unchanged; only the
previous-baseline digest changes.
