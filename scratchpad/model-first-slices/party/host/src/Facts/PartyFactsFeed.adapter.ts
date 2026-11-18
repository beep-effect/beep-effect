import { FactEnvelope } from "@proto/kernel/Fact"
import { type LiveGeneration, StreamPin } from "@proto/kernel/PublishedStream"
import type {
  ClaimDecidedV1,
  ClaimDecidedV2
} from "@proto/party-contract/Facts/ClaimDecided.fact"
import { ClaimDecided } from "@proto/party-contract/Facts/ClaimDecided.fact"
import { PartyFactsFeed } from "@proto/party-contract/Facts/PartyFacts.gateway"
import { PartyFacts } from "@proto/party-model/Facts/PartyFacts.stream"
import { PartyFacts2 } from "@proto/party-model/Facts/PartyFacts2.stream"
import { partyStreamPins } from "@proto/party-model/Facts/StreamPins"
import * as A from "@beep/utils/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Match from "effect/Match"
import * as N from "effect/Number"
import * as O from "@beep/utils/Option"
import * as S from "effect/Schema"
import { flow, pipe } from "effect/Function"
import { thunk0 } from "@beep/utils/thunk"

const encodeV1 = S.encodeEffect(S.toCodecJson(ClaimDecided.versions[1]))
const encodeV2 = S.encodeEffect(S.toCodecJson(ClaimDecided.versions[2]))

/** An entry of either generation, as both streams hold it. */
type Entry = {
  readonly event: ClaimDecidedV1 | ClaimDecidedV2;
  readonly envelope: { readonly seq: number }
};

/** `encode`, with its payload tagged by the `version` it encodes. */
const versioned = <A, I, E>(version: number, encode: (event: A) => Effect.Effect<I, E>) =>
  flow(encode, Effect.map((payload) => ({ version, payload })))

/** An entry's version and payload, as that version encodes it. */
const encoded = (event: ClaimDecidedV1 | ClaimDecidedV2) =>
  Match.value(event).pipe(
    Match.tagsExhaustive({
      ClaimDecidedV1: versioned(1, encodeV1),
      ClaimDecidedV2: versioned(2, encodeV2)
    })
  )

/** The envelope of an entry served at `offset` plus its stream position. */
const envelopeAt = (offset: number) => ({ event, envelope }: Entry) =>
  encoded(event).pipe(
    Effect.map(({ version, payload }) =>
      FactEnvelope.make({
        producer: ClaimDecided.producer,
        contract: ClaimDecided.contract,
        version,
        factId: event.factId,
        seq: offset + envelope.seq,
        payload
      })
    )
  )

/** The envelopes of `entries` served at `offset`, in order. */
const envelopesAt = (offset: number) => (entries: ReadonlyArray<Entry>) =>
  Effect.forEach(entries, envelopeAt(offset), { concurrency: 1 })

/** A stream's page reader, as both generations offer it. */
type Pages = {
  readonly list: (key: "claims", options: {
    readonly after: number;
    readonly take: number
  }) => Effect.Effect<{ readonly entries: ReadonlyArray<Entry> }>
};

const allOf = (stream: Pages, after: number, read: ReadonlyArray<Entry>): Effect.Effect<ReadonlyArray<Entry>> =>
  Effect.flatMap(stream.list("claims", { after, take: 100 }), ({ entries }) =>
    O.match(A.last(entries), {
      onNone: () => Effect.succeed(read),
      onSome: (last) => allOf(stream, last.envelope.seq, A.appendAll(read, entries))
    })
  )

