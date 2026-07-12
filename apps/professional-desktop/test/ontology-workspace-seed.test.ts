import {
  OntologyFilePath,
  OntologyFileStore,
  OntologyFileStoreError,
  SerializeTurtleResult,
  TurtleCodec,
} from "@beep/ontology-use-cases/aggregates/Session";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import * as S from "effect/Schema";
import { seedPizzaTutorial } from "@/ontology/OntologyWorkspaceSeed";

const path = S.decodeUnknownSync(OntologyFilePath)("tmp/ontology-workbench/pizza-tutorial.ttl");

const codecLayer = Layer.succeed(
  TurtleCodec,
  TurtleCodec.of({
    parse: () => Effect.die("not used"),
    serialize: () => Effect.succeed(SerializeTurtleResult.make({ source: "@prefix ex: <https://example.org/> ." })),
  })
);

// The seed decides to write from a *read failure*. Treating every read failure as
// "the file is absent" — which an unqualified `Effect.option` does — overwrites a
// document that exists but could not be read (a permissions error, a transient
// fault) with the starter fixture, destroying the user's work.
const storeLayer = (readError: OntologyFileStoreError["reason"], writes: Ref.Ref<number>) =>
  Layer.succeed(
    OntologyFileStore,
    OntologyFileStore.of({
      read: () =>
        Effect.fail(OntologyFileStoreError.make({ reason: readError, path, message: `read failed (${readError})` })),
      write: () => Ref.update(writes, (count) => count + 1),
    })
  );

describe("ontology workspace seed", () => {
  it.effect(
    "seeds the starter document when it is absent",
    Effect.fnUntraced(function* () {
      const writes = yield* Ref.make(0);
      yield* seedPizzaTutorial().pipe(Effect.provide(Layer.merge(storeLayer("notFound", writes), codecLayer)));
      expect(yield* Ref.get(writes)).toBe(1);
    })
  );

  it.effect(
    "refuses to overwrite a document it could not read",
    Effect.fnUntraced(function* () {
      const writes = yield* Ref.make(0);
      const exit = yield* seedPizzaTutorial().pipe(
        Effect.provide(Layer.merge(storeLayer("readFailed", writes), codecLayer)),
        Effect.exit
      );
      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(writes)).toBe(0);
    })
  );
});
