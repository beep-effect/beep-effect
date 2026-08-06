---
"@beep/repo-cli": patch
---

Add the Yeet merge loop: `beep yeet sweep [--plan]` resets the clone after a
merge (prune refs, fast-forward main, delete merged branches, reinstall on a
moved lockfile) as a worktree-aware plan whose every skip is reported instead
of failing; `beep yeet merge` squash-merges without `--delete-branch`, confirms
`MERGED` through the API, and only then hands the whole cleanup sequence to the
sweep; `beep yeet reply` posts and resolves drafted review-thread replies from
`.beep/yeet/reply-drafts.json` and records a report beside it; and
`beep yeet monitor --until-merged` follows the pull request across pushes,
giving each known-flake job one `gh run rerun --job` per head SHA before
sweeping the clone on merge.

Yeet status now carries a `mergeReady` verdict plus per-thread triage context,
the run verdict is written through an `S.encode`-backed JSON codec, and the
Fallow advisory phase purges stale or mode-mismatched envelopes and skips
instead of failing the run.
