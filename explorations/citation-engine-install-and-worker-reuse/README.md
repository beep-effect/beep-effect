# Citation Engine Install And Worker Reuse

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The bun full-span citation replay hit its 180 second watchdog on hosted CI
(main red episode ep81). The cost is in the production engine: each request
reinstalls the stage tree and tokenizer, re-detaches configuration, and spawns
a child process for every regex evaluation.

## Next Open Question

None. Graduated into
[`goals/citation-engine-install-once`](../../goals/citation-engine-install-once/README.md)
and
[`goals/citation-regex-worker-v3`](../../goals/citation-regex-worker-v3/README.md).
The packet reopens at `decompose` if a gate in [`MAP.md`](./MAP.md) fires: the
one spawn per request exceeding ten percent of a request, or a sibling worker
entering the top three costs.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3).
6. [`research/design-2026-11-12.md`](./research/design-2026-11-12.md) - schemas and service contracts, with its review beside it.
7. [`MAP.md`](./MAP.md) - decomposition (stage 4).

## Trail

- 2026-11-12: graduated; both goal packets scaffolded with SPEC, PLAN, decision
  files and the carried provenance ledger. First slice is A1 in
  `citation-engine-install-once`.
- 2026-11-12: packet opened from the operator's capture; source inventory and
  Effect v4 plus prior-art research; align round settled binding, detach,
  worker lifetime and goal shape; design written and sent to an independent
  review, which found two blockers (request-long lease starvation, single-use
  child stdio); revision 2 resolved them; shape review settled the native lane
  and confirmed the seven-slice plan; map written.
