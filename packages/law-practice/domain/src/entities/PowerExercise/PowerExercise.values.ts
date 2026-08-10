/**
 * Concept-local value objects for recorded power exercises.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";
import { ActFrameElementRef } from "../../values/ActFrameElementRef/index.ts";
import { ConstitutionOutcome } from "../../values/ConstitutionOutcome/index.ts";
import { LegalRole } from "../../values/LegalRole/index.ts";
import { PermissionStatus } from "../../values/PermissionStatus/index.ts";
import { SourceNormRef } from "../../values/SourceNormRef/index.ts";

const $I = $LawPracticeDomainId.create("entities/PowerExercise/PowerExercise.values");

const ActDispositionBase = LiteralKit(["effective", "void", "disputed", "undetermined"]);
const PreconditionAssertionStatusBase = LiteralKit(["asserted-met", "asserted-unmet", "unassessed"]);

/**
 * Where a recorded act stands, as somebody has disposed of it.
 *
 * **When to use**
 *
 * Use as the required disposition on every recorded exercise, including one
 * nobody has looked at yet.
 *
 * **Details**
 *
 * `effective` and `void` record that a person disposed of the act one way or
 * the other. `disputed` records that two people disposed of it differently and
 * nothing has settled which stands. `undetermined` records that nobody has
 * disposed of it at all.
 *
 * The last two members are the reason this field can be required. Without them
 * an unreviewed attempt would have to be filed under `effective` or `void`,
 * and a renderer would show a disposition nobody made — the authority
 * laundering this vocabulary is shaped to prevent. With them, an exercise is
 * always displayable together with how far its assessment actually got.
 *
 * **Gotchas**
 *
 * Disposition is not derived from the constitution and permission axes, and
 * must not be. Those two record specific determinations about power and breach;
 * this records what somebody concluded about the act. Computing one from the
 * others would turn two recorded facts into a verdict the system never has
 * standing to reach.
 *
 * **Example** (Record that nobody has disposed of an attempt yet)
 *
 * ```ts
 * import { ActDisposition } from "@beep/law-practice-domain"
 *
 * console.log(ActDisposition.is.undetermined("undetermined")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActDisposition = ActDispositionBase.pipe(
  $I.annoteSchema("ActDisposition", {
    description: "Where a recorded act stands as somebody has disposed of it, including undisposed.",
  }),
  SchemaUtils.withLiteralKitStatics(ActDispositionBase)
);

/**
 * Runtime type for {@link ActDisposition}.
 *
 * @see {@link ActDisposition} for the runtime schema and why `undetermined` is a member.
 * @category models
 * @since 0.0.0
 */
export type ActDisposition = typeof ActDisposition.Type;

/**
 * What somebody asserted about one of an act frame's preconditions.
 *
 * **Details**
 *
 * `asserted-met` and `asserted-unmet` record a claim a person made about the
 * condition on this occasion; `unassessed` records that the condition was
 * carried over from the frame and nobody has said anything about it. All three
 * are assertions or their absence — none is a finding that the fact obtained.
 *
 * **Example** (Record an unassessed condition)
 *
 * ```ts
 * import { PreconditionAssertionStatus } from "@beep/law-practice-domain"
 *
 * console.log(PreconditionAssertionStatus.is.unassessed("unassessed")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PreconditionAssertionStatus = PreconditionAssertionStatusBase.pipe(
  $I.annoteSchema("PreconditionAssertionStatus", {
    description: "What somebody asserted about one of an act frame's preconditions on one occasion.",
  }),
  SchemaUtils.withLiteralKitStatics(PreconditionAssertionStatusBase)
);

/**
 * Runtime type for {@link PreconditionAssertionStatus}.
 *
 * @see {@link PreconditionAssertionStatus} for the runtime schema and its assertion-not-finding rule.
 * @category models
 * @since 0.0.0
 */
export type PreconditionAssertionStatus = typeof PreconditionAssertionStatus.Type;

/**
 * The stated ground a determination was made on.
 *
 * **Example** (Record why a violation was asserted)
 *
 * ```ts
 * import { DeterminationBasis } from "@beep/law-practice-domain"
 *
 * console.log(DeterminationBasis.make("notice was served after the cure period closed"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DeterminationBasis = S.NonEmptyString.pipe(
  $I.annoteSchema("DeterminationBasis", {
    description: "The stated ground a recorded determination about an act was made on.",
  })
);

/**
 * Runtime type for {@link DeterminationBasis}.
 *
 * @see {@link DeterminationBasis} for the runtime schema.
 * @category models
 * @since 0.0.0
 */
