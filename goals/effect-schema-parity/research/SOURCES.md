# Effect Schema Parity — Sources & Provenance

<!--
Carried from the source exploration at graduate (2026-09-15). The exploration's
ledger is the primary copy; this file reproduces the corpus for implementation
and updates the in-repo capability table to the graduated MAP dispositions.
Never fabricate a URL; cite the on-disk section when none exists.
-->

- **Source exploration:** `explorations/effect-schema-parity` — primary ledger:
  `explorations/effect-schema-parity/research/SOURCES.md`.
- **Provenance:** `explorations/effect-schema-parity/RESEARCH.md` (map), lane
  reports under `explorations/effect-schema-parity/research/` (evidence),
  `CAPTURE.md` (brief + hint list), `DECISIONS.md` (25 rulings), `BRIEF.md`
  (shape), `MAP.md` (decomposition).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `inv-role-a` | Role A schema surfaces (14 `.ts` modules) | Effect-TS/effect | `packages/effect/src/Schema*.ts`, `JsonSchema.ts`, `StandardSchema.ts`, `unstable/schema/*`, `unstable/arbitrary/*` (rows carry `file:line`) | adoption targets | reference (consume upstream; never vendored) |
| `role-b` | Role B idiom exemplars (39 modules) | Effect-TS/effect | `explorations/effect-schema-parity/CAPTURE.md` module list; `research/idiom-role-b.json` | idiom rubric; six may replace local concepts (group G) | reference |
| `hint-28` | rc.112..main schema commits | Effect-TS/effect | `explorations/effect-schema-parity/research/upstream-delta.md` per-commit `path:line` | delta | reference |
| `docs` | `packages/effect/SCHEMA.md`, `migration/schema.md` | Effect-TS/effect | repo root / `packages/effect/` | doctrine | reference |
| `perf` | `packages/effect/typeperf/suites/schema`, `runtimeperf/suites/schema` | Effect-TS/effect | `explorations/effect-schema-parity/research/performance-baseline.md` | measurement | port-with-attribution (harness shape only, P5) |
| `inventory` | `schema-inventory/v1` rows, 2,105 over 14 modules | this repo (prototype) | `explorations/effect-schema-parity/research/inventory/*.jsonl`, contract in `inventory/README.md` | knowledge layer | MOVE to `packages/tooling/tool/cli/test/fixtures/effect-schema-rc115/` (P1) |
| `tools` | inventory generator and verifier | this repo (prototype) | `explorations/effect-schema-parity/research/tools/schema-inventory.ts`, `verify-schema-inventory.ts` | knowledge layer | MOVE into repo-cli (P1) |

**How these inform implementation:** Role A rows are the adoption oracle for
every retirement and the source of lane prompts; Role B modules are targets
only for the six group-G concepts; the hint list bounds the rc window; the
perf suites give the P5 measurement shape; the prototype inventory and tools
become the P1 fixture and command.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Effect-TS/effect (`main` @ `51d4a2f08a`, local `.repos/effect` -> `$HOME/YeeBois/dev/effect`) | MIT (`LICENSE`, Effectful Technologies Inc) | port-with-attribution allowed; direction is reverse (delete repo code, consume upstream), so nothing is vendored except the typeperf harness shape | Schema surfaces (Role A) as adoption targets; six Role B modules as group-G targets; `SCHEMA.md` and `migration/schema.md` as doctrine; rc.112..main commits as the hint list |

## 3. External research sources

Verified by fetch on 2026-09-12 (each appears in the exploration's
`RESEARCH.md` "External Landscape"):

- Effect Schema v4 reference, raw: https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/effect/SCHEMA.md
- Schema v3 -> v4 migration guide: https://github.com/Effect-TS/effect/blob/main/migration/schema.md
- Commit "Optimize Schema initialization (#8196)": https://github.com/Effect-TS/effect/commit/657254b821
- Commit "Move unstable HTTP schemas to Schema (#7553)": https://github.com/Effect-TS/effect/commit/46d83101e8
- Effect blog, "Effect v4 Beta: June Updates" (2026-06-30): https://effect.website/blog/effect-v4beta-june-recap/
- Effect v4 API reference: https://effect.website/docs/v4/api/effect

Dead or superseded (do not cite): https://effect-ts-effect-smol.mintlify.app/migration/schema (404 on 2026-09-12).

Local-only (cite the path): the graft index at `$HOME/YeeBois/dev/effect/graft/`; the hint list in `explorations/effect-schema-parity/CAPTURE.md`.

## 4. In-repo capability references

