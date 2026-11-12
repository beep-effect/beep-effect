---
title: "A rewrite is unchanged only when GitHub replayed the same commits"
date: 2026-11-12
lane: "feat/yeet-rewrite-stable-proof"
reversal: "Delete HeadMove.ts and its window and receipt call sites; every rewrite restarts the window and voids the receipt again."
---

The head-move classifier answers unchanged only when the new head is the old head's own non-empty commits replayed by GitHub onto the PR base. Four conditions apply. Every replayed commit has a GitHub committer (`noreply@github.com` or `<id>+<login>@users.noreply.github.com`). Each pair has equal author name, email and date (offset kept), an equal raw message, equal `diff-tree --raw` entries without blob ids, and an equal whitespace-exact per-path patch digest. The new head's linear base is the PR base (`A~k == S`). The base absorbs the old base, and the new tree equals `git merge-tree --merge-base=<old base> <S> <old head>`. This is stricter than `git patch-id --stable`, which ignores whitespace and metadata. Empty commits such as the S32 re-request commit are dropped from both sides before pairing. Merge commits fail closed, so a lane that merged main restarts; slice D counts those stops. Any git failure or unfetchable object classifies as unknown, which never carries. On the recorded heads all six #3050/#3051 rewrite pairs classify unchanged, and the stale-base, retarget and layer-2-versus-layer-3 counterexamples classify changed.
