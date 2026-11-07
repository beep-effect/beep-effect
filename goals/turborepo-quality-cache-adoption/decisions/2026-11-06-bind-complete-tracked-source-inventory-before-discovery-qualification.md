---
title: "Bind complete tracked source inventory before discovery qualification"
date: 2026-11-06
reversal: "Remove the optional source-index digest and native env declaration while keeping affected tasks fresh and preserving failure evidence."
---

Extend the existing bounded tracked-discovery capture with the canonical Git ls-files stage command. Include the complete NUL-framed path, mode, object and merge-stage listing under the existing runtime digest, with a ten-second and 16777216-character cap. Keep scrubbed execution and sanitized failures. This is deliberately conservative: staged object changes also invalidate the shared runtime key. Working-tree contents, law scope, baseline and implementation still require native inputs; a snapshot does not freeze concurrent index edits. Historical schemas default the new optional digest to None, while current collection observes Some. Author cross-root, mode, content and failure controls for hosted CI. No local suites ran, no qualification is granted and both affected tasks remain cache false.
