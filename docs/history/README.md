# Commit-history overlay

About 940 commits on `main` from before late July 2026 have subjects such as
`saving`, `updated deps` or `merged in main`. This directory holds better
messages for them. Nothing here rewrites history: every SHA, signature and
original message stays as it is. The corrected messages are published as git
notes on the ref `refs/notes/history` and show up in `git log`.

## Files

| File | What it is |
| --- | --- |
| `commit-message-map.json` | Object keyed by full 40-character commit SHA. Each value is a conventional commit message: subject line (72 characters or fewer), optionally a blank line and a body. 940 rows. |
| `commit-message-map.excluded.json` | 55 commits that were considered and deliberately left with their original message (50 authored upstream, 5 merges whose body already carries the detail), with the reason for each. |

## Provenance

The map was drafted in July 2026 by a model fleet over the full history,
checked against the repo's `commitlint.config.ts`, and adversarially reviewed
by three models (53 fixes applied). One row was added on 2026-11-06 for
`6f33208961`, the only `saving` commit the July map missed. Background and the
decision not to rewrite history:
[`explorations/git-history-rewrite`](../../explorations/git-history-rewrite/)
and [`goals/history-message-overlay`](../../goals/history-message-overlay/).

## Changing a row

Edit the row in a pull request. Every key must stay an ancestor of
`origin/main`, and each message needs a subject of 72 characters or fewer,
optionally followed by a blank line and a body. `bun run beep history notes
--check` proves both locally. After the merge, the `History Notes Publish`
workflow (`.github/workflows/history-notes-publish.yml`) rebuilds
`refs/notes/history` with `bun run beep history notes --write`, checks it, and
force-pushes the notes ref. Nobody pushes the notes ref by hand.

## Seeing the overlay

`bun run beep worktree new` and the cloud bootstrap configure this for you.
In any other clone, run it once:

```sh
bun run beep history notes sync
git log 6f33208961 -1
```

`sync` adds `+refs/notes/history:refs/notes/history` to the `origin` fetch
refspecs and `refs/notes/history` to `notes.displayRef`, each only if missing,
then fetches the ref. From then on, plain `git log` and `git show` print a
`Notes (history):` block under each corrected commit. github.com does not show
git notes.

## Smaller clones

History is never rewritten, so the old vendored `.repos/` subtree commits stay
in the object graph. For a lighter clone, fetch file contents on demand:

```sh
git clone --filter=blob:none git@github.com:beep-effect/beep-effect.git
```
