import { FactEnvelope } from "@proto/kernel/Fact";
import type { ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { ClaimDecided } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyFactsFeed } from "@proto/party-contract/Facts/PartyFacts.gateway";
import { PartyFacts } from "@proto/party-model/Facts/PartyFacts.stream";
import { PartyFacts2 } from "@proto/party-model/Facts/PartyFacts2.stream";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const encodeV1 = S.encodeEffect(S.toCodecJson(ClaimDecided.versions[1]));
const encodeV2 = S.encodeEffect(S.toCodecJson(ClaimDecided.versions[2]));

/** An entry of either generation, as both streams hold it. */
type Entry = { readonly event: ClaimDecidedV1 | ClaimDecidedV2; readonly envelope: { readonly seq: number } };

/** The envelope of an entry served at `offset` plus its stream position. */
const envelopeAt = (offset: number) => ({ event, envelope }: Entry) =>
  Match.value(event).pipe(
    Match.tagsExhaustive({
      ClaimDecidedV1: (fact) => Effect.map(encodeV1(fact), (payload) => ({ version: 1, payload })),
      ClaimDecidedV2: (fact) => Effect.map(encodeV2(fact), (payload) => ({ version: 2, payload })),
    }),
    Effect.map(({ version, payload }) =>
      FactEnvelope.make({
        producer: ClaimDecided.producer,
        contract: ClaimDecided.contract,
        version,
        factId: event.factId,
        seq: offset + envelope.seq,
        payload,
      }),
    ),
  );

/**
 * Party's fact feed over its outbox, both generations in order: each entry
 * becomes an envelope with the producer, the contract, the version its tag
 * names, the stable fact id, its feed position and the encoded payload.
 *
 * **Details**
 *
 * Generation 1 (`PartyFacts`) is closed, so its length is fixed: its entries
 * keep their positions, 1 to its length, and generation 2 (`PartyFacts2`)
 * follows at that length plus its own position. A checkpoint taken before
 * phase 9 therefore still means the same place. Generation 2 republishes the
 * decisions generation 1 holds, under the same fact ids; consumers drop
 * those by producer, fact id and version.
 *
 * @category adapters
 * @since 0.0.0
 */
export const PartyFactsFeedLive = Layer.effect(
  PartyFactsFeed,
  Effect.gen(function* () {
    const closed = yield* PartyFacts;
    const open = yield* PartyFacts2;
    return {
      read: Effect.fn("PartyFactsFeed.read")(
        function* ({ after, take }) {
          const closedLength = yield* closed.peek("claims").pipe(
            Effect.map(O.match({ onNone: () => 0, onSome: (entry) => entry.envelope.seq })),
          );
          const first = after < closedLength ? (yield* closed.list("claims", { after, take })).entries : [];
          const rest = take - A.length(first);
          const second = rest > 0 ? (yield* open.list("claims", { after: Num.max(after - closedLength, 0), take: rest })).entries : [];
          const served = yield* Effect.forEach(first, envelopeAt(0));
          const followed = yield* Effect.forEach(second, envelopeAt(closedLength));
          return A.appendAll(served, followed);
        },
        // The outbox holds only what Party encoded itself, and a peek without `atLeast` never waits.
        Effect.orDie,
      ),
    };
  }),
);
