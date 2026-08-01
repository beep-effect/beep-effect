---
"@beep/dock-react": patch
---

Drop previews now distinguish joining a tab list from creating a section:
tab-join targets render inside the destination strip as an insertion caret at
the computed index (Chrome tab-strip model — the position is visible and
adjustable by dragging along the strip; center-of-content still appends and
shows the caret at the end), while split and root drops keep the layout
overlay. Both preview elements persist across hovers with FlexLayout-style
CSS bound transitions, so the section overlay flies between targets and the
caret slides along the strip instead of teleporting.
