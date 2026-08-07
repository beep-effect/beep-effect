/**
 * Per-element pointer back to the norm text an interpretation was read from.
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
 * Modified: reimplemented in Effect/TypeScript; no upstream source was copied.
 * Only the donor's source-reference-per-element discipline is ported — every
 * frame element names the text it was read from, rather than one document
 * pointer standing for a whole interpretation.
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { SourceNormRef } from "../SourceNormRef/index.ts";

const $I = $LawPracticeDomainId.create("values/NormSourceReference/NormSourceReference.model");

/**
 * Verbatim fragment of norm text an element was read from.
 *
 * **Details**
 *
 * The fragment is quoted exactly as the recorder transcribed it. Nothing
 * resolves it against a stored copy of the norm, so it is evidence of what was
 * read rather than proof that the norm says it.
 *
 * **Example** (Record the text a precondition was read from)
 *
 * ```ts
 * import { NormTextFragment } from "@beep/law-practice-domain"
 *
 * console.log(NormTextFragment.make("unless the lessor has given written notice"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NormTextFragment = S.NonEmptyString.pipe(
  $I.annoteSchema("NormTextFragment", {
    description: "Verbatim fragment of norm text a recorded element was read from.",
  })
);

/**
 * Runtime type for {@link NormTextFragment}.
 *
 * @see {@link NormTextFragment} for the runtime schema and its evidential status.
 * @category models
 * @since 0.0.0
 */
export type NormTextFragment = typeof NormTextFragment.Type;

/**
 * The norm text one recorded element rests on.
 *
 * **When to use**
 *
 * Use on every element of a recorded interpretation — each slot, each
 * precondition, each position a frame creates or terminates — and on each
 * element a correction touches.
 *
 * **Details**
 *
 * One pointer per element rather than one per record is the whole discipline. A
 * single document pointer on an interpretation says the interpretation came
 * from somewhere; a pointer on each element says which words each part was read
 * from, which is the only form a later reader can check or dispute one element
 * at a time.
 *
 * The norm reference is required and the fragment is optional. An element read
 * from a provision as a whole has no single quotable span, and forcing one
 * would produce invented quotes — the placeholder trap this vocabulary avoids
 * everywhere it appears.
 *
 * **Gotchas**
 *
 * A reference is not a citation check. Nothing resolves the norm, nothing
 * confirms the fragment appears in it, and nothing establishes that the norm
 * was in force when the element was recorded.
 *
 * **Example** (Point one precondition at the words it was read from)
 *
 * ```ts
 * import { NormSourceReference, SourceNormRef } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const source = NormSourceReference.make({
 *   fragment: O.some("upon written demand"),
 *   norm: SourceNormRef.make({ designation: "cl. 4.1" }),
 * })
 * console.log(O.isSome(source.fragment)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NormSourceReference extends S.Class<NormSourceReference>($I`NormSourceReference`)(
  {
    fragment: S.OptionFromNullOr(NormTextFragment).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Verbatim words this element was read from; absent when it rests on a provision as a whole.",
    }),
    norm: SourceNormRef.annotateKey({
      description: "Opaque reference to the norm this element was read from.",
    }),
  },
  $I.annote("NormSourceReference", {
    description: "The norm text one recorded interpretation element rests on, pointed at per element.",
  })
) {}
