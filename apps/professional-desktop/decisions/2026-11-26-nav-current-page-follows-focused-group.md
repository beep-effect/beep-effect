---
title: Navigation focuses the panel's group, and the current page is the focused group's active panel
date: 2026-11-26
reversal: Make navigation only activate the panel's tab, and mark every active panel in any group as current.
governs:
  - src/App.tsx#focusPanelGroup
  - src/App.tsx#navigateDesktopPanelAtom
  - src/App.tsx#DesktopShell
enforcedBy: []
---

A nav click focuses the target panel's group and then activates its tab. The rail marks one current page: the panel active in the focused group. Before any focus interaction, or once focus clears, it falls back to a panel active in any group.
Rejected: activating the tab alone. A nav click on a panel already active in an unfocused group is then a visual no-op, and the current page does not follow the click.
