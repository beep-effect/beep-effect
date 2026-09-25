---
{}
---

No release: document the TypeScript 6 / TypeScript 7 / `@effect/tsgo` split.

`docs/runbooks/typescript-toolchain.md` records which compiler each script runs, the
Effect binary paths, which dependencies still need `typescript@6` (typescript-eslint,
tstyche, commitlint; not ts-morph or knip), and how to point WebStorm's Effect plugin
at the patched compiler. The `syncpack.config.ts` hold comment now names the real
consumers and the unblock condition (TypeScript 7.1's stable API) and notes that the
Bun alias bug blocking `@typescript/typescript6` (oven-sh/bun#33834) was fixed before
Bun 1.4.0.
