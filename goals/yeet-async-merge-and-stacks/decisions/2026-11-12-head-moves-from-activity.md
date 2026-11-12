---
title: "Head moves come from repository activity; unreadable means no carry"
date: 2026-11-12
lane: "feat/yeet-rewrite-stable-proof"
reversal: "Drop the activity read; the window anchors on every force push again."
---

The review window learns head moves from REST repository activity (`GET /repos/{o}/{r}/activity?ref=refs/heads/<branch>`, at most three cursor pages of 100), linked by sha and never by time. The walk starts at the row whose after-sha is the current head and follows force pushes while each old head classifies unchanged against the current head and the PR's base sha. The base sha is used only when the pull record's head equals the gated head. A failed pull, activity or check-suite read, a lagging activity feed, a cycle or the page bound means no carry, which is today's behaviour. Goals completion keeps its window as raw, uncarried evidence (it is non-gating), and its detail now says so.
