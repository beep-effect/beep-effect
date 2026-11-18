---
title: "P0: T3-hosted sessions see T3CODE_THREAD_ID, Codex included"
date: 2026-11-13
kind: checkpoint
lane: "feat/session-route-resolver"
reversal: "If a Codex shell under T3 lacks the variable, record that kind as resolving through t3 thread lookup by worktree or PR only."
---

Observed in a T3-hosted Claude session's tool shell: T3CODE_THREAD_ID, CLAUDE_CODE_ENTRYPOINT=t3-code and CLAUDE_CODE_SESSION_ID are set, and the T3 userdata environment-id file holds the environment id. For Codex, the T3 Codex adapter (apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts, T3 checkout 2026-11-13) sets T3CODE_THREAD_ID per thread through shell_environment_policy, so a T3-hosted Codex tool shell sees its own thread id; the app-server process itself does not carry it, so presence is captured from the session's shells and hooks, not from the server process. `t3 thread show <id> --json` exits 1 with 'is no longer available' on stderr for a missing thread, which separates dead from unreachable.
