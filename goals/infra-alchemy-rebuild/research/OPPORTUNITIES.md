# Alchemy infra rebuild: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: vitest loads two copies of Alchemy, so `Unowned` stops refusing

- **Doing:** P2 aws-extras lane, the adopt test for `RunnerLaunchTemplate`
  under `@alchemy.run/test` (`test.provider`, `inMemoryState()`).
- **Evidence:** a same-name launch template without Alchemy's ownership tags
  was adopted on a plain `stack.deploy`, with no `adopt(true)`. Instrumenting
  `read` showed it returned `Unowned(attrs)` while `AdoptPolicy` resolved to
  `false`. The planner checks the brand with `Unowned.is`, keyed by a
  module-private symbol, and vitest had loaded the engine (through
  `@alchemy.run/test`) separately from the package source that imports
  `alchemy/AdoptPolicy`. Inlining `alchemy` and `@alchemy.run/*` with
  `test.server.deps.inline` in the package `vitest.config.ts` fixed it: the
  deploy then fails with `OwnedBySomeoneElse`.
- **Would have prevented it:** a shared vitest preset for `@beep/alchemy-*`
  packages that inlines Alchemy, or an upstream `Unowned` brand registered
  with `Symbol.for`. Sibling lanes (vercel, github-runners) need the same
  config, or their adopt tests pass for the wrong reason.

## 2026-11-13: repo Effect diagnostics reject Alchemy's provider idioms

- **Doing:** the same lane, typing the resources and providers.
- **Evidence:** `tsrs -p tsconfig.json` reports
  `effect(missingPipeableSignature)` on every exported `Resource(...)` value
  (Alchemy's `(id, Effect<props>)` overload), `effect(lazyEffect)` on
  `XProvider = () => Provider.succeed(...)` and `providers = () => Layer...`,
  and `effect(anyUnknownInErrorContext)` on every `stack.deploy(...)` in
  tests, because `ScratchStack` types failures as `any`. Diagnostic
  directives are banned by the quality gate. The workarounds: export each
  resource through a narrowed `ExtrasResource` interface, make providers
  Layer constants, and give tests a `TypedStack` view of the scratch stack
  (`test/fixtures/FakeAws.ts`). About an hour went to this.
- **Would have prevented it:** a short `@beep/alchemy-*` section in the
  `alchemy-provider` skill naming these three shapes, or one shared
  internal helper package the three P2 libraries import.