/**
 * A generation's entries as the retirement check reads them (D51): each at
 * its position in the generation, with its fact id and the payload its
 * version encodes, as the feed serves it.
 *
 * **Example** (Reading generation 2 for the check)
 * ```ts
 * import { liveGenerationOf } from "@proto/party-host/Facts/PartyFactsFeed.adapter";
 * import { PartyFacts2 } from "@proto/party-model/Facts/PartyFacts2.stream";
 * import * as Effect from "effect/Effect";
 *
 * const generation = Effect.gen(function* () {
 *   const stream = yield* PartyFacts2;
 *   return yield* liveGenerationOf("PartyFacts2")(stream);
 * });
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const liveGenerationOf = (name: string) => (stream: Pages): Effect.Effect<LiveGeneration> =>
  Effect.flatMap(allOf(stream, 0, []), (entries) =>
    Effect.map(
      Effect.forEach(entries, ({ event, envelope }) =>
          pipe(encoded(event), Effect.map(
            ({
               version,
               payload
             }) => ({
              position: envelope.seq,
              factId: event.factId,
              version,
              payload
            }))),
        { concurrency: 1 }
      ),
      (read) => ({ stream: name, entries: read })
    )
  ).pipe(
    // The outbox holds only what Party encoded itself.
    Effect.orDie
  )

/** The length `pins` fixes for generation 1, once its pin is retired. */
const retiredLengthOf = (pins: ReadonlyArray<StreamPin>) =>
  A.findFirst(pins, (pin) => StreamPin.guards.Retired(pin) && pin.stream === "PartyFacts" ? O.some(pin.length) : O.none())

/** Party's fact feed over both generations' outboxes, under `pins`. */
const makePartyFactsFeed = Effect.fnUntraced(function* (pins: ReadonlyArray<StreamPin>) {
  const closed = yield* PartyFacts
  const open = yield* PartyFacts2
  const retired = retiredLengthOf(pins)
  return PartyFactsFeed.of({
    read: Effect.fn("PartyFactsFeed.read")(
      function* ({ after, take }) {
        const closedLength = yield* O.match(retired, {
          onSome: Effect.succeed,
          onNone: () => closed.peek("claims").pipe(Effect.map(O.match({
            onNone: thunk0,
            onSome: (entry) => entry.envelope.seq
          })))
        })
        const first = O.isNone(retired) && after < closedLength ? (yield* closed.list("claims", {
          after,
          take
        })).entries : []
        const rest = take - A.length(first)
        const second = rest > 0 ? (yield* open.list("claims", {
          after: N.max(after - closedLength, 0),
          take: rest
        })).entries : []
        const served = yield* envelopesAt(0)(first)
        const followed = yield* envelopesAt(closedLength)(second)
        return A.appendAll(served, followed)
      },
      // The outbox holds only what Party encoded itself, and a peek without `atLeast` never waits.
      Effect.orDie
    )
  })
})

/**
 * Party's fact feed over its outbox, under `pins`, its generations in order:
 * each entry becomes an envelope with the producer, the contract, the version
 * its tag names, the stable fact id, its feed position and the encoded
 * payload.
 *
 * **Details**
 *
 * Generation 1 (`PartyFacts`) is closed, so its length is fixed: its entries
 * keep their positions, 1 to its length, and generation 2 (`PartyFacts2`)
 * follows at that length plus its own position. A checkpoint taken before
 * phase 9 therefore still means the same place. Generation 2 republishes the
 * decisions generation 1 holds, under the same fact ids; consumers drop
 * those by producer, fact id and version. Once generation 1's pin is retired
 * (D51), the feed no longer serves it, and its pin's length places
 * generation 2 where it was.
 *
 * **Example** (The feed with generation 1 retired)
 * ```ts
 * import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
 * import { partyFactsFeedFor } from "@proto/party-host/Facts/PartyFactsFeed.adapter";
 *
 * const feed = partyFactsFeedFor([
 *   StreamPin.cases.Retired.make({ stream: "PartyFacts", length: 2 }),
 *   StreamPin.cases.Open.make({ stream: "PartyFacts2", writer: StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] }) }),
 * ]);
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const partyFactsFeedFor = flow(makePartyFactsFeed, Layer.effect(PartyFactsFeed))

/**
 * Party's fact feed under its pins (`partyStreamPins`).
 *
 * @category adapters
 * @since 0.0.0
 */
export const PartyFactsFeedLive = partyFactsFeedFor(partyStreamPins)
