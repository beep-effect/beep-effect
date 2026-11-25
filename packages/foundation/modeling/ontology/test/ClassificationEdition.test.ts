import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { ClassificationError, ClassificationPin } from "@beep/ontology/Classification.models";
import { ClassificationRegistry } from "@beep/ontology/ClassificationRegistry";
import {
  decodeVendorManifestRow,
  VendorContentDigestMissing,
  VendorSliceDigestMismatch,
  vendorDigestUnit,
} from "@beep/ontology/TaxonomyLoader";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

class EditionFixtureReadError extends S.TaggedError<EditionFixtureReadError, { readonly brand: unique symbol }>()(
  "EditionFixtureReadError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A fixture file could not be read from disk." }
) {}

const vendor = "test/fixtures/classification";
const manifest = `${vendor}/manifest.jsonl`;
const ipcPin = ClassificationPin.make({ kind: "ipc", edition: "2026.01" });
const cpcPin = ClassificationPin.make({ kind: "cpc", edition: "2026.08" });
const fixtureFiles = [
  manifest,
  `${vendor}/ipc.xml`,
  `${vendor}/nice-structure.xml`,
  `${vendor}/nice-texts.xml`,
  `${vendor}/cpc/cpc-scheme-fixture.xml`,
  `${vendor}/cpc/cpc-scheme-range.xml`,
];

const GoldenRow = S.Struct({ pin: ClassificationPin, id: S.NonEmptyString, digest: S.NonEmptyString });
const Golden = GoldenRow.pipe(S.Array, S.fromJsonString);

const readDisk = (path: string) =>
  Effect.tryPromise({
    try: () => Bun.file(path).text(),
    catch: (cause) => EditionFixtureReadError.make({ cause }),
  }).pipe(Effect.orDie);

const freshFixture = Effect.fnUntraced(function* () {
  const fs = yield* MemoryFileSystem.make;
  yield* fs.makeDirectory(`${vendor}/cpc`, { recursive: true });
  yield* Effect.forEach(
    fixtureFiles,
    Effect.fnUntraced(function* (file) {
      const content = yield* readDisk(file);
      yield* fs.writeFileString(file, content);
    }),
    { concurrency: 1 }
  );
  return fs;
});

const withFixture = <A, E>(
  body: () => Effect.Effect<A, E, FileSystem.FileSystem | ClassificationRegistry | Digest.Digest>
) =>
  Effect.fnUntraced(function* () {
    const fs = yield* freshFixture();
    return yield* body().pipe(Effect.provideService(FileSystem.FileSystem, fs));
  });

const tamper = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(path);
  yield* fs.writeFileString(path, Str.replace("Synthetic", "Synthetiq")(content));
});

const verifiedDigests = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(manifest);
  const lines = A.filter(Str.split(content, "\n"), Str.isNonEmpty);
  const rows = yield* Effect.forEach(lines, (line, index) => decodeVendorManifestRow(manifest, line, index), {
    concurrency: 1,
  });
  return A.map(rows, (row) => ({
    id: row.id,
    digest: vendorDigestUnit(row) === "file" ? O.getOrUndefined(row.sha256) : O.getOrUndefined(row.contentSha256),
  }));
});

const readGolden = Effect.fnUntraced(function* () {
  const text = yield* readDisk(`${vendor}/pins.golden.json`);
  return yield* S.decodeEffect(Golden)(text);
});

const matchesGolden = Effect.fnUntraced(function* () {
  const golden = yield* readGolden();
  const digests = yield* verifiedDigests();
  return A.every(golden, (row) => A.some(digests, (entry) => entry.id === row.id && entry.digest === row.digest));
});

