import {
  DocumentClass,
  LibrarianInput,
  runLibrarianLoop,
  SemanticFoundationSeed,
  TaxonomyLoader,
  TaxonomyManifestParseError,
  TaxonomyManifestReadError,
  TaxonomySeed,
  VendorManifestEntry,
  VendorSliceParseError,
  VendorSliceReadError,
  VendorSliceUnvetted,
} from "@beep/ontology";
import { IRIReference } from "@beep/rdf";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Match } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const manifestPath = "test/fixtures/vendor-manifest.jsonl";
const vendorRoot = "test/fixtures";
const slicePath = "test/fixtures/fixture-slice.jsonld";
const encodeEntry = S.encodeUnknownEffect(S.fromJsonString(VendorManifestEntry));
const encodeSeed = S.encodeUnknownEffect(S.fromJsonString(TaxonomySeed));

const loadWith = Effect.fnUntraced(function* (readFileString: FileSystem.FileSystem["readFileString"]) {
  const loader = yield* TaxonomyLoader;
  return yield* loader
    .load(manifestPath, vendorRoot)
    .pipe(Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({ readFileString })));
});

layer(TaxonomyLoader.layer)("semantic foundation", (it) => {
  it.effect("loads the committed seed plus an explicitly VETTED fixture slice", () =>
    Effect.gen(function* () {
      const manifest = yield* encodeEntry(
        VendorManifestEntry.make({
          format: "jsonld",
          id: "fixture-legal-intake",
          loadStatus: "VETTED",
          path: "fixture-slice.jsonld",
        })
      );
      const slice = yield* encodeSeed(
        TaxonomySeed.make({
          concepts: [],
          filingRoots: [],
          pathTemplateSegments: ["root", "client", "matter", "taxonomy-concept", "document-class", "file-name"],
          schemeIri: IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/taxonomy/fixture"),
          title: "Fixture vendor slice",
        })
      );
      const loaded = yield* loadWith((path) =>
        Match.value(path).pipe(
          Match.when(manifestPath, () => Effect.succeed(manifest)),
          Match.when(slicePath, () => Effect.succeed(slice)),
          Match.orElse(() => FileSystem.makeNoop({}).readFileString(path))
        )
      );
      expect(loaded.concepts).toHaveLength(SemanticFoundationSeed.concepts.length);
    })
  );

  it.effect("fails closed for a missing manifest", () =>
    Effect.gen(function* () {
      const error = yield* loadWith(FileSystem.makeNoop({}).readFileString).pipe(Effect.flip);
      expect(S.is(TaxonomyManifestReadError)(error)).toBe(true);
    })
  );

  it.effect("fails closed for an unparsable manifest", () =>
    Effect.gen(function* () {
      const error = yield* loadWith(() => Effect.succeed("not-json")).pipe(Effect.flip);
      expect(S.is(TaxonomyManifestParseError)(error)).toBe(true);
    })
  );

  it.effect("fails closed for an unvetted slice", () =>
    Effect.gen(function* () {
      const manifest = yield* encodeEntry(
        VendorManifestEntry.make({
          format: "jsonld",
          id: "fixture-legal-intake",
          loadStatus: "UNVETTED",
          path: "fixture-slice.jsonld",
        })
      );
      const error = yield* loadWith(() => Effect.succeed(manifest)).pipe(Effect.flip);
      expect(S.is(VendorSliceUnvetted)(error)).toBe(true);
    })
  );

  it.effect("fails closed for an unreadable vetted slice", () =>
    Effect.gen(function* () {
      const manifest = yield* encodeEntry(
        VendorManifestEntry.make({
          format: "jsonld",
          id: "fixture-legal-intake",
          loadStatus: "VETTED",
          path: "fixture-slice.jsonld",
        })
      );
      const missing = FileSystem.makeNoop({});
      const error = yield* loadWith((path) =>
        Match.value(path).pipe(
          Match.when(manifestPath, () => Effect.succeed(manifest)),
          Match.orElse(() => missing.readFileString(path))
        )
      ).pipe(Effect.flip);
      expect(S.is(VendorSliceReadError)(error)).toBe(true);
    })
  );

  it.effect("fails closed for an unparsable vetted slice", () =>
    Effect.gen(function* () {
      const manifest = yield* encodeEntry(
        VendorManifestEntry.make({
          format: "jsonld",
          id: "fixture-legal-intake",
          loadStatus: "VETTED",
          path: "fixture-slice.jsonld",
        })
      );
      const error = yield* loadWith((path) =>
        Match.value(path).pipe(
          Match.when(manifestPath, () => Effect.succeed(manifest)),
          Match.orElse(() => Effect.succeed("not-json"))
        )
      ).pipe(Effect.flip);
      expect(S.is(VendorSliceParseError)(error)).toBe(true);
    })
  );

  it.effect("runs the librarian loop purely over registry data", () =>
    Effect.gen(function* () {
      const conceptIri = IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/concept/email-message");
      const output = yield* runLibrarianLoop(
        SemanticFoundationSeed,
        LibrarianInput.make({
          client: "acme",
          conceptIri,
          documentClass: "received",
          fileName: "intake-email.eml",
          matter: "aurora",
        })
      );
      expect(output.conceptIri).toBe(conceptIri);
      expect(output.documentClass).toBe("received");
      expect(A.map(output.filingPaths, (filingPath) => filingPath.path)).toEqual([
        "vault/acme/aurora/email-messages/received/intake-email.eml",
        "box-mirror/acme/aurora/email-messages/received/intake-email.eml",
      ]);
      expect(DocumentClass.Options).toEqual(["draft", "redline", "filed", "received", "privileged", "extracted-child"]);
    })
  );
});
