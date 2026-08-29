# /goal: Firecrawl Driver

Repo: `/home/elpresidank/YeeBois/projects/beep-effect`.

Mission: implement `@beep/firecrawl` at `packages/drivers/firecrawl` as a
technical Firecrawl driver, then finish verification, PR, CI, review, Greptile,
and readiness.

This is a compact `/goal` launcher. The detailed contract lives in the packet:

- `goals/firecrawl-driver/README.md`
- `goals/firecrawl-driver/SPEC.md`
- `goals/firecrawl-driver/PLAN.md`
- `goals/firecrawl-driver/research/firecrawl-sdk-inventory.md`
- `goals/firecrawl-driver/ops/manifest.json`

Read those files first, then read `AGENTS.md`, `CLAUDE.md`,
`standards/ARCHITECTURE.md`, `standards/architecture/03-driver-boundaries.md`,
`standards/architecture/07-non-slice-families.md`,
`standards/architecture/09-errors-across-boundaries.md`,
`standards/architecture/12-observability.md`, and
`.patterns/jsdoc-documentation.md`. Architecture standards outrank packet prose.

Load/use these skills: `$grill-with-docs`, `$effect-first-development`,
`$schema-first-development`, `$jsdoc-annotation-specialist`,
`$quality-review-fix-loop`, `github:yeet`, `github:gh-fix-ci`, and
`github:gh-address-comments`. If unavailable, record it and use the closest
repo-native fallback.

Before coding, refresh
`goals/firecrawl-driver/research/firecrawl-sdk-inventory.md`. Record local
clone path `/home/elpresidank/YeeBois/dev/firecrawl`, clone commit/status,
current npm `firecrawl` version, installed package version, docs/OpenAPI refs,
SDK files inspected, in-scope/excluded methods, schema names, LiteralKit
domains, tagged unions, Option/nullish policy, watcher event model, live smoke
scope, and source/npm/docs drift. Stop if the method surface is ambiguous.

Scaffold with the modern `firecrawl` npm package:

```sh
bun run create-package firecrawl --family drivers --description "Firecrawl driver package"
```

Do not default to `@mendable/firecrawl-js`. Use it only if the refreshed
inventory proves modern `firecrawl` is not viable and documents why.

Nonnegotiables from `SPEC.md`/`PLAN.md`: implement the current nondeprecated v2
SDK method surface; exclude deprecated v1 aliases and extract methods; make
schemas the source of truth with `S.Class` Payload/Success/Failure classes for
every method; transform optional/nullish fields to `Option`; use named
`LiteralKit` domains and tagged unions; expose an Effect `Context.Service` with
Layers, effectful config, `Redacted` secrets, decoded Success values, and typed
technical `FirecrawlError` values; never leak raw thrown SDK values; keep the
driver free of product/slice/domain/UI/app imports; sanitize observability; add
JSDoc/TSDoc annotations, fake/live Layers, and tests.

Watcher is first-class: expose an Effect `Stream` of decoded watcher events and
close the SDK watcher on completion or interruption.

Verification lane:

```sh
bunx turbo run check test lint type-test --filter=@beep/firecrawl
bunx turbo run test:integration --filter=@beep/firecrawl
bun run docgen:local
bun run repo-exports:catalog
bun run repo-exports:catalog:check
bun run lint:fix
bun run audit:github quality
```

Tests must cover fake SDK units, watcher stream/finalizers, error translation,
schema decoding, dtslint public API, and low-cost live smokes gated by
`FIRECRAWL_API_KEY`.

Use branch `codex/firecrawl-driver` unless it conflicts. Commit intentionally:
`feat: add firecrawl driver`. Open a draft PR only after local quality is
green. Use the GitHub skills for CI and review follow-up.

After each follow-up commit, comment `@greptileai`, wait for the review, report
the score, and continue until Greptile is `5/5`. Mark ready only after CI is
green, actionable comments are resolved, and Greptile is `5/5`.

Stop only for packet stop conditions: ambiguous Firecrawl drift, unexpected
live-test cost/destructive side effects, unrelated unreproducible CI failure
after reasonable investigation, or unobservable Greptile trigger/score after
documented attempts.
