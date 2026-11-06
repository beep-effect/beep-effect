/** Synthetic maintainer benchmark child; never a production worker. */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const program = Effect.gen(function* () {
  const input = yield* S.decodeUnknownEffect(
    S.Struct({
      control: S.Literals(["safe-linear", "catastrophic-backtracking"]),
      size: S.NumberFromString.pipe(S.check(S.isInt(), S.isGreaterThanOrEqualTo(8), S.isLessThanOrEqualTo(512))),
    })
  )({ control: process.argv[2], size: process.argv[3] });
  const safe = input.control === "safe-linear";
  const pattern = new RegExp(safe ? "^a+$" : "^(a+)+$");
  const text = safe ? "a".repeat(input.size) : `${"a".repeat(input.size - 1)}!`;
  const measure = () => {
    let matched;
    for (let index = 0; index < 256; index++) matched = pattern.test(text);
    return matched;
  };
  yield* Console.log("started");
  for (let index = 0; index < 2; index++) yield* Effect.sync(measure);
  const samplesNanos = [];
  let matched;
  for (let index = 0; index < 5; index++) {
    const start = yield* Clock.currentTimeNanos;
    matched = yield* Effect.sync(measure);
    const end = yield* Clock.currentTimeNanos;
    samplesNanos.push(Number(end - start));
  }
  yield* Console.log(
    yield* S.encodeUnknownEffect(S.fromJsonString(S.JsonObject))({
      control: input.control,
      size: input.size,
      matched,
      samplesNanos,
      runtime: process.version,
      bunVersion: globalThis.Bun?.version ?? null,
      warmups: 2,
      repetitions: 5,
      evaluationsPerSample: 256,
      totalEvaluations: 1792,
    })
  );
});
NodeRuntime.runMain(program);
