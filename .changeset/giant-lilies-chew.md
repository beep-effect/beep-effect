---
"@beep/oip-web": patch
"@beep/professional-desktop": patch
"@beep/ui": patch
---

Migrate oip-web and professional app UI state to Effect atom reactivity, fix the shared `@beep/ui` carousel infinite-render loop by hoisting render-body atoms into module-scoped `Atom.family` instances, and refresh repo-exports catalog shards.
