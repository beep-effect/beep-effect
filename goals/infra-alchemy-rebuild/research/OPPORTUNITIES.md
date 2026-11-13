# Infra Alchemy rebuild: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: Alchemy's provider shape trips two repo-wide Effect diagnostics

- **Doing:** P2 `@beep/alchemy-vercel` (lane goals/infra-alchemy-rebuild-p2-vercel).
- **Evidence:** `tsrs -p tsconfig.json` on the new package failed with
  `effect(lazyEffect)` on every `XProvider = () => Provider.succeed(...)` and on
  `providers = () => Layer...` (Alchemy's own convention), and with
  `effect(missingPipeableSignature)` on `export const Project = Resource<Project>("Vercel.Project")`,
  because Alchemy's resource constructor has an `(id, Effect<props>)` overload.
  Both rules are `off` upstream and `error` in `tsconfig.base.json`, and
  `@effect-diagnostics` directives are banned outside two root files. The
  package exports constant layers and a narrowed `DeclaredResource<R>` type.
- **Would have prevented it:** a documented repo pattern for exporting
  third-party constructor shapes (Alchemy resources, platforms) that the
  `missingPipeableSignature` rule cannot model, or a rule option that
  ignores exported values typed by a dependency.

## 2026-11-13: Vitest loads `alchemy` twice, so `Unowned` reads look owned

- **Doing:** the adoption tests for the same package.
- **Evidence:** `stack.deploy` over a seeded, never-deployed project
  succeeded instead of failing with `OwnedBySomeoneElse`. The provider
  (transformed by Vite) imported `alchemy/AdoptPolicy` through the `default`
  export condition (`lib/*.js`), while the engine, loaded natively through
  `@alchemy.run/test`, used the `bun` condition (`src/*.ts`); the `Unowned`
  brand is a module-private symbol, so the engine never saw it. Fixed with
  `server.deps.inline: [/alchemy/]` in the package's `vitest.config.ts`.
- **Would have prevented it:** a shared vitest preset for packages that test
  Alchemy providers (inline `alchemy` and `@alchemy.run/*`), or a note in the
  alchemy-provider skill's testing section.

## 2026-11-13: the test harness types every engine error as `any`

- **Doing:** the same tests.
- **Evidence:** `tsrs -p tsconfig.test.json` reported 29
  `effect(anyUnknownInErrorContext)` errors on `stack.deploy(...)`,
  `stack.destroy()` and `provider.read(...)`, whose error channels are `any`
  in `@alchemy.run/test` and `alchemy/Provider`. The tests go through a typed
  view (`test/harness/Harness.ts` `typed`, `test/harness/Readers.ts`).
- **Would have prevented it:** a shared typed wrapper for the Alchemy test
  harness in a test-kit package, reused by every `@beep/alchemy-*` library.

## 2026-11-13: fallow ignores `test/fixtures/`, so test-only dependencies look unused

- **Doing:** the same package's final-check.
- **Evidence:** `fallow dead-code` reported `@alchemy.run/test` as an unused dev
  dependency of `@beep/alchemy-vercel`; its only importer was
  `test/fixtures/Harness.ts`, and `.fallowrc.jsonc` ignores `**/test/fixtures/**`.
  The harness moved to `test/harness/`.
- **Would have prevented it:** a note in the effect-vitest new-test-file
  checklist that `test/fixtures/` is invisible to fallow, so shared harness
  modules that import packages belong elsewhere.
