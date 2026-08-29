---
"@beep/dock-react": patch
"@beep/ontology-ui": patch
"@beep/professional-desktop": patch
---

Browser-QA fixes from the workbench-migration loop: drag pointers normalize
to the dock root's coordinate space (drops hit the hovered group), Dock
restores a floated group's pre-float placement, the tab-overflow menu gets
popover chrome, strips wrap at narrow widths, floating headers carry a grip
and title, per-panel minima guard splits, and the SPARQL Run button's
disabled state reads as inactive instead of low-contrast.
