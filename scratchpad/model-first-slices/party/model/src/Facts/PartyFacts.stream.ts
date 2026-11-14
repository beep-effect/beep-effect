import * as Domain from "@alchemy.run/domain";
import { ClaimDecidedV1, ClaimDecidedV2, ClaimFeed } from "@proto/party-contract/Facts/ClaimDecided.fact";

/**
 * Generation 1 of Party's outbox for published facts, closed in phase 9. Its
 * writer read the `ClaimReview` view; it was retired when the publisher moved
 * to claim events (D43), and nothing appends here any more.
 *
 * **Details**
 *
 * It stays declared because what it holds is still published: the feed serves
 * it before generation 2 (`PartyFacts2`), and `ClaimDecisions` reads it for
 * the scope of decisions stored before their events carried one.
 * `StreamPins.ts` pins it closed, so a writer cannot come back to it.
 *
 * @category streams
 * @since 0.0.0
 */
export class PartyFacts extends Domain.Stream(
  "PartyFacts",
  { key: ClaimFeed, entries: [ClaimDecidedV1, ClaimDecidedV2] },
  { description: "Party's published facts, generation 1 (closed), in commit order." },
) {}
