# P0f round 1 immutable input corpus

Assembly in progress. This lane assembles review inputs only; it does not run the adversarial review, tests, validation commands, or remediation. Root supplies primary revision `bf6014ae31531bf4dc18f7f6eedafa96a700d876` (live uncommitted proposal) and filesystem revision `0fce23fbace5ef95a1bca9459c341a17d5bbd641` (published PR1047, not merged). Snapshots will be qualified by source root and SHA256.

Progress: selected 20 tests deterministically from the existing 970-test census: 5 apps, 2 infra, 13 packages, 17 owners, 213,693 source bytes. Their 92 baseline rows match the existing per-package JSONL projection exactly. All 14 nonempty detector rule families are represented; EV015 has zero baseline rows. The baseline remains untouched and is referenced by hash. Mandatory implementation, fixtures, charters, doctrine and separately rooted P0.5 context are inventoried.

Reference gap: five upstream persistence/event-log helpers cited by grounding 2 were fetched during that earlier research but are absent from the supplied partial rc.112 extraction and retained cache. Their exact missing paths will remain visible in the manifest and guide; no current-HEAD substitutes or network retrieval are used.

## Assembled corpus

- Sealed corpus: `~/.cache/beep/effect-vitest-canon/p0f-round1-corpus/manifest.json`; SHA256 `eac5a3b2770af59ae3abcea745e284d936b56e460f5a5b311e511e6d36b8b39c`.
- 282 copied inputs / 4,436,607 bytes; 132 hash-qualified references. Including metadata and assembly scripts: 297 files / 6,066,818 bytes.
- Exactly 20 sampled tests / 213,693 bytes / 17 owners. Selection: 20 ordered metadata strata; within each, prefer an owner not selected yet, then smallest existing census byte count, then lexical path. No test-body census was run.
- `samples.json` has reasons, exact hashes and baseline/census counts. `rows-for-samples.json` holds the 92 selected baseline identities, matching JSONL rows and exact existing census records; all 14 nonempty rule IDs are represented. EV015=0 is covered by mandatory detector/graph tests.
- `reading-guide.md` orders mandatory groups, anchors D1-D14 and phase stops, and distinguishes the two worktrees plus local Node24.20.0 / hosted coverage Node24.21.0. No raw CI logs or dependency trees are copied.

## Twenty-file selection

Paths are primary-proposal repo-relative. B = exact baseline counts; C = historical EV census counts. Zero rows are controls for review, not proof that a file is canonical.

| # | Test/spec path | Reason | B | C |
| --- | --- | --- | --- | --- |
| 1 | `apps/professional-desktop/test/theme-atoms.test.tsx` | Shared layer / UI legitimate-idiom control | 011×1 | 011×1, 012×1, 014×1 |
| 2 | `apps/professional-desktop/test/chat-ui.test.tsx` | Mock/spying judgment candidate | 006×2, 011×1, 012×1 | 006×2, 011×1, 012×1 |
| 3 | `apps/architecture-lab-proof/test/ArchitectureLabProof.test.ts` | App property migration candidate | 007×1 | 002×1, 004×1, 006×1, 007×1 |
| 4 | `apps/professional-desktop/test/dock-shell.test.tsx` | Clock/sleep lexical candidate versus syntax detector | 011×1 | 008×1, 009×1, 011×1 |
| 5 | `apps/practice-kg-mcp/test/Host.test.ts` | App Result/error assertion false-positive contrast | 006×2 | 005×2, 006×2, 010×3 |
| 6 | `infra/test/OpenClaw.test.ts` | Infrastructure shared resource/stub layer behavior | 001×8, 006×2 | 001×8, 004×1, 006×3, 013×1, 014×3 |
| 7 | `infra/ci-runners/sdks/ghaRunners/test/build.test.js` | In-scope JavaScript non-Effect negative control | 0 | 010×4 |
| 8 | `packages/drivers/pacer/test/Pacer.test.ts` | Canonical synchronous property API control | 001×1, 007×1 | 001×1, 002×1, 004×1, 007×1, 014×14 |
| 9 | `packages/foundation/capability/semantic-web/test/IdentityRdfBinding.test.ts` | Canonical effect property API control | 007×2 | 002×1, 004×1, 007×2 |
| 10 | `packages/drivers/drizzle/test/Drizzle.errors.test.ts` | Existing public assertion helper control | 006×18, 007×3 | 002×1, 003×4, 004×1, 006×18, 007×3 |
| 11 | `packages/drivers/duckdb/test/DuckDb.service.test.ts` | Only recorded unadjusted-sleep detector case | 002×1, 003×7, 004×1, 006×11, 008×1, 010×1 | 001×3, 002×2, 003×33, 004×2, 006×9, 007×1, 008×1 |
| 12 | `packages/documents/server/test/DocumentIntake.test.ts` | Explicit Result-shape assertion candidate | 005×1, 006×2, 007×1 | 005×2, 006×2, 007×1, 010×3 |
| 13 | `packages/epistemic/use-cases/test/ClaimDisposition.test.ts` | Shared layer hook-timeout judgment candidate | 006×2, 014×1 | 006×2, 014×1 |
| 14 | `packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts` | Retry/attempt judgment candidate | 006×2, 009×6, 010×1, 013×2 | 003×6, 006×2, 010×7, 013×6 |
| 15 | `packages/drivers/obs/test/integration/Obs.live.test.ts` | Per-test effectful layer provision candidate | 002×1 | 001×1, 002×1, 009×1, 013×1 |
| 16 | `packages/tooling/library/ai-metrics/test/file-inventory.test.ts` | Resource wrapper definition/use context | 003×1, 010×1 | 003×3 |
| 17 | `packages/foundation/modeling/utils/test/DrainableWorker.test.ts` | Exit/Option specialized assertion candidate | 004×1, 009×1 | 004×1, 009×1 |
| 18 | `packages/epistemic/server/test/EpistemicServer.test.ts` | Clean shared-layer false-positive control | 0 | 014×1 |
| 19 | `packages/tooling/library/qa-capture/test/integration/ClockCorrelator.integration.test.ts` | Live-mode justification judgment candidate | 009×1, 010×1 | 002×1, 004×2, 009×1 |
| 20 | `packages/foundation/modeling/schema/test/Csp.test.ts` | Schema/model property and floor contrast | 007×1 | 007×1 |