it.layer(Layer.mergeAll(ClassificationRegistry.layer, Digest.layerWebCrypto), { timeout: "30 seconds" })(
  "L3-4 a pinned edition is immutable",
  (it) => {
    it.effect(
      "two loads of one pin are equal and every row's verified digest equals the golden",
      withFixture(
        Effect.fnUntraced(function* () {
          const registry = yield* ClassificationRegistry;
          const golden = yield* readGolden();
          yield* Effect.forEach(
            golden,
            Effect.fnUntraced(function* ({ pin }) {
              const first = yield* registry.load(manifest, vendor, pin);
              const second = yield* registry.load(manifest, vendor, pin);
              expect(Equal.equals(first, second)).toBe(true);
            }),
            { concurrency: 1 }
          );
          const digests = yield* verifiedDigests();
          const matches = yield* matchesGolden();
          expect(A.map(golden, (row) => row.id)).toEqual(A.map(digests, (row) => row.id));
          expect(matches).toBe(true);
        })
      )
    );

    it.effect(
      "a changed byte in a file or a tree fails with VendorSliceDigestMismatch naming the row",
      withFixture(
        Effect.fnUntraced(function* () {
          const registry = yield* ClassificationRegistry;
          const cases = [
            [ipcPin, `${vendor}/ipc.xml`, "ipc-fixture"],
            [cpcPin, `${vendor}/cpc/cpc-scheme-range.xml`, "cpc-fixture"],
          ] as const;
          yield* Effect.forEach(
            cases,
            Effect.fnUntraced(function* ([pin, path, id]) {
              yield* tamper(path);
              const error = yield* registry.load(manifest, vendor, pin).pipe(Effect.flip);
              expect(S.is(VendorSliceDigestMismatch)(error)).toBe(true);
              expect(S.is(VendorSliceDigestMismatch)(error) && error.id).toBe(id);
            }),
            { concurrency: 1 }
          );
        })
      )
    );

    it.effect(
      "a manifest row refreshed to tampered bytes loads but fails the golden",
      withFixture(
        Effect.fnUntraced(function* () {
          const registry = yield* ClassificationRegistry;
          const fs = yield* FileSystem.FileSystem;
          const digest = yield* Digest.Digest;
          const original = yield* fs.readFileString(manifest);
          yield* tamper(`${vendor}/ipc.xml`);
          const bytes = yield* fs.readFile(`${vendor}/ipc.xml`);
          const tampered = yield* digest.digestHex(Digest.sha256, bytes);
          yield* fs.writeFileString(
            manifest,
            Str.replace("9e36a0875ce07211674f462ad4f34ab0a170d2242f7fcc829d9078b45a1839ce", tampered)(original)
          );
          const snapshot = yield* registry.load(manifest, vendor, ipcPin);
          const golden = yield* matchesGolden();
          expect(snapshot.edition).toBe("2026.01");
          expect(golden).toBe(false);
        })
      )
    );

    it.effect(
      "an archive-entry or tree row without contentSha256 fails with VendorContentDigestMissing",
      withFixture(
        Effect.fnUntraced(function* () {
          const registry = yield* ClassificationRegistry;
          const fs = yield* FileSystem.FileSystem;
          const original = yield* fs.readFileString(manifest);
          const cases = [
            [cpcPin, Str.replace(/, "contentSha256": "[a-f0-9]{64}"/, "")(original), "tree"],
            [
              ipcPin,
              Str.replace('"path": "ipc.xml"', '"path": "ipc.xml", "archivePath": "ipc.zip"')(original),
              "archive-entry",
            ],
          ] as const;
          yield* Effect.forEach(
            cases,
            Effect.fnUntraced(function* ([pin, content, unit]) {
              yield* fs.writeFileString(manifest, content);
              const error = yield* registry.load(manifest, vendor, pin).pipe(Effect.flip);
              expect(S.is(VendorContentDigestMissing)(error)).toBe(true);
              expect(S.is(VendorContentDigestMissing)(error) && error.unit).toBe(unit);
            }),
            { concurrency: 1 }
          );
        })
      )
    );

    it.effect(
      "a pin with no matching edition is refused and there is no latest",
      withFixture(
        Effect.fnUntraced(function* () {
          const registry = yield* ClassificationRegistry;
          const editions = ["2025.01", "latest"];
          yield* Effect.forEach(
            editions,
            Effect.fnUntraced(function* (edition) {
              const error = yield* registry.load(manifest, vendor, { kind: "ipc", edition }).pipe(Effect.flip);
              expect(S.is(ClassificationError)(error) && error.reason).toBe("edition-unpinned");
            }),
            { concurrency: 1 }
          );
        })
      )
    );

    it.effect(
      "a cpc row must state the tree unit and other rows must not",
      withFixture(
        Effect.fnUntraced(function* () {
          const registry = yield* ClassificationRegistry;
          const fs = yield* FileSystem.FileSystem;
          const original = yield* fs.readFileString(manifest);
          const cases = [
            [cpcPin, Str.replace('"digestUnit": "tree", ', "")(original)],
            [ipcPin, Str.replace('"path": "ipc.xml"', '"path": "ipc.xml", "digestUnit": "tree"')(original)],
          ] as const;
          yield* Effect.forEach(
            cases,
            Effect.fnUntraced(function* ([pin, content]) {
              yield* fs.writeFileString(manifest, content);
              const error = yield* registry.load(manifest, vendor, pin).pipe(Effect.flip);
              expect(S.is(ClassificationError)(error) && error.reason).toBe("manifest-invalid");
            }),
            { concurrency: 1 }
          );
        })
      )
    );
  }
);
