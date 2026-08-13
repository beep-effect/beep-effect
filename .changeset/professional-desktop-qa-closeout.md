---
"@beep/documents-use-cases": patch
"@beep/documents-server": patch
"@beep/professional-desktop": patch
---

Close the professional-desktop QA findings: `DmsMirrorProbe` and `VaultSyncStatus` now carry an
honest disconnect reason (`credentials-missing` vs `probe-failed`) so the vault sync panel stops
telling operators to set a CLOUD_BOX_TOKEN that is already set; desktop-RPC surfaces gate on an
authenticated session instead of mounting dead write controls in chat-only HTTP sessions; the
workspace vault gate replaces its `window.prompt` fallback with a recoverable manual path form;
and the chat composer is capped to half the chat surface so the transcript stays readable in the
default docked layout.
