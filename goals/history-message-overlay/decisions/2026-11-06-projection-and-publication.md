---
title: "Notes ref is a projection of the tracked map, published only by a post-merge job"
date: 2026-11-06
lane: "docs/git-history-rewrite-exploration"
reversal: "Remove the workflow and the History command; the tracked map stays as plain data"
---

beep history notes --write builds the ref deterministically from docs/history/commit-message-map.json; --check fails on drift; a post-merge workflow on main is origin's only writer. A refs/notes/* ruleset is optional later hardening. Source: explorations/git-history-rewrite/DECISIONS.md (2026-11-06).
