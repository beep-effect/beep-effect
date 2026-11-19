import * as Domain from "@alchemy.run/domain";
import { FindPartiesAnnotations, FindPartiesParts } from "@proto/party-contract/Directory/FindParties.read";
import { PartyDirectory } from "./PartyDirectory.projection.ts";

/**
 * Search an org for parties by name, a page at a time. Declared from the
 * contract's parts; it waits on this model's own projection, which the
 * contract's `FindPartiesRead` cannot name.
 *
 * @category queries
 * @since 0.0.0
 */
export class FindParties extends Domain.Query(
  "FindParties",
  { ...FindPartiesParts, waitsFor: [PartyDirectory] },
  FindPartiesAnnotations,
) {}