export type DeterminationBasis = typeof DeterminationBasis.Type;

/**
 * One person's determination that an act did or did not constitute its effect.
 *
 * **Details**
 *
 * The interpreter is required because this is somebody's reading and never the
 * system's. The basis is optional: a determination made without a stated ground
 * is worse evidence, and recording it as such is more honest than inventing the
 * ground it lacked.
 *
 * **Example** (Record that an act was determined to lack power)
 *
 * ```ts
 * import { ConstitutionDetermination } from "@beep/law-practice-domain"
 * import { SystemPrincipal } from "@beep/shared-domain/entity/Principal"
 * import * as O from "effect/Option"
 *
 * const determination = ConstitutionDetermination.make({
 *   basis: O.some("the assignor had already assigned the same claim"),
 *   interpreter: SystemPrincipal.make({ component: "Runtime", kind: "System" }),
 *   outcome: "not-constituted",
 * })
 * console.log(determination.outcome) // "not-constituted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConstitutionDetermination extends S.Class<ConstitutionDetermination>($I`ConstitutionDetermination`)(
  {
    basis: S.OptionFromNullOr(DeterminationBasis).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Ground the determination was stated on, absent when none was given.",
    }),
    interpreter: Principal.annotateKey({
      description: "Principal whose determination this is.",
    }),
    outcome: ConstitutionOutcome.annotateKey({
      description: "Whether the act was determined to constitute the legal effect it aimed at.",
    }),
  },
  $I.annote("ConstitutionDetermination", {
    description: "One attributed determination that an act did or did not constitute its intended effect.",
  })
) {}

/**
 * One person's determination that an act was permitted or breached a duty.
 *
 * **Details**
 *
 * Recorded independently of the constitution determination, always. An act may
 * be within power and still breach a duty, which is the ordinary case of an
 * effective wrong, and the two determinations are made by different people as
 * often as by the same one.
 *
 * **Example** (Record an asserted breach)
 *
 * ```ts
 * import { PermissionDetermination } from "@beep/law-practice-domain"
 * import { SystemPrincipal } from "@beep/shared-domain/entity/Principal"
 * import * as O from "effect/Option"
 *
 * const determination = PermissionDetermination.make({
 *   basis: O.some("the covenant against subletting"),
 *   interpreter: SystemPrincipal.make({ component: "Runtime", kind: "System" }),
 *   status: "violative",
 * })
 * console.log(determination.status) // "violative"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PermissionDetermination extends S.Class<PermissionDetermination>($I`PermissionDetermination`)(
  {
    basis: S.OptionFromNullOr(DeterminationBasis).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Ground the determination was stated on, absent when none was given.",
    }),
    interpreter: Principal.annotateKey({
      description: "Principal whose determination this is.",
    }),
    status: PermissionStatus.annotateKey({
      description: "Whether the act was determined to be permitted or to breach a duty.",
    }),
  },
  $I.annote("PermissionDetermination", {
    description: "One attributed determination that an act was permitted or breached a duty.",
  })
) {}

/**
 * One person's disposition of a recorded act.
 *
 * **Details**
 *
 * An interpreter is required even for `undetermined`, because somebody records
 * that nothing has been settled, and knowing who left it open is part of the
 * record.
 *
 * **Example** (Record an unsettled disposition)
 *
 * ```ts
 * import { DispositionDetermination } from "@beep/law-practice-domain"
 * import { SystemPrincipal } from "@beep/shared-domain/entity/Principal"
 * import * as O from "effect/Option"
 *
 * const determination = DispositionDetermination.make({
 *   basis: O.none(),
 *   disposition: "undetermined",
 *   interpreter: SystemPrincipal.make({ component: "Runtime", kind: "System" }),
 * })
 * console.log(determination.disposition) // "undetermined"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DispositionDetermination extends S.Class<DispositionDetermination>($I`DispositionDetermination`)(
  {
    basis: S.OptionFromNullOr(DeterminationBasis).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Ground the disposition was stated on, absent when none was given.",
    }),
    disposition: ActDisposition.annotateKey({
      description: "Where the act stands as this principal has disposed of it.",
    }),
    interpreter: Principal.annotateKey({
      description: "Principal whose disposition this is, including when it is undetermined.",
    }),
  },
  $I.annote("DispositionDetermination", {
    description: "One attributed disposition of a recorded act, including leaving it undetermined.",
  })
) {}

/**
 * What was determined about one recorded exercise.
 *
 * **When to use**
 *
 * Use as the required `result` of every recorded exercise. It is required
 * precisely because an unassessed attempt has an answer here — an undetermined
 * disposition and two absent axes — rather than nothing.
 *
 * **Details**
 *
 * The two axes are independent and never merge. A `not-constituted` act with no
 * permission determination stays on the record as an attempt with no effect on
 * any position; a `constituted` act with a `violative` permission determination
 * changed positions **and** breached a duty, both at once. Collapsing them into
 * one validity field erases the second case, which is most of what a practice
 * actually records, and that collapse is the donor trap this shape refuses.
 *
 * Both axes are optional and the disposition is not. An axis nobody has
 * determined is absent rather than defaulted, because a default here would be
 * the system making a legal determination on its own account. The disposition
 * carries `undetermined` for the same situation, which is what lets it be
 * required.
 *
 * **Gotchas**
 *
 * No field is derived from another. Nothing infers effectiveness from
 * constitution, permission from disposition, or a disposition from the two
 * axes agreeing. In a contested case the record holds every determination that
 * was made and settles none of them.
 *
 * **Example** (Record an effective act that breached a duty)
 *
 * ```ts
 * import {
 *   ConstitutionDetermination,
 *   DispositionDetermination,
 *   ExerciseResult,
 *   PermissionDetermination,
 * } from "@beep/law-practice-domain"
 * import { SystemPrincipal } from "@beep/shared-domain/entity/Principal"
 * import * as O from "effect/Option"
 *
 * const interpreter = SystemPrincipal.make({ component: "Runtime", kind: "System" })
 * const result = ExerciseResult.make({
 *   constitution: O.some(
 *     ConstitutionDetermination.make({ basis: O.none(), interpreter, outcome: "constituted" })
 *   ),
 *   disposition: DispositionDetermination.make({
 *     basis: O.none(),
 *     disposition: "effective",
 *     interpreter,
 *   }),
 *   permission: O.some(
 *     PermissionDetermination.make({ basis: O.none(), interpreter, status: "violative" })
 *   ),
 * })
 * console.log(result.disposition.disposition) // "effective"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExerciseResult extends S.Class<ExerciseResult>($I`ExerciseResult`)(
  {
    constitution: S.OptionFromNullOr(ConstitutionDetermination).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Determination about power, absent while nobody has made one.",
    }),
    disposition: DispositionDetermination.annotateKey({
      description: "Required disposition of the act, carrying `undetermined` when nothing is settled.",
    }),
    permission: S.OptionFromNullOr(PermissionDetermination).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Determination about breach, absent while nobody has made one and never implied by the other axis.",
    }),
  },
  $I.annote("ExerciseResult", {
    description: "What was determined about one recorded exercise, on two independent axes plus a disposition.",
  })
) {}

/**
 * What somebody asserted about one of the frame's preconditions on this
 * occasion.
 *
 * **Details**
 *
 * The element pointer says which condition; the status says what was claimed
 * about it. Conditions with no assertion recorded are simply not listed, and a
 * reader comparing the frame's conditions against these assertions can see
 * which ones nobody addressed.
 *
 * **Example** (Assert that a condition was met)
 *
 * ```ts
 * import { ActFrameElementRef, PreconditionAssertion } from "@beep/law-practice-domain"
 *
 * const assertion = PreconditionAssertion.make({
 *   element: ActFrameElementRef.make({ label: "notice-given", part: "precondition" }),
 *   status: "asserted-met",
 * })
 * console.log(assertion.status) // "asserted-met"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreconditionAssertion extends S.Class<PreconditionAssertion>($I`PreconditionAssertion`)(
  {
    element: ActFrameElementRef.annotateKey({
      description: "Pointer at the frame precondition this assertion is about.",
    }),
    status: PreconditionAssertionStatus.annotateKey({
      description: "What was asserted about the condition on this occasion.",
    }),
  },
  $I.annote("PreconditionAssertion", {
    description: "What somebody asserted about one of an act frame's preconditions on one occasion.",
  })
) {}

/**
 * The party recorded as filling one of the frame's slots on this occasion.
 *
 * **Details**
 *
 * The frame names slots; an occasion fills them. Linkage is by party id, and
 * nothing checks that the party is one the norm admits into that slot — that is
 * a question about authority, which is recorded and never computed.
 *
 * **Example** (Fill a frame slot with a party)
 *
 * ```ts
 * import { ActFrameElementRef, ActFrameSlotAssignment } from "@beep/law-practice-domain"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * const assignment = ActFrameSlotAssignment.make({
 *   player: LawPractice.PartyId.make(9),
 *   slot: ActFrameElementRef.make({ label: "lessor", part: "slot" }),
 * })
 * console.log(assignment.slot.label) // "lessor"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActFrameSlotAssignment extends S.Class<ActFrameSlotAssignment>($I`ActFrameSlotAssignment`)(
  {
    player: LawPractice.PartyId.annotateKey({
      description: "Party recorded as filling the slot on this occasion.",
    }),
    slot: ActFrameElementRef.annotateKey({
      description: "Pointer at the frame slot being filled.",
    }),
  },
  $I.annote("ActFrameSlotAssignment", {
    description: "The party recorded as filling one act frame slot on one occasion.",
  })
) {}

/**
 * The authority somebody claimed for an act, as they claimed it.
 *
 * **When to use**
 *
 * Use as the required authority basis of a recorded exercise, so an act is
 * never on the record without the ground its actor stood on.
 *
 * **Details**
 *
 * Four things make up a claim to act: the role claimed, the norm claimed under,
 * the power relation cited, and the exercise that conferred that power. The
 * last two are optional together with intent — a power resting directly on a
 * norm has no earlier relation behind it and no conferring act, which is where
 * every lineage chain terminates.
 *
 * `foundingExercise` is the same link a stored position's grounding names from
 * the other side. Recording it here means the chain reads in both directions:
 * from a position to what produced it, and from an act to what let it be done.
 *
 * **Gotchas**
 *
 * Every field is asserted, none is verified. That a power relation is cited is
 * not a finding that the actor held it, that the role is claimed is not a
 * finding that they occupied it, and a complete-looking basis is not a
 * complete-looking authority. Whether the party **has** the authority is never
 * computed.
 *
 * **Example** (Claim authority resting directly on a norm)
 *
 * ```ts
 * import { AssertedAuthorityBasis, LegalRole, PartyKind, SourceNormRef } from "@beep/law-practice-domain"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const basis = AssertedAuthorityBasis.make({
 *   claimedRole: LegalRole.make({
 *     admittedPlayerKinds: HashSet.make(PartyKind.Enum["natural-person"]),
 *     name: "lessee",
 *     player: LawPractice.PartyId.make(4),
 *     sourceNorm: SourceNormRef.make({ designation: "cl. 4.1" }),
 *   }),
 *   exercisedPower: O.none(),
 *   foundingExercise: O.none(),
 *   sourceNorm: SourceNormRef.make({ designation: "cl. 4.1" }),
 * })
 * console.log(O.isNone(basis.exercisedPower)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssertedAuthorityBasis extends S.Class<AssertedAuthorityBasis>($I`AssertedAuthorityBasis`)(
  {
    claimedRole: LegalRole.annotateKey({
      description: "Role the actor claimed to be acting in, asserted and never verified.",
    }),
    exercisedPower: S.OptionFromNullOr(LawPractice.LegalPositionRelatorId)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Stored power relation cited as the ground for acting; absent when the power rests on a norm.",
      }),
    foundingExercise: S.OptionFromNullOr(LawPractice.PowerExerciseId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Exercise that conferred the cited power, matching the grounding a produced position records.",
    }),
    sourceNorm: SourceNormRef.annotateKey({
      description: "Opaque reference to the norm the authority is claimed under.",
    }),
  },
  $I.annote("AssertedAuthorityBasis", {
    description: "The authority somebody claimed for an act: role, norm, cited power, and conferring exercise.",
  })
) {}
