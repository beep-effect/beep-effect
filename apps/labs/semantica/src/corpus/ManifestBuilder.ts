import { $SemanticaId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils, Sha256HexFromBytes } from "@beep/schema";
import { Context, Crypto, Effect, Equal, FileSystem, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ByteDrift, ByteExpectation, verifyByteExpectations } from "@/corpus/ByteWitness";
import { canonicalJson } from "@/corpus/Canonical";
import {
  CorpusManifest,
  CorpusManifestRow,
  CorpusManifestSelection,
  CorpusRootUnavailable,
  isCorpusPaperId,
  ManifestDecodeFailed,
  ManifestDiff,
  ManifestDrift,
} from "@/corpus/Manifest";
import { LabConfig } from "@/runtime/Config";
import type { CorpusPaperId } from "@/corpus/Manifest";

const $I = $SemanticaId.create("corpus/ManifestBuilder");

const ManifestFromJsonString = S.fromJsonString(CorpusManifest).pipe(
  SchemaUtils.withStatics((schema) => ({
    decodeEffect: S.decodeEffect(schema),
  }))
);

/**
 * Operations that build W1 from the configured corpus root or check a committed manifest.
 *
 * @category services
 * @since 0.0.0
 */
interface CorpusManifestBuilderShape {
  readonly build: Effect.Effect<CorpusManifest, CorpusRootUnavailable>;
  readonly check: (
    manifestPath: string
  ) => Effect.Effect<CorpusManifest, ManifestDrift | CorpusRootUnavailable | ManifestDecodeFailed>;
  readonly load: (manifestPath: string) => Effect.Effect<CorpusManifest, ManifestDecodeFailed>;
}

