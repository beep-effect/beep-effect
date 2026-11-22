---
title: "The store is one SQLite file per repository, keyed by the origin URL"
date: 2026-11-20
lane: "goals/gate-run-history-lane"
reversal: "Key the file by the checkout path and accept one history per clone."
---

The file is gate-history/<repository-key>.sqlite under the beep state directory from @beep/xdg AppDirs. The key is the canonical origin URL written as host__owner__repo, lower-cased, with the .git suffix and any credentials dropped, and an underscore of the URL written as _u so no two origins share a key; a repository with no origin takes a digest of the real path of its git common directory. Upstream derives its key from the package manifest's repository field and falls back to the directory name; the origin URL is used here because every clone and worktree of this repository shares it and a worktree's directory name does not identify the repository.
