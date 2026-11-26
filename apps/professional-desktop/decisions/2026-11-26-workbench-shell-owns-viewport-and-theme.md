---
title: The workbench shell owns the viewport, its compositor layer and the theme toggle
date: 2026-11-26
reversal: Size the shell with h-screen, let the page scroll, drop the isolated GPU layer and move the theme toggle back into the chat header.
governs:
  - src/App.tsx#DesktopShell
  - src/App.tsx#minGroupExtentBeforeFonts
  - src/App.tsx#stripChromeWithActionRail
  - src/chat/ui/Composer.tsx#Composer
  - src/chat/ui/ChatApp.tsx#ChatApp
  - src/editor-proof/EditorProofPanel.tsx#EditorProofPanel
enforcedBy: []
---

Nothing outside the shell scrolls; every surface scrolls in its own pane. A surface fills what it is given (`h-full`, never `h-screen`): the chat surface mounts below the nav, and asking for the whole viewport overflowed by the nav height, so the window scrolled on top of the transcript scrollbar. The shell is `h-dvh` with `overflow-hidden`, so a mobile browser's collapsing chrome cannot make the app taller than its real space, and a surface that misjudges its height is clipped instead of growing a second scrollbar over the pane already scrolling.
The shell sits on one compositor layer (`isolate transform-gpu`): software-rendered browser captures otherwise show partial text-tile repaints for a frame when dock portals swap active content.
The dock's minimum group extent is a synchronous floor used while font capture settles, and the tab strip's chrome budget includes the Float/Maximize action rail.
The composer is capped at half the chat surface (`max-h-1/2`) as a flex column: its editable region scrolls internally and the send row stays visible. Uncapped, the toolbar, editor and send row consumed a short dock panel and starved the transcript to a ~20px strip (QA closeout P0); scrolling the whole composer pushed Send out of view.
The editor proof panel keeps the editor region at a usable floor: when the dock box is shorter than controls, drawer and floor, the panel scrolls as a whole instead of collapsing the document, and its sticky, opaque controls never sit half-hidden under the tab strip after focus-driven scrolling.
The theme toggle lives in the shell nav, not in one surface, and surfaces carry no title bar of their own: the nav already says where you are, and a chat header cost vertical height on the surface that needs it most.
Rejected: `h-screen` and page-level scrolling (the outer scrollbar problem above); no isolated layer (capture flicker); the toggle in the chat header, where it lived before and where Home, Ontology and Vault sync could not reach it.
