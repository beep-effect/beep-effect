# @beep/agents-server P1 four-lens digest

6 complete census files, 24 rows: 1 review proposals and 23 coverage-only NONE rows. All remain open judgments. This is a source-only audit, not remediation.

| Lens | Reviews | NONE | Major | Minor | Info |
|---|---:|---:|---:|---:|---:|
| resource | 0 | 6 | 0 | 0 | 6 |
| flake | 1 | 5 | 1 | 0 | 5 |
| property | 0 | 6 | 0 | 0 | 6 |
| observability | 0 | 6 | 0 | 0 | 6 |

## Findings

### L-FLAKE-05 AnthropicTurnKernel.test.ts:111–125 (major)

beforeEach resets one hoisted providerState and each case mutates it. Shared config sequence.concurrent=true; this named it.layer supplies no concurrent override, and pinned internal.ts342-352 inherits suite options. Another case can replace stream parts/error/repair tokens before their deferred read. Prefer isolated scenario services at the existing seam; if module mock must remain, explicitly serialize this state-owning block with evidence. Preserve every scenario/token/error assertion, no global concurrency change. This is source-proven shared-state exposure, not an observed hosted flake.

Evidence: `beforeEach(() => {   providerState.parts = [];   providerState.providerError = undefined;`

## Layer topology, rebuild costs and native boundaries

The Anthropic kernel has a public layer, but its module mock holds one mutable scenario across tests. The scripted LanguageModel and repair callback do not contact Anthropic. BlockRepair directly accepts a local Effect callback. The ProviderInstance suite builds PGlite/Drizzle, crypto and CuidState once in a serial layer, recreates its table per case, and injects fake CLI runner/home services. Concurrent inserts inside one case intentionally test real DB-generated IDs; preserve that subject and tenant scoping. Path expansion reads host home metadata but no provider process/home mutation is executed. MemoryFS is not a SQL replacement. Retained timing suggests the first DB case dominates this package file duration, but does not isolate acquisition cost.

## Retained timing and hosted limits

The accepted Node command baseline records 24 passed tests, 7.121654669000236 seconds whole command and 6620.78466796875 ms reporter duration. All assigned files appear in the retained report. These timings are not rerun or adjusted for host load. Runtimes: Node22.22.3/Bun1.4.2/Vitest4.1.11; the rc113 Vitest5 peer-range qualification remains. Raw reporter SHA256: `2c2fa6f956767c0a365724d921e706e974e3cb39179924fceaaece291fde1ce3`.

| File | Retained ms | Registered tests |
|---|---:|---:|
| packages/agents/server/test/AnthropicTurnCodec.test.ts | 4.054443359375 | 5 |
| packages/agents/server/test/AnthropicTurnKernel.test.ts | 18.406494140625 | 6 |
| packages/agents/server/test/AssistantTurn.schema-parity.test.ts | 19.683349609375 | 2 |
| packages/agents/server/test/BlockRepair.test.ts | 9.373046875 | 5 |
| packages/agents/server/test/ProviderInstance.integration.test.ts | 1346.78466796875 | 4 |
| packages/agents/server/test/scanChunk.test.ts | 40.91748046875 | 2 |

Hosted summary: 0 observations in 0 jobs; categories {}. These are not unique flakes or evidence of a current-source cause. Detailed cause is not inferred from this aggregate. Production coverage-ratchet observations are not failing test cases. Passing registrations do not prove browser/provider/native integration execution beyond the source-defined test subject.

Globally, all 139 first attempts comprise 132 full-file baselines, 4 configured subsets and 3 failures: CIops, Effect Drizzle and QA Capture. Keep those failed/subset boundaries unchanged. Hosted scope covers 527 failed runs and includes 21 unavailable logs and one unresolved cause. Graph-3d browser file is outside its Node cohort, not executed or reported skipped.

## Top ten files by review count

