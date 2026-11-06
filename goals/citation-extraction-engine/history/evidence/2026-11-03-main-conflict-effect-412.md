# Main conflict repair and Effect 4.1.2 integration

PR #2511 starts this repair at `c08ab4a0d8a67bec1498adb9766612944e6e2319`.
The merged main revision is `31e2ac20f3`; it includes the landed upgrade
PR #2637 (`2ece63265d`) and subsequent claims and Git kit work.

The sole textual conflict was `LawPracticeDomain.test.ts`. Main changed
Effect expression ordering inside tests for citation models previously retired
by this branch. Preserve that retirement; retain main's expression ordering
changes in the remaining domain tests. No citation production code changes
are required for this conflict resolution.

The upgraded diagnostics also identify 45 nested yield expressions in five
branch-specific citation test files. Lift those effect results into local
constants before passing them to schema codecs or assertions. Assertions and
schema contracts are preserved; no diagnostic suppression is added.

Local verification on the merged tree:

- Frozen-lockfile install succeeds with the merged lockfile.
- All 54 tests in the six affected domain test files pass.
- Quick law-practice-domain package lint and type checks pass after the
  diagnostic fixes. The initial diagnostic failure is retained in the local
  repair log rather than counted as a successful check.
- The merge has no unresolved paths. Normal commit and push hooks remain enabled.

Broader runtime, policy, coverage and integration proof belongs to hosted CI
for the new pushed head. These focused results do not establish full goal
completion. The separate citation implementation worktree and its 23 modified
or untracked files are preserved outside this conflict-only merge.
