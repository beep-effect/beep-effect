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
