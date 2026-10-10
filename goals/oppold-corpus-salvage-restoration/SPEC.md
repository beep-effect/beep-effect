# SPEC — Oppold Corpus Salvage Restoration

Normative contract. Packet anchor document. Repo standards outrank this file
when they conflict. Seeded 2026-08-24 from G1 of the ratified
[parent MAP](../../explorations/oppold-corpus-overhaul/MAP.md). Back-links
carry the source record; this spec does not duplicate the exploration.

## Objective

Close two independently accepted gates:

1. Preserve the current T7 salvage state with a one-pass,
   copy-while-streaming-SHA-256 archive operation, atomic destinations,
   truncate-and-resume-by-hash, a verified destination manifest under the
   corpus home's `raw/t7-salvage-2026-08-10/`, and an inherited-loss opening
   ledger. Archive `oppold-corpus.zip` verbatim as its own object.
2. Complete one bounded transformation wave: restore mail first with a
   source-path libpff `-m all` lane and per-store/child reconciliation, repair
   attachment types and run second-pass extraction, reconcile all three
   recycle volumes, and convert distinct legacy-Word digests while retaining
   originals and measuring declared fidelity dimensions.

The [BRIEF](../../explorations/oppold-corpus-overhaul/BRIEF.md) defines the
problem and appetite. The [MAP](../../explorations/oppold-corpus-overhaul/MAP.md)
defines G1's boundary and re-entry gates.

## Scope

**In**

- P0 preservation tooling and the archive operation, including capacity
  preflight, streaming hashing, atomic promotion,
  truncate-and-resume-by-hash, independent destination-manifest verification,
  and the inherited-loss opening balance.
- A mail-first vertical slice followed by the full mail estate, with raw engine
  output, per-store checkpoints, per-child digests, terminal rows, attachment
  type repair, and second-pass extraction.
- The four-class recycle join across all three volumes, directory-tree
  reconciliation, collision/illegal-character/case handling, and restoration
  mappings.
- Distinct-digest legacy-Word conversion in a pinned sandbox, with originals,
  declared fidelity measures, and an exception lane.

**Out**

- Pipeline re-evaluation, semantic ingestion, enrichment, and practice-kg
  bundle v2. These remain gated candidates in the
  [parent MAP](../../explorations/oppold-corpus-overhaul/MAP.md).
- Multi-firm productization. The parent MAP defers that decision to
  `solo-practice-corpus-kit`.

## Non-goals