Dispositions as graduated in `explorations/effect-schema-parity/MAP.md`
(verified against the worktree on 2026-09-15).

| Brick | Path | Disposition |
|-------|------|-------------|
| Schema-first lint (detectors, policy, project, scan, store, render) | `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirst*.ts`, `commands/Lint/SchemaFirst.render.ts` | extend (`SFV4-*` rules for F03, F13, F24; delete F26 rule) |
| Lint schemas (rule domain `:104`, line-keyed key `:582`, effect-vitest line-free identity `:1292`) | `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts` | extend |
| Effect-vitest lint, store, pin check, fixture layout | `commands/Lint/internal/EffectVitest*.ts`, `test/fixtures/effect-vitest-rc115/` | reuse pattern (P1); extend `verifyEffectVitestPin` to sha + digest |
| Shared ratchet | `packages/tooling/tool/cli/src/internal/ratchet/RatchetDiff.ts:71`, `RatchetLifecycle.ts:67` | reuse |
| Artifact IO adapters | `packages/tooling/tool/cli/src/internal/artifacts/index.ts` | reuse |
| ts-morph project and rewrite pipeline | `commands/Lint/internal/SchemaFirstProject.ts:42`, `commands/Quality/internal/JSDocMigrateApply.ts:578`, `ts-morph` dependency | reuse (codemod engine); rewrite rules NET-NEW |
| Type-check census | `commands/Quality/CheckCensus.ts` (`:330`, `:672`, `:851`) | extend (instantiations, check time, committed baseline) |
| Knowledge-refs gate | `commands/Knowledge/Knowledge.refs.ts` | reuse (home-relative fixture paths) |
| Effect reference provisioning | `scripts/setup-effect-ref.sh`, `.repos/effect` symlink | reuse (local `--check` input; must fail loud) |
| Deprecation doctrine, PGlite precedent | `standards/architecture/11-evolution-and-deprecation.md`, `standards/architecture/DECISIONS.md:580` | extend (P0 entry) |
| `@beep/schema` concept modules (137) | `packages/foundation/modeling/schema/src` | retire 50 / Role B retire 6 / adapt 4 (LiteralKit, MappedLiteralKit, SchemaUtils, Float) / keep 77 |
| LiteralKit, MappedLiteralKit | `.../schema/src/LiteralKit/LiteralKit.schema.ts`, `.../MappedLiteralKit/MappedLiteralKit.schema.ts` | ADAPT: trim four facets, drop `enumMapping`, override `rebuild` (P2) |
| SchemaUtils | `.../schema/src/SchemaUtils/withCodecStatics.ts:420`, `collectAnnotationsAt.ts:149` | ADAPT after `goals/schema-utils-selective-codec-statics` merges (P5) |
| Tracked generated baselines | `standards/schema-first.inventory.jsonc`, `standards/schema-catalog.generated.jsonc`, `standards/coverage.regression-baseline.jsonc`, `standards/jsdoc-documentation.inventory.md` | regenerate per PR |
| Inventory generator command and fixture | proposed under `commands/Lint/`, `test/fixtures/effect-schema-rc115/` | NET-NEW command from the prototype (P1) |
| Boundary table, facet census gate, lane prompt templates | `SPEC.md`, `ops/prompts/` | NET-NEW (procedure and prose) |

## 5. Cross-links & provenance

- Source exploration packet: `README.md`, `CAPTURE.md`, `DECISIONS.md`,
  `RESEARCH.md`, `BRIEF.md`, `MAP.md`, `research/SOURCES.md` (primary ledger).
- Lane reports: `explorations/effect-schema-parity/research/retirement-A-F.md`,
  `retirement-G-Z.md`, `idiom-families.md`, `upstream-delta.md`,
  `upstream-verification-supplement.md`, `performance-baseline.md`,
  `performance-verification-supplement.md`, `gate-and-knowledge-plumbing.md`,
  `inventory/`, `tools/`.
- Adjacent goals: `goals/schema-utils-selective-codec-statics` (active; P5
  precondition), `goals/schema-first-v4-capabilities` and
  `goals/schema-first-zero-actionables` (gate-then-zero precedent),
  `goals/beep-schema-topology` (concept module layout), `goals/effect-vitest-canon`
  (fixture pin procedure).
- Doctrine: `standards/architecture/11-evolution-and-deprecation.md`,
  `standards/architecture/DECISIONS.md` (2026-07-08 PGlite precedent),
  `standards/architecture/07-non-slice-families.md`.
- Decision log: `SPEC.md` §Decision Log back-links every ruling by heading with a binds, historical or superseded disposition, and appends goal-time rulings.
