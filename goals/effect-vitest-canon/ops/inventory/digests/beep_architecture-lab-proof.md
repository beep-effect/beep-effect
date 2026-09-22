# @beep/architecture-lab-proof P1 four-lens digest

1 complete census files, 4 rows: 1 review proposals and 3 coverage-only NONE rows. All remain open judgments. This is a source-only audit, not remediation.

| Lens | Reviews | NONE | Major | Minor | Info |
|---|---:|---:|---:|---:|---:|
| resource | 1 | 0 | 0 | 1 | 0 |
| flake | 0 | 1 | 0 | 0 | 1 |
| property | 0 | 1 | 0 | 0 | 1 |
| observability | 0 | 1 | 0 | 0 | 1 |

## Findings

### L-RES-05 ArchitectureLabProof.test.ts:13–21 (minor)

The local wrapper creates a new scoped Layer.build around actual effectful server composition. WorkItem/Worker builders create separate Ref stores; current repository aliases are in-memory, not SQL or a hosted server. Replace private outer wrapper with public layer registration in P2 while preserving fresh proof ID/config and exact real create/projection results. No guessed database timeout, new service or pure-stub substitution.

Evidence: `const provideScopedLayer =   <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>   <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>`

## Layer topology, rebuild costs and native boundaries

A private scoped Layer.build wraps ArchitectureLabServerLive. The actual WorkItem/Worker constructors build Ref stores; current makeRepository aliases select in-memory implementations. The proof runs a real service create then a pure UI projection, not an HTTP server or rendered UI. Public outer registration should preserve fresh fixed proof ID and configuration. No native resource or MemoryFS candidate; no measured rebuild saving is inferred from one smoke case.

## Retained timing and hosted limits

The accepted Node command baseline records 2 passed tests, 7.470439009999609 seconds whole command and 7122.797607421875 ms reporter duration. All assigned files appear in the retained report. These timings are not rerun or adjusted for host load. Runtimes: Node22.22.3/Bun1.4.2/Vitest4.1.11; the rc113 Vitest5 peer-range qualification remains. Raw reporter SHA256: `5316543a9ce57a47ae0a71cc8f0f385afaa11f32e084a38cc0cc11410337aa0b`.

| File | Retained ms | Registered tests |
|---|---:|---:|
| apps/architecture-lab-proof/test/ArchitectureLabProof.test.ts | 15.797607421875 | 2 |

Hosted summary: 0 observations in 0 jobs; categories {}. These are not unique flakes or evidence of a current-source cause. Detailed cause is not inferred from this aggregate. Production coverage-ratchet observations are not failing test cases. Passing registrations do not prove browser/provider/native integration execution beyond the source-defined test subject.

Globally, all 139 first attempts comprise 132 full-file baselines, 4 configured subsets and 3 failures: CIops, Effect Drizzle and QA Capture. Keep those failed/subset boundaries unchanged. Hosted scope covers 527 failed runs and includes 21 unavailable logs and one unresolved cause. Graph-3d browser file is outside its Node cohort, not executed or reported skipped.

## Top ten files by review count

| File | Review rows |
|---|---:|
| apps/architecture-lab-proof/test/ArchitectureLabProof.test.ts | 1 |

## Complete per-file coverage

### apps/architecture-lab-proof/test/ArchitectureLabProof.test.ts

Kind test; full read 1–61; 2325 bytes; SHA256 `ac77ee4bd8a1212a6073787d0eac054ab3b2d2012ee73af4fbaa23300b76f590`.

- **resource:** The local wrapper creates a new scoped Layer.build around actual effectful server composition. WorkItem/Worker builders create separate Ref stores; current repository aliases are in-memory, not SQL or a hosted server. Replace private outer wrapper with public layer registration in P2 while preserving fresh proof ID/config and exact real create/projection results. No guessed database timeout, new service or pure-stub substitution.
- **flake:** No additional change required by this lens: One awaited composed create/projection and a pure property have no network or scheduling dependency. Fixed proof ID is safe only within its fresh repository lifetime.
- **property:** No additional change required by this lens: Exact created and projected encoded shapes cover status, priority, labels and actions. Real result schema round trip uses fcRuns(20) and Equal.equals. Preserve production contracts and default configuration, not a snapshot-only stub.
- **observability:** No additional change required by this lens: Named app composition and encoded result expose topology contract failures. The proof calls server services and UI projection functions; it does not launch an HTTP server or render a UI.

## Proposed P2 order and uncertainty

After Benjamin authorizes P2: replace the private scoped layer wrapper with public layer registration, preserving fresh Ref stores, proof identity, exact create/projection assertions and fcRuns(20). No scheduling defect or native acquisition was established. Preserve assertion operands and polarity during mechanical migrations. No remediation is performed by this inventory.

Mechanical candidates remain open and separate. Human resource coverage comes from actual construction/teardown reads, not EV judgments. No old exception is transferred. Source review does not establish absence of races or package/coverage success. Root-reviewed P1 inventory; P2 remains gated.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

Root accepted these P1 rows after source, artifact and combined strict-schema validation. Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2.
