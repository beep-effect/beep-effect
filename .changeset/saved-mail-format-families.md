---
"@beep/file-processing": minor
"@beep/tika": minor
"@beep/repo-cli": patch
---

Saved mail is now a recognized format: `FileFormatFamily` gains `eml` and `msg`, classified from the extension or from the `message/rfc822` and `application/vnd.ms-outlook` media types (`classifyFormatFromMediaType`, `classifySourceFormat`), and the Tika engines extract their text and metadata. Attachments are not exported as children. A routing failure from the file-processing service now names the format no engine supports.

`beep corpus extract` gains `--tika-timeout-millis`, records sources no engine routes as settled failures (retried only when the engine routing changes, counted as `noEngine`), and takes a per-output run lock so a second concurrent extract on the same out-label is refused.