## Mandatory group coverage

| Group | Files / bytes | Coverage |
| --- | ---: | --- |
| 01-contract | 13 / 137,374 | Packet and phase receipts |
| 02-pinned-grounding | 96 / 2,256,695 | KG, pinned APIs/examples/licenses, installed declarations; five missing helpers below |
| 03-detector | 38 / 311,640 | Command/rules/schema/store/scanner/version guard, wiring, tests/fixtures |
| 04-charters | 12 / 69,602 | Four charters + shared contract; runner/errors/internal modules/tests/fixture |
| 05-doctrine | 9 / 187,269 | D5 corrections and current testing/Effect/schema/architecture guidance |
| 06-samples | 22 / 407,601 | 20 selected tests + existing census metadata |
| 07-local-support | 70 / 612,469 | Local helpers, actual aliases/barrels/manifests/configs and sample support |
| 08-filesystem-context | 22 / 453,957 | Separate PR1047 core/facade/conformance/tests/patch/policy and final hosted receipt |

Group totals may overlap where an input has multiple roles. Manifest totals are unique.

## Validation and Root follow-up

- Assembly integrity PASS: all copied before/snapshot/after hashes and terminal live hashes match; references match; selection metadata remained unchanged; sample count is exactly 20; all 92 baseline rows match existing JSONL projections. Installed Effect/Vitest are rc.112; installed Vitest4.1.11; all three installed Effect Vitest source files match the pinned copy. Manifest/generated-artifact digest checks pass. Corpus files/directories are read-only.
- Input completeness is **not passed**: the supplied pinned extraction lacks the five full upstream helper bodies below, corroborating grounding-2 lines25–28. No retained cache copy was found. Root must recover the exact pinned bodies before claiming all requested upstream inputs are present; use a new versioned corpus rather than altering this seal. No approval requirement or waiver is invented.
  - `packages/effect/test/unstable/eventlog/SqlEventLogServerUnencryptedStorageTest.ts` (pinned-effect-rc112).
  - `packages/effect/test/unstable/persistence/KeyValueStoreTest.ts` (pinned-effect-rc112).
  - `packages/effect/test/unstable/persistence/PersistedCacheTest.ts` (pinned-effect-rc112).
  - `packages/effect/test/unstable/persistence/PersistedQueueTest.ts` (pinned-effect-rc112).
  - `packages/effect/test/unstable/persistence/SqlCleanupTest.ts` (pinned-effect-rc112).
- Packet ambiguity retained: README still says P0c in progress/older census, while PLAN and later receipts advance to P0f. Root should reconcile or explicitly frame this for Grok; this lane changed no packet doctrine/state.
- Graft guidance was absent in primary and loaded from the filesystem checkout; two existing cards were read directly. No CLI/init/refresh/build ran outside ownership. Numeric estimate: 0, with 0 CLI retrieval calls.
- Commands: report creation, metadata selection, assembly planning, JSONL equality, bounded import-reference indexing, snapshot capture and final digest/permission validation all exited0. Initial memory/local guidance and missing-reference searches returned no matches; one guessed Quality/internal/Tasks.ts path was absent and resolved to the existing Quality/Tasks.ts. No tests/builds/installs/package checks/coverage/scanner/model/Grok/git commands ran.
- Root-supplied revision claims are not independently verified through git. Primary proposal hashes control; PR1047 remains separately published and unmerged. P0g ratification/merge and P1 acknowledgement remain stops. This report is assembly evidence only.
