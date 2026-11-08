# Compute-Profile Gate Routing

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

On 2026-11-07 dankserver showed `Offline` in T3 Code while the host was up: the repo's lefthook
pre-commit schema-catalog writer held a 4 GB heap inside the worker's 7 GiB cgroup, the slice
thrashed its loop-mounted home image, and `t3 serve` sat in disk wait. Agents on worker-class
hosts should never run compute-heavy gates or hooks locally; they should edit, push, and let
hosted CI be the proof. The repo's tooling, skills and docs need to make that the default rather
than an agent's judgment call.

## Next Open Question

None. Graduated into [`goals/compute-profile-gate-routing`](../../goals/compute-profile-gate-routing/README.md) and [`goals/catalog-writer-incremental`](../../goals/catalog-writer-incremental/README.md). Re-entry points stay in MAP.md: remove the worker hook skip once the incremental writer lands; dankserver `t3 serve` own slice (D8) in the dankserver repo.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-11-07: Shape confirmed, decomposed (MAP.md: two goals + three gated re-entries) and graduated via `beep explore graduate` into goals/compute-profile-gate-routing and goals/catalog-writer-incremental; SPECs seeded, six decision files added, sources ledgers carried.
- 2026-11-07: Align closed in two rounds (D1–D9 in DECISIONS.md; D9 answered from the repo). BRIEF.md drafted; advanced to shape.
- 2026-11-07: Research written (RESEARCH.md, research/SOURCES.md): seven RSS measurements of the catalog writer, Bun/Node constrainedMemory() under a cgroup-v2 scope, lefthook skip/run + LEFTHOOK_EXCLUDE, pre-commit SKIP prior art, in-repo inventory incl. ProofEnvProfile. Advanced to align; six frontier questions logged.
- 2026-11-07: packet opened from the dankserver T3 Offline incident; capture written (incident evidence, inverted-admission findings, six-part design sketch, doc and host change list, open questions).
