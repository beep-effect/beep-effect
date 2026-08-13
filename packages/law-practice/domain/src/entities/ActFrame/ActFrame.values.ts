/**
 * Concept-local value objects for recorded act frames.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

/**
 * Derived from flint-ontology
 * (https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology),
 * v1.0.0. Copyright 2022 TNO. Licensed under the Apache License, Version 2.0.
 * See THIRD_PARTY_NOTICES.md.
 *
 * Modified: reimplemented in Effect/TypeScript; no upstream source was copied.
 * The donor's act-frame shape — named slots, preconditions, and the
 * creates/terminates pair, each element carrying its own source reference — is
 * ported. The donor's execution semantics are excluded: nothing here evaluates
 * a precondition, fires a transition, or derives a violation. Positions are
 * this project's own Hohfeldian pairs rather than the donor's fact and duty
 * types, and preconditions carry an explicit absence polarity the donor
 * expresses in its own formula language.
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { HashSet as StoredHashSet } from "@beep/schema/HashSet";
import { HashSet } from "effect";
import * as S from "effect/Schema";
import { ActFrameElementLabel } from "../../values/ActFrameElementRef/index.ts";
import { HohfeldPosition } from "../../values/HohfeldPosition/index.ts";
import { NormSourceReference } from "../../values/NormSourceReference/index.ts";
import { hasActorSlot, hasDistinctLabels } from "./ActFrame.behavior.ts";

const $I = $LawPracticeDomainId.create("entities/ActFrame/ActFrame.values");

const ActFrameSlotKindBase = LiteralKit(["actor", "object", "recipient"]);
const OperativeFactPolarityBase = LiteralKit(["present", "absent"]);
const PositionDerivationKindBase = LiteralKit(["create", "alter", "extinguish"]);

/**
 * Which structural place in an act frame a slot occupies.
 *
 * **Details**
 *
 * `actor` is who does the act, `object` is what it is done to, and `recipient`
 * is who it is done toward. The three are the frame's grammar, not a claim
 * about anyone's authority: naming a party in the actor slot records who is
 * said to have acted and nothing about whether they could.
 *
 * **Example** (Narrow a slot kind)
 *
 * ```ts
 * import { ActFrameSlotKind } from "@beep/law-practice-domain"
 *
 * console.log(ActFrameSlotKind.is.recipient("recipient")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActFrameSlotKind = ActFrameSlotKindBase.pipe(
  $I.annoteSchema("ActFrameSlotKind", {
    description: "Which structural place in an act frame a slot occupies.",
  }),
  SchemaUtils.withLiteralKitStatics(ActFrameSlotKindBase)
);

/**
 * Runtime type for {@link ActFrameSlotKind}.
 *
 * @see {@link ActFrameSlotKind} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type ActFrameSlotKind = typeof ActFrameSlotKind.Type;

/**
 * Whether a precondition requires a fact to be present or to be absent.
 *
 * **When to use**
 *
 * Use as the direction on every recorded precondition. There is no default and
 * no omission: a condition that does not say which way it runs cannot be read.
 *
 * **Details**
 *
 * `absent` is the negative operative fact, and it is a first-class member
 * rather than something a reader infers from a negation written into the fact's
 * own wording. Norms condition on absences constantly — no notice given, no
 * objection filed, no prior assignment recorded — and a vocabulary that could
 * only express presence would push those conditions into free text where
 * nothing could point at them.
 *
 * **Gotchas**
 *
 * Polarity says what the condition asks for, never whether it was met. Whether
 * a fact was present or absent at the time of an act is asserted on the
 * exercise that instantiates the frame, by a person, and is never derived from
 * stored facts.
 *
 * **Example** (Record a condition on an absence)
 *
 * ```ts
 * import { OperativeFactPolarity } from "@beep/law-practice-domain"
 *
 * console.log(OperativeFactPolarity.is.absent("absent")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OperativeFactPolarity = OperativeFactPolarityBase.pipe(
  $I.annoteSchema("OperativeFactPolarity", {
    description: "Whether a recorded precondition requires an operative fact to be present or absent.",
  }),
  SchemaUtils.withLiteralKitStatics(OperativeFactPolarityBase)
);

/**
 * Runtime type for {@link OperativeFactPolarity}.
 *
 * @see {@link OperativeFactPolarity} for the runtime schema and the negative operative fact.
 * @category models
 * @since 0.0.0
 */
