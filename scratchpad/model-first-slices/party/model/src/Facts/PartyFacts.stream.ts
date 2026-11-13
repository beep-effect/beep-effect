import * as Domain from "@alchemy.run/domain";
import { ClaimDecidedV1, ClaimDecidedV2, ClaimFeed } from "@proto/party-contract/Facts/ClaimDecided.fact";

/**
 * Party's outbox for published facts: one ordered log under the single key
 * `claims`. Only `ClaimFacts` appends to it, and the library appends nothing
 * twice for a replayed or redelivered input, so each decision is written
 * once per version.
 *
 * @category streams
 * @since 0.0.0
 */
export class PartyFacts extends Domain.Stream(
  "PartyFacts",
  { key: ClaimFeed, entries: [ClaimDecidedV1, ClaimDecidedV2] },
  { description: "Party's published facts, in commit order: its outbox." },
) {}
