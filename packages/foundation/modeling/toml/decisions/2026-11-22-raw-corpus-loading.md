---
title: Load compliance fixtures as raw module data
date: 2026-11-22
reversal: Replace eager raw glob imports with runtime filesystem reads or normalized text loading.
governs:
  - test/corpus.ts#validFiles
  - test/corpus.ts#invalidFiles
  - test/e2e/toml-test.e2e.test.ts#README_VALID_COUNT
enforcedBy: []
---
Use eager Vite raw glob imports so compliance tests consume fixture text without runtime filesystem access.
Preserve CRLF and lone-CR bytes; the fixture tree's scoped .gitattributes also prevents normalization.
Run every valid tagged expectation and require every invalid fixture to fail through the typed channel.
Rejected: newline-normalizing fixture loaders, runtime filesystem dependence or a fixture skip list.
Normalization would erase the distinction between valid CRLF and invalid bare-CR inputs.
