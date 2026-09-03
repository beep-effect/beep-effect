import {
  OntologyFilePath,
  OntologyFileStore,
  OntologyFileStoreError,
  ReadOntologyFileResult,
  SerializeTurtleResult,
  TurtleCodec,
} from "@beep/ontology-use-cases/aggregates/Session";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { seedPizzaTutorial } from "@/ontology/OntologyWorkspaceSeed";

const path = S.decodeSync(OntologyFilePath)("tmp/ontology-workbench/pizza-tutorial.ttl");

const codec = TurtleCodec.of({
  parse: Effect.fn("OntologyWorkspaceSeedTest.TurtleCodec.parse")(() => Effect.die("not used")),
  serialize: Effect.fn("OntologyWorkspaceSeedTest.TurtleCodec.serialize")(() =>
    Effect.succeed(SerializeTurtleResult.make({ source: "@prefix ex: <https://example.org/> ." }))
  ),
});

// The seed decides to write from a *read failure*. Treating every read failure as
// "the file is absent" — which an unqualified `Effect.option` does — overwrites a
// document that exists but could not be read (a permissions error, a transient
// fault) with the starter fixture, destroying the user's work.
const store = (readError: OntologyFileStoreError["reason"], writes: Ref.Ref<number>) =>
  OntologyFileStore.of({
    read: Effect.fn("OntologyWorkspaceSeedTest.OntologyFileStore.read")(() =>
      Effect.fail(OntologyFileStoreError.make({ reason: readError, path, message: `read failed (${readError})` }))
    ),
    write: Effect.fn("OntologyWorkspaceSeedTest.OntologyFileStore.write")(() =>
      Ref.update(writes, (count) => count + 1)
    ),
  });

const provideStore = (readError: OntologyFileStoreError["reason"], writes: Ref.Ref<number>) =>
  Effect.provideService(OntologyFileStore, store(readError, writes));

describe("ontology workspace seed", () => {
  it.effect(
    "preserves an existing starter document",
    Effect.fnUntraced(function* () {
      const writes = yield* Ref.make(0);
      const existingStore = OntologyFileStore.of({
        read: Effect.fn("OntologyWorkspaceSeedTest.OntologyFileStore.readExisting")((request) =>
          Effect.succeed(ReadOntologyFileResult.make({ path: request.path, source: "existing ontology" }))
        ),
        write: Effect.fn("OntologyWorkspaceSeedTest.OntologyFileStore.writeExisting")(() =>
          Ref.update(writes, (count) => count + 1)
        ),
      });

      yield* seedPizzaTutorial().pipe(
        Effect.provideService(OntologyFileStore, existingStore),
        Effect.provideService(TurtleCodec, codec)
      );

      expect(yield* Ref.get(writes)).toBe(0);
    })
  );

  it.effect(
    "seeds the starter document when it is absent",
    Effect.fnUntraced(function* () {
      const writes = yield* Ref.make(0);
      yield* seedPizzaTutorial().pipe(provideStore("notFound", writes), Effect.provideService(TurtleCodec, codec));
      expect(yield* Ref.get(writes)).toBe(1);
    })
  );

  it.effect(
    "refuses to overwrite a document it could not read",
    Effect.fnUntraced(function* () {
      const writes = yield* Ref.make(0);
      const exit = yield* seedPizzaTutorial().pipe(
        provideStore("readFailed", writes),
        Effect.provideService(TurtleCodec, codec),
        Effect.exit
      );
      expect(exit._tag).toBe("Failure");
      expect(yield* Ref.get(writes)).toBe(0);
    })
  );
});
