# Brief — History Message Overlay

## Problem

About 940 pre-July-2026 commits on `main` carry subjects such as `saving`,
`updated deps` and `merged in main`. Agents and humans reading `git log`,
`git blame` or `git show` on older code get no signal from them. July's fix was
a `git filter-repo` cutover. Research (RESEARCH.md 2026-11-06) showed it
can't clean GitHub's side, drops 5,326 signatures, makes thousands of tracked
SHA citations stale and breaks ancestry-based lane tooling. History has been
clean since July, so the problem is bounded and won't grow.

A reviewed 939-row correction map already exists (three-model adversarial
review, all rows pass commitlint, every key still an ancestor of
`origin/main`). It sits in an untracked folder that `goals/legacy-drain` is
about to archive.

## Appetite

Small batch: one goal packet, about two to three agent days, a single PR plus
the post-merge publication. If the projection or bootstrap grows past that,
cut delivery back to the sync command and leave bootstrap hooks for later.

## Solution sketch

```text
census map (tracked, PR-only)        beep history notes --write / --check
docs/history/commit-message-map.json ► builds refs/notes/history from the map
        │                                       │
        │ merge to main                         │ post-merge Actions job
        ▼                                       ▼
   schema decode (sha → subject+body)    git push origin refs/notes/history
                                                │
                     every clone: fetch refspec +refs/notes/history:refs/notes/history
                     and notes.displayRef=refs/notes/history (set by worktree new,
                     cloud bootstrap, `beep history notes sync`)
                                                │
                                   git log shows "Notes (history):" under the old subject
```

1. **Map import.** Copy `final-map.json` and `excluded-from-map.json` to
   `docs/history/commit-message-map.json` (and its exclusion list) with a
   README. The map lives outside any goal packet because the projection
   outlives it. Add a schema (commit SHA key →
   conventional subject + optional body) and decode it at the boundary. Add
   the one `saving` commit the map misses.
2. **Projection command.** `beep history notes` with `--write` (rebuild the
   notes ref deterministically from the map), `--check` (exit non-zero when the
   local or remote ref and the map differ) and `sync` (set the fetch refspec
   and `notes.displayRef` on the current clone, then fetch). It is a new
   `History` command family in `@beep/repo-cli`; notes operations go into the
   `@beep/git` driver.
3. **Delivery.** `beep worktree new` and `scripts/cloud/bootstrap.sh` call the
   sync step. Linked worktrees share the clone's config, so it runs once per
   clone and is idempotent.
4. **Publication.** A post-merge workflow on `main`, filtered to the map path,
   runs `--write` and pushes `refs/notes/history`.
5. **Folder retirement.** Move the rest of `~/YeeBois/projects/beep-effect-cutover`
   to `~/.local/state/beep/archive/beep-effect-cutover/`, then remove the
   folder. Record it so `goals/legacy-drain` can mark its line done.
6. **Docs.** A short section in the git or worktree standards: what the
   overlay is, how to see it, and the blobless-clone recipe
   (`git clone --filter=blob:none`) for size.

## Rabbit holes

- Rewriting history after all, even "just the subtree". Ruled out (DECISIONS
  2026-11-06); reopen only through align.
- Re-reviewing or regenerating the 939 rows. They were adversarially reviewed
  in July; spot-fix individual rows by PR instead.
- Getting GitHub to show notes. It hasn't since 2014; the overlay is a local
  and agent-facing aid.
- Rewriting SHA citations or ancestry tooling. Nothing changes SHAs, so
  nothing needs it.
- Server-side size reduction on GitHub. Not achievable without Support, and
  not needed.

## No-gos

- No `git filter-repo`, no force-push of any branch or tag.
- No direct workstation push of the notes ref: only the post-merge job writes
  origin's ref.
- No fleet inventory, local paths or local-only branch names in the public
  repo.
- No change to existing commit messages, signatures or SHAs.
