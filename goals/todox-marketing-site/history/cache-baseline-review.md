# Qualification baseline refresh for the Todox product site

`feat/todox-product-site` gives `@beep/todox` three workspace dependencies it
did not have when the reviewed baseline was recorded on `main` at
`2086a0a090` (#1068): `@beep/identity`, `@beep/schema`, and `@effect/atom-react`
(the last is a catalog package, not a workspace edge). The app's `tsconfig.json`
and `tsconfig.check.json` gained the matching project references through
`bun run beep tsconfig-sync`. No task command, script map, root configuration,
or Turbo task definition changed.

`bun run beep quality cache-policy` therefore reports five
`configuration-drift` findings, one per `@beep/todox` executable computation
whose projected dependency edges moved from `[]` to the identity and schema
packages: `#audit`, `#build`, `#check`, `#lint:deprecated-apis`, `#test`.

This review accepts that dependency-edge change as an inherited configuration
of the product-site build without granting cache qualification to any
computation. The scope stays identity lint and types lint in
`local-linux-x64-bun1.4.2`, epoch `qualification-v2`; both remain excluded and
cache-disabled. The qualification ledger is unchanged. The canonical baseline
writer compares the previous baseline digest and this review's exact bytes.

Reviewer: Claude Fable 5.1 on behalf of the goal executor, 2026-09-11.
Evidence: `goals/todox-marketing-site/PLAN.md` (redesign evidence log), the
`quality:cache-policy` lane output in the `feat/todox-product-site` yeet repair
run, and `standards/cache-qualification-baseline.json` at the prior digest.
