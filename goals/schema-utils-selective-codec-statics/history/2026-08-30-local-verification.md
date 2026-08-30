# Local Verification — 2026-08-30

## Selective API

- `bun vitest run test/codecStatics.test.ts` from `@beep/schema`: 8 tests pass.
- `bun run beep quality package-verify @beep/schema`: audit and docgen pass.
- `bun run beep quality package-verify @beep/rdf`: audit and docgen pass.
- All remaining touched workspace packages completed their justified quick
  package-verification lane; the final directly affected reruns for
  `@beep/agents-domain`, `@beep/law-practice-domain`,
  `@beep/law-practice-server`, and `@beep/db-admin` pass.

## Repository Laws

- Effect import governance: pass.
- Schema-first inventory: 92 live and tracked entries, zero missing, stale,
  enforced, or advisory entries.
- JSDoc ratchet: 20 tracked metrics, zero growth, zero non-generated legacy
  findings.
- Fallow audit: zero introduced complexity or duplication; inherited-adjacent
  findings remain non-blocking.
- Goals doctor and generated index check: pass with no introduced blocking
  findings.

## Attributed Failure

`bun run beep quality test-tsgo` reports no changed-source diagnostics. It
fails only while compiling vendored `infra/node_modules/@pulumi/gharunners`
sources under the infra test project, principally TS1295 CommonJS versus
`verbatimModuleSyntax` diagnostics. This environment/dependency failure was
reproduced independently of the migration-owned fixes and is recorded in
`research/OPPORTUNITIES.md`.

## Census

- Opening attachments: 726, including 291 generated declarations.
- Closing attachments: 213 explicit, non-empty selections.
- Broad helper matches: 0.
- JSON-suffixed static matches: 0.
- Unresolved owners or risky augmented roots: 0.
- Inline compiler baseline: 2,935 opening; 2,931 closing; touched findings: 0.
