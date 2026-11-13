---
title: "Known-good solutions stay out of the repository"
date: 2026-11-13
reversal: "Commit them under a lint-excluded path if a reviewer needs to reproduce preflight without the cache."
---

Preflight solutions are fixture TypeScript; they live beside the archive checkout and history records their sha256 and score reports only.
