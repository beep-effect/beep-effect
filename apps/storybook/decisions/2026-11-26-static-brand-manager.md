---
title: static brand manager
date: 2026-11-26
reversal: Import the brand package into the manager bundle.
governs:
  - .storybook/main.ts#config
  - .storybook/manager.ts#brandTheme
enforcedBy: []
---

Serve the brand wordmark and favicon through staticDirs and retain the manager’s default dark colors.
Reason: importing the brand package would pull effect/Schema into the manager bundle.
Rejected: importing brand runtime values for static chrome assets.
