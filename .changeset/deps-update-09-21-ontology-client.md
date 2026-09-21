---
"@beep/ontology-client": patch
---

Drop the browser Vitest `gl-bench` alias and the matching `gl-bench` devDependency for the same reason as the professional-desktop Vite config: `@cosmos.gl/graph` 3.4.2 imports gl-bench's ESM build directly from its own dependency.
