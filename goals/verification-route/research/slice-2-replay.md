# Slice-2 replay (2026-11-07)

Recall evidence for the first enforced refinement, `packet-markdown-out-of-build-check`
(`ROUTE_REFINEMENTS` in `commands/Ci/RouteFootprints.ts`): `bun run beep ci route replay --json`
over the slice-1 corpus, run from lane `verification-route-s2` at commit `dfdef2a14c2`.

| Measure | Baseline (slice-1 record) | Refined record |
| --- | ---: | ---: |
| Corpus sha256 | `e840ea6d2eaf…` | `e840ea6d2eaf…` |
| Footprint digest | `68ca6e2400dd…` | `0eaf7bf1aac7…` |
| Heads | 5,083 | 5,083 |
| Skipped lane runs | 0 | 242 (`build` 121, `check` 121) |
| Skipped reds | 0 | 0 |
| Base unknown / unresolved heads | 0 / 0 | 0 / 0 |
| Recall | 100% | **100%** |

121 heads (2.4%) skip both `build` and `check`: their tree changes are packet markdown only, and the
commits atom no longer selects the two lanes. No skipped run was red while its lane was green on
main's base run, so the refinement is admitted at `enforced`.

Mutation fixtures (production `classifyChangedPaths` → `routeLaneDecision` path):
`packages/tooling/tool/cli/test/ci-route-refinements.test.ts`, one per name in the refinement's
`fixtures`. Layer-1 dry-run: `slice-2-layer1-dryrun.md`.

Each replay took about 15 minutes of wall time on the workstation (5,083 classifications).
