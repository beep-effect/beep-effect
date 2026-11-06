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
`origin/main`. After the merge, the publication job rebuilds
`refs/notes/history` from this file; nobody pushes the notes ref by hand.

## Seeing the overlay

Until the sync tooling lands, a clone can fetch and display the ref by hand:

```sh
git config --add remote.origin.fetch '+refs/notes/history:refs/notes/history'
git config --add notes.displayRef refs/notes/history
git fetch origin
git log 6f33208961 -1
```
