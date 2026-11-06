---
title: "Route harness-created worktrees through beep worktree add and remove"
date: 2026-11-06
lane: "lane-bootstrap-worktrunk"
reversal: "Remove the WorktreeCreate and WorktreeRemove hooks from .claude/settings.json; the adoption pass keeps registering such lanes as adopted, so nothing else changes."
---

Amends the exploration decision desktop-app-lanes (2026-10-05, adopt, never fight). Claude Code exposes WorktreeCreate and WorktreeRemove hook events, which Worktrunk's plugin uses to make isolation: worktree lanes through its own command (research/worktrunk-evaluation.md, pattern 1). lane-bootstrap wires the same events to beep worktree add and beep worktree remove so harness-created lanes land under the fleet lanes dir with a registry row from birth. Adoption on sight remains for lanes the hooks cannot reach: Codex worktrees, ad hoc siblings and lanes created before the hooks existed. Gate: confirm the installed Claude Code emits both events (a dry hook that logs its payload) before the wiring lands; if it does not, the original decision stands unchanged.
