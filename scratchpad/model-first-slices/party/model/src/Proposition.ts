import * as S from "effect/Schema";
import { PartyId } from "./Party/Party.id.ts";

/**
 * What a claim asserts. `SameParty` says two parties are one (the absorbed
 * one merges into the survivor); `HasIdentifier` says a party carries an
 * identifier in some scheme.
 *
 * **Example** (A duplicate party)
 * ```ts
 * import { PartyId } from "@proto/party/Party/Party.id";
 * import { Proposition } from "@proto/party/Proposition";
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
  HasIdentifier: { party: PartyId, scheme: S.String, value: S.String },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Proposition = typeof Proposition.Type;
