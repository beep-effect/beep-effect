/**
 * Addressing scheme for one element inside a recorded act frame.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/ActFrameElementRef/ActFrameElementRef.model");

const ActFramePartBase = LiteralKit(["slot", "precondition", "creates", "terminates"]);

/**
 * The name a recorded frame gives to one of its elements.
 *
 * **When to use**
 *
 * Use as the label on every frame element, and as the half of an
 * {@link ActFrameElementRef} that names which element is meant.
 *
 * **Details**
 *
 * Labels are the recorder's own words, and they are what a later pointer
 * addresses. Positional indexes would do the same job until an element was
 * inserted, at which point every stored pointer would silently move to a
 * different element.
 *
 * **Example** (Label a frame element)
 *
 * ```ts
 * import { ActFrameElementLabel } from "@beep/law-practice-domain"
 *
 * console.log(ActFrameElementLabel.make("lessee"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActFrameElementLabel = S.NonEmptyString.pipe(
  $I.annoteSchema("ActFrameElementLabel", {
    description: "The name a recorded act frame gives to one of its elements.",
  })
);

/**
 * Runtime type for {@link ActFrameElementLabel}.
 *
 * @see {@link ActFrameElementLabel} for the runtime schema and why labels beat indexes.
 * @category models
 * @since 0.0.0
 */
export type ActFrameElementLabel = typeof ActFrameElementLabel.Type;

/**
 * Which part of a recorded act frame an element belongs to.
 *
 * **Details**
 *
 * The four parts are the frame's own structure: the slots a party fills, the
 * preconditions the frame asserts, and the positions it creates or terminates.
 * Labels are unique within a part rather than across the whole frame, so a
 * precondition and the position it guards may share the recorder's name for
 * them without either pointer becoming ambiguous.
 *
 * **Example** (Narrow a frame part)
 *
 * ```ts
 * import { ActFramePart } from "@beep/law-practice-domain"
 *
 * console.log(ActFramePart.is.terminates("terminates")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActFramePart = ActFramePartBase.pipe(
  $I.annoteSchema("ActFramePart", {
    description: "Which part of a recorded act frame an element belongs to.",
  }),
  SchemaUtils.withLiteralKitStatics(ActFramePartBase)
);

/**
 * Runtime type for {@link ActFramePart}.
 *
 * @see {@link ActFramePart} for the runtime schema and the per-part label rule.
 * @category models
 * @since 0.0.0
 */
export type ActFramePart = typeof ActFramePart.Type;

/**
 * A pointer at one element of a recorded act frame.
 *
 * **When to use**
 *
 * Use wherever a record must say which element of a frame it is about: an
 * exercise asserting one precondition, a validator finding naming one slot, a
 * correction declaring which element it touched.
 *
 * **Details**
 *
 * Part plus label is the whole address. Nothing carries the frame id, because
 * every record that holds one of these also names the frame it belongs to, and
 * a pointer that could name a different frame than its record would be a way
 * for the two to disagree.
 *
 * **Gotchas**
 *
 * A pointer is not checked against the frame it addresses. Naming an element
 * the frame does not have is a recording error the vocabulary does not catch,
 * and a reader must resolve pointers against the frame rather than trust them.
 *
 * **Example** (Point at one precondition of a frame)
 *
 * ```ts
 * import { ActFrameElementRef } from "@beep/law-practice-domain"
 *
 * const pointer = ActFrameElementRef.make({ label: "notice-given", part: "precondition" })
 * console.log(pointer.part) // "precondition"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActFrameElementRef extends S.Class<ActFrameElementRef>($I`ActFrameElementRef`)(
  {
    label: ActFrameElementLabel.annotateKey({
      description: "Label the frame gives the element being pointed at.",
    }),
    part: ActFramePart.annotateKey({
      description: "Part of the frame the labelled element belongs to.",
    }),
  },
  $I.annote("ActFrameElementRef", {
    description: "A pointer at one element of a recorded act frame, by part and label.",
  })
) {}
