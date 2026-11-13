import * as Domain from "@alchemy.run/domain";

/**
 * Refused: only the human who delegated may narrow or revoke the delegation.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotDelegator extends Domain.Rejection(
  "NotDelegator",
  {},
  { httpApiStatus: 403, description: "Only the human who delegated may change the delegation." },
) {}
