# @beep/runpod — P1 inventory digest

Root accepted all three census files after complete four-lens reads, strict
validation and source/artifact hash checks. Codegen-kit’s prerequisite inventory
is accepted. Full P1 is incomplete and P2 remains gated.

## Findings and counts

12 rows cover all 12 file/lens pairs: ten coverage-only NONE rows and two major judgment findings; no blocker/minor or exception rows. Counts: resource 3 coverage/0 actionable; flake 3 coverage/0 actionable; property 2 coverage/1 actionable; observability 2 coverage/1 actionable. Every NONE row has its exact lens-NONE rule, info severity, confidence 1, judgment/open, module.@effect/vitest and no fixSha.

1. **L-PROP-03, Runpod.service.test.ts:87–103**, also relevant to direct call at 424–432: the helper and direct native property check hard-code `{ runs: 25 }`, with no repository seed/floor options. EV001/EV007 already identify manual runner syntax. The added judgment concerns lost CI floor/seed across ten model checks. In P2 use the existing fcRuns helper in native property registrations, keeping 25 as the local requested minimum and honoring CI400/20260708. Preserve encoded/reencoded equality, semantic equality and every model.
2. **L-OBS-01, integration/Runpod.live.test.ts:30–48**: both live bodies return normally when the key is unavailable. They have no assertion or reported skip on that branch. A green registration therefore cannot prove that listPods/getOpenAPI executed. Preserve both registrations and assertions; expose a nonsecret gate outcome and distinguish unexecuted integration from successful provider evidence. Per-test instrumentation should follow resource migration, without making the unauthenticated case unconditional. No cloud call or credential inspection is authorized.

The property mapping of raw request paths is not automatically a weakened schema: production Runpod.service.ts:26–30 normalizes a leading slash in both decode and encode. The test retains the explicit relative `future` → `/future` encode assertion at 435–437 while generating canonical paths for equality. Preserve both the transformation boundary and canonical round-trip law; do not replace the domain with a weaker test-only schema. No actual generated counterexample was executed.

## Layer topology, native boundaries and detector residue

The service test has seven anonymous layer blocks, each with fresh capturesRef/respondRef, injected HttpClient and one registered case. Six build Runpod and one builds RunpodDocs. Mutating cases reset only their own fixture. Production Runpod.makeLayer captures the supplied client/config; acquisition does not itself invoke provider operations. Docs uses the analogous injected client. Rebuild cost is local Ref/client/service construction; no container or database is acquired and no speedup is measured. Combining these blocks would require explicit mutable-state/concurrency ownership rather than a blanket sharing change.

The two live cases use the local provideScopedLayer wrapper around Runpod.layer. The wrapper builds/closes a scope per body; the production layer reads config and supplies FetchHttpClient. EV002/EV003 already capture that D14 migration. No separate resource leak was found. Migrate the wrapper through canonical layer ownership while preserving optional integration behavior and both native network subjects. MemoryFileSystem is irrelevant: no assigned test uses a filesystem subject. Unit create/delete requests are intercepted by the in-memory HttpClient; they are not cloud provisioning operations.

All 18 exact-file scanner rows were inspected and retained: EV001×2, EV002×2, EV003×1, EV006×4, EV007×2, EV014×7. Scanner-authored resource/judgment classifications are still scanner evidence, not independent lane coverage. EV014 requires actual acquisition-cost judgment: these unit layers allocate local state, not slow server hooks. No timeout change or exception is granted. EV006 migration must preserve status 500, operation ListPods, transport-cause text and documentation description payloads.

Flake review found no sleeps, polling, retries, asynchronous global mutation or demonstrated race in the three files. Real live HTTP has external uncertainty, but no reproduced cause supports flakyTest. The equivalence tests retain both changed-URL and opaque-defect cases. The unit error cases have named captures and precise status/transport fields; no extra observability syntax duplicate was added there.

## Retained timing/history and limits

Public timing: accepted-node-command-baseline, Node22.22.3/Bun1.4.2/Vitest4.1.11, 11 registrations, exit0, reporter success, 5.668507585000043 seconds whole-command. Raw reporter hash 77c1eac56915e42dd0bf04181af79db156363c6824cc93437b0c2db26314c9f5. The [baseline](../timings/baseline/beep_runpod.json) and
[timing context](../timings/context/baseline/beep_runpod.json) retain the original source identity. All files are represented, but the silent early returns mean provider execution is not established; no actual credential state was read to infer which branch ran. No rerun occurred.

Hosted history maps zero observations/jobs to RunPod. This does not prove no failures. The frozen 527 failed-run corpus has 21 inaccessible logs and one unresolved downloaded cause. Observations are not unique flakes, and production coverage paths are not test failures. Global timing facts remain 139 complete attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures.

Effect and adapter semantics remain rc113/d3b837aee836f35d625d55205f7d6e61305fc198. The rc113 declaration requires Vitest5 while the retained cohort is Vitest4.1.11; successful local command evidence is qualified to exercised behavior. No package-proof or race-free claim follows.

## Proposed P2 order

Scope → assertions → property → flake → observability. First resolve live wrapper ownership and preserve unit block isolation; then canonicalize assertion families without losing payloads; migrate all ten schema laws with floors/seeds and normalization semantics intact; diagnose any actual external failure before retry changes; finally adopt accepted instrumentation and truthful live-gate evidence. Preserve all original tests, assertions, operands, polarity, timeout values and native provider subject. No source change, run, waiver or P2 launch is authorized by these proposals.

## Highest-count files

All three files tie at four rows (one per lens):

- `packages/drivers/runpod/test/Runpod.equivalence.test.ts`: 4 rows; 0 actionable, 4 coverage-only.
- `packages/drivers/runpod/test/Runpod.service.test.ts`: 4 rows; 1 actionable, 3 coverage-only.
- `packages/drivers/runpod/test/integration/Runpod.live.test.ts`: 4 rows; 1 actionable, 3 coverage-only.
