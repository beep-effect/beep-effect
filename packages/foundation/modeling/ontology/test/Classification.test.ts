import {
  ClassificationConcept,
  ClassificationError,
  ClassificationPin,
  ClassificationSnapshot,
  CpcSymbol,
  IpcSymbol,
  NiceBasicNumber,
  NiceClassNumber,
} from "@beep/ontology/Classification.models";
import { ClassificationRegistry } from "@beep/ontology/ClassificationRegistry";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const manifest = "test/fixtures/classification/manifest.jsonl";
const vendor = "test/fixtures/classification";
const ipcPin = ClassificationPin.make({ kind: "ipc", edition: "2026.01" });
const cpcPin = ClassificationPin.make({ kind: "cpc", edition: "2026.08" });
const nicePin = ClassificationPin.make({ kind: "nice", edition: "13-2026" });

it("checks authority-specific notation boundaries", () => {
  expect(S.is(IpcSymbol)("A01B1/02")).toBe(true);
  expect(S.is(IpcSymbol)("Y02A10/00")).toBe(false);
  expect(S.is(IpcSymbol)("A01B2001/00")).toBe(false);
  expect(S.is(CpcSymbol)("Y02A10/00")).toBe(true);
  expect(S.is(CpcSymbol)("A01B2001/00")).toBe(true);
  expect(S.is(CpcSymbol)("Z01B1/00")).toBe(false);
  expect(S.is(NiceClassNumber)("45")).toBe(true);
  expect(S.is(NiceClassNumber)("0")).toBe(false);
  expect(S.is(NiceClassNumber)("46")).toBe(false);
  expect(S.is(NiceBasicNumber)("010001")).toBe(true);
  expect(S.is(NiceBasicNumber)("460001")).toBe(false);
});

