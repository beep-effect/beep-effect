# /goal launcher — pretext-driver

Compact launcher; [`SPEC.md`](./SPEC.md) is the normative contract.

## Mission

Build `@beep/pretext` (`packages/drivers/pretext`): browser-safe pure root
(FontMetricsSnapshot v1 contracts + pure layout helpers),
`@beep/pretext/browser` capture surface (prepare/canvas/engine-profile),
fixture-backed test layers, centralized typed technical errors. Zero product
surface.

## First moves

1. Read `SPEC.md`, then the parent exploration's `DECISIONS.md` (Q1) and
   `BRIEF.md` (`explorations/computable-workspace-geometry/`).
2. Add `@chenglou/pretext` to the catalog; `bun install`.
3. Scaffold `packages/drivers/pretext` per repo package conventions
   (`bun run beep architecture` codegen where applicable).
4. Promote `scratchpad/computable-layout/FontMetricsV1.schema.ts` into the
   root surface; port the fixture as the first test-layer fixture.
5. Wrap the capture surface behind `/browser`; typed errors for missing
   `Intl.Segmenter`/Canvas.
6. Prove: DOM-free consumer tests green; encode∘decode identity; full-circle
   pattern reproduced against the driver.

## Guardrails

- Verify every Effect v4 API against `.repos/effect-v4` before writing.
- `npx vitest run` for package tests, never `bun test` (repo law; the bun
  exemption is scratchpad-only).
- No product vocabulary in the driver; no cross-machine determinism claims;
  `system-ui` rejected/warned.
- Close with `/reflect pretext-driver` and the yeet completion gate.