/**
 * App-local service for deterministic W1 manifest construction and drift checks.
 *
 * **Example** (Describe a manifest build)
 *
 * ```ts
 * import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder"
 * import { Effect } from "effect"
 *
 * const build = CorpusManifestBuilder.pipe(Effect.flatMap((service) => service.build))
 * console.log(Effect.isEffect(build)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CorpusManifestBuilder extends Context.Service<CorpusManifestBuilder, CorpusManifestBuilderShape>()(
  $I`CorpusManifestBuilder`
) {}

const makeCorpusRootUnavailable = (
  corpusRoot: O.Option<string>,
  reason: CorpusRootUnavailable["reason"],
  message: string
): CorpusRootUnavailable =>
  CorpusRootUnavailable.make({
    corpusRoot,
    message,
    reason,
  });

const toManifestDiff = (row: CorpusManifestRow, drift: ByteDrift): ManifestDiff => {
  const id = row.id;
  return ByteDrift.match({
    "missing-file": ({ relativePath }) =>
      ManifestDiff.cases["missing-file"].make({
        id,
        relativePath,
      }),
    "sha256-mismatch": ({ relativePath, expectedSha256, actualSha256 }) =>
      ManifestDiff.cases["sha256-mismatch"].make({
        id,
        relativePath,
        expectedSha256,
        actualSha256,
      }),
    "bytes-mismatch": ({ relativePath, expectedBytes, actualBytes }) =>
      ManifestDiff.cases["bytes-mismatch"].make({
        id,
        relativePath,
        expectedBytes,
        actualBytes,
      }),
  })(drift);
};

const makeCorpusManifestBuilder = Effect.gen(function* () {
  const config = yield* LabConfig;
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const resolveCorpusRoot = Effect.fn("CorpusManifestBuilder.resolveCorpusRoot")(function* () {
    const corpusRoot = yield* config.corpusRoot.pipe(
      Effect.fromOption(() =>
        makeCorpusRootUnavailable(
          O.none(),
          "not-configured",
          "SEMANTICA_CORPUS_ROOT is not configured for the external W1 corpus."
        )
      )
    );
    const exists = yield* fs
      .exists(corpusRoot)
      .pipe(
        Effect.mapError(() =>
          makeCorpusRootUnavailable(
            O.some(corpusRoot),
            "unreadable-directory",
            "The configured W1 corpus root could not be inspected."
          )
        )
      );
    if (!exists) {
      return yield* makeCorpusRootUnavailable(
        O.some(corpusRoot),
        "missing-directory",
        "The configured W1 corpus root does not exist."
      );
    }
    const info = yield* fs
      .stat(corpusRoot)
      .pipe(
        Effect.mapError(() =>
          makeCorpusRootUnavailable(
            O.some(corpusRoot),
            "unreadable-directory",
            "The configured W1 corpus root could not be read."
          )
        )
      );
    if (!Str.Equivalence(info.type, "Directory")) {
      return yield* makeCorpusRootUnavailable(
        O.some(corpusRoot),
        "missing-directory",
        "The configured W1 corpus root is not a directory."
      );
    }
    return corpusRoot;
  });

  const hashBytes = Effect.fn("CorpusManifestBuilder.hashBytes")((bytes: Uint8Array) =>
    Sha256HexFromBytes.decodeEffect(bytes).pipe(Effect.provideService(Crypto.Crypto, crypto), Effect.orDie)
  );

  const readSelectedPaperIds = Effect.fn("CorpusManifestBuilder.readSelectedPaperIds")(function* (corpusRoot: string) {
    const names = yield* fs
      .readDirectory(corpusRoot)
      .pipe(
        Effect.mapError(() =>
          makeCorpusRootUnavailable(
            O.some(corpusRoot),
            "unreadable-directory",
            "The configured W1 corpus root could not be listed."
          )
        )
      );
    const ids = A.sort(
      A.getSomes(
        A.map(names, (name) => {
          if (!Str.Equivalence(path.extname(name), ".pdf")) {
            return O.none<CorpusPaperId>();
          }
          const stem = path.basename(name, ".pdf");
          return isCorpusPaperId(stem) ? O.some(stem) : O.none<CorpusPaperId>();
        })
      ),
      Order.String
    );
    const selected = A.take(ids, 25);
    if (!Equal.equals(A.length(selected), 25)) {
      return yield* makeCorpusRootUnavailable(
        O.some(corpusRoot),
        "insufficient-pdfs",
        "The configured W1 corpus root contains fewer than 25 valid corpus PDFs."
      );
    }
    return { ids, selected };
  });

  const build = Effect.gen(function* () {
    const corpusRoot = yield* resolveCorpusRoot();
    const { ids, selected } = yield* readSelectedPaperIds(corpusRoot);
    const rows = yield* Effect.forEach(
      selected,
      Effect.fnUntraced(function* (id: CorpusPaperId) {
        const relativePath = `${id}.pdf`;
        const bytes = yield* fs
          .readFile(path.join(corpusRoot, relativePath))
          .pipe(
            Effect.mapError(() =>
              makeCorpusRootUnavailable(
                O.some(corpusRoot),
                "unreadable-directory",
                `The selected W1 paper ${relativePath} could not be read.`
              )
            )
          );
        return CorpusManifestRow.make({
          id,
          relativePath,
          sha256: yield* hashBytes(bytes),
          bytes: NonNegativeInt.make(bytes.byteLength),
        });
      }),
      { concurrency: 4 }
    );
    if (!A.isReadonlyArrayNonEmpty(rows)) {
      return yield* makeCorpusRootUnavailable(
        O.some(corpusRoot),
        "insufficient-pdfs",
        "The configured W1 corpus root did not yield any selected PDF rows."
      );
    }
    const corpusHash = yield* hashBytes(new TextEncoder().encode(canonicalJson(rows)));
    return CorpusManifest.make({
      schemaVersion: "w1-manifest/v1",
      corpusId: "academia-2026-07",
      selection: CorpusManifestSelection.make({
        rule: "first-25-by-id",
        take: 25,
        onDisk: NonNegativeInt.make(A.length(ids)),
      }),
      rows,
      corpusHash,
    });
  }).pipe(Effect.withSpan("CorpusManifestBuilder.build"));

  const load = Effect.fn("CorpusManifestBuilder.load")(function* (manifestPath: string) {
    const source = yield* fs.readFileString(manifestPath).pipe(
      Effect.mapError(() =>
        ManifestDecodeFailed.make({
          message: "The W1 manifest could not be read.",
          manifestPath,
        })
      )
    );
    return yield* ManifestFromJsonString.decodeEffect(source).pipe(
      Effect.mapError(() =>
        ManifestDecodeFailed.make({
          message: "The W1 manifest is not valid w1-manifest/v1 JSON.",
          manifestPath,
        })
      )
    );
  });

  const check = Effect.fn("CorpusManifestBuilder.check")(function* (manifestPath: string) {
    const manifest = yield* load(manifestPath);
    const corpusRoot = yield* resolveCorpusRoot();
    const expectations = A.map(manifest.rows, (row) =>
      ByteExpectation.make({
        relativePath: row.relativePath,
        sha256: row.sha256,
        bytes: row.bytes,
      })
    );
    const byteDrifts = yield* verifyByteExpectations(corpusRoot, expectations).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path)
    );
    const diffs = yield* Effect.forEach(
      byteDrifts,
      Effect.fnUntraced(function* (drift) {
        const row = yield* Effect.fromOption(
          A.findFirst(manifest.rows, (candidate) => Str.Equivalence(candidate.relativePath, drift.relativePath))
        ).pipe(Effect.orDie);
        return toManifestDiff(row, drift);
      })
    );
    if (A.isReadonlyArrayNonEmpty(diffs)) {
      return yield* ManifestDrift.make({
        message: "W1 manifest drift detected.",
        manifestPath,
        diffs,
      });
    }
    return manifest;
  });

  return CorpusManifestBuilder.of({ build, check, load });
});

/**
 * Live W1 manifest service backed by Bun filesystem, path, crypto, and {@link LabConfig}.
 *
 * **Example** (Inspect the live service layer)
 *
 * ```ts
 * import { CorpusManifestBuilderLive } from "@/corpus/ManifestBuilder"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(CorpusManifestBuilderLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CorpusManifestBuilderLive = Layer.effect(CorpusManifestBuilder, makeCorpusManifestBuilder);
