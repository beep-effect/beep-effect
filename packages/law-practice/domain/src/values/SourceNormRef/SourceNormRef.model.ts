/**
 * Opaque reference to the norm a legal position or role is prescribed by.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/SourceNormRef/SourceNormRef.model");

/**
 * Verbatim designation of a norm, exactly as the recorder wrote it.
 *
 * **Example** (Record a norm designation)
 *
 * ```ts
 * import { SourceNormDesignation } from "@beep/law-practice-domain"
 *
 * console.log(SourceNormDesignation.make("37 CFR 1.56"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceNormDesignation = S.NonEmptyString.pipe(
  $I.annoteSchema("SourceNormDesignation", {
    description: "Verbatim designation of a norm, recorded as written and never parsed.",
  })
);

/**
 * Runtime type for {@link SourceNormDesignation}.
 *
 * @see {@link SourceNormDesignation} for the runtime schema and its opacity rule.
 * @category models
 * @since 0.0.0
 */
export type SourceNormDesignation = typeof SourceNormDesignation.Type;

/**
 * Opaque reference to the norm that prescribes a legal position or role.
 *
 * **When to use**
 *
 * Use wherever a record must name the norm it rests on. Every stored position
 * and every prescribed role carries one.
 *
 * **Details**
 *
 * The reference is deliberately opaque: it names a norm without modelling what
 * a norm is. Versioned norm identity — which text was in force when, and which
 * amendment a record was made under — is a separate problem with its own
 * temporal semantics, and guessing at it here would bake a wrong answer into
 * every stored record.
 *
 * Wrapping the designation in a value rather than storing bare text is what
 * lets that identity land later without reshaping every field that holds one.
 *
 * **Gotchas**
 *
 * Two references with the same designation are the same reference, and that is
 * all the equality available. Nothing resolves a reference to a norm's text,
 * and nothing establishes that the norm was in force at any particular time.
 *
 * **Example** (Record the norm behind a position)
 *
 * ```ts
 * import { SourceNormRef } from "@beep/law-practice-domain"
 *
 * const norm = SourceNormRef.make({ designation: "35 USC 271(a)" })
 * console.log(norm.designation) // "35 USC 271(a)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceNormRef extends S.Class<SourceNormRef>($I`SourceNormRef`)(
  {
    designation: SourceNormDesignation.annotateKey({
      description: "Verbatim norm designation, opaque until versioned norm identity lands.",
    }),
  },
  $I.annote("SourceNormRef", {
    description: "Opaque reference to the norm that prescribes a legal position or role.",
  })
) {}
