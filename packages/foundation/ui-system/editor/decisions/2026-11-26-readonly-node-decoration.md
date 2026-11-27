---
title: "Decorate code only in the read-only Lexical state"
date: 2026-11-26
reversal: "Restore ordinary code-node rendering in the viewer and verify persisted Mermaid, copy controls and long-line readability before removing viewer node decoration."
governs:
  - "src/viewer.tsx#decorateMermaid"
  - "src/viewer.tsx#decorateCode"
enforcedBy: []
---

Convert Mermaid code blocks and remaining code blocks to real decorator nodes before the viewer mounts Lexical; these transformations belong only to the read-only state and are never serialized back.
The wire profile keeps diagrams as code blocks with language="mermaid", and the composer continues editing code blocks.
Mermaid text content remains source. Code decorators provide copy controls and horizontal scrolling rather than the contenteditable's pre-wrap line folding, which otherwise forces readers to reconstruct long code lines.
Rejected: hide code and portal a diagram into an injected sibling div inside the contenteditable subtree; Lexical owns and reconciles that subtree, removes the div and leaves a blank persisted diagram even if streaming appeared correct.
Rejected: render ordinary Lexical code nodes unchanged; they wrap long lines and require manually selecting snippets together with surrounding prose to copy them.
