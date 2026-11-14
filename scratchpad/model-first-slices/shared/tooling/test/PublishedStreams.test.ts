import { expect, it } from "@effect/vitest";
import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import { checkPublishedStreams, driftOf, type LiveStream, StreamDrift } from "@proto/tooling/PublishedStreams";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

// Phase 9 (D43): a projection feeding a published stream cannot be rebuilt or re-sourced in place;
// it writes a new stream generation, pinned, and the old one is pinned closed.

const opened = StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] });
const pins = [
  StreamPin.cases.Closed.make({ stream: "PartyFacts" }),
  StreamPin.cases.Open.make({ stream: "PartyFacts2", writer: opened }),
];
const live = (writer: O.Option<StreamWriter>): ReadonlyArray<LiveStream> => [
  { stream: "PartyFacts", writer: O.none() },
  { stream: "PartyFacts2", writer },
];

it.effect("the writer a generation was opened with passes, whatever order its sources are listed in", () =>
  Effect.gen(function* () {
    yield* checkPublishedStreams(pins, live(O.some(opened)));
    yield* checkPublishedStreams(
      [StreamPin.cases.Open.make({ stream: "S", writer: { ...opened, sources: ["A", "B"] } })],
      [{ stream: "S", writer: O.some({ ...opened, sources: ["B", "A"] }) }],
    );
  }),
);

it.effect("a bumped version, or a view's bump the writer inherits, fails as a change", () =>
  Effect.gen(function* () {
    const bumped = { ...opened, generation: 1 };
    const failure = yield* Effect.flip(checkPublishedStreams(pins, live(O.some(bumped))));
    expect(failure.drift).toEqual([StreamDrift.cases.Changed.make({ stream: "PartyFacts2", pinned: opened, live: bumped })]);
  }),
);

it.effect("an added, removed or replaced source fails as a change", () =>
  Effect.gen(function* () {
    const added = { ...opened, sources: ["Claim", "ClaimReview"] };
    const replaced = { ...opened, sources: ["ClaimReview"] };
    const removed = { ...opened, sources: [] };
    for (const writer of [added, replaced, removed]) {
      const drift = driftOf(pins, live(O.some(writer)));
      expect(drift).toEqual([StreamDrift.cases.Changed.make({ stream: "PartyFacts2", pinned: opened, live: writer })]);
    }
  }),
);

it.effect("another projection writing an open generation fails as a change", () =>
  Effect.gen(function* () {
    const other = { ...opened, projection: "ClaimFacts" };
    expect(driftOf(pins, live(O.some(other)))).toEqual([
      StreamDrift.cases.Changed.make({ stream: "PartyFacts2", pinned: opened, live: other }),
    ]);
  }),
);

it.effect("a change made the right way passes: the old generation pinned closed, the new one opened", () =>
  Effect.gen(function* () {
    const rebuilt = { ...opened, generation: 1 };
    yield* checkPublishedStreams(
      [
        StreamPin.cases.Closed.make({ stream: "PartyFacts" }),
        StreamPin.cases.Closed.make({ stream: "PartyFacts2" }),
        StreamPin.cases.Open.make({ stream: "PartyFacts3", writer: rebuilt }),
      ],
      [
        { stream: "PartyFacts", writer: O.none() },
        { stream: "PartyFacts2", writer: O.none() },
        { stream: "PartyFacts3", writer: O.some(rebuilt) },
      ],
    );
  }),
);

it.effect("a closed generation written again, an open one left unwritten, an unpinned stream and a dropped one all fail", () =>
  Effect.gen(function* () {
    const failure = yield* Effect.flip(
      checkPublishedStreams(pins, [
        { stream: "PartyFacts", writer: O.some(opened) },
        { stream: "Other", writer: O.none() },
      ]),
    );
    expect(failure.drift).toEqual([
      StreamDrift.cases.Reopened.make({ stream: "PartyFacts", writer: opened }),
      StreamDrift.cases.Unpinned.make({ stream: "Other" }),
      StreamDrift.cases.Undeclared.make({ stream: "PartyFacts2" }),
    ]);
    expect(driftOf(pins, live(O.none()))).toEqual([StreamDrift.cases.Unwritten.make({ stream: "PartyFacts2", pinned: opened })]);
  }),
);
