# Controller-mediated Codex ↔ Grok round trip

2026-10-09. **Passed one synthetic two-provider round trip** in 8.54 seconds, using two concurrently live, owned disposable sessions.

1. Codex `gpt-6.1-sol` medium generated a bounded JSON request envelope addressed to Grok with a fresh nonce.
2. The controller forwarded that actual model output to the owned Grok `grok-4.7` medium ACP session. Grok generated a JSON reply addressed to Codex, retaining the nonce and returning `GROK_ACK`.
3. The controller forwarded that actual Grok reply back to the same owned Codex thread. Codex generated a nonce-correlated `CODEX_ACK_GROK_REPLY` acknowledgement.

Both directions were checked from model-generated output, not from transport acceptance alone. Private correlation evidence retains exact thread/session/turn IDs and all three bounded envelopes. Public `roundtrip-result.json` contains identity-continuity booleans and sanitized model/permission receipts.

This was **controller-mediated output forwarding**, not autonomous reply-tool integration, production message delivery, or existing-app attachment. No broker, remote routing, group delivery, crash-replay or ambient fleet session was involved.

Codex used an owned standalone Unix-socket app-server with existing ChatGPT authentication forced, provider fallback disabled, MCP servers explicitly disabled, plugins/hooks/apps/memories/subagents/shell snapshot disabled, project documents disabled, and `OPENAI_API_KEY` removed from child environment. Its thread receipt confirms `gpt-6.1-sol`, medium, approval policy never, read-only sandbox and network access false. Grok used the previously verified private child HOME/read-only existing-auth bind, disabled inherited hooks/plugins/MCP, `grok-4.7` medium, no subagents, no web search and no permitted tool actions. Zero reverse tool/permission requests occurred on either side.

All owned children were stopped by finalizers. `roundtrip-probe.py` preserves the runnable test; it copies the root Codex helper's Client pattern rather than importing its top-level suite. Raw logs and exact correlation files are mode 600 under the mode-700 spike root and must remain private.
