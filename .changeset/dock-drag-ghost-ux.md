---
"@beep/dock-react": patch
"@beep/ontology-ui": patch
"@beep/professional-desktop": patch
---

Dock gesture UX: suppress native text selection and drag-and-drop hijack across sash, tab, and
floating-pane gestures (pointerdown preventDefault, pointercancel cleanup, touch-action none);
promote tab presses to drags only past a 5px threshold and render a follow-cursor title ghost so
mid-drag state is visible; replace Float/Maximize/Restore/Dock text buttons with inline SVG icons.
Professional-desktop panel targets become flex columns, restoring the workbench layout contract so
weighted regions (ontology graph canvas, editors) regain height — fixes the knowledge graph never
mounting its renderer. Ontology Document toolbar gains AsyncResult-driven busy/disabled states on
Open/Save/Preview.
