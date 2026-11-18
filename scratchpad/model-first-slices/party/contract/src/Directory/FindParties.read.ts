import * as Domain from "@alchemy.run/domain";
import * as Catalog from "@proto/contract-kit/Catalog";
import { OrgId } from "@proto/kernel/Ids";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { PartyId } from "../Party/Party.id.ts";

/**
 * One party as the directory lists it.
 *
 * @category models
 * @since 0.0.0
 */
export const DirectoryRow = S.Struct({
  partyId: PartyId,
  org: OrgId,
  name: S.String,
  absorbed: S.Array(PartyId),
});
/**
 * @category models
 * @since 0.0.0
 */
export type DirectoryRow = typeof DirectoryRow.Type;

/**
 * What `FindParties` asks: an org to search and the text a name must contain.
 *
 * @category models
 * @since 0.0.0
 */
export const FindPartiesInput = { org: OrgId, text: S.String };

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
  {
    input: FindPartiesInput,
    success: DirectoryRow,
    paged: true,
    waitsFor: [Catalog.waitsOnProjection("PartyDirectory")],
    middleware: [Session],
    rejects: [MissingGrant],
  },
  { description: "Search an organization for parties by name." },
) {}
