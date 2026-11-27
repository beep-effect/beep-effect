---
title: Test private keys build their PEM banner at runtime instead of suppressing the secret scanners
date: 2026-11-26
reversal: Inline the literal PEM header and footer in test/GitHubApp.test.ts and test/GitHubApp.coverage.test.ts and mark each line with gitleaks:allow and nosemgrep.
governs:
  - test/GitHubApp.test.ts#pemBanner
  - test/GitHubApp.coverage.test.ts#pemBanner
enforcedBy: []
---

The GitHubApp suites sign with a key generated in memory and wrap it in a PEM banner that `pemBanner` assembles, so no literal key header sits in source.
Reason: semgrep `beep-hardcoded-private-key` blocks any literal key header in tracked source.
Rejected: a literal banner with `gitleaks:allow` and `nosemgrep: semgrep.beep-hardcoded-private-key` suppressions, which teaches the scanners to skip a line that holds key material.