| File | Review rows |
|---|---:|
| packages/agents/server/test/AnthropicTurnKernel.test.ts | 1 |
| packages/agents/server/test/AnthropicTurnCodec.test.ts | 0 |
| packages/agents/server/test/AssistantTurn.schema-parity.test.ts | 0 |
| packages/agents/server/test/BlockRepair.test.ts | 0 |
| packages/agents/server/test/ProviderInstance.integration.test.ts | 0 |
| packages/agents/server/test/scanChunk.test.ts | 0 |

## Complete per-file coverage

### packages/agents/server/test/AnthropicTurnCodec.test.ts

Kind test; full read 1–71; 2850 bytes; SHA256 `cfdac547fa23564284e4835af96c89311246323d9512fd4518f334d8b4c919e3`.

- **resource:** No additional change required by this lens: Module-level codec construction and pure string decoding do not call a model or acquire a service.
- **flake:** No additional change required by this lens: Fixed JSON literals and synchronous schema checks have no external scheduling.
- **property:** No additional change required by this lens: Valid paragraph/rich block examples accompany malformed Mermaid/table/YouTube rejection and unconstrained non-Mermaid control. Preserve invalid fixtures and exact expected diagnostics. This is provider-expressible schema evidence, not live provider compliance.
- **observability:** No additional change required by this lens: Named build/decoding/constraint cases include specific expected error patterns. Plain decoded values may use expect. EV011 remains registration/import policy work, not evidence of provider activity.

### packages/agents/server/test/AnthropicTurnKernel.test.ts

Kind test; full read 1–255; 9853 bytes; SHA256 `36657f86af849bef18d2defc6fd0f760b08f2e4ce814deec6ba0d76ff173ea94`.

- **resource:** No additional change required by this lens: Public it.layer owns the real kernel; vi.mock supplies a scripted LanguageModel and repair function. No real Anthropic API is invoked. EV012 needs precise service/function provenance rather than blindly replacing all mocks with Layer.mock; EV014 alone does not prove container startup. Mutable scenario ownership is the flake finding.
- **flake:** beforeEach resets one hoisted providerState and each case mutates it. Shared config sequence.concurrent=true; this named it.layer supplies no concurrent override, and pinned internal.ts342-352 inherits suite options. Another case can replace stream parts/error/repair tokens before their deferred read. Prefer isolated scenario services at the existing seam; if module mock must remain, explicitly serialize this state-owning block with evidence. Preserve every scenario/token/error assertion, no global concurrency change. This is source-proven shared-state exposure, not an observed hosted flake.
- **property:** No additional change required by this lens: Exact block order, finalization usage/model, repair-token addition, emitted-block-before-failure, translated provider/repair errors and negative token validation are witnessed. Keep partial delivery and usage totals; no invented expected payloads for Boolean assertions.
- **observability:** No additional change required by this lens: Failure messages distinguish absent metadata, provider stream failure, repair failure and invalid usage. Mock unexpected non-streaming call dies explicitly. Preserve per-test scenario identity when later adopting tracing.

### packages/agents/server/test/AssistantTurn.schema-parity.test.ts

Kind test; full read 1–91; 2646 bytes; SHA256 `8a22009d3a1e98e7345660fa84f54de0ee1102aafcd353e1706f8dc00567d529`.

- **resource:** No additional change required by this lens: Real codecs and incremental scanner are pure local subjects, with no resource layer.
- **flake:** No additional change required by this lens: Schema generation has explicit fcRuns(25); no external state or timers.
- **property:** No additional change required by this lens: Six real schemas, initial scanner state, issue report, replacement operation and completed chunk have exact encoded/value checks. Assertions execute before property returns true. Preserve schema equivalence and fcRuns(25), not a weaker test-only schema.
- **observability:** No additional change required by this lens: Named parity and initial-state expectations expose schema drift. EV001/EV007 already capture manual runner migration; no extra generic logging finding.

### packages/agents/server/test/BlockRepair.test.ts

