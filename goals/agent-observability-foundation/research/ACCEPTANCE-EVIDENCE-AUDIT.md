# Acceptance evidence audit — October 29

Independent Astra reviewed SPEC's thirteen acceptance criteria at source checkpoint
`d3a33a8bc128b685e644b80f69e801ec82b3110a`. It verified all 86 current installed-proof
source hashes, all 29 entrypoint source hashes and all 25 reviewed Dankserver hashes.
The assessment is twelve supported at the stated source/synthetic/canary scope and
one partial. Repository publication, required current-head gates and closeout remain
separate requirements. No completion or historical-hold release is certified.

| AC | Assessment | Evidence and scope |
| --- | --- | --- |
| 1 Inventory/denominators | Supported | `observation-inventory.ts`, inventory/coverage tests, WORKSTATION-ROOT-INVENTORY.md and CLAIM-POPULATION-PUBLICATION.md. Capability, launches, expected events and observations are separate. The actual 28-root probe is a dated census, not current fleet completeness. |
| 2 Identity separation | Supported | `observation-launch-facts.ts`, Git identity models, occurrence hashes and `ingest.test.ts` global-Codex regression. Legacy collector context survives without becoming asserted source identity. |
| 3 Fair incremental discovery | Supported | `transcript-discovery.test.ts`, transcript-page/sweep suites and current terminal-classification verification. N+1 fairness, copies, rotation/truncation, partial lines, oversized growth, retired/unreadable roots, symlinks and real permission failures are covered. Sampled identity does not detect every possible unseen rewrite. |
| 4 Actual encoded event time | Supported | `ingest.test.ts` sends 1,200 historical observations through real protobuf export, with mixed-offset timestamps and actual start/end checks. Native/transcript export and surface-rounded-recovery-verification.json qualify nanosecond attributes and Phoenix microsecond quantization. Point events remain points. |
| 5 Metadata intake/journal | Supported | Positive native metadata projection, bounded HTTP/decompression/concurrency/deadlines, native-http-crash tests and NATIVE-INTAKE-NOTES.md. Acknowledgment follows local committed metadata/receipts; producer/pre-intake loss and backend visibility remain separate. Current installed proof binds the actual frontend and private credentials. |
| 6 Delivery state/recovery | Supported | Delivery ledger, process-crash, scheduler, reclamation and retention suites; actual qualified replay and epoch-backend-verification.json. Partial acceptance, lost replies, duplicate identity, capacity, restart and atomic disposal are qualified. Changed-epoch mismatch remains unverified instead of inventing delivery. |
| 7 Usage/cache/UI interpretation | Supported for pinned conventions/backend | `native-export.ts`, verify-phoenix-native-proof.py and MIXED-COLLECTOR-ROUTE.md. Claude-exclusive cache categories are added once; inclusive OpenInference counts stay inclusive; unknown totals are omitted. Actual complete-native total 270, known prompt/completion subtotal 275 and reconstructed standard-token contribution 0 reconcile with stored values. Recorded UI cells 5/135/135 and misleading zero-cost display are documented, not interpreted as measured zero cost. |
| 8 Dankserver parity/render | Supported | Current collector template preserves collision transform/ordering. collector-migration-verification.json records thirteen pinned-image tests, legacy→metadata→legacy delivery and unchanged queue bytes. Default legacy routing remains. PR3 merged without collector deployment. |
| 9 Queue/health bounds | Supported for qualified arrangement | COLLECTOR-QUEUE-HEALTH.md, runtime/source tests, current Prometheus rules and terminal-classification-verification.json. Queue exhaustion/crash/restart, stopped/stale/idle/paused distinctions, source expectations, refusal and disk pressure are covered. Lag is sampled acceptance age; the actual stopped-worker alert receiver is local, not a human notification channel. |
| 10 Health/backup/retention reporting | Supported | Configured Phoenix health URL, exact-ID retention reconciliation and dankserver-current-verification.json: ten retention tests, five backup-reporting tests and syntax checks. Actual-image retention mutation/reversal is separate evidence. No production retention change or operational backup readiness is inferred. |
| 11 Recovery hold | Supported and freshly rechecked by orchestrator | FORWARDER-RECOVERY-HOLD.md and current user-systemd state: both historical units masked/inactive, service MainPID zero. Replacement proof owns different units. It does not authorize blind restoration or release of the historical hold. |
| 12 Declared host/repo + CLI/desktop + disposable/live | **Partial: root association missing** | Existing proofs qualify synthetic labels, exact event IDs, read-back, visibility and owned rollback. Their synthetic host/route configuration has no declared source-root binding; native-coverage-input.json has roots=[] and unknown route roots, while managed fixtures retain unknown repository/clone/worktree identities. The verifier checkout is build provenance, not source-repository evidence. |
| 13 Ownership/compatibility/rollback | Supported for held/canary operation | STORAGE-OWNERSHIP.md, backup-crash tests, claim-store disaster rehearsal, current canary and collector-mode rollback. Custodians, bounds, uncertainty, legacy IDs/project producers and recovery boundaries are explicit. Historical archives stay preserved. Off-device replication, production generation management and historical-store recovery remain deployment holds. |

Source paths in the table are under `packages/tooling/library/ai-metrics`, unless
they refer to the recorded Dankserver checkout; research and receipt names resolve
under this packet's `research/` and `ops/`. Current source-bound receipts are
`ops/terminal-classification-verification.json` and
`ops/boundary-predicates-verification.json`. Earlier documents retain historical
scope; their obsolete remaining-work paragraphs are not authoritative current status.

## Required correction for AC12

Create one owned synthetic Git repository with a synthetic remote and explicit
private host/root declaration. Obtain positive repository, clone and worktree
identity through the existing real root-probe path. Before any send, bind that
validated declaration to each stage's tested route and independently computed
expected event IDs. Both disposable and live stages must refer to the same declared
host/repository evidence; routes, projects and request IDs may differ by stage.

Preserve CLI/desktop markers as synthetic, exact local/backend reconciliation and
owned rollback. Keep real launch denominators unknown. Do not infer source identity
from the verifier's checkout, copy expectations from returned rows, or enroll a real
harness to fill this proof gap. This is an evidence association requirement, not a
new universal-coverage or production-enrollment requirement.

The reviewer made no edits, ran no tests/services and changed no external state.
Its earlier acceptance of route behavior is narrowed by this explicit check of
the repository qualifier. AC12 and overall completion remain open until corrected
proof and the remaining repository-delivery gates pass.

## Preparation checkpoint

The real root-probe command now positively identifies one retained synthetic Git
repository in the private `declared-canary-root-20261029-v2` proof archive. Independent
review accepted the preparation script and re-computed host/root/namespace and Git
repository/clone/worktree identities. All 82 recorded source hashes match; no private
path, host label, salt or remote hostname appears in the probe/qualification output.
The same-output refusal was exercised and preserved every pre-existing file.

The accepted preparation script hash is
`893e245dc18f177f50c19c369330a93f8aa9f9cc8b73e1b29918e19a5f92f65f`;
the v2 qualification hash is
`5ba97f27866de55bbeb2b70e64892cc4e7d0068802b313044d41a50020c390b3`.
See `ops/declared-canary-root-preparation-verification.json` for its private archive
reference and hash-bound source snapshots. Both route stages remain not-run, and
all seven real-harness launch/event populations remain Unknown. Reuse this exact
v2 root after verifying its qualification; do not substitute the retained initial
v1 preparation or infer identity from the verifier checkout.
