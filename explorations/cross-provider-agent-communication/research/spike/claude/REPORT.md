# Claude managed-session communication probe

2026-10-09. Installed Claude Code 2.1.295; explicitly selected `claude-opus-5-5` at medium effort. Existing first-party `claude.ai` Max subscription was verified through auth-status metadata; no credentials were read or printed. No API key, alternate provider endpoint, model fallback or delegation was used.

## Results

| Case | Result | Evidence boundary |
| --- | --- | --- |
| Stream-json initialize control request | Success | Zero-model-turn capability handshake |
| Idle nonce request/reply | 5/5 pass | Same owned persistent process and one session identity; nonce in assistant/result output |
| Followup submitted during observed active stream | 5/5 pass | Same session; queued followup after first result, second result echoes nonce |
| Interrupt control during observed content delta | Control success | Active turn returned `error_during_execution`; no claim of provider-independent targeted cancel semantics |
| Existing visible app-session attachment | Not probed | Managed CLI session must not be counted as app continuity |
| Claude channels | Unverified | Channels flag absent in installed help; no plugin setup or channel handshake attempted |

All ten nonce exchanges used one session identity. Idle response completion took 1.209–1.413 seconds. Busy-followup completion took 7.064–8.190 seconds after submission, including completion of the preceding 300-word task. These are model completion latencies from five cases, not transport latency or production p95 estimates. Entire suite completed in 51.95 seconds.

Interrupt used `{"type":"control_request","request_id":"probe-interrupt","request":{"subtype":"interrupt"}}`. The control response was success; the resulting error contained a diagnostic stop-state record, not an explicit user-cancel reason. This demonstrates the interrupt control was accepted and execution ended; stronger cancellation labeling requires adapter-level testing.

## Launch and isolation

Launch argv recorded by reusable `handshake.py` / `probe.py`:

```text
claude --safe-mode --setting-sources '' --strict-mcp-config
  --mcp-config '{"mcpServers":{}}' --disable-slash-commands --tools ''
  --permission-mode dontAsk --permission-prompts none
  --no-session-persistence --no-chrome --model claude-opus-5-5 --effort medium
  --system-prompt '<disposable nonce-probe instruction>'
  --print --input-format stream-json --output-format stream-json --verbose
  --include-partial-messages --replay-user-messages
```

Empty owned workspace beneath `~/.cache/beep/agent-comms-spike/claude/workspace`; no repository files or live user sessions. Environment stripped `ANTHROPIC_*` and `CLAUDE_CODE_USE_*` route overrides so first-party subscription auth remained the route. Normal home retained solely for existing login; no raw credential reads. `--bare` was deliberately excluded because installed help says it disables OAuth auth.

Effective startup confirmed model `claude-opus-5-5`, permission mode `dontAsk`, zero tools, zero MCP servers, zero skills, and three plugin metadata entries. `--safe-mode` help explicitly retains built-in plugins, so this is not a plugin-free claim. Customizations/hooks/plugins are disabled by safe-mode semantics; the no-tools/MCP surface is verified in startup events. No global or repo configuration was changed. Medium effort is an explicit launch argument, not a separately echoed startup field.

Private protocol logs have mode 0600; exported receipts omit account identifiers, session IDs and transcript content. Owned child process group was terminated and waited at completion. Reusable probe now has a 240-second overall alarm in addition to bounded per-operation waits; observed run required 51.95 seconds before the alarm addition.

## Files

- `handshake.py`: zero-model initialization probe.
- `handshake-receipt.json`: sanitized handshake outcome.
- `probe.py`: reusable idle, busy-followup and interrupt probe.
- `receipts.json`: sanitized per-attempt outcomes and effective startup counts.
- `handshake-private.jsonl`, `probe-private.jsonl`: private raw protocol evidence, mode 0600; do not commit.

No cross-provider exchange, existing-app attachment, idle wake of a human-started session, channel deployment, reconnect/replay or crash consistency was tested. The result qualifies managed persistent-stream input as a viable Claude adapter edge; queued followup must remain distinct from active-turn steering.
