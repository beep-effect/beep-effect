import * as Domain from "@alchemy.run/domain";
import { ClaimDecidedV1, ClaimDecidedV2, ClaimFeed } from "@proto/party-contract/Facts/ClaimDecided.fact";

/**
 * Generation 2 of Party's outbox for published facts, opened in phase 9 when
 * the publisher changed to read claim events directly (D43). One ordered log
 * under the single key `claims`; only `ClaimDecisions` appends to it, and the
 * library appends nothing twice for a replayed or redelivered input.
 *
 * **Details**
 *
 * A new generation is a new stream, so no position from an earlier writer is
 * stored against it and the new writer's first appends are accepted. The
 * feed serves generation 1 (`PartyFacts`, closed) and then this one;
 * consumers drop what they already saw by producer, fact id and version.
 * `StreamPins.ts` pins this generation to its writer.
 *
 * @category streams
 * @since 0.0.0
 */
export class PartyFacts2 extends Domain.Stream(
  "PartyFacts2",
  { key: ClaimFeed, entries: [ClaimDecidedV1, ClaimDecidedV2] },
  { description: "Party's published facts, generation 2, in commit order: its outbox." },
) {}
