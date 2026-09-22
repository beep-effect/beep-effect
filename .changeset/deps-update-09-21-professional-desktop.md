---
"@beep/professional-desktop": patch
---

Drop the Vite `gl-bench` alias and the matching `gl-bench` devDependency: `@cosmos.gl/graph` 3.4.2 imports gl-bench's shipped ESM build by its deep path from its own dependency, and the bare-name alias was prefix-rewritten into a doubled, nonexistent path that failed the production build.