Kind test; full read 1–129; 4594 bytes; SHA256 `6264129202f9c3101eef948209b5cf9a6a78a8878ec4d25c6dd9d26beb40c775`.

- **resource:** No additional change required by this lens: makeRepairInvalidBlocks receives a local Effect-returning callback; no provider client, process or database is acquired. Keep dependency injection and actual repair logic.
- **flake:** No additional change required by this lens: Repair responses/failures are deterministic and awaited. Two repair-call usage totals are algorithm behavior, not retries hiding a flaky test.
- **property:** No additional change required by this lens: Valid envelope, dropped missing block, codec-valid empty patch, duplicate index first-wins and typed failure controls are explicit. Guard assertions precede payload checks. Keep first text, token totals and real invalid block schema; no helper assertion weakening.
- **observability:** No additional change required by this lens: Named repair modes and typed BlockRepairFailed expose the boundary. Scripted model-unavailable input does not prove a live outage; no need for external execution.

### packages/agents/server/test/ProviderInstance.integration.test.ts

Kind test; full read 1–310; 13194 bytes; SHA256 `4e6639cbb53740e3767be28b44cd824e54b3a58d047e30331e5c32fb34ea0bd7`.

- **resource:** No additional change required by this lens: Public serial layer owns real PGlite/Drizzle, CuidState and crypto. CLI runner and home services are explicit pure scripts; fake paths do not spawn binaries or access homes. Keep native SQL identities/tenant predicates, separate actor services and actual cryptographic ID generation; MemoryFS is not a SQL replacement.
- **flake:** No additional change required by this lens: Each serial case recreates its table; recording requests reset where used. Eight inserts deliberately run concurrently inside one case and are awaited. Preserve that concurrency and serial table ownership; no arbitrary waits or real auth operation.
- **property:** No additional change required by this lens: Authenticated/logged-out snapshots, executable/env mapping, eight distinct DB/public IDs and cross-tenant get/update/probe/save/remove refusal with zero runner calls are concrete controls. Subsequent secondary update verifies principal and version. No fabricated timing or real provider assertion.
- **observability:** No additional change required by this lens: Exact login guidance and tenant request counts localize failures. All credentials/paths shown are test inputs; real authentication is not performed. Public layer has explicit five-minute acquisition option and existing test-body limit.

### packages/agents/server/test/scanChunk.test.ts

Kind test; full read 1–80; 2980 bytes; SHA256 `1700c04640435b8ca7574010ee11386675879dcfdbbdd1805ed526ea3e7fa11d`.

- **resource:** No additional change required by this lens: Incremental JSON extraction maintains only local scanner state and generated strings, without services.
- **flake:** No additional change required by this lens: Explicit fcRuns(200), sorted cuts and single-character control are deterministic under supplied seed; no wall time or provider.
- **property:** No additional change required by this lens: Generated envelopes cover escapes/braces/brackets/quotes/Unicode, bounded block count and cut count, with exact parsed element/order equality. Synthetic blocks intentionally test structural extraction, not domain validation; do not substitute narrower valid AssistantBlock schemas. Keep fcRuns(200), all cut handling and single-character control.
- **observability:** No additional change required by this lens: Property asserts every extracted slice against its corresponding original and checks count. Preserve shrink/seed visibility during EV007 migration; parser output is not live model-stream evidence.

## Proposed P2 order and uncertainty

After Benjamin authorizes P2: isolate the Anthropic kernel scenario state or explicitly serialize its state-owning block. Preserve the serial PGlite fixture, concurrent inserts within the identity case, exact tenant controls and property run floors. Preserve assertion operands and polarity during mechanical migrations. No remediation is performed by this inventory.

Mechanical candidates remain open and separate. Human resource coverage comes from actual construction/teardown reads, not EV judgments. No old exception is transferred. Source review does not establish absence of races or package/coverage success. Root-reviewed P1 inventory; P2 remains gated.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

Root accepted these P1 rows after source, artifact and combined strict-schema validation. Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2.
