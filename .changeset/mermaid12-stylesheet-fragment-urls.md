---
"@beep/editor": patch
---

Namespace `url(#id)` references inside Mermaid stylesheets alongside attribute
references, and let the desktop SVG safety policy admit stylesheet fragment
URLs that resolve to one internal target, so Mermaid 12's stylesheet-driven
`<filter>` drop shadows render instead of failing the policy.
