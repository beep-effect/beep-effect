---
"@beep/libpff": patch
---

Complete the P3 pffexport export path: engine-version capture via `pffexport
-V`, mode-derived target-tree walking (`.export`/`.orphans`/`.recovered`),
deterministic per-item `Message.eml` assembly, `PffexportMessageRecord`
messages JSONL preserving folder/message/body/attachment relationships, an
`existingExportPolicy` output-directory policy, and a shared
`Libpff.error-translation.ts` boundary so signal-killed pffexport processes
surface as `archive-export-failed` instead of `engine-unavailable`.
