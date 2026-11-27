---
title: todox keeps its own PostCSS config for Tailwind's theme and utilities layers
date: 2026-11-26
reversal: Import the shared @beep/ui PostCSS setup and add @beep/ui as a dependency.
governs:
  - postcss.config.mjs#config
enforcedBy: []
---

Tailwind runs only to build its theme and utilities layers into src/app/globals.css; the site's own styles stay hand-written CSS. A local config with the bare `@tailwindcss/postcss` plugin gives that without the shared UI package.

Rejected: reusing @beep/ui's PostCSS and Tailwind setup, which adds an @beep/ui dependency the site does not otherwise need.
