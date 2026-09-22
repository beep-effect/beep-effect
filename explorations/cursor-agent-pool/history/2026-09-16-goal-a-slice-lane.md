# Goal A slice — composer-2.5 lane, 2026-09-16

Wrote `docs/runbooks/agent-pools.md` (pool order, Codex probe, Cursor fail-open meter, seat map
with L3 list prices, recipe v2, jq cookbook, structural guards, hooks smoke mapping, sandbox
notes, Codex pointer, failure table, sources), replaced `AGENTS.md` "Token-heavy Codex work" with
"Volume pools" (Codex pins verbatim under pool 1, Cursor pool 2 in three lines), and this history
note.

Could not reconcile: D7's "5% per bucket" Cursor floor has no machine-readable meter under D17 —
the runbook treats dashboard bucket bars as the human check and lane stderr as the only
headless signal. CLIProxyAPI quota for proxy Codex accounts remains NOT FOUND (D8 union is
documented but only the CLI probe is proven live). L3 marks Grok 4.6 in the doubled Cursor Models
grant as INFERENCE, not CONFIRMED.

Guessed: the review primary id is pinned as `claude-opus-5-thinking-high` per D18 rather than
the wildcard `claude-opus-5-*` from L3; mechanical tier uses `gpt-5.6-luna-high` exactly as in
BRIEF/D16. Host timeout default is 15m from L1 brief, not a separate decision.
