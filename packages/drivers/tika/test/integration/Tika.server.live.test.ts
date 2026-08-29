import { ArtifactLocator, SourceArtifact } from "@beep/file-processing/Artifact";
import { ExtractFileOperation } from "@beep/file-processing/Operation";
import { decodeTestOperationIdentifiers } from "@beep/file-processing/test";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { provideScopedLayer } from "@beep/test-utils";
import { makeTikaServerFileProcessingEngine, TikaServerEngineConfig } from "@beep/tika";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Config, Effect, FileSystem, Layer, Option as O, Path, Result } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import {
  liveHtml,
  liveMarkdown,
  livePlainText,
  liveRtf,
  liveXhtml,
  makeLiveDoc,
  makeLiveDocx,
  makeLivePdf,
  makeLivePng,
} from "./live-fixtures.ts";
import type { FileFormatFamily } from "@beep/file-processing/Strategy";

const BEEP_TEST_TIKA_URL_ENV = "BEEP_TEST_TIKA_URL";
const liveMarker = "hello live tika corpus";

// Snapshot the opt-in lane key once, treating absent and blank values as "not
// configured" so the whole suite no-ops instead of dialing a phantom server.
const liveTikaUrl = Config.string(BEEP_TEST_TIKA_URL_ENV).pipe(Config.option, Effect.map(O.filter(Str.isNonEmpty)));

const provideLive = provideScopedLayer(Layer.merge(FetchHttpClient.layer, NodeServices.layer));

const skipNotice = Effect.logInfo(
  `Skipping the live Tika Server lane because ${BEEP_TEST_TIKA_URL_ENV} is not configured.`
);

const liveEngine = Effect.fn("TikaLive.engine")(function* (baseUrl: string) {
  return yield* makeTikaServerFileProcessingEngine(
    yield* S.decodeEffect(TikaServerEngineConfig)({ baseUrl, timeoutMillis: 30_000 })
  );
});

const liveOperation = Effect.fn("TikaLive.operation")(function* (
  format: FileFormatFamily,
  extension: string,
  bytes: Uint8Array
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "tika-server-live-" });
  const name = `fixture.${extension}`;
  const filePath = path.join(dir, name);
  yield* fs.writeFile(filePath, bytes);

  const { artifactId, digest, operationId } = yield* decodeTestOperationIdentifiers();
  const locatorValue = yield* S.decodeEffect(PosixPath)(filePath);
  const relativePath = yield* S.decodeEffect(PosixPath)(name);

  return ExtractFileOperation.make({
    format,
    operationId,
    operationKind: "extract",
    preference: { engine: "tika" },
    source: SourceArtifact.make({
      digest,
      extension,
      id: artifactId,
      locator: ArtifactLocator.make({ kind: "file", value: locatorValue }),
      name,
      relativePath,
      sizeBytes: NonNegativeInt.make(bytes.length),
    }),
  });
});

const textFixtures: ReadonlyArray<{
  readonly bytes: Uint8Array;
  readonly extension: string;
  readonly format: FileFormatFamily;
}> = [
  { bytes: livePlainText, extension: "txt", format: "plain-text" },
  { bytes: liveMarkdown, extension: "md", format: "markdown" },
  { bytes: liveHtml, extension: "html", format: "html" },
  { bytes: liveXhtml, extension: "xhtml", format: "xhtml" },
  { bytes: liveRtf, extension: "rtf", format: "rtf" },
  // Word extraction failures are silent (HTTP 200, empty text), so the
  // liveMarker toContain assertion below is the load-bearing check.
  { bytes: makeLiveDoc(), extension: "doc", format: "doc" },
  { bytes: makeLiveDocx(), extension: "docx", format: "docx" },
];

describe("@beep/tika live Tika Server", () => {
  it.live(
    "reports a runtime Apache Tika version from the live server",
    Effect.fnUntraced(
      function* () {
        const baseUrl = yield* liveTikaUrl;
        if (O.isNone(baseUrl)) {
          return yield* skipNotice;
        }

        const engine = yield* liveEngine(baseUrl.value);

        expect(engine.descriptor.version).toBeDefined();
        expect(engine.descriptor.version).toContain("Tika");
      },
      Effect.scoped,
      provideLive
    )
  );

  for (const { bytes, extension, format } of textFixtures) {
    it.live(
      `extracts live text and metadata for ${format}`,
      Effect.fnUntraced(
        function* () {
          const baseUrl = yield* liveTikaUrl;
          if (O.isNone(baseUrl)) {
            return yield* skipNotice;
          }

          const engine = yield* liveEngine(baseUrl.value);
          const result = yield* engine.extract(yield* liveOperation(format, extension, bytes));

          expect(result.engine).toBe("apache-tika");
          expect(result.text).toContain(liveMarker);
          expect(result.metadata["Content-Type"]).toBeDefined();
        },
        Effect.scoped,
        provideLive
      )
    );
  }

  it.live(
    "extracts live text-layer content from a generated PDF",
    Effect.fnUntraced(
      function* () {
        const baseUrl = yield* liveTikaUrl;
        if (O.isNone(baseUrl)) {
          return yield* skipNotice;
        }

        const engine = yield* liveEngine(baseUrl.value);
        const result = yield* engine.extract(yield* liveOperation("pdf-text-layer", "pdf", makeLivePdf()));

        expect(result.metadata["Content-Type"]).toContain("pdf");
        expect(Str.isNonEmpty(result.text ?? "")).toBe(true);
      },
      Effect.scoped,
      provideLive
    )
  );

  it.live(
    "returns live metadata only for a generated PNG",
    Effect.fnUntraced(
      function* () {
        const baseUrl = yield* liveTikaUrl;
        if (O.isNone(baseUrl)) {
          return yield* skipNotice;
        }

        const engine = yield* liveEngine(baseUrl.value);
        const result = yield* engine.extract(yield* liveOperation("image-metadata", "png", makeLivePng()));

        expect(result.text).toBeUndefined();
        expect(result.metadata["Content-Type"]).toContain("png");
      },
      Effect.scoped,
      provideLive
    )
  );

  it.live(
    "keeps an unparseable live payload inside the operation error contract",
    Effect.fnUntraced(
      function* () {
        const baseUrl = yield* liveTikaUrl;
        if (O.isNone(baseUrl)) {
          return yield* skipNotice;
        }

        const engine = yield* liveEngine(baseUrl.value);
        const operation = yield* liveOperation("doc", "doc", new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]));
        const outcome = yield* Effect.result(engine.extract(operation));

        // Tika may answer 415, 422, or parse the junk as an empty document; the
        // load-bearing invariant is that no HTTP error escapes as itself.
        if (Result.isFailure(outcome)) {
          expect(outcome.failure._tag).toBe("FileProcessingOperationError");
        }
      },
      Effect.scoped,
      provideLive
    )
  );
});
