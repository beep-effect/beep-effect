---
title: "Slices 3 and 4 in the lane: publication workflow, docs, folder archived"
date: 2026-11-06
kind: checkpoint
lane: "docs/git-history-rewrite-exploration"
pullRequest: 2785
reversal: "Delete .github/workflows/history-notes-publish.yml and restore the folder from the archive"
---

History Notes Publish (.github/workflows/history-notes-publish.yml) runs on main pushes that touch docs/history/commit-message-map.json and on dispatch: full-history checkout, --write, --check --require-published, then a force-push of refs/notes/history with the job token (contents: write, job-scoped). beep ci workflow-lint: clean. docs/history/README.md documents sync, publication and the blobless clone. The cutover folder moved to $HOME/.local/state/beep/archive/beep-effect-cutover/ and goals/legacy-drain has a checkpoint. Remaining acceptance needs main: the first workflow run publishing the ref, then --check against it.
