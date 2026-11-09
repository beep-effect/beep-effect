# Incremental Catalog Writer — Sources & Provenance

- **Source exploration:** `explorations/compute-profile-gate-routing` — primary ledger:
  [explorations/compute-profile-gate-routing/research/SOURCES.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/explorations/compute-profile-gate-routing/research/SOURCES.md).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|

## 3. External research sources

## 4. In-repo capability references

## 5. Cross-links & provenance

## Carried from the exploration ledger (2026-11-07)

## External citations

| Id | Source | URL | Used for | License / disposition |
| --- | --- | --- | --- | --- |
| E1 | lefthook docs — `skip` conditions | https://lefthook.dev/configuration/skip/ | `skip: - run:` per-command syntax, exit 0 ⇒ skip | docs; reference only |
| E2 | lefthook docs — `LEFTHOOK_EXCLUDE` | https://lefthook.dev/usage/envs/LEFTHOOK_EXCLUDE | env exclude of commands by name/tag | docs; reference only (page 404'd on `.html`, search summary used) |
| E3 | lefthook docs — `exclude_tags` | https://lefthook.dev/configuration/exclude_tags/ | `lefthook-local.yml` override path | docs; reference only |
| E4 | Node.js `process.constrainedMemory` (nodejs.cn mirror) | https://nodejs.cn/api/process/process_constrainedmemory.html | semantics, 0 when unknown | docs; reference only |
| E5 | nodejs/node#27508 | https://github.com/nodejs/node/pull/27508/commits | origin in libuv `uv_get_constrained_memory` | MIT (Node); reference only |
| E6 | @crawlee/utils memory-info.js | https://app.unpkg.com/@crawlee/utils@3.16.0/files/internals/systemInfoV2/memory-info.js | manual cgroup v1/v2 fallback pattern | Apache-2.0 (crawlee); reference only |
| E7 | adamj.eu — Git: how to skip hooks | https://adamj.eu/tech/2023/02/13/git-skip-hooks/ | pre-commit `SKIP` env convention | blog; reference only |
| E8 | adamj.eu — pre-commit: various ways to run hooks | https://adamj.eu/tech/2022/10/20/pre-commit-various-ways-to-run-hooks/ | same | blog; reference only |
| E9 | binutils-gdb `.pre-commit-config.yaml` | https://gnu.googlesource.com/binutils-gdb/+/b5e40fa57215854e567f5eb8895e893e47a06c8e/.pre-commit-config.yaml | permanent `SKIP` in developer env | GPL project config; reference only |

## Measurements (on disk)

| Id | What | Where |
| --- | --- | --- |
| M1 | schema-catalog RSS/wall table (7 variants) | `RESEARCH.md` § Measurements, 2026-11-07 |
| M2 | Bun/Node `constrainedMemory()` under a cgroup-v2 user scope | `RESEARCH.md` § External landscape |
| M3 | dankserver incident readings (pressure, cgroup, RSS) | `CAPTURE.md` § Trigger incident |

## In-repo bricks

| Id | Brick | Path |
| --- | --- | --- |
| B1 | Admission scheduler + `MemoryStats` + `AdmissionConfig` | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts`, `QualityScheduler.schemas.ts` |
| B2 | `ProofEnvProfile`, `ProofStage` LiteralKits | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts` |
| B3 | Heavy admission (`ready-for-heavy`) | `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts` |
| B4 | Scoped catalog writer + shard scope | `packages/tooling/tool/cli/src/commands/Lint/SchemaCatalog.ts`, `@beep/repo-cli-kit/cli/ShardScope` |
| B5 | Gate table, skips, `yeet open` | `.claude/skills/yeet/references/gates-and-proof.md`, AGENTS.md Quality Operator |
| B6 | Pre-commit writers | `lefthook.yml` |
| B7 | Host-pressure parcel | `packages/tooling/tool/cli/src/commands/Palantiri/Palantiri.service.ts` |
| B8 | Worker provisioning (out of repo) | dankserver repo `ansible/roles/development_worker` |

## Cross-links

- Memory notes: `dankserver-t3-offline-worker-slice-thrash`, `dankserver-ops-gotchas`,
  `feedback-constrained-compute-push-to-hosted-ci-2026-10-24`, `goal-closeout-ready-push-moves-verdict-head`.
