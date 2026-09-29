import { ArtifactLocator, SourceArtifact } from "@beep/file-processing/Artifact";
import { ExportArchiveOperation, ExtractFileOperation } from "@beep/file-processing/Operation";
import { decodeTestOperationIdentifiers } from "@beep/file-processing/test";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { makeTikaAppFileProcessingEngine, TikaAppEngineConfig, TikaContentText } from "@beep/tika";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, FileSystem, Logger, Path, References, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";
import type { FileFormatFamily } from "@beep/file-processing/Strategy";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const decodePosixPath = S.decodeEffect(PosixPath);
const decodeTikaAppEngineConfigResult = S.decodeResult(TikaAppEngineConfig);
const TikaAppEngineConfigArbitrary = Arbitrary.schema(TikaAppEngineConfig);
const TikaContentTextArbitrary = Arbitrary.schema(TikaContentText);

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);

  expect(encode(schema, decoded)).toEqual(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const stubJava = `#!/usr/bin/env bash
printf '%s' '[{"Content-Type":"application/pdf","dc:title":"Probe Title","X-TIKA:Parsed-By":["org.apache.tika.parser.CompositeParser","org.apache.tika.parser.pdf.PDFParser"],"X-TIKA:content":"\\n\\n  hello corpus world\\n\\n"}]'
exit 0
`;

const failingStub = `#!/usr/bin/env bash
exit 1
`;

const echoSourceStub = `#!/usr/bin/env bash
source="\${@: -1}"
printf '[{"Content-Type":"application/pdf","X-TIKA:content":"%s"}]' "$(cat "$source")"
exit 0
`;

const fixture = Effect.fn(function* (stubScript: string, format: FileFormatFamily) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "tika-app-test-" });
  const stubPath = path.join(dir, "java-stub");
  yield* fs.writeFileString(stubPath, stubScript);
  yield* fs.chmod(stubPath, 0o755);
  const sourcePath = path.join(dir, "document.pdf");
  const sourceBytes = new TextEncoder().encode("not a real pdf");
  yield* fs.writeFile(sourcePath, sourceBytes);

  const { artifactId, digest, operationId } = yield* decodeTestOperationIdentifiers();
  const locatorValue = yield* decodePosixPath(sourcePath);
  const relativePath = yield* decodePosixPath("document.pdf");

  const operation = ExtractFileOperation.make({
    format,
    operationId,
    operationKind: "extract",
    preference: { engine: "tika" },
    source: SourceArtifact.make({
      digest,
      extension: "pdf",
      id: artifactId,
      locator: ArtifactLocator.make({ kind: "file", value: locatorValue }),
      name: "document.pdf",
      relativePath,
      sizeBytes: NonNegativeInt.make(sourceBytes.length),
      bytes: sourceBytes,
    }),
  });

  return { operation, sourcePath, stubPath };
});

