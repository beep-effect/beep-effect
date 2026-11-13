import { FactEnvelope } from "@proto/kernel/Fact";
import { ClaimDecided } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyFactsFeed } from "@proto/party-contract/Facts/PartyFacts.gateway";
import { PartyFacts } from "@proto/party-model/Facts/PartyFacts.stream";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as S from "effect/Schema";

const encodeV1 = S.encodeEffect(S.toCodecJson(ClaimDecided.versions[1]));
const encodeV2 = S.encodeEffect(S.toCodecJson(ClaimDecided.versions[2]));

/**
 * Party's fact feed over its outbox stream: each entry becomes an envelope
 * with the producer, the contract, the version its tag names, the stable
 * fact id, the stream position and the encoded payload.
 *
 * @category adapters
 * @since 0.0.0
 */
export const PartyFactsFeedLive = Layer.effect(
  PartyFactsFeed,
  Effect.map(Effect.service(PartyFacts), (facts) => ({
    read: ({ after, take }) =>
      facts.list("claims", { after, take }).pipe(
        Effect.flatMap((page) =>
          Effect.forEach(page.entries, ({ event, envelope }) =>
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
                  seq: envelope.seq,
                  payload,
                }),
              ),
            ),
          ),
        ),
        // The outbox holds only what Party encoded itself.
        Effect.orDie,
      ),
  })),
);
