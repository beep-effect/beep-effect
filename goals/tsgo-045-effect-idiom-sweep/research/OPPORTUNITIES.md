# Friction ledger — tsgo 0.45 Effect idiom sweep

Record friction the moment it happens: what you were doing, the evidence
(command, minimal error text, PR or file), and what would have prevented it.
Public-safe paths only.

| Date | Lane | Doing | Evidence | Prevention |
| --- | --- | --- | --- | --- |
| 2026-09-12 | P0 grill | Reading the tsgo plugin config | `tsconfig.base.json` sets 7 of ~20 keys the 0.45 plugin reads; nothing reports unset keys | Key-set parity in `tsgo-rules` (D3) |
| 2026-09-12 | P0 grill | Locating the tsgo changelog | `_packages/tsgo-darwin-arm64/CHANGELOG.md` has only headers; the real notes are in `_packages/tsgo/CHANGELOG.md` | Cite the main package changelog in cards |
| 2026-09-12 | P0 grill | `beep goals bootstrap` | `--plan` compiles seeds but "no writer exists"; the manifest entry has a digest and no payload | A `--write` mode, or document the hand-materialization step |
| 2026-09-12 | P1 | Deleting the `$I.annoteError` hook (D4) | `rg declaredFieldsEquivalence` found a second copy of the same hook in `packages/ecosystem/effect-drizzle/src/core/` (11 sites) plus local copies in `apps/professional-desktop/scripts/` (3) and `packages/_internal/db-admin/scripts/` (2); the grounding census counted only `$I` call sites | Census the ritual by shape (`toEquivalence:` inside class annotations), not by helper name |
| 2026-09-12 | P1 | Widening the directive gate to repo-root `*.ts` | `vitest.shared.ts` keeps two `nodeBuiltinImport:off` lines because its include list is computed with sync `node:fs` before vitest boots; an Effect-native rewrite needs a generated file (like `vitest.aliases.generated.json`), not a one-line fix, so root scanning waits for the S01 PR | Treat config-time scripts as a design item in the shard note, not a directive count |
