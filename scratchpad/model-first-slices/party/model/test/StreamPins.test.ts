import * as InMemory from "@alchemy.run/domain/InMemory";
import { Internals } from "@alchemy.run/domain/Model";
import { expect, it } from "@effect/vitest";
import { Sequence } from "@proto/kernel/Measure";
import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import { Authority } from "@proto/party-model/Authority.external";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { ContactSource } from "@proto/party-model/Evidence/ContactSource.external";
import { claimDecisionsLive, ClaimDecisionsVersion } from "@proto/party-model/Facts/ClaimDecisions.handler";
import { partyStreamPins } from "@proto/party-model/Facts/StreamPins";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import { checkPublishedStreams, liveStreamsOf, StreamDrift } from "@proto/tooling/PublishedStreams";
import * as A from "@beep/utils/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// Phase 9 (D43): Party's published streams, as the hosted model has them, against `StreamPins.ts`.
// Only hosting knows a projection's Layer version and the views it inherits from, so the check reads
// the hosted kernel.

/** No port is called: nothing is sent. */
const ports = Layer.mergeAll(
  Authority.toLayer(Effect.succeed({ readmit: () => Effect.die("unused") })),
  ReviewRuns.toLayer(
    Effect.succeed({
      open: () => Effect.die("unused"),
      reserve: () => Effect.die("unused"),
      settle: () => Effect.die("unused"),
      release: () => Effect.die("unused"),
      step: () => Effect.die("unused"),
      awaitApproval: () => Effect.die("unused"),
      exhaust: () => Effect.die("unused"),
      refuse: () => Effect.die("unused"),
    }),
  ),
  Reasoner.toLayer(Effect.succeed({ assess: () => Effect.die("unused") })),
  ContactSource.toLayer(Effect.succeed({ observe: () => Effect.die("unused") })),
);

/** Party hosted with `handlers`, and its streams as the hosted kernel sees them. */
const hostedStreams = Effect.fn("hostedStreams")(function* (handlers: typeof PartyHandlers) {
  const platform = InMemory.make();
  const hosted = yield* Layer.build(
    PartyModel.layer(handlers).pipe(Layer.provide(Layer.mergeAll(platform.layer, ports, MemoryPartyDirectoryStore))),
  );
  const { kernel } = Context.get(hosted, Internals);
  return liveStreamsOf(PartyModel, kernel.generationOf);
});

it.effect("the deployed model matches its pins", () =>
  Effect.gen(function* () {
    const live = yield* hostedStreams(PartyHandlers);
    yield* checkPublishedStreams(partyStreamPins, live);
  }),
);

it.effect.prop("bumping the publisher by any number of versions without a new stream generation fails the check", [Sequence], ([bump]) =>
  Effect.gen(function* () {
    const live = yield* hostedStreams(Layer.merge(PartyHandlers, claimDecisionsLive(ClaimDecisionsVersion + bump)));
    const failure = yield* Effect.flip(checkPublishedStreams(partyStreamPins, live));
    // The one open pin is the stream the bumped publisher writes; its generation moves by the bump.
    const open = yield* Effect.fromOption(A.findFirst(partyStreamPins, StreamPin.guards.Open)).pipe(Effect.orDie);
    expect(failure.drift).toEqual([
      StreamDrift.cases.Changed.make({
        stream: open.stream,
        pinned: open.writer,
        live: StreamWriter.make({ ...open.writer, generation: open.writer.generation + bump }),
      }),
    ]);
  }),
);
