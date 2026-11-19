import * as Domain from "@alchemy.run/domain";
import * as Catalog from "@proto/contract-kit/Catalog";
import { OrgId } from "@proto/kernel/Ids";
import { Text } from "@proto/kernel/Measure";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as Initial from "@proto/kernel/Initial";
import * as S from "effect/Schema";
import { PartyId } from "../Party/Party.id.ts";
import { PartyName } from "../Party/PartyName.ts";
import { InvalidCursor } from "./InvalidCursor.rejection.ts";

/**
 * One party as the directory lists it.
 *
 * @category models
 * @since 0.0.0
 */
export const DirectoryRow = S.Struct({
  partyId: PartyId,
  org: OrgId,
  name: PartyName,
  absorbed: Initial.empty(PartyId, { description: "The parties merged into this one; none at first." }),
});
/**
 * @category models
 * @since 0.0.0
 */
export type DirectoryRow = typeof DirectoryRow.Type;

/**
 * The text a directory search looks for in a party's name: {@link Text} with
 * no leading or trailing whitespace, at most 200 characters. Empty text
 * matches every name, so it lists every party of the org.
 *
 * **Example** (Search for a surname)
 * ```ts
 * import { DirectoryText } from "@proto/party-contract/Directory/FindParties.read";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(DirectoryText)("smith");
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DirectoryText = Text.check(
  S.isTrimmed({ identifier: "DirectoryTextTrimmedCheck", description: "Search text has no leading or trailing whitespace." }),
  S.isMaxLength(200, { identifier: "DirectoryTextMaxLengthCheck", description: "Search text holds at most 200 characters." }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type DirectoryText = typeof DirectoryText.Type;

/**
 * What `FindParties` asks: an org to search and the text a name must contain.
 *
 * @category models
 * @since 0.0.0
 */
export const FindPartiesInput = { org: OrgId, text: DirectoryText };

/**
 * Every part of `FindParties` but what it waits for: the contract's
 * {@link FindPartiesRead} and the model's `FindParties` are both declared
 * from it, so the two cannot drift.
 *
 * **Example** (Declare the query from its parts)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { FindPartiesAnnotations, FindPartiesParts } from "@proto/party-contract/Directory/FindParties.read";
 *
 * class FindParties extends Domain.Query("FindParties", { ...FindPartiesParts }, FindPartiesAnnotations) {}
 * ```
 *
 * @category reads
 * @since 0.0.0
 */
export const FindPartiesParts = {
  input: FindPartiesInput,
  success: DirectoryRow,
  paged: true,
  middleware: [Session],
  rejects: [MissingGrant, InvalidCursor],
} as const;

/**
 * The annotations both declarations of `FindParties` carry.
 *
 * @category reads
 * @since 0.0.0
 */
export const FindPartiesAnnotations = { description: "Search an organization for parties by name." };

/**
 * The `FindParties` query's client contract. The model declares its own
 * `FindParties` from the same parts, waiting on its `PartyDirectory`
 * projection.
 *
 * **Gotchas**
 *
 * Interim (D9). A query that waits fails with `ConsistencyTimeout` too, and
 * only its `waitsFor` says so; `waitsFor` must name the model's own
 * projection, which a contract cannot import, so this one names it by
 * {@link Catalog.waitsOnProjection}. The parity test checks the RPCs match.
 *
 * @category reads
 * @since 0.0.0
 */
export class FindPartiesRead extends Domain.Query(
  "FindParties",
  { ...FindPartiesParts, waitsFor: [Catalog.waitsOnProjection("PartyDirectory")] },
  FindPartiesAnnotations,
) {}
