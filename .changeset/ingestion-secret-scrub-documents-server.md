---
"@beep/documents-server": major
---

Admit extracted filing excerpts through the credential scrub before constructing
the model prompt. Blocked or unknown results route to the inbox without a model
call; boundary logs carry counts and categories only.

Direct users of FilingDecisionLlmLayer must provide SecretScrubService. The composed
DocumentsServerLlmLayer supplies the default implementation.
