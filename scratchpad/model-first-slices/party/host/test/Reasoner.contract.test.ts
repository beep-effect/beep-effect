import { expect, it } from "@effect/vitest";
import { RunId } from "@proto/kernel/Ids";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { assessWithFixture, FixtureReasoner } from "@proto/party-host/Review/FixtureReasoner.adapter";
import { memoryTape, ReasonerTape, TapeJson } from "@proto/party-host/Review/ReasonerTape";
import { recordingReasoner } from "@proto/party-host/Review/RecordingReasoner.adapter";
import { ReplayReasoner } from "@proto/party-host/Review/ReplayReasoner.adapter";
import { type AssessRequest, Reasoner } from "@proto/party-model/Review/Reasoner.external";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

const proposition = Proposition.cases.HasIdentifier.make({
  party: PartyId.make("party_dana"),
  scheme: "email",
  value: "dana@acme.test",
});
const request = (key: string, signals: number, maxAllowance = 40): AssessRequest => ({
  run: RunId.make("run_eval"),
  step: "assess",
  idempotencyKey: key,
  promptVersion: "review-v1",
  maxAllowance,
  proposition,
  signals: Array.from({ length: signals }, (_, i) => EvidenceSignal.make({ source: `source-${i}`, quote: "says so" })),
});
const keys = [request("k-one", 1), request("k-two", 2), request("k-many", 12, 20)];

/** The recorded tape a replay serves: the recording adapter's output, through its JSON fixture form. */
const recordedTape = Effect.gen(function* () {
  const recorded = yield* Effect.scoped(
    Effect.gen(function* () {
      const recording = yield* Layer.build(recordingReasoner(assessWithFixture).pipe(Layer.provideMerge(memoryTape())));
      return yield* Effect.gen(function* () {
        const reasoner = yield* Reasoner;
        yield* Effect.forEach(keys, (call) => reasoner.assess(call), { concurrency: 1, discard: true });
        const tape = yield* ReasonerTape;
        return yield* tape.entries;
      }).pipe(Effect.provideContext(recording));
    }),
  );
  const fixture = yield* S.encodeEffect(TapeJson)(recorded);
  return yield* S.decodeEffect(TapeJson)(fixture);
});
const replayed = Layer.unwrap(Effect.map(recordedTape, (entries) => ReplayReasoner.pipe(Layer.provide(memoryTape(entries)))));

const adapters = [
  ["fixture", FixtureReasoner],
  ["recording", recordingReasoner(assessWithFixture).pipe(Layer.provide(memoryTape()))],
  ["replay", replayed],
] as const;

// One contract, every adapter (D19): every call is checked against the port's schemas on the way in and out.
// Each test builds its adapter afresh, as a provide per test did.
for (const [name, adapter] of adapters) {
  it.layer(adapter, { buildPerTest: true })(`Reasoner contract: ${name}`, (it) => {
    it.effect("usage stays within the call's allowance, and the receipt names the key and prompt version", () =>
      Effect.gen(function* () {
        const reasoner = yield* Reasoner;
        for (const call of keys) {
          const assessed = yield* reasoner.assess(call);
          expect(assessed.usage.units).toBeLessThanOrEqual(call.maxAllowance);
          expect(assessed.receipt).toMatchObject({ idempotencyKey: call.idempotencyKey, promptVersion: call.promptVersion });
        }
      }),
    );

    it.effect("a retried call with the same idempotency key returns the first answer", () =>
      Effect.gen(function* () {
        const reasoner = yield* Reasoner;
        const first = yield* reasoner.assess(keys[1]!);
        const again = yield* reasoner.assess(keys[1]!);
        expect(again).toEqual(first);
      }),
    );

    it.effect("one source proposes reject, two independent sources propose accept", () =>
      Effect.gen(function* () {
        const reasoner = yield* Reasoner;
        const oneSource = yield* reasoner.assess(keys[0]!);
        expect(oneSource.assessment.disposition).toBe("reject");
        const twoSources = yield* reasoner.assess(keys[1]!);
        expect(twoSources.assessment.disposition).toBe("accept");
      }),
    );
  });
}

it.layer(replayed)((it) => {
  it.effect("replay refuses a call it never recorded, so a changed prompt cannot pass an evaluation silently", () =>
    Effect.gen(function* () {
      const reasoner = yield* Reasoner;
      const changedPrompt = yield* reasoner.assess({ ...keys[0]!, promptVersion: "review-v2" }).pipe(Effect.flip);
      expect(changedPrompt).toMatchObject({ _tag: "ReasonerUnavailable" });
    }),
  );
});
