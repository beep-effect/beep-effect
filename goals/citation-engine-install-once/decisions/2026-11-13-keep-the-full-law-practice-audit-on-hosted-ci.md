---
title: "Keep the full law-practice audit on hosted CI"
date: 2026-11-13
reversal: "Run full package-verify locally when the operator permits a whole-package suite."
---

The operator clarified on 2026-11-13 that file-by-file local tests govern because the full law-practice package audit runs the whole suite. Run package-verify --quick and docgen:local locally, and leave the full audit to hosted CI. The smaller lint-rules package receives its full package-verify.
