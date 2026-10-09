import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { canaryBuilders } from "../fixtures/SecretScrub.fixtures.ts";

/** Count exact runtime canaries without exposing a match. */
export const countCanaries: {
  (text: string, builders: ReadonlyArray<() => string>): number;
  (builders: ReadonlyArray<() => string>): (text: string) => number;
} = dual(2, (text: string, builders: ReadonlyArray<() => string>) =>
  A.reduce(builders, 0, (count, build) => count + A.length(Str.split(text, build())) - 1)
);

class CanaryScanError extends S.TaggedError<CanaryScanError>()("CanaryScanError", { message: S.String }) {}
const readSurface = (file: Bun.BunFile) =>
  Effect.tryPromise({
    try: () => file.text(),
    catch: () => CanaryScanError.make({ message: "Could not read scan surface" }),
  });
if (import.meta.main) {
  const main = Effect.gen(function* () {
    const files = A.drop(process.argv, 2);
    const surfaces = A.match(files, { onEmpty: () => ["stdin"], onNonEmpty: (values) => values });
    let total = 0;
    yield* Effect.forEach(
      surfaces,
      Effect.fnUntraced(function* (surface) {
        const text = yield* readSurface(surface === "stdin" ? Bun.stdin : Bun.file(surface));
        const count = countCanaries(text, canaryBuilders);
        total += count;
        process.stdout.write(`${surface}: ${count}\n`);
      }),
      { concurrency: 1 }
    );
    return total;
  });
  const count = await Effect.runPromise(main);
  process.exitCode = count > 0 ? 1 : 0;
}
