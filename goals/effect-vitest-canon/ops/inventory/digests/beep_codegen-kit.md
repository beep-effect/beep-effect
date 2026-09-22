# @beep/codegen-kit P1 four-lens digest

Root accepted this package’s source inventory after complete reads, strict row
validation and source/artifact hash checks. Full P1 remains incomplete; P2 is gated.

## Counts


| Lens | Rows | Review items | Coverage | Major | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| resource | 1 | 1 | 0 | 0 | 0 | 1 |
| flake | 1 | 0 | 1 | 0 | 0 | 1 |
| property | 1 | 0 | 1 | 0 | 0 | 1 |
| observability | 1 | 1 | 0 | 0 | 1 | 0 |


Severity: {"info": 3, "minor": 1}. Independent rows: 4. Scanner candidates reviewed separately: 12. No scanner row closes here.

## Files (top ten by row count)

- `packages/tooling/library/codegen-kit/test/CodegenKit.test.ts`: 4 rows; complete read 1–640, 23798 census bytes, SHA256 `0dcf293bdee39624f8d682b9388d0fe7982741e2661ce2b17c796a1a65a55f56`.

## Topology and native boundaries

Two named layer blocks build CodegenKit once each; platform Layer identity is reused inside each memo map. Eight temp-directory callback uses acquire/remove independently. Formatting and unified diff spawn real processes per operation; sharing the service does not eliminate that cost. No measured speedup is claimed.

MemoryFS alone is not faithful for the real Biome file and diff integration: formatter passes actual paths to child processes (format.ts:21-52,91-124). Keep those native subjects. Pure generation or stdin-format paths can be examined separately only with an approved boundary-specific design.

EV003 already identifies wrapper sites. L-RES-04 adds the imported native formatter evidence rather than duplicating syntax. EV014 is a hook-timeout candidate; acquisition reads services, so inspect true hook work before prescribing a container timeout. Warning/diff TestConsole messages are assertion subjects and must survive instrumentation.

## Findings and preservation

File-specific coverage-only explanations remain in the four lens JSONL files.
Review items include constraints on safe migration, not only defects.

- `L-RES-04` `packages/tooling/library/codegen-kit/test/CodegenKit.test.ts:183-190` (info, native-formatter-boundary): Temp files feed real Biome and diff child processes through CodegenKit formatter. Retain native FS for formatter/diff integration; inspect pure generation subcases separately. Replace wrapper with scoped directory without losing cache atomicity assertions.
- `L-OBS-01` `packages/tooling/library/codegen-kit/test/CodegenKit.test.ts:530-556` (minor, missing-stage-context): generate warning and formatter subprocess stages use upstream layer tester. After scope migration adopt accepted instrumented layer API, retaining TestConsole warning/diff assertions and user logger behavior; add nonsecret stage labels around formatter waits.

## Timing and hosted limits

Retained Node22.22.3/Bun1.4.2/Vitest4.1.11 cohort: accepted-node-command-baseline; 17 registrations; exit 0; whole-command 4.522130624000056 seconds. Source/config context is retained in [timing context](../timings/context/baseline/beep_codegen-kit.json) and hashed public timing inputs. No rerun or comparison speedup. Hosted history: 1 mapped observations in 1 jobs; categories {"coverage-ratchet": 1}. The one coverage-ratchet observation is not a test failure or unique flake. [dated coverage job](https://github.com/beep-effect/beep-effect/actions/runs/34438997453/job/102749878919). Across the frozen 527 failed-run history, 21 logs are unavailable and one downloaded cause unresolved. Zero mapped observations is not absence of failures. No source-head comparison or reproduction establishes a current flake; no flakyTest proposal.

## Proposed P2 sequence and uncertainty

Scope → assertions → property → flake → observability. Preserve every original test, operand, polarity, timeout and native subject; properties retain explicit repository floor/seed, no weaker test schema. Resolve scanner candidates alongside the independent constraints above, then collect authorized package/runtime proofs and comparable timing. This audit performs no tests and grants no exceptions. Source-only hazards are not claimed observed failures. P2 remains gated.
