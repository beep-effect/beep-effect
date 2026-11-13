# Execution friction

## 2026-11-13: photo-face lane inherited unrelated unpublished work

The supplied worktree was clean, but its starting commit was 22 commits ahead
of the remote main branch and carried unrelated Alchemy, dependency and packet
changes. Evidence: `git rev-list --left-right --count HEAD...origin/main` returned
`22 4` after fetching main. The lane preserved the original branch, committed
its own photo-face changes, then cherry-picked that single commit onto a fresh
feature branch from `origin/main`. The resulting branch was `0 1` against main.

Worktree creation should show the selected base and its unpublished-commit count
before starting an independent implementation lane. This would prevent an
unrelated parent branch from becoming part of the publication diff. No unrelated
commits were reset, deleted, or published by this lane.

## 2026-11-13: command injection must preserve static derivation

Changing the production match-person command into a factory taking a service
Layer broke two knowledge tests with `command factory arguments are not bound
string literals`. Production now uses a statically declared command definition;
the test factory only applies its service Layer to that definition. Both static
command-surface tests passed after this fix. A documented injection pattern for
commands would prevent this extra test cycle.
