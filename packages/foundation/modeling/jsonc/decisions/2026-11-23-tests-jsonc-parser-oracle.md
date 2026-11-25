---
title: The formatter and formatted modifier are pinned byte for byte to jsonc-parser
date: 2026-11-23
reversal: Delete test/JsoncParserOracle.test.ts and the jsonc-parser devDependency, and accept that formatter or modifier drift from jsonc-parser 3.3.1 goes unseen by the repo-cli JSONC editing facade.
governs:
  - test/JsoncParserOracle.test.ts#corpus
  - test/JsoncParserOracle.test.ts#formatting
enforcedBy: []
---

`JsoncFormatter.format` and `JsoncModifier.modifyWithFormatting` are ports of Microsoft's `jsonc-parser` 3.3.1 `format` and `modify` (README deviation 15 and "Added exports"), and this suite compares every edit they compute with the npm package byte for byte.

Reason: the repo-cli JSONC editing facade and its pretty JSON renderer moved onto these ports when `jsonc-parser` left `@beep/repo-cli` (effected-promotion R3b), so any difference from the package would silently change every file the facade rewrites.

`jsonc-parser` is a devDependency of this suite only. The repository-wide run of the same comparison over every tracked `*.json` and `*.jsonc` file is `goals/effected-promotion/ops/jsonc-parser-drop-differential.ts`.

Rejected: keeping `jsonc-parser` as a runtime dependency of `@beep/repo-cli`, and testing the ports only against hand-written expected output.
