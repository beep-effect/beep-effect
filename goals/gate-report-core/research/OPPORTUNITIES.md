# Friction receipts — gate-report-core

Recorded while building the goal (2026-11-19).

1. **A squash merge turns every stacked lane's next base merge into add/add conflicts.** Doing:
   merging `main` into the libraries lane after the model PR merged, and into the wiring lane after
   the libraries PR merged. Evidence: 18 and 28 conflicted files, all in code the lane already
   contained; resolving them file by file to the lane's side was right for every one, and one
   auto-merged pair was wrong without a conflict (a deleted file came back with its import).
   Prevention: stack the lanes as a native Yeet stack so the base is rewritten for the child, or a
   `yeet` helper that resolves a squash-merged ancestor to the lane's side and lists what
   auto-merged inside lane-owned paths.
2. **A new package fails two generated checks that package-verify does not run.** Doing: the
   libraries PR's first final-check. Evidence: `observability:catalog-check` wanted a new
   instrumentation shard, and the JSDoc ratchet wanted a companion type alias for one exported
   literal domain; both passed package-verify. Prevention: package-verify runs the catalog checks
   and the ratchet for the package it verifies.
3. **Changing one generated script re-keys every package's cache baseline.** Doing: pointing the
   generated `check` at the gate entry. Evidence: 213 subjects drifted and the reviewed request
   carries 214 digests; one subject with no cached task drifts without a blocking row and was
   named only when the record was refused. Prevention: the request accepts a rule, and the audit
   lists every drifting subject, cached or not.
4. **Review rounds arrive against a head that has already moved.** Doing: answering reviews on the
   model and library PRs. Evidence: a reviewer posted ten threads against the previous head after
   the fix push, one of them already fixed; follow-ups arrived on resolved threads, which the
   unresolved-thread count does not show. Prevention: the inbox raises a row for a bot comment
   added to a resolved thread after the author's last reply.
5. **A foreground build hid a review round for two hours.** Doing: running the wiring slice as one
   long foreground agent while the model PR was in review. Evidence: the PR sat blocked on two
   threads until the build returned. Prevention: long builds run as background delegates, so
   review events are handled between them; this session switched to that for the later rounds.
6. **A gate that reads the working tree against `HEAD` fails inside an uncommitted merge.** Doing:
   package-verify for the repo CLI during a merge in progress. Evidence: one knowledge test failed
   on a file the merge staged and `HEAD` lacked, and passed after the commit. Prevention: the test
   compares against the index when a merge is in progress.
7. **The final proof is repo-wide for any change to the root Turbo config or the identity
   registry.** Doing: every final-check of this goal. Evidence: each run skipped docgen and
   coverage by reason and took about ten minutes; more than ten runs across three PRs. Prevention: as in
   the switch-on goal's receipts, the proof states up front what it hands to hosted CI, and a
   review-fix push that touches one package re-proves that package.
