import * as Domain from "@alchemy.run/domain";
import { TermDimension } from "@proto/kernel/Capability";

/**
 * Refused: the new terms reach further than the terms they derive from, in
 * the dimension named. Narrowing a grant, delegating it and narrowing a
 * delegation all refuse with it.
 *
 * **Example** (A delegation that would outlive its parent)
 * ```ts
 * import { TermsWiden } from "@proto/authority-contract/TermsWiden.rejection";
 *
 * const refusal = new TermsWiden({ dimension: "expires" });
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class TermsWiden extends Domain.Rejection(
  "TermsWiden",
  { dimension: TermDimension },
  { httpApiStatus: 422, description: "The new terms reach further than the terms they derive from." },
) {}
