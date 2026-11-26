---
title: The workbench shell owns the viewport and the theme toggle; each surface fills and scrolls its own pane
date: 2026-11-26
reversal: Size surfaces with h-screen, let the page scroll, let the composer and editor proof grow with their content, and move the theme toggle back into a chat header.
governs:
  - src/App.tsx#DesktopShell
  - src/chat/ui/ChatApp.tsx#ChatApp
  - src/chat/ui/Composer.tsx#Composer
  - src/editor-proof/EditorProofPanel.tsx#EditorProofPanel
enforcedBy: []
---

Nothing outside the shell scrolls. The shell is `h-dvh` with `overflow-hidden`, so a mobile browser's collapsing chrome cannot make the app taller than its real space, and a surface that misjudges its height is clipped instead of growing a second scrollbar over the pane already scrolling.
A surface fills what it is given (`h-full`, never `h-screen`): the chat surface mounts below the nav, and asking for the whole viewport overflowed by the nav height, so the window scrolled on top of the transcript scrollbar.
Inside a surface, the part that can grow scrolls and the controls stay put. The composer is capped at half the chat surface as a flex column, so its editable region scrolls and the send row stays visible. The editor proof panel keeps the editor region at a usable floor and scrolls as a whole when the dock box is shorter than controls, drawer and floor; its controls are sticky and opaque so focus-driven scrolling never leaves them half-hidden under the tab strip.
Shell-wide controls live in the shell nav, and surfaces carry no title bar of their own: the nav already says where you are.
Rejected: `h-screen` and page-level scrolling (two scrollbars for one list); an uncapped composer (it starved the transcript to a ~20px strip in a short dock panel, QA closeout P0); scrolling the whole composer (Send scrolled out of view); the theme toggle in the chat header, where Home, Ontology and Vault sync could not reach it and the header cost vertical height on the surface that needs it most.
