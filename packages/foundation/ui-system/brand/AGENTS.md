# @beep/brand

beep brand identity: marks, palette, typography tokens, and static assets.

## Surface

- `src/index.ts` is the framework-free root; `src/react.tsx` is the only React surface
  and must not be re-exported from the root.
- `styles/brand.css` and `assets/*.svg` are generated. Edit `src/Brand.tokens.ts`, run
  `bun run render`, never hand-edit the generated files; `test/assets.test.ts` enforces it.
- The PNG icon set is rasterised from `assets/favicon.svg`; regenerate it when the mark changes.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package.
- Keep this package free of product-domain language and of `@beep/ui` imports; the
  dependency direction is `@beep/ui -> @beep/brand`, never the reverse.
