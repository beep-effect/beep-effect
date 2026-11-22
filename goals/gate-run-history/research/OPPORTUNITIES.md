# Friction receipts: gate-run-history

Recorded while building the first pull request (2026-11-20 to 2026-11-22).

1. **Local coverage under Bun hides files the hosted coverage job measures under Node.** Doing:
   publishing #3446 with the CLI's history files at "100% under Bun". Evidence: hosted Coverage
   Regression on `b5b08499093` was red on five new CLI files, because their suites were skipped
   outside Bun. Prevention: the new-file coverage command names the hosted runtime and provider
   (Node and V8) and refuses another one.
2. **Coverage floors set from one random-seed sample turn `main` red later.** Doing: attributing
   #3446's second coverage red. Evidence: `@beep/xlsx` `workbookPart.ts` fell below its floor on
   `main` itself (episode started at `ebe2b3799b0`), and repeated local and hosted runs showed more files
   whose uncovered lines change with the seed (#3447, #3452). Prevention: coverage runs draw
   property tests from a fixed seed.
3. **A local coverage figure does not say which provider made it.** Doing: reporting the sweep
   behind #3452. Evidence: the runs forced Istanbul, and one file read 82.5% of branches against
   a 97.5% floor the hosted V8 run meets exactly. Prevention: the coverage report prints provider
   and runtime beside the figures.
4. **Gates outside `package-verify` fail only in `final-check`.** Doing: handing back green
   packages. Evidence: cache-policy drift on one new workspace edge, dead exports, an inventory
   row, a fixture without a tsconfig owner and a deprecated `exec` took four `final-check` runs.
   Prevention: `package-verify` lists the repository gates it does not run.
5. **A model limit stopped the owning session for an hour with review threads open.** Doing:
   waiting on #3446. Evidence: every run failed from about 02:40Z to 03:49Z on 2026-11-22, and the
   messages sent meanwhile were answered by nobody. Prevention: a failed run raises the thread to
   the orchestrator at once.
