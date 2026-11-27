---
title: Load the component-grab overlay only in the development preview
date: 2026-11-26
reversal: Import react-grab in the manager or in every DEV preview, including browser tests.
governs:
  - .storybook/preview.tsx#globalWithProcess
  - vitest.storybook.setup.ts#globalWithProcess
enforcedBy: []
---

Load react-grab only in the story iframe with DEV true and MODE other than test, installing bippy’s DevTools hook before its import.
Reason: react-grab initializes in the importing document, its bundled bippy skips the preview-frame hook install, and missing hook.renderers breaks activation. Browser tests have DEV true; an overlay enters addon-a11y’s body scan and freezes updates mid-play.
Rejected: manager imports or a DEV-only guard. The browser-test afterAll check waits for preview-triggered imports and fails if the overlay appeared.
