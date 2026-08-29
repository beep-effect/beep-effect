# /goal: Box Driver

Repo: the machine-local `beep-effect2` checkout.

Mission: finish `@beep/box` at `packages/drivers/box` as a full-surface,
**generated**, schema-first, Effect-first technical driver around
`box-node-sdk` v10.11.1, then complete verification, PR, CI, review, Greptile,
and readiness.

The package is already scaffolded on branch `feature/beep-box-driver`
(`Box.config.ts` + `Box.errors.ts` exist; `Box.service.ts` is a stub,
`Box.models.ts` empty). Do NOT run `create-package`.

This is a compact `/goal` launcher. The detailed contract lives in the packet:

- `goals/box-driver/README.md`
- `goals/box-driver/SPEC.md`
- `goals/box-driver/PLAN.md`
- `goals/box-driver/research/box-sdk-inventory.md`
- `goals/box-driver/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`,
`standards/architecture/03-driver-boundaries.md`,
`standards/architecture/06-configuration-boundaries.md`,
`standards/architecture/07-non-slice-families.md`,
`standards/architecture/09-errors-across-boundaries.md`,
`standards/architecture/12-observability.md`, and
`.patterns/jsdoc-documentation.md`. Architecture standards outrank packet prose.

Load/use: `$grill-with-docs`, `$effect-first-development`,
`$schema-first-development`, `$jsdoc-annotation-specialist`,
`$quality-review-fix-loop`, `github:yeet`, `github:gh-fix-ci`,
`github:gh-address-comments`. Record any unavailable skill and use the closest
repo-native fallback.

Before coding, refresh `research/box-sdk-inventory.md`: confirm SDK version,
manager/method counts, `@deprecated` methods, error shape, auth classes, and the
non-JSON managers. Stop if the method surface is ambiguous.

Locked decisions (see `ops/manifest.json keyDecisions`):

- Generate schemas + per-manager wrappers from the SDK's own `.d.ts` (camelCase,
  decode-compatible, version-locked) via `scripts/generate.ts` (runpod-style).
  Not upstream OpenAPI; not hand-written.
- Service = generated per-method wrappers grouped by manager
  (`box.files.getFileById`), each through one shared `runSdkCall`
  (decode → `tryPromise` → decode → `box.<method>` span → `BoxError`).
- Pragmatic generated fidelity: `S.optionalKey` (not Option); open enums →
  `S.Union([LiteralKit(known), S.String])`; permissive decode. Record this
  divergence in `standards/architecture/DECISIONS.md`.
- Binary/streaming managers hand-written in `Box.streaming.ts`: downloads/zip →
  `Stream<Uint8Array>`; uploads/chunked take byte input; `events` →
  finalizer-backed Effect `Stream`.
- Auth: dev-token layer (`CLOUD_BOX_TOKEN`) + CCG layer + `makeLayerFromClient`;
  OAuth/JWT deferred.
- Generator excludes `@deprecated` + non-JSON methods (logs both); output split
  into `_generated/Box.{models,operations}.gen.ts`, internal via `exports`.
- Live smokes read-only, env-gated on `CLOUD_BOX_TOKEN`.

Generated `_generated/` must carry per-export JSDoc and stay internal. Never
leak raw thrown SDK values; keep the driver free of product/slice/domain/UI/app
imports; sanitize observability (no tokens, raw file content, or PII).

Verification lane (see PLAN.md): `bunx turbo run check test lint type-test
--filter=@beep/box`, `... test:integration ...`, `bun run docgen:local`,
`repo-exports:catalog{,:check}`, `lint:fix`, `audit:github quality`. Tests cover
fake-SDK units, error translation, schema decode (unknown-field + open-enum
tolerance), streaming/finalizers, dtslint, and read-only env-gated live smokes.

Commit `feat: add box driver`. Open a draft PR only after local quality is green.
After each follow-up commit, comment `@greptileai`, wait, report the score, and
continue until Greptile is `5/5`. Mark ready only after CI is green, comments
resolved, and Greptile `5/5`.

Stop only for packet stop conditions: unmodelable SDK shapes, unexpected
live-test cost/side effects, docgen-at-scale needing a human exclusion decision,
unrelated unreproducible CI failure, or unobservable Greptile.
