# P0 Shape-Stable Harness Evidence

Date: 2026-07-02

## Audit Currency

Verdict: drifted, but still usable as the preserve-exactly baseline.

I spot-checked `explorations/identity-as-iri/research/11-audit-identity-coupling.md`
against HEAD with a TypeScript AST scan of named imports from `@beep/identity`
and `@beep/identity/packages` across `apps`, `packages`, `infra`, `goals`,
`scratchpad`, and `explorations`.

- Current `@beep/identity` named imports: 56 runtime names and 9 type-only names.
- Current `@beep/identity/packages` named imports: 41 runtime names.
- Drift found: `$UsptoMcpId` is now imported from `@beep/identity/packages` and
  was not present in the audit list.
- Audit-only names not currently imported as named imports: `$DataId` and
  `$IdentityId`; `$BeepId` is an alias of the imported `$I`, not an imported
  name.

## Harness Coverage

Added `packages/foundation/modeling/identity/test/shape-stable.test.ts`.

The harness pins:

- Current runtime named imports from `@beep/identity`.
- Current runtime named imports from `@beep/identity/packages`.
- Current type-only import inventory from `@beep/identity` as a sentinel next to
  the existing package dtslint coverage.
- Every generated composer export from `src/packages.ts`, including `$I`, with
  exact current `.string()`, `.identifier`, `.value`, and `Symbol.for(...)`
  behavior.
- Composer callable/function shape and method presence for `create`, `compose`,
  `annote`, `annoteHttp`, `annoteSchema`, `annoteKey`, `make`, `string`, and
  `symbol`.
- Current `make()` one-argument forms for `beep`, `@beep`, `schema`, `@schema`,
  `@beep/schema`, and `repo-cli`.
- Representative `Symbol.for` round trips for root, package, nested, and new
  `$UsptoMcpId` identities.
- Existing `annote`, `annoteSchema`, and `annoteKey` metadata keys and values
  while allowing future additive keys such as `iri` and `curie`.
- Create-package identity registration coupling in
  `packages/tooling/tool/cli/src/commands/CreatePackage/Handler.ts`: root import
  emission, typed export emission, accessor naming, and registration against
  `generatedComposers` or `composers`.

## How To Run

Required lane:

```sh
bunx turbo run test --filter @beep/identity
```

Fallback Vitest lane when Bun-backed Vitest workers time out before test import:

```sh
cd packages/foundation/modeling/identity
bunx vitest run
```

Package check:

```sh
cd packages/foundation/modeling/identity
bun run check
```

## Gate Results

- `bunx turbo run test --filter @beep/identity`: failed before test execution;
  `bunx --bun vitest run` timed out starting Vitest fork workers for both
  `Identity.test.ts` and `shape-stable.test.ts`.
- Fallback `bunx vitest run`: passed, 2 files and 29 tests.
- `bun run check`: passed.
