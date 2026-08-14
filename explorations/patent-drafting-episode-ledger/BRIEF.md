# Brief — Patent Drafting Episode Ledger

Status: OPERATOR-RATIFIED 2026-08-13.

## Problem

Patent drafting currently has live runtime gates, verified anchors, claims
extraction, and practice-KG read surfaces, but no law-owned product record that
can replay how a draft reached its present state. Retrieval projections can
become stale, support evidence can be mistaken for a legal verdict, and the
runtime's single `pending` approval literal cannot express refusal without
changing a sibling contract.

The wedge needs an append-only `DraftingEpisode` authority that preserves raw
events and makes every derived memory/search view disposable. It must refuse
promotion when limitation support is unresolved while leaving written-
description and new-matter judgment solely with the attorney.

## Appetite

One focused cycle for the first rung: the episode schema/fold,
`ClaimLimitationSupportSet` promotion gate, deterministic retrieval policy
annex, rebuildable projection seam, fixtures, and proof. The public-USPTO
benchmark is a later re-entry, not part of this cycle.

## Solution Sketch

1. Define the full closed drafting-event union now: outline, retrieval, chunk
   generation, limitation support, deterministic validation, bounded retry,
   correction delta, and attorney disposition. Arms without a live producer
   are explicitly `provisional-until-first-emitter` until their first emitter
   proves the payload.
2. Fold the append-only episode into current drafting state. Raw events remain
   authoritative; `MemoryProjection` implementations are lossy, engine-
   agnostic, deletable, and rebuilt from the ledger.
3. Fire the recent-raw fallback if and only if the projection rebuild
   watermark trails the episode head. A delete-and-rebuild drill proves byte-
   identical projection rows and identical retrieval answers; an answer annex
   reports no fallback when none happened.
4. Emit all seven answer-annex policies in rung 1: temporal, membership,
   language, retrieval, rejected-candidate, fallback, and incompleteness.
5. Model `ClaimLimitationSupportSet` per statutory dependency closure: one
   closure for each ordinary dependent-claim path and N closures for a
   multiple-dependent claim. Verified anchors are evidence only. Attorney
   disposition is the sole verdict-bearing record. An unresolved-state
   LiteralKit distinguishes the section 132 objection track from the section
   112(a) rejection track, and new-matter comparison includes omissions from
   the as-filed record.
6. Keep routing fixed with a human override. Learned routing waits for the
   deferred benchmark. Compose promotion refusal law-side using the
   `CandorGateVerdict.isBlocked` fail-closed predicate pattern.

## Rabbit Holes

- Event arms without emitters can fossilize guessed payloads; keep them
  provisional until exercised.
- The first fixture needs a canonical cross-category event ordering before it
  can seed replay tests.
- Practice-KG rows need total deterministic ordering before retrieval claims
  rely on them.
- A verified anchor is neither necessary nor sufficient for written-
  description support; never let a convenience predicate compute the verdict.
- The recent-raw fallback is a repo design, not a literature-prescribed rule;
  keep its trigger exact and testable.
- Durable drafting artifacts are auditable work products, never quality
  proxies.

## No-Gos

- No runtime-vocabulary amendment.
- No computed written-description, implicit-disclosure, terminology-
  equivalence, or new-matter verdict.
- No persistent graph store and no projection as authority.
- No rebuild of weighted RRF, verified-span, practice-KG, or professional-
  runtime sibling contracts.
- No learned routing before the public benchmark gate.
- No client or pre-publication material in remote research/evaluation systems.
