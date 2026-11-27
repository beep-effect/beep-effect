---
title: eager browser dependencies
date: 2026-11-26
reversal: Use only Vite’s initial crawl and discover Effect leaves while rendering stories.
governs:
  - .storybook/main.ts#config
  - vitest.storybook.config.ts#config
enforcedBy: []
---

Prebundle the Effect leaves that workspace UI and schema imports reveal after the initial crawl, both in preview and browser tests.
Reason: discovery during story rendering would re-optimize dependencies and reload the preview.
Rejected: discovering workspace imports only during story rendering, which reloads active stories or tests.
