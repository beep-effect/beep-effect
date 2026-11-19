import { IdText, Text } from "@proto/kernel/Measure";
import * as S from "effect/Schema";
import { PartyId } from "./Party/Party.id.ts";

/**
 * The value of an identifier a claim asserts, as its scheme writes it (an
 * email address, a phone number): {@link Text} that is not empty and has no
 * leading or trailing whitespace.
 *
 * **Example** (An email address)
 * ```ts
 * import { IdentifierValue } from "@proto/party-contract/Proposition";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(IdentifierValue)("dana@acme.test");
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IdentifierValue = Text.check(
  S.isNonEmpty({ identifier: "IdentifierValueNonEmptyCheck", description: "An identifier's value is never empty." }),
  S.isTrimmed({ identifier: "IdentifierValueTrimmedCheck", description: "An identifier's value has no leading or trailing whitespace." }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type IdentifierValue = typeof IdentifierValue.Type;

/**
 * What a claim asserts. `SameParty` says two parties are one (the absorbed
 * one merges into the survivor); `HasIdentifier` says a party carries an
 * identifier in some scheme: a short machine name such as `email`.
 *
 * **Example** (A duplicate party)
 * ```ts
 * import { PartyId } from "@proto/party-contract/Party/Party.id";
 * import { Proposition } from "@proto/party-contract/Proposition";
 *
 * const duplicate = Proposition.cases.SameParty.make({
 *   survivor: PartyId.make("party_1"),
 *   absorbed: PartyId.make("party_2"),
 * });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Proposition = S.TaggedUnion({
  SameParty: { survivor: PartyId, absorbed: PartyId },
  HasIdentifier: { party: PartyId, scheme: IdText, value: IdentifierValue },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Proposition = typeof Proposition.Type;
