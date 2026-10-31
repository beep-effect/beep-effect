# Acceptance evidence audit

## Current source refresh — October 31

The October 29 assessments below retain their historical execution scope. The
latest completed route qualification is now
`../ops/history/declared-current-stages-20261031.json`, following runtime repair
`4dff0193ea` and main integration `de5abb703c`. A new positively probed synthetic
root was prepared; the previous roots and receipts remain unchanged.

Independent Astra accepted all 88 disposable and 87 live input hashes, exact
pre-send root/configuration/input bindings, independently derived event IDs,
backend/local/native/delivery sets and two actual visibility receipts per stage.
Both stages retain exact source nanoseconds and the reviewed backend timestamp
representation, explicit CLI/desktop fixture annotations and unknown real harness
populations. Actual worker scraping, stopped-worker alert delivery to a local
simulated receiver, collector rollback, unit removal and queue preservation passed.
The retained bundles include the intentional integrity-failure suffix and are
proof artifacts, not installable deployment bundles.

The first live attempt was interrupted by the host memory reserve and remains
incomplete despite a wrapper exit zero. No pre-send plan was written; only that
attempt's owned unit files/container were removed, retaining its queue and cleanup
receipt. The later attempt passed without a resource stop. No memory limit was
weakened, production collector configuration changed, historical data reingested
or recovery hold released.

Current source tests passed under Node22.23.4 and Bun1.4.4: 834 AI-metrics
tests in74 files, five Phoenix readback tests and55 managed-provider tests.
See `../ops/history/current-test-proof-20261031.json` for the split execution
and controlled wrapper-bootstrap stop. Exact-head final-check and hosted/review/
merge/lifecycle closure remain separate requirements.

## Historical October 29 assessment

Independent Astra reviewed SPEC's thirteen acceptance criteria at source checkpoint
`d3a33a8bc128b685e644b80f69e801ec82b3110a`. It verified all 86 current installed-proof
source hashes, all 29 entrypoint source hashes and all 25 reviewed Dankserver hashes.
The initial assessment was twelve supported and AC12 partial. The final declared
route proof below closes AC12: all thirteen are now supported at their stated
source/synthetic/canary scope. Repository publication, required current-head gates and closeout remain
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
| 12 Declared host/repo + CLI/desktop + disposable/live | **Supported at explicit synthetic scope** | declared-route-stages-verification.json and DECLARED-ROUTE-PROOF.md bind the same positively probed root to pre-send independently expected CLI/desktop IDs in both stages. Final source, backend/local/visibility event sets, journal identity and rollback were independently verified. Real harness populations remain Unknown. |
| 13 Ownership/compatibility/rollback | Supported for held/canary operation | STORAGE-OWNERSHIP.md, backup-crash tests, claim-store disaster rehearsal, current canary and collector-mode rollback. Custodians, bounds, uncertainty, legacy IDs/project producers and recovery boundaries are explicit. Historical archives stay preserved. Off-device replication, production generation management and historical-store recovery remain deployment holds. |

Source paths in the table are under `packages/tooling/library/ai-metrics`, unless
they refer to the recorded Dankserver checkout; research and receipt names resolve
under this packet's `research/` and `ops/`. The latest runtime source binding is
`ops/history/committed-source-binding-verification.json`, covering the v3 stages in
`ops/history/hosted-build-repair-verification.json` and its separately recorded preparation.
Earlier terminal-classification and boundary receipts retain their historical scope. Earlier documents retain historical
scope; their obsolete remaining-work paragraphs are not authoritative current status.

## Original correction required for AC12 (now completed)

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
the repository qualifier. This was the initial audit boundary. The final evidence below closes AC12; overall
completion still requires the remaining repository-delivery gates.

## Historical v2 preparation checkpoint

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
reference and hash-bound source snapshots. At this preparation checkpoint both route stages were not-run, and
all seven real-harness launch/event populations remain Unknown. At that checkpoint the exact v2 root was required. Current qualification uses the
separately prepared v3 root; do not substitute either historical root for current
source or infer identity from the verifier checkout.

## Historical v2 AC12 artifact acceptance

Independent Astra accepted the final disposable and live pair after separately
checking all 87 and 86 source hashes, plan/input/configuration digests, independently
derived event IDs, matching backend surface/route IDs, and read-only SQLite local
ledger/visibility sets and host/namespace. Both use the exact v2 qualification and
root above. All four final helper hashes match the reviewed bytes. Both guards
exited zero, without a controlled stop or PID-limit event. Owned unit removal,
collector rollback, retained queues, post-rollback backend readback and disposable
backend/network cleanup are recorded. See `DECLARED-ROUTE-PROOF.md` and
`../ops/history/declared-route-stages-verification.json` for durable archive paths/digests.

The final refusal check is bound to helper `bacdf231e46c75a6588948667ee8279d62ae5003d39e10c151f44924cd737f79`
and qualifies changed Git-directory/common-directory and occupied-plan refusal.
The reviewer made no mutations, test runs or service actions. It expressly accepted
AC12's synthetic association and delivery scope without inferring real enrollment,
exhaustive capture or known launch populations. All thirteen criteria now have
scoped support; required repository gates, publication, merge and reflection remain.

## Current-source refresh after hosted build diagnostics

The source repair and dependency-catalog correction are documented in
`HOSTED-BUILD-REPAIR.md` and `../ops/history/hosted-build-repair-verification.json`. After
full package audit/docgen and 37 focused tests passed, an explicitly new v3 root
was prepared with the current 82 source hashes; v2 was preserved. Independent
Astra accepted both final v3 routes after checking all 87/86 current source hashes,
pre-send plan/input/configuration digests, the same positive root declaration,
independently derived IDs against backend/native/local/visibility sets, checksum-valid
visibility receipts, exact source nanoseconds and rollback evidence. Both guards
exited zero without protective stops or PID-limit events. The current-source AC12
support remains scoped to two synthetic records per stage. No earlier receipt was
relabeled, and real enrollment/populations remain unqualified. Repository delivery
and the remaining final panel/hosted checks still govern overall completion.

## Final source panel and commit binding

The named Claude and Grok reviews completed successfully at runtime source95711;
Astra independently accepted the final evidence and operator-documentation repairs.
`FINAL-PANEL-DISPOSITIONS.md` records every final finding. The explicit committed
binding verifies82 preparation,87 disposable,86 live and8 repair sources against
Git blobs at `95711cb9df8f850c67aa16967567e5c7535e2801`, with no mismatches.
This closes source/evidence review while preserving historical execution receipts.
Current-head repository gates, hosted delivery, merge and terminal lifecycle remain
open. The closeout reflection is prepared and explicitly reports that pending state.
