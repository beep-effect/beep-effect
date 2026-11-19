import * as S from "effect/Schema";
import { $PartyContractId } from "@proto/kernel/Identity";

const $I = $PartyContractId.create("Directory/InvalidCursor.rejection");

/**
 * Refused: the `after` cursor is not one the directory issued, so no page
 * follows it. The caller starts again from the first page.
 *
 * **Example** (Refuse a cursor the directory never issued)
 * ```ts
 * import { InvalidCursor } from "@proto/party-contract/Directory/InvalidCursor.rejection";
 *
 * const refusal = InvalidCursor.make({});
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class InvalidCursor extends S.TaggedError<InvalidCursor, { readonly brand: unique symbol }>()(
  "InvalidCursor",
  {},
  $I.annote("InvalidCursor", { httpApiStatus: 400, description: "The cursor is not one this search issued; start again from the first page." }),
) {}
