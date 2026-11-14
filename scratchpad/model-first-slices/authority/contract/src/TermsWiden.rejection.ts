import { TermDimension } from "@proto/kernel/Capability";
import * as S from "effect/Schema";
import { $AuthorityContractId } from "@proto/kernel/Identity";

const $I = $AuthorityContractId.create("TermsWiden.rejection");

/**
 * Refused: the new terms reach further than the terms they derive from, in
 * the dimension named. Narrowing a grant, delegating it and narrowing a
 * delegation all refuse with it.
 *
 * **Example** (A delegation that would outlive its parent)
 * ```ts
 * import { TermsWiden } from "@proto/authority-contract/TermsWiden.rejection";
 *
 * const refusal = TermsWiden.make({ dimension: "expires" });
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class TermsWiden extends S.TaggedError<TermsWiden, { readonly brand: unique symbol }>()(
  "TermsWiden",
  { dimension: TermDimension },
  $I.annote("TermsWiden", { httpApiStatus: 422, description: "The new terms reach further than the terms they derive from." }),
) {}
