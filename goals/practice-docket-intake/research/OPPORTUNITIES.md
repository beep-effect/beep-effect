# Opportunities

## A stale effect-vitest inventory on main blocks every lane's publish

- **Work:** Publishing the packet (docs only) and the `@beep/m365` driver slice
  through `bun run beep yeet publish` on 2026-10-06.
- **Friction:** The cheap-gates lane `lint:effect-vitest` was red on `main`
  itself, so no lane could push, whatever it changed. The findings sat in test
  files merged minutes earlier by unrelated PRs, and they changed between two
  attempts as `main` moved (2 findings in one file, then 6 in two others).
  Refreshing the inventory inside an unrelated PR rewrites about 1,100 lines of
  line-keyed ids, so that is not a fix a feature lane can carry.
- **Evidence:** `bun run beep lint effect-vitest` on `origin/main` reported
  `6 new finding(s) in 2 file(s)` with no local change; `--write` produced a
  `609 insertions(+), 567 deletions(-)` diff in
  `standards/effect-vitest.inventory.jsonc`.
- **Proposal:** Run the same lane as a required hosted check on every PR that
  touches a test file, so a finding cannot merge without its inventory row.
  Key inventory ids by content hash instead of line number, so one added test
  does not renumber its neighbours.

## A fresh Claude worktree has no install, and the gate failure does not say so

- **Work:** First `yeet publish` from a worktree the desktop app created.
- **Friction:** Twelve of fifteen cheap-gates lanes failed at once because
  `node_modules` was absent. Each lane printed its own unrelated-looking error;
  nothing named the missing install.
- **Evidence:** `ls node_modules` failed in the worktree; after `bun install`
  eleven of the twelve reds cleared with no code change.
- **Proposal:** Have `yeet publish` check for an install before the first lane
  and fail with one line that names it.

## A scaffolded package fails most of its first hosted run

- **Work:** Opening the pull request for slice 3, which adds the
  `docket-intake` service app with `bun run beep create-package`.
- **Friction:** The scaffold left four repo-level records untouched, and each
  one is a separate gate that only fails in hosted CI or in the publish gate:
  the CI lane partition table (every Lint and Test Unit shard stopped before
  running anything), the pinned partition counts in its test, the generated
  fallow boundaries file, and the reviewed cache baseline. The coverage
  baseline also needs rows for the new app. None of the package-level checks
  (`package-verify`) touches any of them.
- **Evidence:** First hosted run: nine failed jobs, all with
  `Package @beep/docket-intake has an executable lint task but no deterministic placement`
  or `fallow:boundaries:config-check exited (1)`; `quality:cache-policy`
  reported `BLOCK unreviewed-expansion: @beep/docket-intake#build` and six
  more.
- **Proposal:** Have `create-package` place the new package in the lane
  partition table, regenerate the boundaries file, and print the two reviewed
  steps it cannot do itself (cache baseline request, coverage baseline rows).

## Hosted-only gates on new files are found one push at a time

- **Work:** Driving slices 1 and 2 to green.
- **Friction:** Three hosted gates have no local counterpart in the publish
  gate: the oxlint rule against compiling a schema inline in a test, the
  coverage ratchet's rule that a new file may have no uncovered unit, and the
  tracked-path check on packet prose. Each cost one hosted round.
- **Evidence:** `beep(no-inline-schema-compile)` on a test line;
  `new file has 13 uncovered unit(s) ... (no baseline file identity)`;
  `broken-tracked-path ... Tracked path does not exist`.
- **Proposal:** Add the three to the cheap-gates tier scoped to changed
  files: oxlint on changed tests, a new-file coverage check for changed
  packages, and `knowledge semantic-delta`.