export type OperativeFactPolarity = typeof OperativeFactPolarity.Type;

/**
 * What an act frame does to the positions it names.
 *
 * **When to use**
 *
 * Use as the member type of an act frame's `derivationKind` set. A frame
 * carries a set of these, never a single one.
 *
 * **Details**
 *
 * `create` brings a position into being, `extinguish` ends one, and `alter`
 * changes one that continues. The three are recorded together in a set because
 * one act routinely does several at once: an assignment extinguishes the
 * assignor's claim and creates the assignee's in the same step, and a
 * three-way choice would force a recorder to pick the half of that act they
 * thought more important.
 *
 * **Example** (Narrow a derivation kind)
 *
 * ```ts
 * import { PositionDerivationKind } from "@beep/law-practice-domain"
 *
 * console.log(PositionDerivationKind.is.extinguish("extinguish")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PositionDerivationKind = PositionDerivationKindBase.pipe(
  $I.annoteSchema("PositionDerivationKind", {
    description: "What an act frame does to a position it names: create, alter, or extinguish it.",
  }),
  SchemaUtils.withLiteralKitStatics(PositionDerivationKindBase)
);

/**
 * Runtime type for {@link PositionDerivationKind}.
 *
 * @see {@link PositionDerivationKind} for the runtime schema and why it is carried as a set.
 * @category models
 * @since 0.0.0
 */
export type PositionDerivationKind = typeof PositionDerivationKind.Type;

const hasDerivationKind = (kinds: HashSet.HashSet<PositionDerivationKind>): boolean => !HashSet.isEmpty(kinds);

const PositionDerivationKinds = StoredHashSet(PositionDerivationKind).check(
  S.makeFilter(hasDerivationKind, {
    identifier: $I`PositionDerivationKindsCheck`,
    title: "Position Derivation Kinds",
    description: "An act frame must record at least one way it derives positions.",
    message: "Expected at least one position derivation kind.",
  })
);

/**
 * Everything one act frame does to the positions it names, as a set.
 *
 * **When to use**
 *
 * Use as an act frame's `derivationKind`. The set is never empty: a frame that
 * derives nothing is not a transition.
 *
 * **Details**
 *
 * The set is the whole point. One act commonly creates and extinguishes at the
 * same time — an assignment ends the assignor's claim and starts the
 * assignee's — so a single three-way choice would force a recorder to discard
 * half of what the act did. Holding several members at once is the ordinary
 * case rather than the exception.
 *
 * The kinds sit inside a value rather than directly on the frame because a
 * persisted field needs an unambiguous encoded shape, which is the same reason
 * a position's recorded scope axes are grouped rather than spread.
 *
 * **Example** (Record an act that creates and extinguishes at once)
 *
 * ```ts
 * import { PositionDerivation, PositionDerivationKind } from "@beep/law-practice-domain"
 * import * as HashSet from "effect/HashSet"
 *
 * const derivation = PositionDerivation.make({
 *   kinds: HashSet.make(PositionDerivationKind.Enum.create, PositionDerivationKind.Enum.extinguish),
 * })
 * console.log(HashSet.size(derivation.kinds)) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PositionDerivation extends S.Class<PositionDerivation>($I`PositionDerivation`)(
  {
    kinds: PositionDerivationKinds.annotateKey({
      description: "Ways this act derives positions; several at once is ordinary, and none is rejected.",
    }),
  },
  $I.annote("PositionDerivation", {
    description: "The non-empty set of ways one act frame derives the positions it names.",
  })
) {}

/**
 * The operative fact a precondition is about, as the recorder stated it.
 *
 * **Example** (State an operative fact)
 *
 * ```ts
 * import { OperativeFactStatement } from "@beep/law-practice-domain"
 *
 * console.log(OperativeFactStatement.make("the lessor has given written notice"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OperativeFactStatement = S.NonEmptyString.pipe(
  $I.annoteSchema("OperativeFactStatement", {
    description: "The operative fact a recorded precondition is about, stated in the recorder's words.",
  })
);

/**
 * Runtime type for {@link OperativeFactStatement}.
 *
 * @see {@link OperativeFactStatement} for the runtime schema.
 * @category models
 * @since 0.0.0
 */
