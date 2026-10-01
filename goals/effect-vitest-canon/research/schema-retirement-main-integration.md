# Unknown and Json retirement integration

PR #1347 landed on main as `90517df719` while PR #1365 was under proof.
Its retirement of the schema Unknown and Json helpers overlapped 17 migrated
CLI test files and the Effect Vitest inventory. The merge preserves the
branch's scoped fixtures, canonical assertions, console isolation, and
cleanup regression while adopting main's Effect Schema codecs.

The 17 resolved files preserve their registration names and options, and
1,820 assertion expressions match the preceding branch after accounting for
the two generated-code expectations that main intentionally updates. Runtime
proof passes 539 tests in those files under Node (76.81 seconds) and Bun
(52.76 seconds). The actual CLI test-type artifact reports exit 0 and no
diagnostics. Full schema package verification passes: audit 11.8 seconds,
docgen 5.1 seconds.

Inventory reconciliation preserves all 5,020 rows and their dispositions.
It incorporates 72 upstream metadata updates. One overlapping version-sync
layer occurrence was reconciled against the merged source after comparing
the preceding branch, main, and merged detector output. No baseline refresh,
new exception, or finding closure was used. The final ratchet reports 2,852
findings, zero introduced, and 2,167 resolved across 1,203 scanned files.
Historical rows referring to retired modules remain for later ledger review.

Before the merge, full lint-policy verification exposed an inherited TSDoc
code-span warning in `CheckCensusGate.ts`. Commit `8d8ec230af` closes both
inline spans without changing the documented command. Full repository ESLint
syntax validation passes, as do CLI quick package lint (3.8 seconds) and
check (6.5 seconds). The previous full publication proof was intentionally
interrupted after finding that blocker; it is not a completed proof of this
merge. Publication, full CLI package verification, and hosted gates must
complete on the merged head before merge readiness can be claimed.
