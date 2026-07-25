---
"@beep/dock-react": patch
---

Resolve tab renderers by own key only, so a persisted `tabComponent` naming a
prototype property (`toString`, `constructor`, `__proto__`) falls back to the panel
title instead of mounting an inherited value as a React component.