export type OperativeFactStatement = typeof OperativeFactStatement.Type;

/**
 * One named place in an act frame that a party fills.
 *
 * **When to use**
 *
 * Use as an element of a frame's slot list. An exercise of the frame assigns a
 * party to a slot by naming this label.
 *
 * **Details**
 *
 * The label is both the norm's name for the slot and the address a later
 * pointer uses, which keeps the two from drifting. The source reference is the
 * per-element discipline: this slot exists because those words say so, and a
 * reader can check that one slot without re-reading the whole provision.
 *
 * **Example** (Record the actor slot of a frame)
 *
 * ```ts
 * import { ActFrameSlot, NormSourceReference, SourceNormRef } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const slot = ActFrameSlot.make({
 *   kind: "actor",
 *   label: "lessee",
 *   source: NormSourceReference.make({
 *     fragment: O.some("the lessee may"),
 *     norm: SourceNormRef.make({ designation: "cl. 4.1" }),
 *   }),
 * })
 * console.log(slot.kind) // "actor"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActFrameSlot extends S.Class<ActFrameSlot>($I`ActFrameSlot`)(
  {
    kind: ActFrameSlotKind.annotateKey({
      description: "Structural place this slot occupies in the frame.",
    }),
    label: ActFrameElementLabel.annotateKey({
      description: "The frame's name for this slot, and the address a pointer uses to reach it.",
    }),
    source: NormSourceReference.annotateKey({
      description: "Norm text this slot was read from.",
    }),
  },
  $I.annote("ActFrameSlot", {
    description: "One named place in an act frame that a party fills, carrying its own source reference.",
  })
) {}

/**
 * One condition a recorded act frame states for its act.
 *
 * **When to use**
 *
 * Use as an element of a frame's precondition list, one per condition the
 * recorder read out of the norm.
 *
 * **Details**
 *
 * Each condition is its own element with its own label and its own source
 * reference, so a correction can touch one condition without reopening the
 * frame, and a reader can see which words each condition came from. Polarity
 * carries the presence-or-absence question explicitly, which is what lets a
 * negative operative fact be a condition rather than a note.
 *
 * **Gotchas**
 *
 * A stated precondition is not an evaluated one. Nothing checks whether the
 * fact obtained; an exercise separately records what a person asserted about
 * it, and an assertion is not a finding.
 *
 * **Example** (Condition an act on an absence)
 *
 * ```ts
 * import { ActFramePrecondition, NormSourceReference, SourceNormRef } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const precondition = ActFramePrecondition.make({
 *   label: "no-objection",
 *   operativeFact: "the lessor has objected in writing",
 *   polarity: "absent",
 *   source: NormSourceReference.make({
 *     fragment: O.none(),
 *     norm: SourceNormRef.make({ designation: "cl. 4.2" }),
 *   }),
 * })
 * console.log(precondition.polarity) // "absent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActFramePrecondition extends S.Class<ActFramePrecondition>($I`ActFramePrecondition`)(
  {
    label: ActFrameElementLabel.annotateKey({
      description: "The frame's name for this condition, and the address a pointer uses to reach it.",
    }),
    operativeFact: OperativeFactStatement.annotateKey({
      description: "The fact this condition is about, stated in the recorder's words.",
    }),
    polarity: OperativeFactPolarity.annotateKey({
      description: "Whether the condition requires the fact to be present or absent.",
    }),
    source: NormSourceReference.annotateKey({
      description: "Norm text this condition was read from.",
    }),
  },
  $I.annote("ActFramePrecondition", {
    description: "One condition a recorded act frame states, able to require a fact's absence.",
  })
) {}

/**
 * One position a recorded act frame creates or terminates.
 *
 * **When to use**
 *
 * Use as an element of a frame's `creates` or `terminates` list. Which of the
 * two a transition belongs to is the list it sits in, so the same shape serves
 * both directions.
 *
 * **Details**
 *
 * Bearer and counterparty are slot labels rather than parties, because a frame
 * describes a norm and not an occasion: the norm says the lessee acquires a
 * claim against the lessor, and which people those are is settled when the
 * frame is exercised.
 *
 * The position is a full kind-and-content pair. Naming a kind without the act
 * it qualifies would leave a transition nothing could derive a view over, which
 * is the same unsoundness the position derivations are built to make
 * unreachable.
 *
 * **Example** (Record the claim an act creates)
 *
 * ```ts
 * import {
 *   HohfeldPosition,
 *   LegalActContent,
 *   NormSourceReference,
 *   PositionTransition,
 *   SourceNormRef,
 * } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const transition = PositionTransition.make({
 *   bearer: "lessee",
 *   counterparty: "lessor",
 *   label: "quiet-enjoyment",
 *   position: HohfeldPosition.make({
 *     content: LegalActContent.make({ description: "disturb the lessee's possession", polarity: "omission" }),
 *     kind: "claim",
 *   }),
 *   source: NormSourceReference.make({
 *     fragment: O.none(),
 *     norm: SourceNormRef.make({ designation: "cl. 5" }),
 *   }),
 * })
 * console.log(transition.position.kind) // "claim"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PositionTransition extends S.Class<PositionTransition>($I`PositionTransition`)(
  {
    bearer: ActFrameElementLabel.annotateKey({
      description: "Slot label of the role that holds the position after the transition.",
    }),
    counterparty: ActFrameElementLabel.annotateKey({
      description: "Slot label of the role the position is held against.",
    }),
    label: ActFrameElementLabel.annotateKey({
      description: "The frame's name for this transition, and the address a pointer uses to reach it.",
    }),
    position: HohfeldPosition.annotateKey({
      description: "The position kind and act content this transition is about.",
    }),
    source: NormSourceReference.annotateKey({
      description: "Norm text this transition was read from.",
    }),
  },
  $I.annote("PositionTransition", {
    description: "One position a recorded act frame creates or terminates, between two of its slots.",
  })
) {}

/**
 * Non-empty frame slots with unique labels and an actor slot.
 *
 * **Example** (Inspect slot schema)
 *
 * ```ts
 * import { ActFrameSlots } from "@beep/law-practice-domain/entities/ActFrame"
 *
 * console.log(ActFrameSlots.ast._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActFrameSlots = S.NonEmptyArray(ActFrameSlot).check(
  S.makeFilter(hasDistinctLabels, {
    identifier: $I`ActFrameElementLabelsCheck`,
    title: "Act Frame Element Labels",
    description: "An act frame's elements must carry distinct labels within the part they belong to.",
    message: "Expected act frame element labels within a part to be distinct.",
  }),
  S.makeFilter(hasActorSlot, {
    identifier: $I`ActFrameActorSlotCheck`,
    title: "Act Frame Actor Slot",
    description: "An act frame must name the slot the act is done by.",
    message: "Expected an act frame to carry a slot of kind actor.",
  })
);

const DistinctLabels = S.makeFilter(hasDistinctLabels, {
  identifier: $I`ActFrameElementLabelsCheck`,
  title: "Act Frame Element Labels",
  description: "An act frame's elements must carry distinct labels within the part they belong to.",
  message: "Expected act frame element labels within a part to be distinct.",
});

/**
 * Frame preconditions constrained to distinct element labels.
 *
 * **Example** (Inspect precondition schema)
 *
 * ```ts
 * import { ActFramePreconditions } from "@beep/law-practice-domain/entities/ActFrame"
 *
 * console.log(ActFramePreconditions.ast._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActFramePreconditions = S.Array(ActFramePrecondition).check(DistinctLabels);

/**
 * Position transitions constrained to distinct element labels.
 *
 * **Example** (Inspect transition schema)
 *
 * ```ts
 * import { PositionTransitions } from "@beep/law-practice-domain/entities/ActFrame"
 *
 * console.log(PositionTransitions.ast._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PositionTransitions = S.Array(PositionTransition).check(DistinctLabels);
