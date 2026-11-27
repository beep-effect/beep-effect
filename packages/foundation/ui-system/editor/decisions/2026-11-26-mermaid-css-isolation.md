---
title: "Validate diagram CSS and contain its painted layout"
date: 2026-11-26
reversal: "Remove the additional CSS policy and trusted-wrapper containment only after proving hostile stylesheet and layout cases remain confined."
governs:
  - "src/mermaid-view.tsx#unsafeStylesheetToken"
  - "src/mermaid-view.tsx#isSafeMermaidStyles"
  - "src/mermaid-view.tsx#rewriteMermaidTreeAttributeReferences"
  - "src/mermaid-view.tsx#renderSuccess"
enforcedBy: []
---

Validate SVG stylesheets after DOM sanitization: URL references must be local fragments and each target must resolve to exactly one element inside the diagram root.
Parse candidate CSS through a live-document CSSOM sheet with media="not all" so untrusted selectors stay inactive during inspection, in browsers and jsdom.
Namespace stylesheet fragment URLs as well as element attributes; Mermaid 12 neo themes reference defs filters from stylesheet rules.
Keep paint containment on the trusted wrapper as the fixed-position containing block and clipping boundary, including for future class-based renderer layout rules the SVG policy does not recognize.
Rejected: trust DOM sanitization alone or only inspect recognized inline layout properties; syntactically sanitized CSS can still target the containing document or escape the diagram layout.