it.layer(Layer.merge(ClassificationRegistry.layer, BunFileSystem.layer))("classification registry", (it) => {
  it.effect(
    "CQ 9 loads pinned IPC and resolves both hierarchy directions",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const snapshot = yield* registry.load(manifest, vendor, ipcPin);
      expect(snapshot.concepts).toHaveLength(5);
      const concept = yield* registry.resolve(snapshot, ipcPin, "A01B1/02");
      expect(concept.prefLabel).toBe("Synthetic narrow IPC tool");
      expect(A.map(yield* registry.broader(snapshot, ipcPin, concept.notation), (value) => value.notation)).toEqual([
        "A01B1/00",
        "A01B",
        "A01",
        "A",
      ]);
      expect(A.map(yield* registry.narrower(snapshot, ipcPin, "A01B1/00"), (value) => value.notation)).toEqual([
        "A01B1/02",
      ]);
      expect(yield* registry.broader(snapshot, ipcPin, "A")).toEqual([]);
      expect(yield* registry.narrower(snapshot, ipcPin, "A01B1/02")).toEqual([]);
    })
  );

  it.effect(
    "CQ 10 keeps shared IPC/CPC notation distinct and resolves CPC-only codes",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const ipc = yield* registry.load(manifest, vendor, ipcPin);
      const cpc = yield* registry.load(manifest, vendor, cpcPin);
      const ipcConcept = yield* registry.resolve(ipc, ipcPin, "A01B1/02");
      const cpcConcept = yield* registry.resolve(cpc, cpcPin, "A01B1/02");
      expect(ipcConcept.iri).not.toBe(cpcConcept.iri);
      expect((yield* registry.resolve(cpc, cpcPin, "Y02A10/00")).kind).toBe("cpc");
      expect((yield* registry.resolve(cpc, cpcPin, "A01B2001/00")).kind).toBe("cpc");
      expect((yield* registry.resolve(ipc, ipcPin, "Y02A10/00").pipe(Effect.flip)).reason).toBe("symbol-not-found");
      expect((yield* registry.resolve(cpc, ipcPin, "A01B1/02").pipe(Effect.flip)).reason).toBe("scheme-mismatch");
      expect(A.every(cpc.concepts, (concept) => !Str.includes("Forbidden")(concept.prefLabel))).toBe(true);
      expect(A.map(yield* registry.broader(cpc, cpcPin, "A01B1/02"), (value) => value.notation)).toEqual([
        "A01B1/00",
        "A01B",
        "A01",
        "A",
      ]);
    })
  );

  it.effect(
    "loads Nice classes and goods/services basic terms",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const snapshot = yield* registry.load(manifest, vendor, nicePin);
      expect(snapshot.concepts).toHaveLength(4);
      expect((yield* registry.resolve(snapshot, nicePin, "010001")).prefLabel).toBe("Synthetic goods term");
      expect((yield* registry.resolve(snapshot, nicePin, "350001")).prefLabel).toBe("Synthetic service term");
      expect(A.map(yield* registry.broader(snapshot, nicePin, "350001"), (value) => value.notation)).toEqual(["35"]);
      expect(A.map(yield* registry.narrower(snapshot, nicePin, "1"), (value) => value.notation)).toEqual(["010001"]);
      expect(A.every(snapshot.concepts, (concept) => Str.startsWith("https://ns.beep.sh/")(concept.iri))).toBe(true);
    })
  );

  it.effect(
    "rejects reversed broader links instead of inferring labels",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const snapshot = yield* registry.load(manifest, vendor, ipcPin);
      const child = yield* registry.resolve(snapshot, ipcPin, "A01B1/02");
      const reversed = ClassificationSnapshot.make({
        ...snapshot,
        concepts: A.map(snapshot.concepts, (concept) =>
          concept.notation === "A01B1/00" ? ClassificationConcept.make({ ...concept, broader: [child.iri] }) : concept
        ),
      });
      expect((yield* registry.resolve(reversed, ipcPin, child.notation).pipe(Effect.flip)).reason).toBe(
        "hierarchy-invalid"
      );
    })
  );

  it.effect(
    "rejects corrupted snapshot identities, duplicate concepts and absent parents",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const snapshot = yield* registry.load(manifest, vendor, ipcPin);
      const root = yield* registry.resolve(snapshot, ipcPin, "A");
      const child = yield* registry.resolve(snapshot, ipcPin, "A01B1/02");
      const corruptions = [
        ClassificationSnapshot.make({ ...snapshot, concepts: [] }),
        ClassificationSnapshot.make({ ...snapshot, concepts: A.append(snapshot.concepts, root) }),
        ClassificationSnapshot.make({ ...snapshot, schemeIri: root.iri }),
        ClassificationSnapshot.make({
          ...snapshot,
          concepts: A.map(snapshot.concepts, (concept) =>
            concept.notation === child.notation ? ClassificationConcept.make({ ...concept, kind: "cpc" }) : concept
          ),
        }),
        ClassificationSnapshot.make({
          ...snapshot,
          concepts: A.filter(snapshot.concepts, (concept) => concept.notation !== "A01B1/00"),
        }),
      ];
      yield* Effect.forEach(
        corruptions,
        Effect.fnUntraced(function* (corrupted) {
          expect((yield* registry.resolve(corrupted, ipcPin, "A").pipe(Effect.flip)).reason).toBe("hierarchy-invalid");
        })
      );
      expect((yield* registry.broader(snapshot, ipcPin, "A01B999/00").pipe(Effect.flip)).reason).toBe(
        "symbol-not-found"
      );
    })
  );

  it.effect(
    "rejects unknown editions and a mismatched lookup edition",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const unknown = ClassificationPin.make({ kind: "ipc", edition: "2099.01" });
      expect((yield* registry.load(manifest, vendor, { kind: "ipc", edition: "" }).pipe(Effect.flip)).reason).toBe(
        "edition-unpinned"
      );
      expect(
        (yield* registry.load(manifest, vendor, { kind: "ipc", edition: "13-2026" }).pipe(Effect.flip)).reason
      ).toBe("edition-unpinned");
      expect((yield* registry.load(manifest, vendor, unknown).pipe(Effect.flip)).reason).toBe("edition-unpinned");
      const snapshot = yield* registry.load(manifest, vendor, ipcPin);
      expect((yield* registry.resolve(snapshot, unknown, "A").pipe(Effect.flip)).reason).toBe("edition-unpinned");
      expect((yield* registry.resolve(snapshot, ipcPin, "A01B999/00").pipe(Effect.flip)).reason).toBe(
        "symbol-not-found"
      );
    })
  );

  it.effect(
    "returns typed source errors for damaged XML across all three authorities",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const fs = yield* FileSystem.FileSystem;
      yield* Effect.forEach(
        [ipcPin, cpcPin, nicePin],
        Effect.fnUntraced(function* (pin) {
          const error = yield* registry.load(manifest, vendor, pin).pipe(
            Effect.provideService(FileSystem.FileSystem, {
              ...fs,
              readFileString: (path) =>
                path === manifest ? fs.readFileString(path) : Effect.succeed("<damaged><archive>"),
            }),
            Effect.flip
          );
          expect(S.is(ClassificationError)(error)).toBe(true);
          expect(error.reason).toBe("source-parse");
        })
      );
    })
  );

  it.effect(
    "fails closed for malformed manifests, unknown kinds, unvetted rows and path escapes",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const fs = yield* FileSystem.FileSystem;
      const original = yield* fs.readFileString(manifest);
      const cases: readonly (readonly [string, ClassificationError["reason"]])[] = [
        ["not json", "manifest-invalid"],
        [Str.replaceAll("classification-scheme", "unknown")(original), "manifest-invalid"],
        [Str.replaceAll('"VETTED"', '"UNVETTED"')(original), "unvetted"],
        [Str.replaceAll('"verified": true', '"verified": false')(original), "unvetted"],
        [Str.replaceAll('"ipc.xml"', '"../escape.xml"')(original), "manifest-invalid"],
      ];
      yield* Effect.forEach(
        cases,
        Effect.fnUntraced(function* ([content, expected]) {
          const error = yield* registry
            .load(manifest, vendor, ipcPin)
            .pipe(
              Effect.provideService(
                FileSystem.FileSystem,
                FileSystem.makeNoop({ readFileString: () => Effect.succeed(content), realPath: Effect.succeed })
              ),
              Effect.flip
            );
          expect(S.is(ClassificationError)(error)).toBe(true);
          expect(error.reason).toBe(expected);
        })
      );
      const escaped = yield* registry.load(manifest, vendor, ipcPin).pipe(
        Effect.provideService(
          FileSystem.FileSystem,
          FileSystem.makeNoop({
            readFileString: () => Effect.succeed(original),
            realPath: (path) => Effect.succeed(path === vendor ? "/fixture/vendor" : "/outside/escape.xml"),
          })
        ),
        Effect.flip
      );
      expect(escaped.reason).toBe("path-escape");
    })
  );
  it.effect(
    "rejects source edition drift, invalid symbols and broken Nice joins",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const fs = yield* FileSystem.FileSystem;
      const cases: readonly (readonly [ClassificationPin, string, string, string])[] = [
        [ipcPin, "ipc.xml", "20260101", "20250101"],
        [ipcPin, "ipc.xml", 'symbol="A"', 'symbol="Z"'],
        [cpcPin, ".xml", "2026-08-01", "2025-08-01"],
        [
          cpcPin,
          ".xml",
          "<classification-symbol>A</classification-symbol>",
          "<classification-symbol>Z</classification-symbol>",
        ],
        [nicePin, "nice-structure.xml", 'version="2026"', 'version="2025"'],
        [nicePin, "nice-texts.xml", 'language="en"', 'language="fr"'],
        [nicePin, "nice-structure.xml", 'classNumber="1"', 'classNumber="46"'],
        [nicePin, "nice-structure.xml", 'basicNumber="0001"', 'basicNumber="invalid"'],
        [nicePin, "nice-texts.xml", 'idRef="class1"', 'idRef="missing"'],
        [nicePin, "nice-texts.xml", 'idRef="good1"', 'idRef="missing"'],
        [nicePin, "nice-texts.xml", "Synthetic goods class", ""],
        [nicePin, "nice-texts.xml", "Synthetic goods term", ""],
      ];
      yield* Effect.forEach(
        cases,
        Effect.fnUntraced(function* ([pin, suffix, before, after]) {
          const error = yield* registry.load(manifest, vendor, pin).pipe(
            Effect.provideService(FileSystem.FileSystem, {
              ...fs,
              readFileString: (path) =>
                fs
                  .readFileString(path)
                  .pipe(
                    Effect.map((content) =>
                      Str.endsWith(suffix)(path) ? Str.replaceAll(before, after)(content) : content
                    )
                  ),
            }),
            Effect.flip
          );
          expect(error.reason).toBe("source-parse");
        })
      );
    })
  );

  it.effect(
    "fails closed when manifest, archive or CPC directory is unavailable",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const fs = yield* FileSystem.FileSystem;
      expect((yield* registry.load("missing-manifest", vendor, ipcPin).pipe(Effect.flip)).reason).toBe(
        "manifest-invalid"
      );
      for (const pin of [ipcPin, cpcPin]) {
        const error = yield* registry.load(manifest, vendor, pin).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            realPath: (path) => (path === vendor ? fs.realPath(path) : fs.realPath("missing-archive")),
          }),
          Effect.flip
        );
        expect(error.reason).toBe("source-parse");
      }
      const noFiles = yield* registry
        .load(manifest, vendor, cpcPin)
        .pipe(
          Effect.provideService(FileSystem.FileSystem, { ...fs, readDirectory: () => Effect.succeed([]) }),
          Effect.flip
        );
      expect(noFiles.detail).toBe("CPC scheme files missing");
      const noDirectory = yield* registry.load(manifest, vendor, cpcPin).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          readDirectory: () => fs.readDirectory("missing-directory"),
        }),
        Effect.flip
      );
      expect(noDirectory.reason).toBe("source-parse");
      const content = yield* fs.readFileString(manifest);
      for (const archive of ["structure", "texts"]) {
        const error = yield* registry.load(manifest, vendor, nicePin).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readFileString: (path) =>
              path === manifest
                ? Effect.succeed(
                    A.join(
                      A.filter(Str.split(content, "\n"), (line) => !Str.includes(`nice-${archive}-fixture`)(line)),
                      "\n"
                    )
                  )
                : fs.readFileString(path),
          }),
          Effect.flip
        );
        expect(error.reason).toBe("manifest-invalid");
      }
      const invalidAsset = yield* registry.load(manifest, vendor, ipcPin).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          readFileString: (path) =>
            path === manifest
              ? Effect.succeed(Str.replaceAll('"schemeKind": "ipc"', '"schemeKind": "other"')(content))
              : fs.readFileString(path),
        }),
        Effect.flip
      );
      expect(invalidAsset.reason).toBe("manifest-invalid");
    })
  );

  it.effect(
    "decodes attributed text content and preserves literal text child elements",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const fs = yield* FileSystem.FileSystem;
      const snapshot = yield* registry.load(manifest, vendor, ipcPin).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          readFileString: (path) =>
            fs
              .readFileString(path)
              .pipe(
                Effect.map((content) =>
                  Str.endsWith("ipc.xml")(path) ? Str.replaceAll("<text>", '<text language="en">')(content) : content
                )
              ),
        })
      );
      expect((yield* registry.resolve(snapshot, ipcPin, "A")).prefLabel).toBe("Synthetic IPC section");
      const cpc = yield* registry.load(manifest, vendor, cpcPin).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          readFileString: (path) =>
            fs
              .readFileString(path)
              .pipe(
                Effect.map((content) =>
                  Str.endsWith(".xml")(path)
                    ? Str.replaceAll(
                        "<text>Synthetic CPC section</text>",
                        '<CPC-specific-text><text language="en">Synthetic CPC section</text></CPC-specific-text>'
                      )(content)
                    : content
                )
              ),
        })
      );
      expect((yield* registry.resolve(cpc, cpcPin, "A")).prefLabel).toBe("Synthetic CPC section");
    })
  );
  it.effect(
    "joins repeated CPC title text elements without admitting notes",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const fs = yield* FileSystem.FileSystem;
      const snapshot = yield* registry.load(manifest, vendor, cpcPin).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          readFileString: (path) =>
            fs
              .readFileString(path)
              .pipe(
                Effect.map((content) =>
                  Str.endsWith(".xml")(path)
                    ? Str.replaceAll(
                        "<text>Synthetic CPC section</text>",
                        '<text>Synthetic CPC section</text><text>Second synthetic title</text><CPC-specific-text marker="synthetic"/>'
                      )(content)
                    : content
                )
              ),
        })
      );
      expect((yield* registry.resolve(snapshot, cpcPin, "A")).prefLabel).toBe(
        "Synthetic CPC section; Second synthetic title"
      );
    })
  );
  it.effect(
    "keeps CPC identifiers when optional titles are absent",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const fs = yield* FileSystem.FileSystem;
      const snapshot = yield* registry.load(manifest, vendor, cpcPin).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          readFileString: (path) =>
            fs
              .readFileString(path)
              .pipe(
                Effect.map((content) =>
                  Str.endsWith(".xml")(path)
                    ? Str.replaceAll(/<class-title>[\s\S]*?<\/class-title>/g, "")(content)
                    : content
                )
              ),
        })
      );
      expect((yield* registry.resolve(snapshot, cpcPin, "A")).prefLabel).toBe("A");
      expect((yield* registry.resolve(snapshot, cpcPin, "Y02A10/00")).prefLabel).toBe("Y02A10/00");
    })
  );
  it.effect(
    "ignores non-concept IPC wrappers and absent title content",
    Effect.fnUntraced(function* () {
      const registry = yield* ClassificationRegistry;
      const fs = yield* FileSystem.FileSystem;
      for (const replacement of ['<titlePart marker="synthetic"/>', '<titlePart><text language="en"/></titlePart>']) {
        const snapshot = yield* registry.load(manifest, vendor, ipcPin).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readFileString: (path) =>
              fs
                .readFileString(path)
                .pipe(
                  Effect.map((content) =>
                    Str.endsWith("ipc.xml")(path)
                      ? Str.replace("<titlePart><text>Synthetic IPC section</text></titlePart>", replacement)(content)
                      : content
                  )
                ),
          })
        );
        expect(snapshot.concepts).toHaveLength(4);
        expect((yield* registry.resolve(snapshot, ipcPin, "A").pipe(Effect.flip)).reason).toBe("symbol-not-found");
      }
    })
  );
});
