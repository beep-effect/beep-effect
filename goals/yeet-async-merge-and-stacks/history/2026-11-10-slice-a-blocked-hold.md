# Slice A: the async merge holds a blocked PR, 2026-11-10

The acceptance row "a PR with an unresolved thread holds with GitHub's
sentence" (`SPEC.md`, slice A), observed live on this repository.

## Setup

- Disposable docs-only PR #3095 against `main`, head `d0d4e31fd5`, one file
  (`goals/yeet-async-merge-and-stacks/research/blocked-merge-probe.md`), made
  through the contents API. Every required check was green or skipped on the
  head.
- One review thread opened on it on purpose and left unresolved
  (`discussion_r4521738034`).
- It was opened as a draft. Another session on the shared login flipped it
  ready at 06:28:07Z, as the slice brief warned; the thread kept it blocked.

## What `yeet merge` did (the async path, no thread pre-check)

`yeet merge` has no thread pre-check of its own, so it reaches GitHub's rule
evaluation. Run from a bare checkout of the probe branch with the slice A
lane's CLI, 06:33:46Z to 06:33:54Z:

```text
gh api -X PUT repos/{owner}/{repo}/pulls/3095/merge-async -f sha=d0d4e31fd54b4ed2ab9aa2793dee6f50608bd4ce failed:
merge-async failed: Repository rule violations found

A conversation must be resolved before this pull request can be merged.
```

Exit 1. The PR stayed open and unmerged (`{"merged":false,"state":"open"}`).
GitHub accepted the request (202) and then failed it after evaluating the
rules, which is the case the poll exists for. The sentence arrives
multi-line; the lane now folds it onto one line for hold details.

## What `yeet merge-gate` did (pre-checks first, unchanged)

`bun run beep yeet merge-gate 3095 d0d4e31fd5` holds on its own pre-checks
before it ever sends a request:

Run at 06:39:31Z, inside the review window:

```text
[yeet] squash-commitlint #3095: pass (header "docs(goals): disposable blocked-merge probe (DO NOT MERGE) (#3095)")
[yeet] #3095 HOLD review-window-open: review window open: 9 min left (20 min after it was marked ready for review at 2026-11-10T06:28:07.000Z)
```

Run at 06:48:45Z, after the window:

```text
[yeet] squash-commitlint #3095: pass (header "docs(goals): disposable blocked-merge probe (DO NOT MERGE) (#3095)")
[yeet] #3095 HOLD threads-unresolved: 1 unresolved thread(s)
```

Both exit 1 and send no merge request: the gate's own thread check still runs
first, and GitHub's sentence is the second line of defence for a thread that
opens between the gate's read and the request.

## Clean-up

PR #3095 closed and `probe/merge-async-blocked` deleted after the record.
