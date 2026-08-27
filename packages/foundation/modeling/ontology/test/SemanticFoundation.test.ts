import {
  DocumentClass,
  FilingSegment,
  FolioConceptSlice,
  isFilingSegment,
  LibrarianInput,
  runLibrarianLoop,
  SemanticFoundationSeed,
  TaxonomyLoader,
  TaxonomyManifestParseError,
  TaxonomyManifestReadError,
  TaxonomySeed,
  VendorAlignmentManifestEntry,
  VendorAlignmentTargetNotFound,
  VendorManifestEntry,
  VendorSliceConceptMismatch,
  VendorSliceParseError,
  VendorSlicePathEscape,
  VendorSliceReadError,
  VendorSliceUnvetted,
} from "@beep/ontology";
import { IRIReference } from "@beep/rdf";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const manifestPath = "test/fixtures/vendor-manifest.jsonl";
const vendorRoot = "test/fixtures";
const slicePath = "test/fixtures/fixture-slice.jsonld";
const folioSlicePath = "test/fixtures/folio-email-communication.jsonld";
const emailMessageIri = IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/concept/email-message");
const folioEmailCommunicationIri = IRIReference.make("https://folio.openlegalstandard.org/RDQy4rbUg82ScgiiXEQ7ZBU");
const folioEmailCommunicationSourceIri = IRIReference.make(
  "https://folio.openlegalstandard.org/RDQy4rbUg82ScgiiXEQ7ZBU/jsonld"
);
const encodeEntry = S.encodeUnknownEffect(S.fromJsonString(VendorManifestEntry));
const encodeAlignmentEntry = S.encodeUnknownEffect(S.fromJsonString(VendorAlignmentManifestEntry));
const encodeFolioSlice = S.encodeUnknownEffect(S.fromJsonString(FolioConceptSlice));
const encodeSeed = S.encodeUnknownEffect(S.fromJsonString(TaxonomySeed));

const loadWith = Effect.fnUntraced(function* (readFileString: FileSystem.FileSystem["readFileString"]) {
  const loader = yield* TaxonomyLoader;
  return yield* loader
    .load(manifestPath, vendorRoot)
    .pipe(
      Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({ readFileString, realPath: Effect.succeed }))
    );
});

