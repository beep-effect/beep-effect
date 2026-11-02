# Independent panel remediation ledger

Claude's final report is retained in review-panel-claude.md. It covers an earlier
dirty snapshot and is not a passing vote. The following items require current
source-bound adjudication before closeout; reviewer claims are evidence to check,
not authority to change unrelated services.

| Finding | Current disposition |
| --- | --- |
| Hard-coded worker file ceiling permits only the minimum journal | Repaired: explicit journal page budget derives worker file ceiling; 1024-page installed proof passes with 8 MiB file limit. Scoped CLI compilers and 29 tests pass; full CLI gate remains open. |
| Accepted/unresolved delivery cannot progress after Missing | Target-qualified replay and latest permanent-refusal guard implemented. Current full package gate passes; maintenance-package-verification.json. Refreshed actual pinned-backend proof accounts for seven attempts/one dropped/six upstream without duplicate stored usage; native-qualified-recovery-hop-verification.json. |
| Conflicting/un-enrollable pages can block retirement | Repaired and independently accepted at bounded scope: validated capacity-only expiry preserves never-enrolled references separately, canonical ownership checksums protect retirement, intake reserves disposition slots. Full package and installed85-source proof pass; retirement-package-verification.json and retirement-live-verification.json. Legacy summary omissions/overcommit remain explicit migration holds. |
| Cross-epoch duplicates necessarily create multiple Phoenix spans | Qualified on pinned backend: real retirement/re-admission changes epoch bytes but preserves IDs; Phoenix retains one original row, exact read-back yields Mismatch, no automatic resend occurs, expiry preserves accepted-unverified state, and usage remains 15 rather than 30. See EPOCH-BACKEND-QUALIFICATION.md and epoch-backend-verification.json. |
| Installed worker lacks reclamation/expiry/backup/seal operations | Repaired for bounded owner operations: process/target-bound private API, paused reclamation/expiry/backup/seal/restore, four create-only slots; installed/context/body/concurrency proof and full AI-metrics package gate pass. See PRIVATE-MAINTENANCE.md and maintenance-*-verification.json. Physical off-host replication is not claimed. |
| Production metadata transport/migration incomplete | Repaired default and bounded reversal: legacy trace receiver remains selected until explicit metadata enrollment; loopback-only new port, mode-specific alerts and actual legacy→metadata→legacy proof preserve queue bytes. See COLLECTOR-MIGRATION.md and collector-migration-verification.json. Cross-host production enrollment remains unqualified, not silently enabled. |
| CLI/desktop marker is lost by hashing | Repaired: explicit owner opt-in, finite synthetic labels, readable fixture names and complete managed-key read-back. Current disposable and2-record tailnet proof pass; surface-label-live-verification.json. Real application enrollment is not inferred. |
| Independent worker health missing | Repaired and actual independent scrape/stopped-worker alert proved after reviewer snapshot; source-bound receipt retained in independent-health-verification.json. |
| Shared environment secret inheritance | Repaired: named systemd credentials and positive environment allowlists; installed proof rejects arbitrary ambient secret canaries and four malformed credentials before journal mutation. See credential-health-installed-verification.json. |
| Held forwarder gains discovery cursor schema | Qualified limited reversal: previous forwarder file runs against additive cursor table with current dependencies; synthetic source rows retained and cursor unchanged. forwarder-schema-compatibility.json. No historical store/service mutation or full binary recovery claim; hold stays active. |
| Pause/scanner suspension race | Repaired: pauseWith holds one permit through drain and scanner suspension; concurrent resume/maintenance refuses. Regression and full package audit/docgen pass; atomic-pause-package-verification.json. |
| Persistent Missing queried at fixed cadence | Repaired: checksummed pre-query reservations survive reconstruction/interruption, cap exponential delay, and retire/restore with event facts. Full AI-metrics audit/docgen pass; query-backoff-package-verification.json. See QUERY-BACKOFF.md for recognition latency and rollback limits. |
| Repository gates/delivery incomplete | Open; scoped evidence does not substitute for touched-package, Yeet, hosted/review and merge/closeout requirements. |

Grok's independently retained report and Astra's source review remain separate.
No review timeout, fixture pass or receipt hash substitutes for the outstanding
requirements. Preserve historical archives, disabled legacy units and private
recovery evidence throughout repairs.

The labelled live proof exposed a floor-only timestamp comparison defect. Phoenix
rounds nanoseconds into microsecond datetimes; the repair preserves exact source
attributes, permits only a strict sub-microsecond representation difference, and
preserves endpoint order and point-event shape. Both red/green regressions and
refreshed actual backend proofs pass. See SYNTHETIC-SURFACE-LABELS.md.
