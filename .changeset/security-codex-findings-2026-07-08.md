---
"@beep/editor": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-use-cases": patch
"@beep/identity": patch
"@beep/langextract": patch
"@beep/law-practice-server": patch
"@beep/mcp-kit": patch
"@beep/md": patch
"@beep/pacer": patch
"@beep/provenance": patch
"@beep/uspto-mcp": patch
"@beep/utils": patch
---

security: remediate the 2026-07-08 Codex Cloud findings.

Hardens the legitimate findings from the new Codex security inventory: untrusted
CI secret exposure, release signing gates, workflow-dispatch shell input,
metadata comment escaping, tier-gate approval, markdown heading bounds, deep
merge prototype keys, PnLocal path encoding, research temp cleanup, skills path
validation, LangExtract remote policy, claim-evidence consistency, PACER request
and cleanup validation, USPTO MCP import safety, scratchpad codegen/logging, and
local-path/retired-plugin cleanup.
