/**
 * Recorded act frame entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Derived from flint-ontology
 * (https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology),
 * v1.0.0. Copyright 2022 TNO. Licensed under the Apache License, Version 2.0.
 * See THIRD_PARTY_NOTICES.md.
 *
 * Modified: reimplemented in Effect/TypeScript over Postgres; no upstream
 * source was copied. The donor's act-frame shape is ported and its execution
 * semantics are excluded — this entity is a recorded interpretation, and
 * nothing evaluates, fires, or violates it. A frame's effect on positions is a
 * set of derivation kinds rather than the donor's single act type, and the
 * positions it names are Hohfeldian kind-and-content pairs the donor does not
 * model.
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LegalActContent } from "../../values/LegalActContent/index.ts";
import { SourceNormRef } from "../../values/SourceNormRef/index.ts";
import { ActFramePreconditions, ActFrameSlots, PositionDerivation, PositionTransitions } from "./ActFrame.values.ts";

const $I = $LawPracticeDomainId.create("entities/ActFrame/ActFrame.model");
const ActFrameEntity = ProductEntity.make(LawPractice.ActFrameId);

/**
 * One recorded reading of a norm as an act that moves legal positions.
 *
 * **When to use**
 *
 * Use to record that an interpreter read a source as describing an act: who may
 * do it, what has to hold first, and which positions it brings into being or
 * ends. Exercises of that act point at this frame rather than restating it.
 *
 * **Details**
 *
 * A frame is an interpretation, not the norm. `interpreter` is required for
 * that reason: the record says that this person read those words this way, and
 * every element carries the words it was read from, so one element can be
 * disputed without reopening the rest.
 *
 * `derivationKind` is a set and never a single choice. One act commonly creates
 * and extinguishes at once — an assignment ends the assignor's claim and starts
 * the assignee's — and a three-way field would force the recorder to throw half
 * of that away. `creates` and `terminates` then say which positions, between
 * which slots.
 *
 * Preconditions can require a fact to be **absent**. Norms condition on
 * absences as readily as on presences, and giving absence its own polarity
 * keeps those conditions addressable instead of buried in the wording of the
 * fact.
 *
 * **Gotchas**
 *
 * Nothing here executes. No precondition is evaluated, no transition fires, no
 * position is written by recording a frame, and no violation follows from one.
 * A frame is a description that later records may cite; the acts themselves are
 * separate events, and every determination about them is a person's, recorded
 * as theirs.
 *
 * A frame's slot labels are its own. Nothing checks that a transition's bearer
 * or counterparty names a slot the frame actually declares, so a reader must
 * resolve those labels rather than assume they land.
 *
 * **Example** (Inspect the recorded frame surface)
 *
 * ```ts
 * import { ActFrame } from "@beep/law-practice-domain"
 *
 * console.log(ActFrame.fields.derivationKind !== undefined) // true
 * console.log(ActFrame.fields.terminates !== undefined) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ActFrame extends ActFrameEntity.Entity<ActFrame>(ActFrameEntity.tableName)(
  {
    act: LegalActContent.annotateKey({
      description: "The act this frame describes, carrying its act-or-omission polarity.",
    }).pipe(ActFrameEntity.pg.jsonb()),
    creates: PositionTransitions.annotateKey({
      description: "Positions this act brings into being, each between two of the frame's slots.",
    }).pipe(ActFrameEntity.pg.jsonb()),
    derivationKind: PositionDerivation.annotateKey({
      description: "Ways this act derives positions, as a set because one act may create and extinguish at once.",
    }).pipe(ActFrameEntity.pg.jsonb(), ActFrameEntity.pg.columnName("derivation_kind")),
    interpreter: Principal.annotateKey({
      description: "Principal whose attributed reading of the norm this frame records.",
    }).pipe(ActFrameEntity.pg.jsonb()),
    preconditions: ActFramePreconditions.annotateKey({
      description: "Conditions the frame states, each able to require a fact's presence or its absence.",
    }).pipe(ActFrameEntity.pg.jsonb()),
    slots: ActFrameSlots.annotateKey({
      description: "Named places a party fills when the act is exercised; one of them is the actor.",
    }).pipe(ActFrameEntity.pg.jsonb()),
    sourceNorm: SourceNormRef.annotateKey({
      description: "Opaque reference to the norm this frame is a reading of.",
    }).pipe(ActFrameEntity.pg.jsonb(), ActFrameEntity.pg.columnName("source_norm")),
    terminates: PositionTransitions.annotateKey({
      description: "Positions this act ends, each between two of the frame's slots.",
    }).pipe(ActFrameEntity.pg.jsonb()),
    ...ActFrameEntity.identityFields,
  },
  $I.annote("ActFrame", {
    description: "One recorded reading of a norm as an act that creates, alters, or extinguishes legal positions.",
  }),
  ActFrameEntity.entityExtras
) {}
