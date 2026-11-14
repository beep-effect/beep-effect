import { FactEnvelope } from "@proto/kernel/Fact";
import { $PartyContractId } from "@proto/kernel/Identity";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

const $I = $PartyContractId.create("Facts/PartyFacts.gateway");

/**
 * Party's fact feed for other contexts' hosts: its published facts in the
 * order Party committed them, each in a `FactEnvelope` whose payload is the
 * version's encoded shape. Reading is a pull by position; the consumer owns
 * its checkpoint. In process for now (D31).
 *
 * @category contracts
 * @since 0.0.0
 */
export class PartyFactsFeed extends Context.Service<
  PartyFactsFeed,
  {
    /** Up to `take` facts after position `after` (0 for the start), oldest first. */
    readonly read: (request: {
      readonly after: number;
      readonly take: number;
    }) => Effect.Effect<ReadonlyArray<FactEnvelope>>;
  }
>()($I`PartyFactsFeed`) {}
