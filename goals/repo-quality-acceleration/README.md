# Repo Quality Acceleration

## Status

Lifecycle: `superseded`

Status: `superseded`

Superseded by:
[`goals/repo-quality-throughput`](../repo-quality-throughput)

## Mission

Reduce the wall-clock cost of this repo's quality feedback loops without
weakening the canonical quality proof.

This packet is retained as source evidence. It is no longer the execution
packet for quality performance work because its scope was research-first and
did not include implementation through current-PR proof.

The first priority is GitHub pull request feedback speed. Local canonical
quality commands remain important, but CI and local commands do not need to
share identical orchestration when a tiered gate gives faster PR feedback and a
full push-to-main or scheduled proof still covers the complete quality surface.

This initiative starts from the current repo reality:

- root quality scripts are intentionally compact and route through
  `@beep/repo-cli` or Turbo;
- GitHub Actions already splits major lanes and uses affected Turbo scopes on
  pull requests;
- docgen already has package, affected, changed-files, quality, and worker-eval
  surfaces;
- the export catalog and JSDoc inventory packets provide useful deterministic
  metadata but do not yet define a quality acceleration strategy.

## First Proof

Phase 0 produces read-only evidence:

- recent GitHub Actions run and job timing baseline;
- focused local timing probes for suspected slow lanes;
- five parallel explorer reports;
- a ranked roadmap of candidate interventions with correctness risks.

No quality command behavior changes belong in the first proof.

## Local Docgen Lane

The first implementation slice adds `bun run docgen:local` for local agent and
edit-loop relief. It preserves `bun run docgen` as the canonical full docgen
proof, keeps CI docgen semantics unchanged, and scopes local work to packages
selected from branch plus dirty file changes unless docgen tooling or global
inputs require an explicit `--full` run.

## Reading Order

- [../repo-quality-throughput](../repo-quality-throughput) - active execution
  packet that supersedes this research packet
- [SPEC.md](./SPEC.md) - research contract and quality semantics
- [PLAN.md](./PLAN.md) - current phased plan
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing metadata
- [ops/prompts/parallel-explorer.md](./ops/prompts/parallel-explorer.md) -
  prompt for read-only parallel explorer agents
