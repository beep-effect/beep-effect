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
| 2026-09-12 | P1 publish | First `yeet publish` full proof | `quality:changeset-status` red: `apps/todox` and `apps/oip-web` tsconfig profiles gained plugin keys and count as product-workspace changes needing a changeset line | Add every workspace whose `tsconfig*.json` restates the plugin block to the changeset up front |
| 2026-09-12 | P1 publish | Same proof, `fallow:health --check` | Health scopes to changed files, so touching `Quality.command.ts` surfaced the untouched `collectFiles.visit` (cognitive 11 > 8) as a blocking not-applicable finding with no baseline row and no refresh flag; fixed by extracting its per-entry step | A `fallow health` baseline writer, or attribute not-applicable findings as advisory locally as hosted already does |
| 2026-09-12 | P2 discovery | Codex lane D5 (read-only card author) | The Yeet inbox P0 hook fired inside the lane (`Fix this now ... yeet inbox ack`), and the lane acked `full:00-cheap-gates` with `--wontfix` for a failure it did not own; orchestrator re-acked with the fix sha | Scope the inbox hook nag to sessions that own the checkout, or tell lanes explicitly to ignore inbox prompts |
