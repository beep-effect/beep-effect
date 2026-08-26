---
"@beep/brand": minor
"@beep/identity": patch
"@beep/storybook": patch
---

Add `@beep/brand`, a `foundation/ui-system` package that owns the beep brand identity as
schema-decoded data (forest-green and zinc color schemes, Inter and JetBrains Mono stacks,
the lambda mark geometry) and renders the Tailwind v4 theme stylesheet, the SVG mark,
favicon, and wordmarks from it. Ships a shadcn bridge stylesheet, self-hosted fonts, a
`@beep/brand/react` subpath with `BeepMark` and `BeepWordmark`, and a parity test that
fails when a generated file drifts. Storybook's manager now carries the wordmark and favicon.