it.layer(NodeServices.layer, { excludeTestServices: true })("makeTikaAppFileProcessingEngine", (it) => {
  it("keeps tika-app schema wire inputs and normalization stable", () => {
    const config = Result.getOrThrow(decodeTikaAppEngineConfigResult({ jarPath: "/opt/tika/tika-app.jar" }));

    expect(config.javaPath).toBe("java");
    expect(config.timeoutMillis).toBe(PosInt.make(120_000));
    expect(encode(TikaAppEngineConfig, config)).toEqual({
      jarPath: "/opt/tika/tika-app.jar",
      javaPath: "java",
      timeoutMillis: 120_000,
    });
    expect(TikaContentText.decodeUnknownSync("\n  hello corpus world\n\n")).toBe("hello corpus world");
  });

  it.prop(
    "round-trips schema-derived tika-app schemas through encoded form",
    [TikaAppEngineConfigArbitrary, TikaContentTextArbitrary],
    ([config, contentText]) => {
      expectRoundTrip(TikaAppEngineConfig, config);
      expectRoundTrip(TikaContentText, contentText);
    },
    { arbitrary: fcRuns(25) }
  );

  it.effect(
    "refuses extraction when the caller omits source bytes",
    Effect.fnUntraced(function* () {
      const { operation, stubPath } = yield* fixture(stubJava, "pdf-text-layer");
      const engine = yield* makeTikaAppFileProcessingEngine(
        TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar", javaPath: stubPath })
      );
      const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;
      const operationWithoutBytes = ExtractFileOperation.make({
        ...operation,
        source: SourceArtifact.make(sourceWithoutBytes),
      });

      const error = yield* engine.extract(operationWithoutBytes).pipe(Effect.flip);

      expect(error.reason).toBe("file-extraction-failed");
      expect(error.message).toContain("caller-supplied source bytes");
    })
  );

  it.effect(
    "reports archive export as unsupported",
    Effect.fnUntraced(function* () {
      const { operation, stubPath } = yield* fixture(stubJava, "pdf-text-layer");
      const engine = yield* makeTikaAppFileProcessingEngine(
        TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar", javaPath: stubPath })
      );
      const exportOperation = ExportArchiveOperation.make({
        format: "pst",
        operationId: operation.operationId,
        operationKind: "export-archive",
        preference: { engine: "tika" },
        source: operation.source,
      });

      const error = yield* engine.exportArchive(exportOperation).pipe(Effect.flip);

      expect(error.reason).toBe("unsupported-file-format");
    })
  );

  it.effect(
    "extracts trimmed text and stringified metadata via tika-app",
    Effect.fnUntraced(function* () {
      const { operation, stubPath } = yield* fixture(stubJava, "pdf-text-layer");
      const engine = yield* makeTikaAppFileProcessingEngine(
        TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar", javaPath: stubPath })
      );

      const result = yield* engine.extract(operation);

      expect(result.engine).toBe("apache-tika");
      expect(result.text).toBe("hello corpus world");
      expect(result.metadata["Content-Type"]).toBe("application/pdf");
      expect(result.metadata["dc:title"]).toBe("Probe Title");
      expect(result.metadata["X-TIKA:Parsed-By"]).toContain("PDFParser");
      expect(result.metadata["X-TIKA:content"]).toBeUndefined();
    })
  );

  it.effect(
    "returns metadata only for image-metadata sources",
    Effect.fnUntraced(function* () {
      const { operation, stubPath } = yield* fixture(stubJava, "image-metadata");
      const engine = yield* makeTikaAppFileProcessingEngine(
        TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar", javaPath: stubPath })
      );

      const result = yield* engine.extract(operation);

      expect(result.text).toBeUndefined();
      expect(result.metadata["Content-Type"]).toBe("application/pdf");
    })
  );

  it.effect(
    "extracts the caller-supplied snapshot instead of reopening the locator",
    Effect.fnUntraced(function* () {
      const { operation, sourcePath, stubPath } = yield* fixture(echoSourceStub, "pdf-text-layer");
      yield* FileSystem.FileSystem.pipe(Effect.flatMap((fs) => fs.writeFileString(sourcePath, "swapped after hash")));
      const engine = yield* makeTikaAppFileProcessingEngine(
        TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar", javaPath: stubPath })
      );

      const result = yield* engine.extract(operation);

      expect(result.text).toBe("not a real pdf");
    })
  );

  it.effect(
    "maps non-zero tika exits to file-extraction-failed",
    Effect.fnUntraced(function* () {
      const { operation, stubPath } = yield* fixture(failingStub, "pdf-text-layer");
      const engine = yield* makeTikaAppFileProcessingEngine(
        TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar", javaPath: stubPath })
      );

      const error = yield* engine.extract(operation).pipe(Effect.flip);

      expect(error.reason).toBe("file-extraction-failed");
    })
  );

  it.effect(
    "maps a missing java binary to engine-unavailable",
    Effect.fnUntraced(function* () {
      const { operation } = yield* fixture(stubJava, "pdf-text-layer");
      const executable = "/nonexistent/java-missing";
      const annotations: Array<Record<string, unknown>> = [];
      const logger = Logger.make<unknown, void>((options) => {
        annotations.push({ ...options.fiber.getRef(References.CurrentLogAnnotations) });
      });
      const engine = yield* makeTikaAppFileProcessingEngine(
        TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar", javaPath: executable })
      );

      const error = yield* engine
        .extract(operation)
        .pipe(
          Effect.provideService(Logger.CurrentLoggers, new Set([logger])),
          Effect.provideService(References.MinimumLogLevel, "Debug"),
          Effect.flip
        );

      expect(error.reason).toBe("engine-unavailable");
      expect(error.message).not.toContain(executable);
      expect(annotations).toEqual([
        {
          "process.error_kind": "NotFound",
          "process.method": "spawn",
          "process.module": "ChildProcess",
          "tika.engine": "tika-app",
          "tika.operation": "extract",
        },
      ]);
    })
  );
});