layer(TaxonomyLoader.layer)("semantic foundation", (it) => {
  it.effect(
    "loads the committed seed plus an explicitly VETTED fixture slice",
    Effect.fnUntraced(function* () {
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
      const directEmailConcept = A.findFirst(SemanticFoundationSeed.concepts, ({ iri }) => iri === emailMessageIri);
      const loadedEmailConcept = A.findFirst(loaded.concepts, ({ iri }) => iri === emailMessageIri);

      expect(loaded.concepts).toHaveLength(SemanticFoundationSeed.concepts.length);
      expect(O.map(directEmailConcept, ({ alignments }) => alignments)).toEqual(O.some([]));
      expect(O.map(loadedEmailConcept, ({ alignments }) => alignments)).toEqual(O.some([]));
    })
  );

  it.effect(
    "ignores reference-only asset rows and validates a vetted FOLIO alignment slice",
    Effect.fnUntraced(function* () {
      const entry = yield* encodeAlignmentEntry(
        VendorAlignmentManifestEntry.make({
          conceptIri: folioEmailCommunicationIri,
          fetchUrl: folioEmailCommunicationSourceIri,
          format: "jsonld",
          id: "folio-email-communication",
          loadStatus: "VETTED",
          localConceptIri: emailMessageIri,
          mappingKind: "closeMatch",
          path: "folio-email-communication.jsonld",
          verified: true,
        })
      );
      const manifest = ['{"format":"owl","id":"folio","verified":true}', entry].join("\n");
      const slice = yield* encodeFolioSlice(
        FolioConceptSlice.make({
          "@id": folioEmailCommunicationIri,
          "@type": "owl:Class",
          "rdfs:label": "Email Communication",
          "skos:definition": "A communication that occurs via email.",
        })
      );
      const loaded = yield* loadWith((path) =>
        Match.value(path).pipe(
          Match.when(manifestPath, () => Effect.succeed(manifest)),
          Match.when(folioSlicePath, () => Effect.succeed(slice)),
          Match.orElse(() => FileSystem.makeNoop({}).readFileString(path))
        )
      );
      const emailConcept = A.findFirst(loaded.concepts, ({ iri }) => iri === emailMessageIri);

      expect(O.map(emailConcept, ({ alignments }) => alignments)).toEqual(
        O.some([
          {
            conceptIri: folioEmailCommunicationIri,
            kind: "closeMatch",
            sourceIri: folioEmailCommunicationSourceIri,
          },
        ])
      );
    })
  );

  it.effect(
    "fails closed when a FOLIO slice identifier differs from its manifest concept IRI",
    Effect.fnUntraced(function* () {
      const entry = yield* encodeAlignmentEntry(
        VendorAlignmentManifestEntry.make({
          conceptIri: folioEmailCommunicationIri,
          fetchUrl: folioEmailCommunicationSourceIri,
          format: "jsonld",
          id: "folio-email-communication",
          loadStatus: "VETTED",
          localConceptIri: emailMessageIri,
          mappingKind: "closeMatch",
          path: "folio-email-communication.jsonld",
          verified: true,
        })
      );
      const slice = yield* encodeFolioSlice(
        FolioConceptSlice.make({
          "@id": IRIReference.make("https://folio.openlegalstandard.org/not-email"),
          "@type": "owl:Class",
          "rdfs:label": "Other Concept",
          "skos:definition": "A different concept.",
        })
      );
      const error = yield* loadWith((path) => Effect.succeed(path === manifestPath ? entry : slice)).pipe(Effect.flip);

      expect(S.is(VendorSliceConceptMismatch)(error)).toBe(true);
    })
  );

  it.effect(
    "fails closed for an unparsable FOLIO alignment slice",
    Effect.fnUntraced(function* () {
      const entry = yield* encodeAlignmentEntry(
        VendorAlignmentManifestEntry.make({
          conceptIri: folioEmailCommunicationIri,
          fetchUrl: folioEmailCommunicationSourceIri,
          format: "jsonld",
          id: "folio-email-communication",
          loadStatus: "VETTED",
          localConceptIri: emailMessageIri,
          mappingKind: "closeMatch",
          path: "folio-email-communication.jsonld",
          verified: true,
        })
      );
      const error = yield* loadWith((path) => Effect.succeed(path === manifestPath ? entry : '{"@id":')).pipe(
        Effect.flip
      );

      expect(S.is(VendorSliceParseError)(error)).toBe(true);
    })
  );

  it.effect(
    "fails closed when a FOLIO alignment names no repo-owned concept",
    Effect.fnUntraced(function* () {
      const entry = yield* encodeAlignmentEntry(
        VendorAlignmentManifestEntry.make({
          conceptIri: folioEmailCommunicationIri,
          fetchUrl: folioEmailCommunicationSourceIri,
          format: "jsonld",
          id: "folio-email-communication",
          loadStatus: "VETTED",
          localConceptIri: IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/concept/missing"),
          mappingKind: "closeMatch",
          path: "folio-email-communication.jsonld",
          verified: true,
        })
      );
      const slice = yield* encodeFolioSlice(
        FolioConceptSlice.make({
          "@id": folioEmailCommunicationIri,
          "@type": "owl:Class",
          "rdfs:label": "Email Communication",
          "skos:definition": "A communication that occurs via email.",
        })
      );
      const error = yield* loadWith((path) => Effect.succeed(path === manifestPath ? entry : slice)).pipe(Effect.flip);

      expect(S.is(VendorAlignmentTargetNotFound)(error)).toBe(true);
    })
  );

  it.effect(
    "rejects an asset row that opts into loading without a load status",
    Effect.fnUntraced(function* () {
      const manifest = `{"format":"jsonld","id":"folio-email-communication","loadKind":"folio-alignment"}`;
      const error = yield* loadWith(() => Effect.succeed(manifest)).pipe(Effect.flip);

      expect(S.is(TaxonomyManifestParseError)(error)).toBe(true);
    })
  );

  it.effect(
    "rejects an unverified asset row even when its load status is VETTED",
    Effect.fnUntraced(function* () {
      const manifest = `{"conceptIri":"${folioEmailCommunicationIri}","fetchUrl":"${folioEmailCommunicationSourceIri}","format":"jsonld","id":"folio-email-communication","loadKind":"folio-alignment","loadStatus":"VETTED","localConceptIri":"${emailMessageIri}","mappingKind":"closeMatch","path":"folio-email-communication.jsonld","verified":false}`;
      const error = yield* loadWith(() => Effect.succeed(manifest)).pipe(Effect.flip);

      expect(S.is(TaxonomyManifestParseError)(error)).toBe(true);
    })
  );

  it.effect(
    "fails closed for a missing manifest",
    Effect.fnUntraced(function* () {
      const error = yield* loadWith(FileSystem.makeNoop({}).readFileString).pipe(Effect.flip);
      expect(S.is(TaxonomyManifestReadError)(error)).toBe(true);
    })
  );

  it.effect(
    "fails closed for an unparsable manifest",
    Effect.fnUntraced(function* () {
      const error = yield* loadWith(() => Effect.succeed("not-json")).pipe(Effect.flip);
      expect(S.is(TaxonomyManifestParseError)(error)).toBe(true);
    })
  );

  it.effect(
    "fails closed for a manifest row whose path escapes the vendor root",
    Effect.fnUntraced(function* () {
      const manifest = `{"format":"jsonld","id":"escape","loadStatus":"VETTED","path":"../secrets.jsonld"}`;
      const error = yield* loadWith(() => Effect.succeed(manifest)).pipe(Effect.flip);
      expect(S.is(TaxonomyManifestParseError)(error)).toBe(true);
    })
  );

  it.effect(
    "fails closed for an unvetted slice",
    Effect.fnUntraced(function* () {
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

  it.effect(
    "fails closed for an unreadable vetted slice",
    Effect.fnUntraced(function* () {
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

  it.effect(
    "fails closed for an unparsable vetted slice",
    Effect.fnUntraced(function* () {
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

  it.effect(
    "rejects a vetted slice symlink that resolves outside the vendor root",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const loader = yield* TaxonomyLoader;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-taxonomy-vendor-" });
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "beep-taxonomy-outside-" });
      const outsideSlice = `${outside}/outside.jsonld`;
      const linkedSlice = `${root}/linked.jsonld`;
      const manifest = `${root}/manifest.jsonl`;
      const entry = yield* encodeEntry(
        VendorManifestEntry.make({
          format: "jsonld",
          id: "linked-slice",
          loadStatus: "VETTED",
          path: "linked.jsonld",
        })
      );
      const slice = yield* encodeSeed(
        TaxonomySeed.make({
          concepts: [],
          filingRoots: [],
          pathTemplateSegments: ["root", "client", "matter", "taxonomy-concept", "document-class", "file-name"],
          schemeIri: IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/taxonomy/outside"),
          title: "Outside vendor slice",
        })
      );
      yield* fs.writeFileString(outsideSlice, slice);
      yield* fs.symlink(outsideSlice, linkedSlice);
      yield* fs.writeFileString(manifest, entry);

      const error = yield* loader.load(manifest, root).pipe(Effect.flip);
      expect(S.is(VendorSlicePathEscape)(error)).toBe(true);
    }, provideScopedLayer(BunFileSystem.layer))
  );

  it.effect(
    "accepts a canonical Windows vendor root with a trailing separator",
    Effect.fnUntraced(function* () {
      const loader = yield* TaxonomyLoader;
      const canonicalRoot = "C:\\vendor\\";
      const canonicalSlice = `${canonicalRoot}fixture-slice.jsonld`;
      const manifest = yield* encodeEntry(
        VendorManifestEntry.make({
          format: "jsonld",
          id: "windows-slice",
          loadStatus: "VETTED",
          path: "fixture-slice.jsonld",
        })
      );
      const slice = yield* encodeSeed(
        TaxonomySeed.make({
          concepts: [],
          filingRoots: [],
          pathTemplateSegments: ["root", "client", "matter", "taxonomy-concept", "document-class", "file-name"],
          schemeIri: IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/taxonomy/windows"),
          title: "Windows vendor slice",
        })
      );
      const loaded = yield* loader.load(manifestPath, vendorRoot).pipe(
        Effect.provideService(
          FileSystem.FileSystem,
          FileSystem.makeNoop({
            readFileString: (path) => Effect.succeed(path === manifestPath ? manifest : slice),
            realPath: (path) => Effect.succeed(path === vendorRoot ? canonicalRoot : canonicalSlice),
          })
        )
      );

      expect(loaded.concepts).toHaveLength(SemanticFoundationSeed.concepts.length);
    })
  );

  it.effect(
    "maps a missing vendor root realpath to a typed slice read error",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const loader = yield* TaxonomyLoader;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-taxonomy-manifest-" });
      const missingRoot = `${root}/missing-vendor`;
      const manifest = `${root}/manifest.jsonl`;
      const entry = yield* encodeEntry(
        VendorManifestEntry.make({
          format: "jsonld",
          id: "missing-root",
          loadStatus: "VETTED",
          path: "slice.jsonld",
        })
      );
      yield* fs.writeFileString(manifest, entry);

      const error = yield* loader.load(manifest, missingRoot).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "VendorSliceReadError", id: "missing-root", path: missingRoot });
    }, provideScopedLayer(BunFileSystem.layer))
  );

  it.effect(
    "maps a missing vendor slice realpath to a typed slice read error",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const loader = yield* TaxonomyLoader;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-taxonomy-vendor-" });
      const missingSlice = `${root}/missing.jsonld`;
      const manifest = `${root}/manifest.jsonl`;
      const entry = yield* encodeEntry(
        VendorManifestEntry.make({
          format: "jsonld",
          id: "missing-slice",
          loadStatus: "VETTED",
          path: "missing.jsonld",
        })
      );
      yield* fs.writeFileString(manifest, entry);

      const error = yield* loader.load(manifest, root).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "VendorSliceReadError", id: "missing-slice", path: missingSlice });
    }, provideScopedLayer(BunFileSystem.layer))
  );

  it.effect(
    "runs the librarian loop over a manifest-admitted alignment",
    Effect.fnUntraced(function* () {
      const conceptIri = emailMessageIri;
      const entry = yield* encodeAlignmentEntry(
        VendorAlignmentManifestEntry.make({
          conceptIri: folioEmailCommunicationIri,
          fetchUrl: folioEmailCommunicationSourceIri,
          format: "jsonld",
          id: "folio-email-communication",
          loadStatus: "VETTED",
          localConceptIri: emailMessageIri,
          mappingKind: "closeMatch",
          path: "folio-email-communication.jsonld",
          verified: true,
        })
      );
      const slice = yield* encodeFolioSlice(
        FolioConceptSlice.make({
          "@id": folioEmailCommunicationIri,
          "@type": "owl:Class",
          "rdfs:label": "Email Communication",
          "skos:definition": "A communication that occurs via email.",
        })
      );
      const loaded = yield* loadWith((path) => Effect.succeed(path === manifestPath ? entry : slice));
      const output = yield* runLibrarianLoop(
        loaded,
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
      expect(output.alignments).toEqual([
        {
          conceptIri: folioEmailCommunicationIri,
          kind: "closeMatch",
          sourceIri: folioEmailCommunicationSourceIri,
        },
      ]);
      expect(A.map(output.filingPaths, (filingPath) => filingPath.path)).toEqual([
        "vault/acme/aurora/email-messages/received/intake-email.eml",
        "box-mirror/acme/aurora/email-messages/received/intake-email.eml",
      ]);
      expect(DocumentClass.Options).toEqual(["draft", "redline", "filed", "received", "privileged", "extracted-child"]);
    })
  );

  it.effect("round-trips generated filing segments and never admits separators", () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(S.toArbitrary(FilingSegment)(fc), (segment) => {
          const decoded = O.flatMap(S.encodeOption(FilingSegment)(segment), S.decodeUnknownOption(FilingSegment));
          expect(O.exists(decoded, (value) => value === segment)).toBe(true);
          expect(isFilingSegment(segment)).toBe(true);
        })
      )
    )
  );

  it.effect(
    "rejects traversal segments in librarian input at decode time",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.sync(() =>
        S.decodeResult(LibrarianInput)({
          client: "acme",
          conceptIri: "https://ns.beep.sh/ontology/semantic-foundation/concept/email-message",
          documentClass: "received",
          fileName: "../../other-matter/document.pdf",
          matter: "aurora",
        })
      );
      expect(decoded._tag).toBe("Failure");
    })
  );
});
