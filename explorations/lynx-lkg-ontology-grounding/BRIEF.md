# Brief — Lynx LKG Ontology Grounding

Status: OPERATOR-RATIFIED 2026-08-13.

## Problem

The repo already has precise `TextAnchor` and `EvidenceSpan` primitives, but
one span cannot carry multiple attributed claims with separate confidence,
annotator/model identity, timestamps, and supersession. Lynx's useful lesson
is this annotation pattern, not its small and internally contradictory
vocabulary. At the same time, schema-to-SHACL generation is not yet allowed by
the semantic-foundation milestone sequence, and multilingual ontology work has
no consumer-backed competency question.

## Appetite

One focused cycle for the attributed multi-claim span seam and its
LangExtract-to-ClaimGate proof. Preserve SHACL generation and language
discipline as explicit gated re-entry points rather than expanding the first
goal.

## Solution Sketch

1. Add a schema-first annotation aggregate over the existing `TextAnchor` and
   `EvidenceSpan` seam. One anchored span may carry multiple claims; each claim
   records attribution, model/version or human principal, confidence, time,
   provenance, and supersession without mutating the source anchor.
2. Exercise it through the current extraction/admission path: LangExtract
   produces attributed claims, the existing ClaimGate evaluates them, and
   accepted/rejected outcomes preserve per-claim evidence.
3. Author a lexicog competency question now for term-level work and compare it
   with the LangExtract-to-ClaimGate loop. Lexicog remains reference-only
   because no license is stated.
4. Keep schema-to-SHACL projection behind semantic-foundation M4. When that
   gate fires, reopen at `decompose` and project only the shipped schema
   contract.
5. Route Lynx `lkg.ttl` through the document-structure packet's FOLIO
   TaxonomySeed machinery after this packet completes artifact-level vetting
   and license verification.

## Rabbit Holes

- A multi-claim container can accidentally duplicate claim authority; it is an
  evidence/annotation record, not a replacement for epistemic claim entities.
- Lynx's OWL, JSON-LD context, SHACL, and prose disagree; none is imported as
  unquestioned truth.
- ELI and lexicog lack stated licenses and remain reference-only.
- Thesaurus alignments require per-artifact license checks when a consumer
  creates real demand.
- Language-map design stays deferred until a multilingual competency question
  and consumer exist.

## No-Gos

- No Lynx vocabulary fork or wholesale TTL/OWL vendoring.
- No schema-to-SHACL generation before M4.
- No multilingual framework in the first goal.
- No persistent graph store, runtime OWL reasoning, second minting authority,
  or legal positions represented as SKOS concepts.
- No patent/IP model inferred from Lynx; research found none.
