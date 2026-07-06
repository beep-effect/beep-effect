# Quality Gate Ratchets — Sources & Provenance

- **Cluster / origin:** REPO_RATING path-to-10 program + agent-pipeline-velocity successor planning (grill-with-docs, 2026-07-06).
- **Provenance:** approved plan `~/.claude/plans/ok-so-i-only-starry-planet.md` (session-local); grill decisions mirrored in `SPEC.md`.

## 1. Mined source corpus

Not applicable — no upstream code corpus; this packet extends in-repo machinery.

## 2. Upstream repositories & licenses

None (no vendoring; all work extends repo-owned tooling).

## 3. External research sources

- `explorations/agent-pipeline-velocity/research/deep-research-report.json` — machine-enforcement-over-prose findings (hooks/linters/CI as the reliable compliance channel) that motivate blocking ratchets.
- `REPO_RATING.md` (repo root, 2026-07-05) — per-dimension path-to-10 items this packet executes: §2 coverage theater, §8 knip unwired, §1 boundary consistency-only enforcement, §5/§10 jsdoc backlog ratchet, §11/§6 commitlint + protection.

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| #294 per-owner ratchet machinery | landed in PR #294 (`feat(lint): P0 crispening enforcement — novel cards, per-owner ratchet`) | **reuse** for A4; pattern for A1/A2 baselines |
| Coverage thresholds + zeroing | `vitest.shared.ts:13-35`; root `package.json` coverage script | extend/replace zeroing |
| Quality lanes | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` | extend (knip step, coverage compare, jsdoc ratchet) |
| Dead-code baseline convention | `standards/fallow.dead-code.regression-baseline.jsonc` | pattern for knip/coverage baselines |
| Boundary provenance | `standards/fallow.boundaries.provenance.jsonc` (+ `.schema.json`, generator) — 70/70 manifest-derived as of 2026-07-06 | extend with doctrine-pinned sourceClass |
| Yeet prepare steps | `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` | remove boundaries-write from prepare |
| CI lanes | `.github/workflows/check.yml` verify matrix | extend (coverage, knip, commitlint) |
| Ruleset husk | GitHub ruleset id 10240248 (deletion/non-FF only, empty include) | update in place (A5) |
| State recon (2026-07-06) | scratchpad `ground-gates.md` (codex agent; verdicts PARTIAL/UNCHANGED per lane) | primary grounding; key figures mirrored in SPEC |

## 5. Cross-links & provenance

- Predecessor: `goals/agent-pipeline-velocity/` (completed-retained, PR #295).
- Sibling-successor: `explorations/skillopt-training-pilot` → `goals/skillopt-training-pilot` (starts after this closes).
- Conventions: `goals/repo-quality-throughput/` (measured-delta reporting; proof-parity-map.md).
