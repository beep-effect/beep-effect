---
"@beep/agents-client": patch
"@beep/langextract": patch
"@beep/provenance": patch
"@beep/workspace-server": patch
---

Persist citation-verification attempt history and verify source-text identity before
accepting exact anchors or re-anchoring candidates.

Run receipt-reconciliation polling tests against the live clock so delayed status checks cannot stall under the test clock.

Prove the workspace resolver's canonical full-source output against the reusable
verified-source contract.
