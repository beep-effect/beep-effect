import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { Crypto, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { canonicalJson } from "@/corpus/Canonical";
import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import { F1Catalog } from "@/fixtures/F1";
import { LabConfig } from "@/runtime/Config";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { DocumentUnavailable } from "@/schema/Errors";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { EventBody } from "@/schema/Provenance";
import { DocumentSelection, DocumentSource } from "@/services/DocumentSource";
import type { CorpusManifestRow, CorpusPaperId } from "@/corpus/Manifest";
import type { F1Fixture } from "@/fixtures/F1";
import type { MediaType } from "@/schema/MediaType";

const F1_ROOT = "fixtures/f1";
const encodeEventBodyEffect = S.encodeEffect(EventBody);

const unavailable = (message: string): DocumentUnavailable => DocumentUnavailable.make({ message });

/**
 * Loads the manifest and fixture catalog through their existing integrity
 * checks before constructing a document selection.
 *
 * **Example** (Build a selection-loading effect)
 *
 * ```ts
 * import { loadDocumentSelection } from "@/layers/DocumentSourceLive"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const selection = loadDocumentSelection("fixtures/w1.manifest.json", O.none(), false)
 * console.log(Effect.isEffect(selection)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadDocumentSelection = Effect.fn("DocumentSource.loadSelection")(function* (
  manifestPath: string,
  paper: O.Option<CorpusPaperId>,
  includeW1: boolean
): Effect.fn.Return<DocumentSelection, DocumentUnavailable, CorpusManifestBuilder | F1Catalog> {
  const manifestBuilder = yield* CorpusManifestBuilder;
  const fixtures = yield* F1Catalog;
  const manifest = yield* Bool.match(includeW1, {
    onFalse: () =>
      manifestBuilder
        .load(manifestPath)
        .pipe(Effect.mapError(() => unavailable("The selected W1 manifest could not be decoded."))),
    onTrue: () =>
      manifestBuilder
        .check(manifestPath)
        .pipe(Effect.mapError(() => unavailable("The selected W1 manifest did not pass its integrity check."))),
  });
  const fixtureIndex = yield* fixtures.load.pipe(
    Effect.mapError(() => unavailable("The committed F1 catalog did not pass its integrity check."))
  );
  return DocumentSelection.make({ fixtures: fixtureIndex, includeW1, manifest, paper });
});

const makeDocumentSource = Effect.gen(function* () {
  const config = yield* LabConfig;
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const hashBytes = Effect.fn("DocumentSource.hashBytes")((bytes: Uint8Array) =>
    Sha256HexFromBytes.decodeEffect(bytes).pipe(Effect.provideService(Crypto.Crypto, crypto), Effect.orDie)
  );

  const makeAcquiredId = Effect.fn("DocumentSource.makeAcquiredId")(function* (document: DocumentId) {
    const body = EventBody.cases.Ingested.make({ document });
    const encodedBody = yield* encodeEventBodyEffect(body).pipe(Effect.orDie);
    const preimage = new TextEncoder().encode(canonicalJson({ body: encodedBody, prev: null }));
    return ProvenanceEventId.make(yield* hashBytes(preimage));
  });

  const verifyExpectedBytes = Effect.fn("DocumentSource.verifyExpectedBytes")(function* (
    absolutePath: string,
    expectedDigest: string,
    expectedBytes: number
  ) {
    const bytes = yield* fs
      .readFile(absolutePath)
      .pipe(Effect.mapError(() => unavailable("A selected source document could not be read.")));
    const digest = yield* hashBytes(bytes);
    if (!Str.Equivalence(digest, expectedDigest) || bytes.byteLength !== expectedBytes) {
      return yield* unavailable("A selected source document no longer matches its verified byte witness.");
    }
    return { bytes, digest };
  });

  const makeVerifiedDocument = Effect.fn("DocumentSource.makeVerifiedDocument")(function* (
    absolutePath: string,
    expectedDigest: SourceDocument["sha256"],
    expectedBytes: number,
    mediaType: MediaType,
    origin: Origin
  ) {
    const verified = yield* verifyExpectedBytes(absolutePath, expectedDigest, expectedBytes);
    const id = DocumentId.make(verified.digest);
    return SourceDocument.make({
      acquired: yield* makeAcquiredId(id),
      bytes: NonNegativeInt.make(verified.bytes.byteLength),
      id,
      mediaType,
      origin,
      sha256: verified.digest,
    });
  });

  const makeW1Document = Effect.fn("DocumentSource.makeW1Document")(function* (
    row: CorpusManifestRow,
    corpusId: string,
    corpusRoot: string
  ) {
    const absolutePath = path.join(corpusRoot, row.relativePath);
    return yield* makeVerifiedDocument(
      absolutePath,
      row.sha256,
      row.bytes,
      "application/pdf",
      Origin.cases.W1Paper.make({
        corpusId,
        kind: "W1Paper",
        paperId: row.id,
        relativePath: row.relativePath,
      })
    );
  });

  const makeFixtureDocument = Effect.fn("DocumentSource.makeFixtureDocument")(function* (fixture: F1Fixture) {
    const absolutePath = path.join(F1_ROOT, fixture.relativePath);
    return yield* makeVerifiedDocument(
      absolutePath,
      fixture.sha256,
      fixture.bytes,
      fixture.mediaType,
      Origin.cases.Fixture.make({
        declared: FixtureDeclaration.make({
          degradedKind: fixture.degradedKind,
          expectation: fixture.expectation,
        }),
        fixtureId: fixture.id,
        kind: "Fixture",
        relativePath: fixture.relativePath,
      })
    );
  });

  const selectRows = Effect.fn("DocumentSource.selectRows")(function* (selection: DocumentSelection) {
    return yield* O.match(selection.paper, {
      onNone: () => Effect.succeed(selection.manifest.rows),
      onSome: (paperId) =>
        A.findFirst(selection.manifest.rows, (row) => Str.Equivalence(row.id, paperId)).pipe(
          Effect.fromOption,
          Effect.map(A.of),
          Effect.mapError(() => unavailable("The requested paper id is not present in the selected W1 manifest."))
        ),
    });
  });

  const listW1 = Effect.fn("DocumentSource.listW1")(function* (selection: DocumentSelection) {
    const rows = yield* selectRows(selection);
    const corpusRoot = yield* config.corpusRoot.pipe(
      Effect.fromOption(() => unavailable("SEMANTICA_CORPUS_ROOT is required to list W1 documents."))
    );
    return yield* Effect.forEach(rows, (row) => makeW1Document(row, selection.manifest.corpusId, corpusRoot), {
      concurrency: 4,
    });
  });

  const list = Effect.fn("DocumentSource.list")(function* (selection: DocumentSelection) {
    const w1 = yield* Bool.match(selection.includeW1, {
      onFalse: () => Effect.succeed(A.empty<SourceDocument>()),
      onTrue: () => listW1(selection),
    });
    const f1 = yield* Effect.forEach(selection.fixtures.fixtures, makeFixtureDocument, { concurrency: 4 });
    return A.appendAll(w1, f1);
  });

  const read = Effect.fn("DocumentSource.read")(function* (document: SourceDocument) {
    const sourcePath = yield* Origin.match(document.origin, {
      Fixture: (origin) => Effect.succeed(path.join(F1_ROOT, origin.relativePath)),
      W1Paper: (origin) =>
        O.match(config.corpusRoot, {
          onNone: () => Effect.fail(unavailable("SEMANTICA_CORPUS_ROOT is required to read a W1 document.")),
          onSome: (corpusRoot) => Effect.succeed(path.join(corpusRoot, origin.relativePath)),
        }),
    });
    const bytes = yield* fs
      .readFile(sourcePath)
      .pipe(Effect.mapError(() => unavailable("The requested source document bytes could not be read.")));
    const digest = yield* hashBytes(bytes);
    if (
      bytes.byteLength !== document.bytes ||
      !Str.Equivalence(digest, document.id) ||
      !Str.Equivalence(digest, document.sha256)
    ) {
      return yield* unavailable("The requested source document no longer matches its content identity.");
    }
    return bytes;
  });

  return DocumentSource.of({ list, read });
});

/**
 * Filesystem-backed source service for verified W1 and F1 documents.
 *
 * **Example** (Inspect the document-source layer)
 *
 * ```ts
 * import { DocumentSourceLive } from "@/layers/DocumentSourceLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(DocumentSourceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentSourceLive = Layer.effect(DocumentSource, makeDocumentSource);
