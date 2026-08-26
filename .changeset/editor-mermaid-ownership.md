---
"@beep/editor": patch
---

Stabilize Mermaid render ownership: replace the nested `Atom.family` topology (whose
inner family was only weakly retained and could be collected mid-render, restarting the
same diagram and racing the lazy Mermaid import) with a single family keyed by a
structural `MermaidRenderKey`, and harden the async-ownership race test.
