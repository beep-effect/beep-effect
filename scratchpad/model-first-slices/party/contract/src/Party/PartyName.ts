import { Text } from "@proto/kernel/Measure";
import * as S from "effect/Schema";

/**
 * A party's name, as a person registers it and the directory lists it:
 * {@link Text} that is not empty, has no leading or trailing whitespace, and
 * holds at most 200 characters. Every field that carries a party's name uses
 * it.
 *
 * **Example** (A registered name)
 * ```ts
 * import { PartyName } from "@proto/party-contract/Party/PartyName";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(PartyName)("Dana Smith");
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PartyName = Text.check(
  S.isNonEmpty({ identifier: "PartyNameNonEmptyCheck", description: "A party's name is never empty." }),
  S.isTrimmed({ identifier: "PartyNameTrimmedCheck", description: "A party's name has no leading or trailing whitespace." }),
  S.isMaxLength(200, { identifier: "PartyNameMaxLengthCheck", description: "A party's name holds at most 200 characters." }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type PartyName = typeof PartyName.Type;
