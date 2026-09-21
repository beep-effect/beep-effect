# @beep/cosmos P1 four-lens digest

Root accepted this package’s source inventory after complete reads, strict row
validation and source/artifact hash checks. Full P1 remains incomplete; P2 is gated.

## Counts


| Lens | Rows | Review items | Coverage | Major | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| resource | 2 | 1 | 1 | 1 | 0 | 1 |
| flake | 2 | 0 | 2 | 0 | 0 | 2 |
| property | 2 | 1 | 1 | 0 | 1 | 1 |
| observability | 2 | 1 | 1 | 0 | 1 | 1 |


Severity: {"major": 1, "minor": 2, "info": 5}. Independent rows: 8. Scanner candidates reviewed separately: 2. No scanner row closes here.

## Files (top ten by row count)

- `packages/drivers/cosmos/test/Cosmos.equivalence.test.ts`: 4 rows; complete read 1–16, 781 census bytes, SHA256 `7058776d977b69fb3d13b53f9d7dacdab476311c8287f859669f4fa6ba4f7694`.
- `packages/drivers/cosmos/test/CosmosProjection.test.ts`: 4 rows; complete read 1–183, 5793 census bytes, SHA256 `79a4ae50015d5fdc7bc14c0848dc58ec4af1e59c221e045c01ee8d1902a5c234`.

## Topology and native boundaries

Projection tests use happy-dom and mocked third-party Graphology/Sigma. Only one case mutates shared mock state and resets it. The handle owns an FPS sampler and renderer kill; cleanup currently follows assertions, while finally only restores globals.

No filesystem. Retain vendor mocks as vendor boundary tests, not pretend Layer.mock replaces a non-Effect module. Do not treat happy-dom projection proof as real GPU execution.

L-RES-02 addresses failure-path release beyond EV011 import syntax. L-PROP-02 adds complete projection determinism coverage without deleting existing first-link/count assertions. No suite-order failure is observed; failed cleanup is a concrete risk, not a reproduced flake.

## Findings and preservation

File-specific coverage-only explanations remain in the four lens JSONL files.
Review items include constraints on safe migration, not only defects.

- `L-RES-02` `packages/drivers/cosmos/test/CosmosProjection.test.ts:161-178` (major, renderer-failure-cleanup): handle.destroy() follows all assertions; finally only unstubs globals. Register handle.destroy as a test-scope finalizer immediately after acquisition, retaining explicit destroy calls and global restoration. Do not mock the cleanup assertion away.
- `L-PROP-02` `packages/drivers/cosmos/test/CosmosProjection.test.ts:81-99` (minor, partial-determinism-oracle): Deterministic projection test compares first.links[0] and [1] only. Keep every existing typed-array/count/element assertion; add bounded production-options generated determinism over complete IDs, positions and links with explicit fcRuns.
- `L-OBS-01` `packages/drivers/cosmos/test/CosmosProjection.test.ts:132-181` (minor, missing-stage-context): Renderer acquisition and update use upstream it.effect. Adopt accepted instrumented it after cleanup correction; preserve global stubs and vendor method assertions, with acquisition/update phase context.

## Timing and hosted limits

Retained Node22.22.3/Bun1.4.2/Vitest4.1.11 cohort: accepted-node-command-baseline; 7 registrations; exit 0; whole-command 4.020284717000322 seconds. Source/config context is retained in [timing context](../timings/context/baseline/beep_cosmos.json) and hashed public timing inputs. No rerun or comparison speedup. Hosted history: 0 mapped observations in 0 jobs; categories {}. Across the frozen 527 failed-run history, 21 logs are unavailable and one downloaded cause unresolved. Zero mapped observations is not absence of failures. No source-head comparison or reproduction establishes a current flake; no flakyTest proposal.

## Proposed P2 sequence and uncertainty

Scope → assertions → property → flake → observability. Preserve every original test, operand, polarity, timeout and native subject; properties retain explicit repository floor/seed, no weaker test schema. Resolve scanner candidates alongside the independent constraints above, then collect authorized package/runtime proofs and comparable timing. This audit performs no tests and grants no exceptions. Source-only hazards are not claimed observed failures. P2 remains gated.
