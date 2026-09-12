# Effect Schema Parity — Sources & Provenance

- **Cluster / origin:** research stage 2026-09-12: six Codex lanes over `.repos/effect` main `51d4a2f08a` plus verified upstream URLs.
- **Provenance:** `RESEARCH.md` (map), lane reports under `research/` (evidence), `CAPTURE.md` (brief + hint list), `DECISIONS.md` (pre-research grill).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `inv-role-a` | Role A schema surfaces (14 `.ts` modules) | Effect-TS/effect | `packages/effect/src/Schema*.ts`, `JsonSchema.ts`, `StandardSchema.ts`, `unstable/schema/*`, `unstable/arbitrary/*` (rows carry `file:line`) | adoption targets | reference (consume upstream; never vendored) |
| `role-b` | Role B idiom exemplars (39 modules) | Effect-TS/effect | see `CAPTURE.md` module list; `research/idiom-role-b.json` | idiom rubric | reference |
| `hint-28` | rc.112..main schema commits | Effect-TS/effect | `research/upstream-delta.md` per-commit `path:line` | delta | reference |
| `docs` | `packages/effect/SCHEMA.md`, `migration/schema.md` | Effect-TS/effect | repo root / `packages/effect/` | doctrine | reference |
| `perf` | `packages/effect/typeperf/suites/schema/fixtures` (22), `runtimeperf/suites/schema` | Effect-TS/effect | see `research/performance-baseline.md` | measurement | port-with-attribution (harness shape only) |

**How these inform this packet:** Role A rows are the adoption/retirement oracle; Role B shows how upstream authors consume Schema (rubric only, not targets unless align lifts the exclusion); the hint list bounds the rc window; perf suites give the measurement shape.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Effect-TS/effect (`main` @ `51d4a2f08a`, local `.repos/effect` -> `$HOME/YeeBois/dev/effect`, remotes `origin` = Effect-TS/effect, `fork` = beep-effect/effect) | MIT (`LICENSE`, Effectful Technologies Inc) | port-with-attribution allowed; this packet's direction is the reverse (delete repo code, consume upstream), so nothing is vendored | Schema surfaces (Role A) as adoption targets; Role B modules as idiom exemplars; `SCHEMA.md` + `migration/schema.md` as doctrine; rc.112..main commits as the hint list |

## 3. External research sources

Verified by fetch on 2026-09-12 (each appears in `RESEARCH.md` "External Landscape"):

- Effect Schema v4 reference, raw: https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/effect/SCHEMA.md (rendered view https://github.com/Effect-TS/effect/blob/main/packages/effect/SCHEMA.md failed to render server-side on 2026-09-12; the file is 7,223 lines / 216 KB)
- Schema v3 -> v4 migration guide: https://github.com/Effect-TS/effect/blob/main/migration/schema.md
- Commit "Optimize Schema initialization (#8196)": https://github.com/Effect-TS/effect/commit/657254b821
- Commit "Move unstable HTTP schemas to Schema (#7553)": https://github.com/Effect-TS/effect/commit/46d83101e8
- Effect blog, "Effect v4 Beta: June Updates" (2026-06-30): https://effect.website/blog/effect-v4beta-june-recap/

Dead or superseded (do not cite): https://effect-ts-effect-smol.mintlify.app/migration/schema (404 on 2026-09-12); `Effect-TS/effect-smol` GitHub paths surfaced by web search are the pre-rename home of the same documents and were not fetched.

Local-only sources (no URL; cite the on-disk path): the graft index built at `$HOME/YeeBois/dev/effect/graft/` (structural, `graft build -e .ts`, 1,571 files, 30 s, 117 MB, 2026-09-12); the rc.112..main hint list in `CAPTURE.md` (from `git -C .repos/effect log`).

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| Schema-first lint (detectors/policy/project/scan/store/arbitrary coverage) | `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirst*.ts` | extend (new `UpstreamParity*` family) |
| Effect-vitest lint + sha-pinned fixture pattern | `.../Lint/internal/EffectVitest*.ts`, `packages/tooling/tool/cli/test/fixtures/effect-vitest-rc115/`, `standards/effect-vitest.primitives.jsonc` | reuse pattern |
| Lint schemas (rule domain, finding, inventory, identity key) | `.../Lint/Lint.schemas.ts` | extend |
| Shared ratchet | `packages/tooling/tool/cli/src/internal/ratchet/RatchetDiff.ts`, `RatchetLifecycle.ts` | reuse |
| Hosted lint-policy route | `.github/workflows/heavy.yml`, `.../commands/Ci/CiLane.ts`, `.../commands/Quality/Tasks.ts`, `.../Quality/internal/GithubChecks.ts` | reuse |
| Effect reference provisioning | `scripts/setup-effect-ref.sh`, `.repos/effect` symlink | reuse |
| `beep graft` command (cache sync / deep) | `packages/tooling/tool/cli/src/commands/Graft/Graft.command.ts` | reuse as-is; effect index is plain `graft build <dir>` |
| `@beep/schema` concept modules (137) | `packages/foundation/modeling/schema/src` | retire 52 / adapt 2 / keep 77 / unsure 6 (proposed) |
| Deterministic upstream symbol extractor | proposed `scripts/upstream-parity-inventory.ts` (prototype: `research/tools/schema-inventory.ts`) | NET-NEW |
| Parity policy edges, independent baseline, prompt templating | proposed | NET-NEW |
| Doctrine entry + README policy | `standards/architecture/DECISIONS.md`, `packages/foundation/modeling/schema/README.md` | proposed text in `research/gate-and-knowledge-plumbing.md` §(g) |

## 5. Cross-links & provenance

- Packet: `README.md`, `CAPTURE.md`, `DECISIONS.md`, `RESEARCH.md`, this ledger.
- Lane reports: `research/retirement-A-F.md`, `research/retirement-G-Z.md`, `research/idiom-families.md`, `research/upstream-delta.md`, `research/upstream-verification-supplement.md`, `research/performance-baseline.md`, `research/performance-verification-supplement.md`, `research/gate-and-knowledge-plumbing.md`, `research/inventory/`, `research/tools/`.
- Adjacent packets: `goals/schema-utils-selective-codec-statics` (active; overlaps the SchemaUtils ADAPT), `goals/schema-first-v4-capabilities`, `goals/beep-schema-topology`, `goals/effect-vitest-canon` (fixture pin procedure), `explorations/effect-jsdoc-quality`.
- Doctrine: `standards/architecture/11-evolution-and-deprecation.md`, `standards/architecture/DECISIONS.md` (2026-07-08 PGlite precedent), `standards/architecture/07-non-slice-families.md`.
