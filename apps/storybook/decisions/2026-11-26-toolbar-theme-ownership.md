---
title: Let MUI alone write the Storybook root theme class
date: 2026-11-26
reversal: Add withThemeByClassName or restore persisted/system theme selection.
governs:
  - .storybook/preview.tsx#ThemeSync
  - .storybook/preview.tsx#withAppTheme
enforcedBy: []
---

The toolbar chooses explicit light/dark and MUI alone writes the html class; initialize the toolbar without withThemeByClassName. Render ThemeSync inside AppThemeProvider because setMode silently does nothing outside it, and reassert the mode each render.
Reason: competing class writers strip each other’s classes; system mode fights the toolbar and persisted mui-mode leaks state across stories. Set storageManager to null so storage is neither read nor written.
Rejected: class-toggling addon decorators, system mode, or persisted MUI state. Use the canonical app provider stack so MUI and Tailwind/shadcn tokens share one signal.
Accepted limit: AppThemeProvider must remain free of Config/Layer dependencies; revisit this mount if it gains one.
