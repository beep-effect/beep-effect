# Lockfiles round-3 inventory

Seats read: `grok.md`, `sol.md`, `fable.md` (all three reports; no part directories).
Briefs read: `BRIEF.md` and the third-seat `BRIEF.grok3.md`. The Fable report is the independent Grok medium fallback seat named in its route header.

Counts: required 1; backlog 0; deviation codemod 0; rejected 0; groups 1.
Sol and Fable contribute two records for one defect; Grok reports no findings.

Reviewed commit: `3ad7b305790c7f0903f6d55766c55186745ba2d1`. The current checkout is `@lab/effected-2`, rather than the requested `@lab/effected`; live `internal/yarn.ts` matches the reviewed commit byte-for-byte. The operator revision block, D1-D20, sections 12.4-12.5 and 14, the round-2 inventory, and the pinned oracle were read. No tests, compiler probes or audit gates were run for this merge. Seat-reported green gates and probe results are identified as reported evidence below.

The parsed `standards/effect-laws.allowlist.jsonc` has zero entries for `scratchpad/effected/lockfiles/**`, so there are no `allow-<n>` findings. File history and the `63645ee483` S3 diff were read, together with the initial port/law implementation in `7929b1f529`. The dangling-edge behavior already exists in the pinned upstream oracle; this inventory alleges no unforced lab divergence and assigns no upstream-shape restore. Round-2 dangling-edge fixes cover npm, pnpm and bun, not Yarn.

`g1` owns one source file and one regression test file. Its write assignments are within the module's allowed directories. Ledger and README Port-notes bookkeeping stays central.

## Required

### sol-3-1 — Resolve Yarn edges only to emitted package instances

- file: scratchpad/effected/lockfiles/internal/yarn.ts:108-114,127-137,150,209-213
- class: bug
- severity: required
- standard: D11; D9 and section 14's verified upstream-bug exception; `ResolvedPackage.ts:53-72,118-125` requires resolved targets to identify real normalized instances and recorded-but-unnameable edges to appear in `unresolvedEdges`.
- evidence: Sol reports a read-only probe against both the reviewed port and the pinned oracle using Yarn metadata version 8, `consumer@npm:1` with version `1` and dependency `ghost: npm:1`, and the compound key `, ghost@npm:1` with version `1` and resolution `ghost@npm:1`. Both returned only the consumer, `resolved: { ghost: "ghost@npm:1" }`, `unresolvedEdges: []`, and `None` from `packageByInstanceId("ghost@npm:1")`. Fable independently traces `ghost@not-a-protocol: {}` and a `real@npm:1.0.0` dependency `ghost: not-a-protocol` to the same failure. Source inspection confirms that the descriptor index accepts these rows before package emission rejects an unextractable first-descriptor name, and `resolveYarnEdges` checks only descriptor presence. Pinned oracle `src/internal/yarn.ts:86-92,104-115,185-189` has the same defect. Existing `scratchpad/test/lockfiles/internal/yarn.coverage.test.ts:8-22` tests skipped rows without dependents, while lines 24-37 test descriptors never indexed; neither checks an indexed target whose row is skipped. This specific missing invariant explains how the reported green gates missed the bug.
- failure: Parsing succeeds with an apparently resolved dependency whose package cannot be retrieved, and omits the unresolved-edge signal. Traversing the normalized graph therefore follows a nonexistent instance.
- fix: Precompute an Effect HashSet of the nonempty instance ids that package emission will produce, using the same extractYarnPackageName and resolution-or-first-descriptor checks as the emission pass. Pass that membership to resolveYarnEdges and emit a resolved edge only when the indexed locator belongs to it; otherwise record the dependency name through the existing sorted unresolvedEdges path. Preserve the full descriptor index and its overwrite precedence, including descriptors from skipped rows whose locator identifies another emitted row. Add both seats' dangling-target counterexamples and a skipped-row alias to an emitted locator to scratchpad/test/lockfiles/internal/yarn.coverage.test.ts. Assert empty resolved plus unresolvedEdges ["ghost"] for dangling cases, retain resolution for the valid alias, and verify every emitted resolved value is found by packageByInstanceId. Use the existing Lockfile API without changing its source. Supply upstream-bug evidence for central D9 bookkeeping; do not edit the shared ledger or README Port notes.
- seats: sol-3-1, fable-3-1

The merged fix uses Fable's target-membership check. Sol's proposal to index only emitted rows would also discard descriptors from skipped rows whose locator names an emitted instance. Keeping those aliases preserves upstream resolution behavior while removing only dangling targets. Both original records remain contributors to this one required finding.

## Backlog

None. No round-3 seat reports a separate docs, JSDoc, coverage, vitest-canon, out-of-scope or other non-required finding. Prior-round backlog is not re-counted here.

## Handled by the deviation codemod

None. No round-3 record solely asks to record a law-forced change. Central D9 bookkeeping for the required upstream-bug fix is follow-through, not a second finding or a worker-owned ledger/Port-notes edit.

## Rejected

None. Both reported records supply concrete evidence and a fix for the same admissible bug. Deduplication does not count a contributing seat record as rejected; Grok's no-findings report adds no record.
