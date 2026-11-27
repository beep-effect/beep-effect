---
title: Generate the plugin entry the static loader can inspect
date: 2026-11-26
reversal: Export bundled arrow bindings directly or minify the plugin hook module.
governs:
  - src/build-plugin.ts#bundle
  - src/build-plugin.ts#program
enforcedBy: []
---

Keep the browser module unminified because the engine reads $ and on by name. Generate the hooks entry with a function-declared register and literal hook functions calling the Effect bodies.
Reason: the Claude loader inspects the module statically; its $ traversal accepts const/function bindings but Bun emits var. Function-valued bindings are never reassigned, so rewrite those bindings to const.
Rejected: minified or direct bundled entry exports, which obscure the names or binding shapes the loader follows.
