import { it } from "@beep/test-runner";
import { WinkEngine, WinkEngineLive, WinkIntrinsicNounRequest, winkIntrinsicNounQueryCost } from "@beep/wink";
import { constructWinkWithIntrinsicOwner } from "@beep/wink/test";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import model from "wink-eng-lite-web-model";

const samples = [
  { word: "joint", pos: "ADJ", noun: true, oov: false },
  { word: "terminal", pos: "NOUN", noun: true, oov: false },
  { word: "inaccessible", pos: "ADJ", noun: false, oov: false },
  { word: "unpainted", pos: "ADJ", noun: false, oov: false },
  { word: "smooth", pos: "ADJ", noun: true, oov: false },
  { word: "porous", pos: "ADJ", noun: false, oov: false },
  { word: "green", pos: "ADJ", noun: true, oov: false },
  { word: "elderly", pos: "ADJ", noun: true, oov: false },
  { word: "nouffle", pos: "NOUN", noun: false, oov: true },
];
const rawAndIntrinsic = Effect.fn("IntrinsicTest.observations")(function* () {
  const engine = yield* WinkEngine;
  const capability = yield* engine.intrinsicNoun;
  const repeated = yield* engine.intrinsicNoun;
  assert.strictEqual(capability, repeated);
  assert.strictEqual(capability.provider, "wink-nlp@2.4.0/wink-eng-lite-web-model@1.8.1");
  const its = yield* engine.its;
  for (const sample of samples) {
    const tokens = yield* engine.getWinkTokens(`A system comprising a welded ${sample.word} is fixed.`);
    const token = A.findFirst(tokens, (token) => token.out(its.value) === sample.word).pipe(O.getOrThrow);
    assert.strictEqual(token.out(its.pos), sample.pos);
    const result = yield* capability.query(
      WinkIntrinsicNounRequest.make({ rawForm: sample.word, remainingWork: 262_144 })
    );
    assert.strictEqual(result.status, "known");
    if (result.status !== "known") return;
    assert.strictEqual(result.rawForm, sample.word);
    assert.strictEqual(result.baseNoun, sample.noun);
    assert.strictEqual(result.oov, sample.oov);
    assert.strictEqual(result.workDebit, winkIntrinsicNounQueryCost(sample.word));
    assert.strictEqual(result.remainingWork + result.workDebit, 262_144);
  }
});
const budgetAndOov = Effect.fn("IntrinsicTest.budgetAndOov")(function* () {
  const engine = yield* WinkEngine;
  const capability = yield* engine.intrinsicNoun;
  const declined = yield* capability.query(WinkIntrinsicNounRequest.make({ rawForm: "joint", remainingWork: 1 }));
  assert.deepStrictEqual(
    { status: declined.status, remaining: declined.remainingWork, debit: declined.workDebit },
    { status: "work-limit", remaining: 1, debit: 0 }
  );
  yield* engine.getWinkTokens("A system comprising a zzqxvproofowner.");
  const unknown = yield* capability.query(
    WinkIntrinsicNounRequest.make({ rawForm: "zzqxvproofowner", remainingWork: 262_144 })
  );
  const known = yield* capability.query(WinkIntrinsicNounRequest.make({ rawForm: "joint", remainingWork: 262_144 }));
  assert.strictEqual(unknown.status, "known");
  assert.strictEqual(known.status, "known");
  if (unknown.status === "known") {
    assert.strictEqual(unknown.oov, true);
    assert.strictEqual(unknown.baseNoun, false);
  }
  if (known.status === "known") assert.strictEqual(known.baseNoun, true);
});
describe("intrinsic membership preserves raw contextual POS and engine ownership", () => {
  it.effect("retains an actual synchronous engine initialization failure as typed availability", () =>
    Effect.gen(function* () {
      const cause = "synthetic SDK constructor failure";
      const failingEngine: typeof import("wink-nlp").default = () => {
        throw cause;
      };
      const result = yield* Effect.result(constructWinkWithIntrinsicOwner(failingEngine, model));
      assert.strictEqual(Result.isFailure(result), true);
      if (Result.isFailure(result)) {
        assert.strictEqual(result.failure._tag, "WinkEngineError");
        if (result.failure._tag === "WinkEngineError") {
          assert.strictEqual(result.failure.cause, cause);
          assert.strictEqual(result.failure.operation, "initialize");
        }
      }
    })
  );

  it.layer(WinkEngineLive, { timeout: "30 seconds" })("one owning engine", (it) => {
    it.effect("retains nine raw observations and exact-form membership", rawAndIntrinsic);
    it.effect("refuses insufficient work and remains intrinsic after OOV tokenization", budgetAndOov);
    it.effect("refuses a replaced runtime reference after reserving the actual query debit", () =>
      Effect.gen(function* () {
        const engine = yield* WinkEngine;
        const capability = yield* engine.intrinsicNoun;
        const ref = yield* engine.getRef;
        const original = yield* Ref.get(ref);
        const result = yield* Effect.gen(function* () {
          yield* Ref.set(ref, { ...original, nlp: { ...original.nlp } });
          return yield* Effect.result(
            capability.query(WinkIntrinsicNounRequest.make({ rawForm: "joint", remainingWork: 262_144 }))
          );
        }).pipe(Effect.ensuring(Ref.set(ref, original)));
        assert.strictEqual(Result.isFailure(result), true);
        if (Result.isFailure(result)) {
          assert.strictEqual(result.failure.reason, "engine-replaced");
          assert.strictEqual(result.failure.workDebit, winkIntrinsicNounQueryCost("joint"));
          assert.strictEqual(result.failure.remainingWork + result.failure.workDebit, 262_144);
        }
      })
    );
  });
  it.effect("an escaped capability refuses query after its real engine scope releases", () =>
    Effect.gen(function* () {
      const capability = yield* Effect.scoped(
        Effect.gen(function* () {
          const context = yield* Layer.build(WinkEngineLive);
          const engine = Context.get(context, WinkEngine);
          return yield* engine.intrinsicNoun;
        })
      );
      const result = yield* Effect.result(
        capability.query(WinkIntrinsicNounRequest.make({ rawForm: "joint", remainingWork: 262_144 }))
      );
      assert.strictEqual(Result.isFailure(result), true);
      if (Result.isFailure(result)) assert.strictEqual(result.failure.reason, "released");
    })
  );
});
