import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CommentStyle } from "@beep/managed-section/CommentStyle";
import { ManagedSection, ManagedSectionTestError, SectionFileError } from "@beep/managed-section/ManagedSection";
import { Section, SectionId } from "@beep/managed-section/Section";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name} decodes its encoded values without failure`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(equivalent(decoded, value));
      }),
    runs
  );
};

describe("ManagedSection schema properties", () => {
  roundTrips("SectionFileError", SectionFileError);
  roundTrips("ManagedSectionTestError", ManagedSectionTestError);
});

// A pinned ported-memfs layer lets the property observe actual writes.
let writes = 0;
let iteration = 0;
const fs = MemoryFileSystem.makeSync(
  {},
  {
    faults: {
      writeFileString: () => {
        writes += 1;
        return undefined;
      },
    },
  }
);
it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "syncing an up-to-date UTF-8 file writes nothing and round-trips through read",
    [Arbitrary.schema(S.String)],
    ([value]) =>
      Effect.gen(function* () {
        iteration += 1;
        const path = `file-${iteration}`;
        const initialWrites = writes;
        // Filesystem text is UTF-8: replace lone UTF-16 surrogates before declaring it.
        const content = `data:${Str.replace(/\n/g, "\ndata:")(Str.replace(/\r/g, "")(value.toWellFormed()))}`;
        const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
        const section = id.section(content);
        const service = yield* ManagedSection;
        assert.strictEqual((yield* service.sync(path, section))._tag, "Created");
        const written = fs.volume.text(path);
        assert.strictEqual(writes, initialWrites + 1);
        assert.strictEqual((yield* service.sync(path, section))._tag, "Unchanged");
        assert.strictEqual(writes, initialWrites + 1);
        assert.strictEqual(fs.volume.text(path), written);
        const recovered = yield* Effect.fromOption(yield* service.read(path, id));
        assert.isTrue(S.toEquivalence(Section)(recovered, section));
      }),
    runs
  );
});
