# Cursor ACP capability spike

2026-10-09. Owned empty workspace, installed CLI `2026.10.01-e373342`. No existing app session was contacted. No global configuration changes, copied credentials, API-key override, paid endpoint, purchase, retry, or model switch.

## Outcome

Handshake and new-session control passed. Model delivery is blocked: the first synthetic echo prompt produced **“Upgrade your plan to continue”**, while ACP returned `stopReason: end_turn` and no RPC error. The expected nonce was absent. This is a terminal model-access barrier for the approved subscription route, not a successful model receipt. No further model calls were made.

| Case | Observation |
| --- | --- |
| Initialize | Protocol version 1; `loadSession: true`, image prompts, HTTP/SSE MCP and session/list advertised |
| Session/new | Opaque owned identity returned; `mcpServers: []` sent |
| Model pin | Observed `claude-opus-5-5[context=300k,effort=medium,fast=false]` |
| Mode | CLI `--mode ask` did not propagate: session/new reported `agent`; explicit `session/set_mode` to `ask` succeeded before prompt |
| Idle echo | 1 attempted, 0 nonce receipts; remaining 4 not run because of access barrier |
| Busy queue/steer | 5 planned samples not run; no busy-turn inference |
| Cancellation | 5 planned samples not run; no model cancellation proof |
| Reconnect/session/load | After stopping original owned process, new ACP process rejected the owned session ID: `-32602 Invalid params`, session not found; zero new prompts |
| Live app attach | Unknown; no existing session touched; restart/load is a separate operation |
| Permission requests | None observed; client would deny every reverse tool/permission request; provider enforcement untested |
| Process cleanup | Every owned subprocess stopped; raw logs private mode 600 |

The unsuccessful echo's first text arrived after 262.71 ms and its RPC settled after 262.94 ms. These are plan-barrier response timings, not delivery/wake/model latency or p95 measurements. A protocol `end_turn` must be accompanied by semantic recipient evidence before marking model delivery successful.

The failed load only establishes that this denied-turn disposable session was unavailable after restart. It does not disprove loading a persisted successful conversation, and it does not test attachment to an already-running owner.

## Exact route and isolation

```text
cursor-agent --model claude-opus-5-5 --mode ask --sandbox enabled \
  --workspace ~/.cache/beep/agent-comms-spike/cursor/workspace acp
```

Existing local authentication was inherited; no credential values were inspected or copied. No model list request or other model selection was performed. The approved exact model was confirmed in `session/new` metadata.

Empty cwd, explicit `mcpServers: []`, ask mode, synthetic-only prompts, and denial of reverse operations bound the probe. Complete global-config isolation is unverified: user-level MCP config has two entries, and this CLI exposes no verified `settingSources` suppression option. No configuration values were emitted. Passing an empty ACP server list must not be interpreted as proof that user plugins/hooks/settings are disabled.

## Artifacts and repeatability

- `results.json`: sanitized structured receipt, with no session ID or absolute workspace path.
- `*.private.json*`: raw protocol and identity logs; mode 600; do not publish.
- `probe.py`: reusable client; defaults to initialize-only. Explicit `--authorized-model-probes` enables the synthetic exchange suite in `exchanges.py`.
- `session.py`: session/new-only metadata probe.
- `resume_only.py`: handshake/load-only test of this owned disposable identity.

Each RPC is bounded; the model suite has a 540-second overall bound and always closes its owned process. The client denies reverse operations and does not accept user-defined model prompts. The completed run stopped at the first missing nonce receipt.

Primary contract reference: [Cursor ACP documentation](https://cursor.com/docs/cli/acp). SDK steering remains a separate documented candidate; it was not tested here. Access remediation is an operator money decision if it requires a plan change. No remediation was attempted.
