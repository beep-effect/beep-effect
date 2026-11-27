---
title: Initialize the minimal process global before browser story imports
date: 2026-11-26
reversal: Rely on a Node process global or initialize its shim after story imports.
governs:
  - .storybook/preview.tsx#globalWithProcess
  - vitest.storybook.setup.ts#globalWithProcess
enforcedBy: []
---

Install the minimal process shape before browser story modules evaluate; previewHead initializes it before hoisted imports and the preview keeps a fallback for consumers outside Storybook.
Reason: imported Next modules reference process at module initialization even though their Next-only runtime paths are not exercised by these stories. Browsers otherwise throw process is not defined.
Rejected: rely on Node globals or install the shim after importing stories.
