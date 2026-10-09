import * as Effect from "effect/Effect";

export default function globalCleanup() {
  return Effect.runPromise(Effect.gen(function* () {}));
}
