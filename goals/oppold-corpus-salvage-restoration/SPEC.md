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
- [ ] Atomic destinations land under `raw/t7-salvage-2026-08-10/`; an
      existing destination follows the truncate-and-resume-by-hash policy
      instead of failing closed.
- [ ] `oppold-corpus.zip` remains verbatim and separately addressable as its
      own archive object.
- [ ] A fresh process independently reparses the destination manifest and
      verifies every terminal row against destination bytes.
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

- [ ] One metadata-selected non-stub PST occurrence from a recycle surface
      completes end to end through the public source-path runner at concurrency
      one and `-m all`.
- [ ] Raw engine output, per-child SHA-256, child counts, warnings, failures,
      and atomic attempt promotion reconcile to zero unaccounted children.
- [ ] Attachment byte signatures drive type repair and second-pass
      extraction.
- [ ] Synthetic fixtures cover corrupt, password, and codepage lanes without
      corpus content.
- [ ] Measured disk/time amplification stays within the approved expansion
      ceiling.

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

## Exception ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
