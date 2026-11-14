import * as Domain from "@alchemy.run/domain";

/**
 * Refused: the caller acts for a different org than the record belongs to.
 *
 * **Example** (Refuse a cross-org read)
 * ```ts
 * import { NotAMember } from "@proto/kernel/NotAMember.rejection";
 *
 * const refusal = new NotAMember();
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotAMember extends Domain.Rejection(
  "NotAMember",
  {},
  { httpApiStatus: 403, description: "The caller is not a member of the record's organization." },
) {}
