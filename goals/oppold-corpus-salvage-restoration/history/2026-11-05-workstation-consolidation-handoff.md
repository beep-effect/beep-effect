# Workstation corpus consolidation: resumption handoff

Recorded 2026-11-05 local time; operational checkpoint observed on
2026-11-06 UTC. This is a dated handoff, not a live status feed or a change to
the packet's acceptance criteria. Refresh the private receipts before acting.

## Read this before resuming

The operator authorized a separate workstation space-reclamation and corpus
consolidation effort. Its requested end state is an active corpus plus one
complete external recovery copy. That end state is still being verified.
This note records changes relevant to these packets; it does not restart or
complete any Beep goal.

Keep these proof boundaries separate:

| Surface | Established at this checkpoint | Still required |
| --- | --- | --- |
| Existing encrypted recovery baseline | Upload, full stored-data check, independent recovery-key representatives for all four source aliases, archive occurrence coverage and additional original-container/application-state recovery checks passed. | A fresh capture and binding for a new backup of changed live sources. |
| Exact-copy retirement | Approved legacy payloads and temporary copies were rehashed against retained keepers; mappings and retirement journals were preserved and recovery-tested. | Fresh identity, byte, consumer and recovery checks for every additional removal. |
| Additional native mail extraction | All 33 selected inputs transferred with full SHA-256 verification; a separate bounded worker run is in progress. | Terminal coverage, exception reconciliation, new-output upload and recovery verification. |
| This packet's P2/P3 gates | Historical accepted and failed families, manifests and frozen execution rules remain retained. | Mail store/child acceptance, attachment repair/fidelity, recycle and legacy-Word reconciliation, and closeout under SPEC. |
| Downstream practice KG / mailbox operations | No bundle rebuild, ingestion promotion, mailbox import or live tagging change was made by this cleanup. | Each consumer's own governed source, reconciliation and rollout checks. |

## What changed on storage

- The active corpus was retained. In the legacy archive, 8,333 exact duplicate
  payload files were replaced with relative links to retained active keepers.
  Original empty files/directories and logical occurrence paths were retained;
  all replacement links resolved in the retirement check. Original archive
  bytes and metadata remain in the verified encrypted baseline.
- Twenty-nine temporary staged mail-container copies were removed only after
  independent full-hash matches against retained active keepers. These were
  temporary copies, not retirement of the original unique containers.
- The exact task-owned read-only home capture was retired after recovery and
  identity checks. Its old paths still name objects **inside the saved
  snapshot**; they are not reusable live input paths or a fresh capture.
- Retirement mappings/journals were uploaded separately and fully restored
  with the independent recovery key. Do not infer lineage from link targets
  alone: retain and consult the occurrence and retirement records.
- The current pass made no new removals on external removable media. Historical
  drive availability and successful older hashes are not present-day mount or
  recovery proof. Resolve the actual mounted device and current keeper first.

## New extraction is a separate evidence family

A fresh signature/hash inventory found 62 distinct PFF containers. Existing
successful extraction ledgers match 29 distinct inputs; the remaining 33 inputs
total 122,511,153,152 bytes. An earlier preliminary count of 58 omitted four
previously un-hashed inputs and is superseded by the completed hash inventory.
These are distinct container-byte identities, not a count of unique messages.

All 33 selected inputs have reached the worker and passed full-hash acceptance.
The observed checkpoint had 23 terminal containers: 20 engine passes and three
exceptions, with 323,714 indexed file occurrences. This partial count is not an
estate-wide extraction result or a percentage of recovered mail.

The new run uses a pinned portable libpff build in an isolated native sandbox:
read-only accepted inputs, separate output, no network, bounded CPU/memory/time
and free-space/growth ceilings. It does not overwrite or retry the sealed
October restoration attempts. Native warnings produce exception records even
when the engine exits zero. All original containers and exception output remain
retained. The content index preserves each file occurrence, relative path,
digest, mode and timestamp, plus empty directories.

This native output is **not** a new accepted `beep corpus restore` family:
it has not passed the frozen source-identity, store/child, attachment repair,
second-pass extraction and fidelity gates in this packet. Match by source digest
and derivation/occurrence records before proposing any adoption. Never infer
semantic message equality from identical filenames, file sizes or an engine pass.

### SSD continuation and infrastructure failures

After 25 original worker stores were terminal, the operator's cleanup lane
moved future output/indexing to the worker's SSD. Accepted input inodes and
completed output remain on their original disk. The continuation validates the
prior source root, its filesystem identity and unchanged extraction policy,
then passes those original inputs directly into the existing native sandbox.
Imported terminal records must match the retained prior receipts; new output
uses a separate SSD scratch. Resolve the current private job identities rather
than restarting the older unit.

