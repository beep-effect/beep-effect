---
title: "Presence rows live in <repo>.presence.jsonl beside the ledger and hooks write them with jq"
date: 2026-11-13
lane: "feat/session-route-resolver"
reversal: "Have the hooks call bun run beep session presence instead of writing the row themselves, or move the file to its own state directory."
---

The file sits in the sessions state directory as github.com__<owner>__<name>.presence.jsonl, owner-only like the ledger. The SessionStart hook writes the row with jq so session start never pays the CLI's start-up cost; the row's shape is pinned by a test that runs the hook and decodes every line through SessionPresence. session note and session presence write the same row from TypeScript. A Codex process with an inherited CLAUDE_CODE_SESSION_ID writes nothing, so a CLI worker keeps resolving to its launcher.
