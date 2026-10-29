# Foundation storage, privacy and recovery ownership

This policy governs the new foundation boundary and its retained qualification
artifacts. It does not release the historical recovery hold or authorize bulk
transcript import. The workstation account running the new owned service is the
local custodian; the dankserver monitoring/Phoenix Ansible roles own their named
server stores. The operator owns final data disposition. An agent may perform
the bounded, reversible maintenance explicitly exposed by this implementation,
but no missing receipt, queue failure or stale backup grants replay/deletion rights.

## Stores and permitted actions

| Store | Owner and bound | Retention/disposition | Recovery rule |
| --- | --- | --- | --- |
| Historical AI metrics archive and old forwarder state | Existing operator-owned store; held service/timer | Preserve byte-for-byte; excluded from new automatic discovery/backfill | No unmask, reset, reingest or archive-key migration in this packet |
| New local metadata journal | One worker under the invoking workstation UID, private 0700 directory/0600 files, exclusive lock and fixed launch configuration | Explicit configured SQLite/page/payload/ledger ceilings; capacity refuses intake. Maintenance requires pause/drain. Visibility-based reclamation and explicit expiry retain bounded disposition evidence | A verified physical snapshot restores only into a fresh owned destination. Never overwrite a newer journal or infer backend delivery from restore |
| Independent managed-launch claim store | Managed owner under the same workstation UID, explicitly provisioned private directory disjoint from the collector journal | 1–256 claims; fixed per-claim outbox/receipt slots. No automatic reclaim or fence recreation. Capacity stops new launches | Missing, stale, copied or torn fences remain held. A collector snapshot cannot restore launch authority. Retained claim copies support reconciliation only |
| Native collector queue | Dankserver monitoring role, stable exporter/storage IDs, UID/GID 10001, private bind mount | 16 MiB serialized queue and one 64 MiB capped store; no automatic corrupt-file recreation/compaction. Permanent exporter failures are observable but may discard a queued export | Stop intake and retain queue/config before replacement. Restart the exact owned queue only after checking target and policy identity; an older queue snapshot can duplicate exports |
| Phoenix records | Phoenix role for service/project/retention identity; Phoenix backup role for backup status | Existing declared policy and project assignment are authoritative. The role reconciles exact IDs and independently reads back assignments. Eligibility/scheduled deletion is not an exact deletion deadline | Backup success requires the actual backup and service restart/health result; previous success time survives later failure. No project deletion based on an empty time-window UI |
| Synthetic canary artifacts | Foundation packet custodian, private same-host observation-proof archive | Retain failed and passed runs through review/delivery. Retained generations and their exact byte counts, hashes and original locations are recorded in live-canary-evidence-archive.json, independent-health-archive.json and credential-health-archive.json. Raw fixture text is synthetic and private | Copies were hash-compared and synced. They are not off-device backup. Archived successful bundle is deliberately tampered for refusal testing and must not be started |

The journal launch policy is immutable for an existing store. A different maximum,
retention policy, target or hash namespace requires an explicit migration/new owned
store; silently changing a JSON file is not migration. No normal startup, status,
reconcile or population command creates a replacement claim fence.

## Unresolved and refused records

There is no raw-content dead-letter bucket. The local bounded journal/ledger is
the owner of metadata-only pending, accepted-unverified, rejected and unresolved
events. A transport timeout or a missing query result never proves loss and never
authorizes blind resend. Explicit retryable responses use the bounded scheduling
policy; accepted/ambiguous attempts are reconciled by exact backend read-back.
Permanent rejection remains visible in the ledger and health reporting. Failed
requests before local commit have no durable acceptance claim; caller retry and
the pre-intake loss window remain part of the declared route contract.

An explicit payload-expiry decision can remove an unresolved payload after its
configured minimum age, but its disposition records the uncertainty. It cannot
create a visibility fact or pretend to be successful delivery. A later native
retry against expired canonical evidence is refused. Evidence-window retirement
retains bounded aggregate state counts and changes the duplicate-detection horizon;
the exported epoch/history-retired attributes disclose that boundary.

## Identity and old-record compatibility

New native and reconstructed streams have distinct versioned projection and event
identity contracts. Source session, repository/clone/worktree, managed attempt and
event occurrence are separate evidence. Unsupported or unbound identity stays
unknown. The collector checkout never becomes an asserted source for global Codex
inputs. Changing a hash namespace does not silently join old and new identities.

Existing `harness-otel` records without new stream attributes remain a legacy/unknown
population. They are not rewritten to match the new schema or silently excluded
from aggregate interpretation. The held derived exporter remains the named producer
for `beep-agent-effectiveness`; the Ansible health canary explains `default`.
The new dedicated live-canary project has two synthetic records and an explicit
description, with no claim of real agent coverage. No automatic cross-generation
ID merge or historical replay is supplied by this foundation.

## Enrollment and disaster boundaries

Before persistent real-source enrollment, the owner must select and record the
exact private paths, resource/retention limits, independent health observer and
backup destination/rotation for that deployment. A same-host copy cannot establish
failure-domain separation. An independently retained manifest and tested fresh
restore must precede any destructive generation disposal. Until those deployment
facts exist, this packet leaves real-source enrollment disabled and the old
forwarder held; it does not present synthetic backup tests as operational backup.

For a storage incident: pause the owned intake; preserve original stores and
configuration; inspect bounded integrity and exact target identity; reconcile
retained immutable facts without launching a child; restore only to a new
destination with surviving independent launch authority; verify read-back; resume
only the explicitly qualified route. If the launch fence itself is lost or rolled
back, keep launches held. Do not reset it to regain availability.
