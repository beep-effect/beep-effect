---
title: Every theme scale token is registered in the tailwind-merge config
date: 2026-11-27
reversal: Replace extendTailwindMerge with the stock twMerge and accept stock-only conflict resolution for theme scales.
governs:
  - src/lib/utils.ts#twMerge
enforcedBy: []
---

A theme stylesheet that declares a new `--text-*`, `--radius-*`, `--shadow-*`, `--leading-*`, `--tracking-*`, `--font-*`, `--ease-*`, `--animate-*`, `--spacing-*`, `--gap-*` or `--background-image-*` token, or an `@utility` whose name collides with a stock group, is registered in this config in the same change. `border-indicator`, for example, would otherwise read as a border color.
Reason: tailwind-merge resolves conflicts only among the names it knows. An unregistered `text-<name>` merges as a text color, and an unregistered radius, shadow or leading name never conflicts with its stock siblings, so `cn` silently keeps both classes or drops the wrong one.
Rejected: deriving the registration from the theme stylesheets at build time. The tokens are declared in CSS that no TypeScript build step reads, and a generator would add a build dependency to a module every component imports.
`text-anchor-middle` is applied only through d3 attributes, never through `cn`, so it stays unregistered.
