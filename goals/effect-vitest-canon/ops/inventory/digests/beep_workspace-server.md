# @beep/workspace-server — P1 source audit

Root-reviewed and accepted P1 source inventory. P2 remains gated.

All 4 assigned files were read completely in the original audit and reused only after current hash equality. 16 rows: 5 minor review proposals and 11 info coverage rows. All are open judgments.

| Lens | Review | Coverage | Total |
| --- | ---: | ---: | ---: |
| resource | 1 | 3 | 4 |
| flake | 0 | 4 | 4 |
| property | 2 | 2 | 4 |
| observability | 2 | 2 | 4 |

Review proposals:

- `packages/workspace/server/test/ThreadStore.test.ts:290` — L-PROP-03: The set-title native property uses arbitrary:{} and therefore does not consume fcRuns or the repository CI run/seed floor. Pin source defaults to 100 trials. Supply arbitrary:fcRuns(100) (or an explicitly higher approved floor), preserving the production SetThreadTitleIfEmptyInput schema, both nonempty assertions and normal CI seed. Keep the four separate 25-floor round trips unchanged.
- `packages/workspace/server/test/ThreadStore.test.ts:353` — L-OBS-01: Four native construction-schema checks reduce results to _tag, dropping formatted counterexample/replay context. Preserve Thread/Turn/Message/InMemoryState encode/decode laws and fcRuns(25), but name/report each failing schema and retain native failure detail during EV007 migration. Do not change the intentional Eq.equals-or-schema-equivalence law without separate review.
- `packages/workspace/server/test/WorkspaceSourceTextResolver.test.ts:216` — L-RES-04: Retain real native vault containment/symlink resolution, SHA-256 verification and DOCX extraction in the wrapper migration. The cache test must keep one resolver across two reads and source drift, while separate tests keep separate vault/cache state. A generic MemoryFileSystem or mocked successful extractor must not replace these subjects; preserve the 32 MiB + 1 rejection control.
- `packages/workspace/server/test/WorkspaceVaultStore.test.ts:40` — L-OBS-01: The shared local error-schema runner projects native result to _tag. Retain both WorkspaceVault error schema encode/decode equivalence laws and fcRuns(10), but expose complete formatted failure/replay and a distinct schema name during EV007 migration. Keep typed missing-root message and post-failure state assertions.
- `packages/workspace/server/test/integration/ThreadStoreDrizzleRepository.pglite.test.ts:119` — L-PROP-04: The second timeline item is checked only inside if(secondItem?.kind === message), unlike the first item's explicit kind assertion. A missing/non-message second item skips the assistant-role check while turn indices can still pass. Assert the second kind/presence before narrowing, then preserve exact assistant role, ordered turns, cost and public-ID checks.

Top files by human-row count (ties sorted by path; these are review coverage counts, not defect counts):

- `packages/workspace/server/test/ThreadStore.test.ts`: 4 rows; 2 review proposals.
- `packages/workspace/server/test/WorkspaceSourceTextResolver.test.ts`: 4 rows; 1 review proposals.
- `packages/workspace/server/test/WorkspaceVaultStore.test.ts`: 4 rows; 1 review proposals.
- `packages/workspace/server/test/integration/ThreadStoreDrizzleRepository.pglite.test.ts`: 4 rows; 1 review proposals.

In-memory ThreadStore layers capture fresh mutable store/Cuid/Crypto state; preserve concurrency-8 yielding-ID proof and joined work. Resolver tests require native containment, digest, DOCX and cached extraction; retain one resolver for the cache/drift scenario while isolating separate tests. Vault existence is a native subject. Drizzle uses one fresh in-process extension-enabled database in a serial layer with distinct workspace IDs; its concurrency-1 cases are not concurrent SQL proof. No blanket MemoryFileSystem substitution is justified. Integration took 1.041 seconds in the retained file timing; no isolated setup speedup is measured.

Retained first-attempt Node baseline: 27 passed registrations; whole command 8.074820 seconds, exit 0. All assigned files are represented according to the context receipt. Reporter SHA256 `eb3a5d11076431747fcbca226efb63cf05d1033835f4775b063f73610d43a09f`. Node 22.22.3, Bun 1.4.2, Vitest 4.1.11; rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198. This is one recorded run, not absence of races, package compiler/coverage proof, supported-peer proof or external-provider execution. No timing was rerun.

No package-mapped observation was present in the retained completed hosted dataset. That is not proof of no historical failures or rare races.

Campaign limits: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failed cohorts (CIops, Effect Drizzle, QA Capture). Hosted history covers 527 failed runs with 21 unavailable logs and one unresolved cause. Observations are not unique flakes; production coverage locations are not test failures. Graph-3d browser execution is outside its configured Node cohort.

Proposed P2 order remains scope, assertions, property, flake, observability. First preserve the native boundaries and fixture lifetimes above, then review existing detector candidates without dropping operands or inventing tagged payloads. Apply the specific property controls/floors before ordering and diagnostic improvements. P2 is unauthorized; native-provider runtime behavior, rare failures, coverage completeness and measured optimization benefit remain outside this source audit.

Root verified the sealed artifacts, current inputs and full source receipts, then passed combined strict inventory validation. Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