These are the parent
[BRIEF no-gos](../../explorations/oppold-corpus-overhaul/BRIEF.md#no-gos)
translated into this packet's boundary:

- Store corpus content or client filenames in this public repo or agent
  evidence. Only aggregate metadata and out-of-repo ledgers are allowed.
- Treat a transformation output as preservation evidence, or start
  transformation before P0 passes.
- Dedupe the retirement copy, prune or delete originals, overwrite the
  governed corpus, or expand the root archive object over the corpus.
- Mutate rules, prompts, schemas, engine selection, or ontology versions
  during a run.
- Treat a warning, silent skip, unresolved ledger row, or exit code alone as
  success.
- Change the live practice-kg v1 front or build bundle v2 in this packet.
- Build a multi-firm corpus product in this cycle.

## Constraints

The parent
[BRIEF rabbit holes](../../explorations/oppold-corpus-overhaul/BRIEF.md#rabbit-holes)
become these binding constraints:

- P0 guarantees no further loss from current T7 state. Bytes or NTFS metadata
  already absent remain in the inherited-loss opening balance. The old-PC
  no-wipe instruction remains in force through verification.
- DOC fidelity is a declared, measured set of dimensions, not a strict
  losslessness claim. Retain originals and route exceptions explicitly.
- Unsupported OCR, CAD, encrypted-container, and long-tail formats receive a
  named process, quarantine, or defer decision. They do not expand G1.
- Do not re-found ontology work or pull a gated semantic candidate into this
  packet.
- Freeze each run's rules, prompts, schemas, engine selection, and versions.
  The P1 run manifest is the freeze record described in the 2026-10-09 decision below.
- Preserve reusable seams without making a productization claim.
- Run at most one full transformation pass in the approximately three-week
  wave. Stop and rescope if disk/time preflight exceeds approved ceilings.
- Keep corpus paths and ledgers outside the repo. Use `~` or relative
  descriptions in durable docs, never a username-bearing absolute path.

## Schema-first design order

Implementation must proceed in this order:

1. Define precise `effect/Schema` models for archive objects, content and
   occurrence identity, derivations, inherited-loss rows, child outcomes,
   warnings/failures, restoration mappings, conversion fidelity, and terminal
   verification states.
2. Derive codecs, guards, tagged-union case handling, and test data from those
   schemas. Persisted rows and external JSON boundaries decode through the
   schemas.
3. Define Effect service contracts around those models.
4. Implement runners and command wiring only after the models and services
   hold the acceptance states.

Pure-data interfaces, parallel hand-written guards, optional-payload status
bags, and native JSON parsing are outside the permitted design.

## Capability inventory

Faithful to G1 in the
[ratified MAP](../../explorations/oppold-corpus-overhaul/MAP.md):

- **Existing:** recycle pairing
  (`packages/tooling/tool/cli/src/commands/Corpus/Corpus.recyclebin.ts` plus
  `buildRestorationRecords` in `internal/ServicePrograms.ts`), corpus
  schemas/commands (`packages/tooling/tool/cli/src/commands/Corpus/`), libpff
  mode vocabulary plus internal path-based subprocess
  (`packages/drivers/libpff/src/Libpff.pffexport.ts`), extraction evidence
  (`packages/drivers/doc-text/`, `packages/drivers/tika/`), and file
  classification (`packages/foundation/capability/file-processing/`).
- **NET-NEW:** streaming file hasher (current helpers are in RAM:
  `FsGuards.ts`, `Sha256.ts`), streaming archive runner with resume-by-hash,
  occurrence/derivation ledgers, public path-based `-m all` runner plus corpus
  wiring, per-store checkpoints and child digests, byte-signature type repair
  plus second pass, directory-`$R` tree reconciliation, and DOC converter plus
  fidelity harness.

The packet inherits both binding predecessor debt ledgers:

- [`goals/oppold-corpus-pipeline`](../oppold-corpus-pipeline/README.md), the
  June extract run and its extraction, unsorted, and recovered-mail debt.
- [`goals/oppold-corpus-refresh`](../oppold-corpus-refresh/README.md), the
  July consolidation and its explicit successor boundary.

## Acceptance criteria

### P0 preservation gate

- [ ] Capacity preflight records an approved ceiling before the archive run.
- [ ] Every current T7 archive object copies once while a streaming SHA-256 is
      computed. No source is fully buffered before redundancy exists.
- [ ] Every archive row carries a pre/post source-stability check (size and
      mtime re-stat around the streaming copy); a source observed changing
      during copy receives a terminal `changed-during-copy` outcome and is
      re-copied from its stable state — its first copy never becomes a PASS
      row.
- [ ] Atomic destinations land under `raw/t7-salvage-2026-08-10/`; an
      existing destination follows the truncate-and-resume-by-hash policy
      instead of failing closed.
- [ ] `oppold-corpus.zip` remains verbatim and separately addressable as its
      own archive object.
- [ ] A fresh process independently reparses the destination manifest and
      verifies every terminal row against destination bytes.
- [ ] Payload files, manifest appends, renames, and their parent directories
      are durably synced (file and directory fsync) before any terminal PASS
      row is written, and a recovery proof (crash/power-cut simulation over
      the copy→verify→PASS boundary) demonstrates that an interrupted run
      resumes without a false PASS.
- [ ] The archive operation extends the out-of-repo `raw/provenance.jsonl`
      ledger through the schema-defined records.
- [ ] The inherited-loss ledger records the collector, missing-pair, stripped
      metadata, and mutated-destination opening classes without claiming
      recovery.
- [ ] Fail-closed checks cover the recorded absent recycle tree, the
      post-staging E-tree mutation class, and row-by-row source-manifest
      reconciliation.
- [ ] Preservation passes independently of every transformation result.

### P1 mail vertical slice

P1 writes under the run root in this location inventory:

| Surface | Location |
| --- | --- |
| Corpus home | `~/data-home/oppold-corpus` |
| P1 run root, relative to corpus home | `staging/restoration/runs/t7-salvage-2026-08-10/**` |
| Run-root children | `ledgers/mail/slice.jsonl`, `output/mail/slice/`, and `writer-claims/` |

- [ ] One metadata-selected non-stub PST occurrence from a recycle surface
      completes end to end through the public source-path runner at concurrency
      one and `-m all`.
- [ ] Raw engine output, per-child SHA-256, child counts, warnings, failures,
      and atomic attempt promotion reconcile to zero unaccounted children.
- [ ] Attachment byte signatures drive type repair and second-pass
      extraction.
- [x] Synthetic fixtures cover corrupt, password, and codepage lanes without
      corpus content.
- [ ] Measured disk/time amplification stays within the approved expansion
      ceiling.

### P4 provenance index

- [x] Every pffexport tree has `messages-<tree>.jsonl` plus a counts-only
      summary; every item directory yields exactly one record.
- [x] Attachment repair proposals come from byte signatures; `apply` journals
      every rename and `undo` restores a synthetic tree byte-for-byte.
- [x] The metadata census covers the named roots with per-file status and a
      counts-only summary.
- [x] `beep corpus provenance` is covered by package tests on synthetic
      fixtures only.

### P2 transformation wave

- [ ] The full mail estate closes store by store with terminal store and child
      rows; non-PST mail families have explicit process/quarantine/defer
      decisions.
- [ ] All three recycle volumes complete the four-class join, directory-tree
      reconciliation, path policy, and mapping-ledger checks.
- [ ] Every distinct legacy-Word digest is converted or reaches a terminal
      exception row; originals remain addressable and fidelity is reported by
      the declared dimensions.
- [ ] The wave performs no more than one full transformation run.

### P3 close

- [ ] Preservation and each transformation family have separate reconciled
      acceptance records with no unapproved terminal rows.
- [ ] Closeout evidence includes aggregate counts, verification results,
      disk/time measurements, and exceptions, never corpus content or client
      filenames.
- [ ] A `/reflect` closeout exists and
      `bun run beep lint reflection-artifacts` passes.
- [ ] The final work is driven through Yeet to a mergeable PR; the reflection,
      reconciled ledgers, and packet-state flip land in that same PR.

## Verification matrix

- Packet launcher: `wc -m` reports at most 4,000 characters for `GOAL.md`.
- Manifest: `jq . goals/oppold-corpus-salvage-restoration/ops/manifest.json`
  passes.
- Packet health: `bun run beep goals doctor` introduces no blocking finding.
- Schema law: `bun run beep lint schema-first` passes for changed schema
  surfaces.
- P0: an independent destination-manifest reparse and full verification report
  returns PASS with zero unapproved terminal rows.
- P1: store/child reconciliation reports zero unaccounted children and an
  approved disk/time ceiling.
- P2: mail, recycle, and DOC family ledgers assign every source one terminal
  outcome.
- Close: `bun run beep yeet monitor` reports `merge-ready: yes`.
- Reflection: `bun run beep lint reflection-artifacts` passes.

## Stop conditions

- P0 records any unapproved terminal ledger row.
- P1 records any unaccounted child.
- Capacity or transformation preflight exceeds the approved disk/time ceiling.
- A runner would overwrite, prune, dedupe, or delete an original.
- Passing requires a gated parent-MAP candidate or a change to the live v1
  front.
- Required source facts are missing or materially contradictory.

## Decision log

### 2026-08-17: restoration bar v2

One-pass copy-while-hashing, honest inherited loss, three-volume recycle
reconciliation, fail-closed verification, a separate root archive object, and
independent preservation/transformation gates are binding.

Source:
[`DECISIONS.md`](../../explorations/oppold-corpus-overhaul/DECISIONS.md).

### 2026-08-17: scope discipline

Both predecessor debts bind this goal. Mail leads through source-path
`-m all`, and DOC conversion is a measured net-new subsystem.

Source:
[`DECISIONS.md`](../../explorations/oppold-corpus-overhaul/DECISIONS.md).

### 2026-08-24: graduation shape, timing, archive home, and appetite

G1 is the only promised-now goal. P0 runs this week into the declared archive
home and extends the provenance ledger, followed by one approximately
three-week transformation wave.

Source:
[`DECISIONS.md`](../../explorations/oppold-corpus-overhaul/DECISIONS.md).

### 2026-08-24: four stop conditions

The ratified bounds on pipeline re-evaluation, capability incorporation,
immutable-run improvement, and closed-register enrichment keep G2-G4 outside
G1.

Source:
[`DECISIONS.md`](../../explorations/oppold-corpus-overhaul/DECISIONS.md).

### 2026-08-24: MAP and graduation ceremony

The candidate set and docs-only ceremony are ratified. Ordinary provider
configuration adds no new policy gate.

Source:
[`DECISIONS.md`](../../explorations/oppold-corpus-overhaul/DECISIONS.md).

### 2026-10-06: P0 source mutated after the approved preflight

The 2026-08-27 run (runId `t7-salvage-2026-08-10:1787848829400:0`) stalled at
a 90.25 GB root-archive partial when its writer process died. On resume the
source tree measured 10,695 files / 200,874,564,858 bytes / 755 directories
against the approved 12,157 / 207,772,579,526 / 755. 1,818 collector
destinations (5,026,517,567 bytes; by type .jpg 1,242, .download 192, .png
130, .txt 91, no-extension 48, .mp4 32; by tree f-recyclebin-E 1,043,
b-profile 652, f-recyclebin-C 114, e-onedrive 9) were deleted from the drive
on 2026-09-09, 09-14 and 09-23. The operator confirmed removing them
deliberately ("less than desirable things"). Ruling: record them as a new
inherited-loss class `operator-deleted-noise`, attempt no recovery, and do not
surface any S4 copies in the practice corpus. Collector reconciliation now
observes 19,370 present successful rows (was 21,489) and 3,140 mutated
destinations (was 1,021); `restore-preserve` gained
`--expected-collector-present-rows` because that denominator had only a
schema default. The new class is a fifth, optional inherited-loss category
(`--expected-operator-deleted-destinations`); for the already-running resume
it is recorded beside the main ledger in
`raw/t7-salvage-2026-08-10/inherited-loss-amendments.jsonl` under the same
schema and runId, and the verifier now checks the four ratified classes by
name instead of a row count. Reversal: none needed; the ledger keeps both
runs.

### 2026-10-06: free-space floor lowered for the resumed run

The approved 1.8 TB `minimum-free-after-bytes` floor was set when 2.37 TB was
free. With 1,009 GB free and about 265 GB left to archive, the resumed run
uses a 600 GB floor and the unchanged 400 GB capacity ceiling. Reversal:
re-run preflight with the original floor once disk is reclaimed.

### 2026-10-06: P4 provenance index added

The salvage coverage audit found no normalized header index, the attachment
extension repair proposed but unapplied (115,402 rows for the base tree,
none for the refresh tree's ~185K clipped files), and no document or
attachment metadata census. P4 adds them as `beep corpus provenance`
tooling with schemas and service contracts first. The attachment repair is
reversible through its journal. Reversal: `beep corpus provenance attachments
--mode undo --journal <path>`.

### 2026-10-06: backslash is a name byte in provenance paths

The first attachment-repair apply stopped after 375 renames on a proposal
whose name kept a Windows backslash: pffexport writes Outlook attachment
display names verbatim, and the refresh tree alone holds 793 such rename
proposals. Two defects compounded: the unsafe-name guard rejected `\`
alongside `/` and NUL, and the relative-path helper rewrote `\` to `/`
(a `PosixPath` convention), so every such row pointed at a nested path that
does not exist. Ruling: provenance rows use `CorpusRelativePath`, which is
`/`-separated, traversal-safe and keeps the backslash byte; the guard rejects
only `/` and NUL. The orphaned journal of the aborted run stays valid undo
input for its 375 renames. Reversal: `--mode undo` on each journal in reverse
order of their run ids.

### 2026-10-09: retain Tika text within the remaining attempt budget

The RAM-only probe ran 59 repair candidates: 43 produced more than 4,096 characters,
the maximum was 1,578,537, and none exited nonzero or produced empty text. The previous
capture bound would fail this selected slice despite available output capacity. Reuse
`OutputBound` with the remaining attempt budget after hashing retained output and checking
free space; reserve the final newline and validate UTF-8 bytes before persistence. Keep the
full content-addressed text and fail closed on truncation or exhausted capacity. Existing
process and filesystem service contracts remain sufficient. Synthetic tests prove full
8,192-character capture and rejection above the remaining budget. The extra capture check
adds one tree hash per candidate; the sizing margin covers it. Reversal: revert the CLI edit;
no slice ledger exists at this decision.

### 2026-10-09: escape backslash names at the libpff boundary

The probe found one backslash-bearing file, zero such directories, zero escape collisions,
and zero pre-existing `%5C` names. The escape is unambiguous on this store. A named internal
schema transforms each engine name component to `PosixPath` by replacing only `\` with
`%5C`. After quota handoff and before walking children, rename entries inside the driver's
export trees; refuse collisions with the existing non-portable-path warning and overwrite
nothing. Carry original attachment names into synthesized EML, with MIME quoted-string
escaping. Canonical checks resolve each checked ancestor while retaining backslash components,
including the raw quota handoff, because Bun's realpath treats that byte specially. Keep the shared path and restoration row
schemas unchanged. Synthetic tests cover escaped files and folders, reference/disk agreement,
EML display names, and preservation of both entries on collision. Reversal: revert the libpff
edit; no slice ledger exists yet. The release-note decision below supersedes the patch changeset.

### 2026-10-09: private-workspace release notes without changesets

`@beep/libpff` and `@beep/repo-cli` are private workspaces. Main #1566 and the brief's
2026-10-09T20:33Z standing ruling forbid changesets naming private workspaces, superseding R3.
Remove the unpublished libpff patch changeset and record both bounded fixes in the handoff's
"Release notes without changesets" table. These fixes require no major release: existing portable
paths and public schemas retain their contracts; escaping previously rejected names and retaining
budget-bounded text correct unsupported-input behavior. Widening the public path schemas would
have changed their contract, and was rejected. Reversal: revert the implementation and this
release-note decision together; preserve the append-only handoff as evidence.

### 2026-10-09: P1 slice ceilings, sizing probe, and invocation

The raw-only priors (0.98x and 0.77x with pffexport 20260608) exclude synthesized EML,
all-item body formats, orphan/recovered output, repair copies, and Tika text. The RAM-only
probe measured I = 56,140,800 input bytes, R = 46,317,339 raw output bytes (2,630 files),
D = 19,659,481 repair-copy bytes, T = 5,252,872 Tika bytes, and 607 items. Orphan and
recovered trees contained zero files/bytes. There were 3,399 entries, zero existing EML
collisions, 206 attachments / 41,580,376 bytes, 147 unsupported, zero unchanged, and 59
repair candidates. All 59 Tika invocations succeeded with nonempty output. Probe counts
and script digest are retained in the handoff.

O = R + 1.37R + 4,096 × items + D + T = 137,170,718.43 bytes.
Freeze `--max-amplification-ratio 4` = max(4, ceil(1.5O/I)); the attempt ceiling is
224,563,200 bytes. Probe durations were pffexport 583 ms, Tika 894,687 ms, and one
full tree hash 35 ms. The elapsed expression is
3 × (583 + 894,687 + 2 × 59 × 35) + 600,000 = 3,298,200 ms;
freeze `--max-elapsed-millis 7200000` = max(7,200,000, that expression).
Freeze `--max-total-output-bytes 2147483648` = max(2,147,483,648,
ceil(2.5 × 56,140,800 × 4)) = max(2,147,483,648, 561,408,000).
Freeze `--max-total-elapsed-millis 43200000` = max(43,200,000, 3 × 7,200,000).
These total caps allow one retained interruption plus retry; the family clock includes queue
wait and re-verification on a retry. Require at least 100,000,000,000 bytes free on every
launch as well as the tool's output-capacity checks. Measured pre-probe free space was
471,790,534,656 bytes; remeasure immediately before launch.

Fixed invocation inventory:

| Flag | Frozen value |
| --- | --- |
| `--scope` | `slice` |
| `--expected-stores` | `1` |
| `--run-label` | `t7-salvage-2026-08-10` |
| `--corpus-root` | `~/data-home/oppold-corpus` |
| `--pffexport` | `/usr/bin/pffexport` |
| `--bwrap` | `/usr/bin/bwrap` |
| `--java` | `/usr/bin/java` |
| `--tika-jar` | `~/.local/share/tika/tika-app-3.3.1.jar` |

The persisted policy freezes these
engine paths, scope, denominator, and ceilings at `family-run-start`; changes are refused.
The engine freeze values are pffexport 20260917, bubblewrap 0.13.0,
`openjdk version "27" 2026-09-15`, Java real path
`/usr/lib/jvm/java-27-openjdk/bin/java`, and Tika jar SHA-256
`0e8ee9795ac4244feab466f4a5a9c3b94675af392848243842cb6e1e69d27103` (Apache Tika 3.3.1).
Reversal: revert this docs decision; retain the append-only ledger and output as evidence.
P2/P3 remain outside this lane.

### 2026-10-09: the P1 run manifest is the freeze record

`transformationPolicySha256` hashes engine paths, scope, expected stores, and four ceilings,
not engine versions. `history/evidence/p1-slice-run-manifest.json`, written before launch,
therefore records Java version and real path, Tika jar digest, pffexport and bubblewrap
versions beside the policy digest, launch-script digest, ceilings, selected object digest,
and code head. Fill the policy digest once the first start row exists, then never change
the manifest. A version mismatch on any relaunch is a stop. Only main's merged code may
write the immutable ledger. Reversal: revert the docs decision, retaining the manifest as evidence.

### 2026-10-09: P1 output path

Designate the P1 location inventory above as the write authority for
`staging/restoration/runs/t7-salvage-2026-08-10/**` under corpus home:
`ledgers/mail/slice.jsonl`, `output/mail/slice/`, and `writer-claims/`.
Only `restore-mail` writes those surfaces. Accept its built-in re-verification's conditional
content-addressed report write to `raw/t7-salvage-2026-08-10/verification/<sha256>.jsonl`:
a byte-identical report already exists for the unchanged sealed archive, so a new report
would indicate changed verification evidence. The lane's other external write inventory is:

| Surface | Root | Allowed contents |
| --- | --- | --- |
| Private logs, relative to corpus home | `logs/corpus-restore/` | Tool stdout/stderr; read counts only |
| Scratch | `~/.cache/beep/corpus-restore/` | Scripts, numeric probe counts, start stamps, and exit codes only |

Never print private log lines or corpus paths/content. Reversal: deletion of the run directory
wholesale is an orchestrator decision; this lane never deletes it.

## Exception ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |

### 2026-10-09: P1 launch held at the inherited publication gate

The bounded fixes, RAM probe, ceilings, freeze-record design, and output authority are retained.
Both full package verifications and the corrected local hosted-parity set passed; restoration
coverage is 100% in every metric. PR1 publication at `e28c05e497` failed before push: 15 of 16
cheap gates passed, and schema-first alone failed on five untracked entries inherited from main
(two Accounts candidates and three unrelated test advisories). All affected files and their
inventory are unchanged by this lane. Do not widen ownership or edit an inventory baseline here;
the orchestrator owns the consolidated main repair. No slice ledger, live launch, or PR exists.
P1 stays pending, lifecycle active, P2/P3 pending. Resume by merging the main repair and publishing
PR1 under R2, then complete its published-head proof and final-file gate before writing the run
manifest or launching. Reversal: revert the bounded local fixes and packet decisions; there is no
live output to reverse, and the append-only handoff remains evidence.

### 2026-10-09: PR1 inherited-fence publication fallback

The orchestrator run-2 ruling authorizes direct push and PR creation after the
canonical publisher refused only five inherited schema inventory entries. Their
source surfaces match main; introduced findings were repaired and scoped proof
passes. PR1 retains the heavy label, readiness monitor, review handling, and exact
head final-file gate. The orchestrator owns inherited hosted reds and the merge.
The frozen manifest and live slice wait for its merged report. Reversal: close the
unmerged PR and revert the bounded changes before any live run.

The worker started the required forty-minute bounded Yeet monitor, observed hosted
check transitions and acknowledged the three deployment rate-limit failures, then
stopped that local monitor at the run-2 handoff boundary. The final-file gate takes
over under S11; no hosted-green or merge-ready verdict is claimed. This avoids an
unowned running job after worker exit. Reversal: resubmit the same bounded monitor.


### 2026-10-09: P1 live slice sealed with an unapproved engine failure

PR1 #1596 merged the two probe-proven fixes before the immutable start. The fresh
prerequisites passed, and the frozen manifest records the exact invocation, engine
versions, code head, script digest, and policy digest. The slice ran once and exited 1:
zero store passes, one unapproved `engine-failure` exception, zero warning rows,
33 attachment dispositions (11 repaired, 22 unsupported, zero unchanged), and zero
terminal child rows. Its final row is `family-acceptance-failure`, with expected and
terminal count one and unapproved count one. Completed child reconciliation and
repair/Tika child acceptance are unproven; leave those boxes unticked.

The selected input was 56,140,800 bytes; retained output and family disk usage were
115,418,004 bytes, or 2.055866749x. Family elapsed was 350,398 ms; re-verification was
282,677 ms, and queue wait approximately 204 ms. No PASS attempt duration exists;
the attempt-start to exception interval was 349,607 ms. Retained disk and family time
are below the frozen ceilings, but do not establish a passing slice. Free bytes were
440,721,391,616 immediately before launch and 442,226,008,064 after it.

The four fresh synthetic exception/accounting/resume tests passed. Only that P1 box
is supported. P1 remains in-progress; P0/P4 complete, P2/P3 pending, lifecycle active.
Do not retry a sealed family or change the selection. Any fresh-ledger route belongs
to the orchestrator. Reversal: the R7 whole-run removal authority remains with the
orchestrator; this lane retains all output and ledger evidence without mutation.
Ledger SHA-256: `efb4b558c2d1680f87a684a69d6aa021653234d12928aa9f27a6943de8970e9f`.

### 2026-10-09: publish the sealed-failure evidence under the inherited fence

The docs-only evidence wave passed fourteen of sixteen cheap gates. Schema-first
and Effect-Vitest inventory findings are inherited in surfaces matching main;
no package source changed. Apply the brief's inherited publication-fence ruling:
direct push and PR creation with the heavy label, Yeet ready, and bounded monitoring.
The orchestrator owns consolidated reds under S11. Reversal: close the evidence
PR, retaining the immutable failed run and its frozen manifest.
