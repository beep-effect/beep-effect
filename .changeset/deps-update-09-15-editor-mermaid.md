---
"@beep/editor": patch
---

Accept mermaid 12 theme stylesheets that reference `<defs>` filters through local `url(#id)` fragments, namespace those fragment targets alongside element ids, and cover the render race with a regression test.
