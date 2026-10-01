---
"@beep/observability": minor
"@beep/m365": minor
"@beep/venice-ai": minor
"@beep/pacer": patch
"@beep/govinfo": patch
"@beep/ai-sync": patch
"@beep/professional-desktop": patch
---

Replace the retired `@beep/schema` `HttpMethod`, `HttpStatus`, and `Toml` concepts under the
"Upstream-First Foundation/Modeling" decision (`standards/architecture/DECISIONS.md`,
2026-09-29). `@beep/observability` now owns `HttpStatusCode` (the same 100–599 composition),
and the client and server HTTP error `status` fields keep encoding as the status name over the
same names. The Microsoft 365 and Venice AI driver errors keep the same status catalog and the
same fallback to 500. PACER, GovInfo, and the desktop RPC session guard read named codes through
`effect/http/HttpStatus`, and `@beep/ai-sync` parses Codex config with `effect/encoding/Toml`,
which also runs on Node. Served status numbers and parsed config values are unchanged.
