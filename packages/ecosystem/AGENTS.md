# Ecosystem Package Guide

These rules apply to `packages/ecosystem/*` and carry the published-package style exceptions in
[`standards/architecture/14-ecosystem-packages.md`](../../standards/architecture/14-ecosystem-packages.md).

- Prefer named imports from Effect module paths and native helpers where behavior is equivalent;
  consumer tree-shaking and bundle size take priority over the repo-wide namespace idiom here.
- Document every consumer export using the measured Effect JSDoc grammar. Mark non-consumer
  declarations `@internal`; production configs must enable `stripInternal`.
- Escape line-leading `@` in JSDoc prose (for example, `\@beep/effect-drizzle`) so editors do not
  interpret package names as documentation tags.
- Keep member `src/` and runtime manifest edges (`dependencies`, `peerDependencies`, and
  `optionalDependencies`) free of `@beep/*`, and never declare bundled dependencies. Tests and
  `devDependencies` may use repo packages. The contract is "publishable from the monorepo," not
  "extractable repo-free."
- Member tsconfigs carry the family effect-lsp profile: the root plugin block restated with
  exactly two style rules off (`missedPipeableOpportunity`, `missingPipeableSignature`) because
  the published data-first API surface and named-import style conflict with the repo's pipe
  idiom. Every correctness diagnostic stays `error`, and inline `@effect-diagnostics ... :off`
  directives remain banned. `beep quality tsgo-rules` verifies member profiles against
  base ⊕ this delta; do not widen the delta without an operator decision.