An initial nested mount-view attempt passed input identity checks but the inner
native sandbox could not create its namespace. Its eight infrastructure launch
failures, and the interrupted original partial attempt, are retained separately.
They are not recovered mail or a new acceptance result. The waiting publisher
was stopped before upload. The corrected continuation passed a real native
sandbox/version probe and a sandboxed input hash probe without weakening kernel
permissions. Startup now stops on a sandbox preflight failure before sweeping
inputs. Publication includes the retained attempts as well as old and new
output, and independent recovery samples cover each selected archive source.

## Recovery archive and current jobs

The operator's external recovery archive is a dedicated compressed, encrypted
Restic repository. The existing verified baseline remains retained. A queued
publication job waits for the exact new extraction invocation to finish, then
uploads only sealed outputs and a consistent occurrence catalog into that same
repository. Its recovery-set manifest binds the retained baseline and new
results snapshot; native chunk deduplication avoids storing matching payload
chunks again. It does not create a standalone ZIP or claim semantic mail dedupe.

Publication must verify repository identity, all terminal source bindings,
independent recovery-key sample restores with matching hashes, and a full
stored-data read check. At this checkpoint it is **waiting**, not uploaded or
verified. No new source retirement is triggered automatically by upload.

Exact unit names/invocations, repository/snapshot identities, mount UUIDs,
credential references and raw engine logs stay in private operator records.
The public packet contains only aggregate findings. Do not copy private
manifests, original filenames, correspondence, item references or logs here.

The separate workstation operations repository, `dankstation-ops`, owns:

- `changes/chg-corpus-retirement-20261105.md`: applied copy/capture retirement
  and recovery proof.
- `changes/chg-corpus-content-deduplication-20261105.md`: current worker,
  publication, health and verification checkpoint.
- `handoffs/hnd-storage-reclamation-20261102.md`: exact job ownership and next
  action.
- `procedures/prc-corpus-backup.md`: source/capture/recovery requirements.

Those are private local records, not files shipped by this public repository.
Resolve their locators through the operator's workstation context. If unavailable,
report that gap and retain data; do not invent job or repository identities.

## Resume sequence

1. Read this handoff, the current private operations handoff and the packet
   SPEC/PLAN. Re-establish live source aliases, mounts, symlinks, consumer
   ownership, capacity and recovery bindings. Count physical keepers separately
   from logical occurrences; the legacy link tree is not another independent
   payload collection.
2. Inspect the already-owned extraction/publication units and bound receipts.
   A running job is pending, not failed. A completed pilot is not full-family
   coverage. Successful `active/exited` state can be terminal for a unit with
   `RemainAfterExit`; `active/running` cannot. Never start a duplicate worker
   because an SSH session ended or a progress file is temporarily stale.
3. Preserve October's sealed failed and accepted families. The retained
   recovery-ordinal-5 failure and frozen-source mismatch still govern the
   old recovery launchers; this cleanup supplies no override or third attempt.
   Resolve the old execution-identity question before any permitted new run.
4. Reconcile new output by container digest and occurrence into the governed
   ledgers, account for every exception, and apply the packet's fidelity and
   acceptance checks. Keep prior unsupported/failed outcomes visible. File
   payload dedupe does not establish equivalent Outlook metadata or messages.
5. Verify the complete recovery set before reviewing the next exact-copy
   removal. Use a fresh immutable capture for changed live application data;
   do not recreate the retired capture identity or silently widen source scope.
6. Only then consider downstream ingestion, KG bundle rebuild or mailbox import
   through its owning packet. This note grants no deployment or mailbox-write
   authority. Keep this packet active until its own P2/P3 gates close.

## Local extent-sharing hold

Workstation Btrfs device statistics showed a corruption counter of eight,
matching an older unresolved record. The owned extent-sharing job was stopped
while still doing read-only prehash, before native corpus deduplication.
No corpus extent-sharing mutation, repair or counter reset occurred. Review
current filesystem health with the operations incident before resuming that
mutation. Work on the separate extraction worker can continue independently.
Directory sizes of historical recovery roots do not establish exclusive reclaim
or authority to delete them.

## Packet-specific interpretation

- **Salvage restoration:** P0/P1 historical acceptance remains historical proof;
  the new encrypted baseline supplements recovery but does not close P2/P3 or
  resolve frozen-source identity. Do not re-run completed preservation or
  sealed attempts as a cleanup shortcut.
- **Refresh and pipeline:** their `completed-retained` lifecycle still describes
  the work completed in their original scope. Historical archive-move paths can
  now resolve through retained links. Their old launchers are not instructions
  to repeat salvage, move or extraction against changed sources.
- **Practice mail backfill:** the raw-original-PST lane remains independent of
  this extraction effort. Resolve current original keepers and make a fresh
  private size/nesting/import inventory; this work supplies no licensing,
  Purview-upload, import or tranche acceptance evidence.
- **Practice KG and professional runtime:** keep the deployed v1 front and
  existing bundle identities. Backup success and new native output do not
  establish ingestion, semantic trust, corpus-v2 or runtime acceptance.
