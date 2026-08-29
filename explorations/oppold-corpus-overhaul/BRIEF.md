# Brief

## Problem

The practice's old workstation was mined onto a removable T7 drive
(`oppold-salvage-2026-08-10`, ~193.5 GiB / 12,156 files, plus a 137.6 GiB
`oppold-corpus.zip` at drive root) that post-dates both the June pipeline run
(`goals/oppold-corpus-pipeline`) and the July refresh
(`goals/oppold-corpus-refresh`) — so the governed corpus and its
knowledge-graph projection are missing the newest evidence set, and the only
consolidated copy sits on removable media. The corrected census
([`research/2026-08-17-restoration-census.md`](./research/2026-08-17-restoration-census.md))
shows loss risk concentrating in a 112 GB mail estate (53 PST stores, 46 of
them inside a raw recycle tree) and three recycle-bin volumes needing
`$I`/`$R` re-pairing.

The live tooling cannot meet the ratified restoration bar
([`DECISIONS.md`](./DECISIONS.md), bar v2): `corpus salvage` hashes whole
sources in RAM before copying (impossible for the 47.58 GiB PST), the libpff
driver's public surface takes bytes rather than paths and current corpus
wiring defaults to `-m items` (recovered mail is never selected), result
ledgers are not crash-safe, and attachment type repair plus binary-Word
conversion do not exist. Preservation must land first, a mail-first
transformation slice second, and only then a bounded, versioned pipeline run
that emits the v2 projection — without disturbing the live practice-kg v1
front.

## Appetite

Split (ratified 2026-08-24):

- **Preservation gate: this week, no negotiation.** One-pass
  copy-while-hashing of current T7 state to the durable archive, verified.
- **Transformation gates: one ~3-week wave** — mail estate, recycle
  re-pairing across all three volumes, legacy Word conversion — with at most
  one full transformation run inside the wave. Stop and rescope if
  preservation has any unapproved terminal ledger row, the mail slice has any
  unaccounted child, or preflight exceeds approved disk/time ceilings.
- **No implementation appetite now** for pipeline re-eval, semantic
  ingestion, enrichment, or bundle v2 — those are gated MAP candidates with
  ratified stop conditions.

## Solution Sketch

Promised-now (G1, `goals/oppold-corpus-salvage-restoration`):

1. **Preserve (P0).** Archive-object and loss-ledger schemas first; capacity
   preflight; one-pass copy-while-hashing (streaming SHA-256) into atomic
   destinations under the corpus home's `raw/t7-salvage-2026-08-10/`;
   truncate-and-resume by hash; independent destination-manifest reparse and
   verification before any transformation. `oppold-corpus.zip` is archived
   verbatim as its own object. The collector's 5,986 errors, 13
   missing-`$R`, exFAT-stripped NTFS metadata, and 1,021 mutated E-tree
   dests open the inherited-loss ledger (bar v2's honest loss universe).
2. **Model.** Immutable content / occurrence / derivation records: digests
   dedupe storage but never collapse volume identity, original path,
   deletion event, container ancestry, or restoration mapping.
3. **Mail-first transformation.** Prove one non-stub PST occurrence
   end-to-end — source-path pffexport, `-m all`, per-child digests,
   append-only child/warning/failure rows, atomic attempt promotion, type
   repair, second-pass extraction — then expand store-by-store across the
   53-store estate. Recycle re-pairing runs the four-class join over all
   three volumes with directory-tree reconciliation and the
   collision/illegal-character/case policy. Non-PST mail families (OST, MSG,
   EML, prior-export residue) each get an explicit process/quarantine/defer
   decision.
4. **Convert.** Format-validate distinct legacy-Word digests (564 paths,
   likely ~half distinct), convert in a pinned sandbox, compare declared
   fidelity dimensions, retain originals, quarantine exceptions.

Gated (each reopens this exploration at decompose; stop conditions in
[`DECISIONS.md`](./DECISIONS.md) 2026-08-24): the versioned
`keep|replace|add|defer` decision-matrix pipeline re-eval (G2), T-Box-guided
semantic ingestion composing version-pinned ready slices of
`goals/semantic-foundation` / `goals/patent-document-schema` /
`goals/folio-lynx-taxonomy-browse` (G3), closed-register enrichment (G4),
then practice-kg **bundle v2** — which must beat the recorded v1 defects
(AC-2 graph provenance, family contamination) rather than merely re-run.

## Rabbit Holes

- Recovering bytes already absent from current T7 state, or reconstructing
  lost NTFS metadata. Carry them in the inherited-loss ledger; keep the
  old-PC no-wipe instruction; never let forensic recovery block
  current-state preservation.
- Perfect or universal DOC fidelity. Declared, measurable dimensions and an
  exception lane; never claim strict losslessness.
- Universal OCR / CAD / encrypted-container / every-format support. Each
  matrix cell gets one decision; unsupported families defer to named
  re-entry packets.
- Re-founding the ontology or waiting on every semantic sibling. Compose
  version-pinned ready slices only; gated inputs stay gated.
- Improving rules mid-run, or surveying enrichment without a closed
  register. Both destroy reproducibility and the stop conditions.
- Productizing a multi-tenant corpus kit for other firms inside this cycle.
  Preserve reusable seams; the product claim defers to
  `solo-practice-corpus-kit`.

## No-Gos

- No corpus content or new corpus filenames in the repo or in agent
  evidence — this repo is public; aggregate metadata and out-of-repo ledgers
  only.
- No transformation before preservation PASS, and no transformation result
  may satisfy the preservation gate.
- No dedupe on the retirement copy, no destructive prune, no original
  deletion, no overwrite of the governed corpus, never unzip
  `oppold-corpus.zip` over the corpus.
- No same-run mutation of rules, prompts, schemas, engine selection, or
  ontology version.
- No silent skip, warning-only loss, unresolved ledger row, or "success"
  based on process exit zero alone.
- No changes to the live practice-kg v1 front from this packet; bundle v2 is
  a gated, replace-as-a-unit deliverable.
- No multi-firm productization in this cycle (deferred to
  `solo-practice-corpus-kit`).
