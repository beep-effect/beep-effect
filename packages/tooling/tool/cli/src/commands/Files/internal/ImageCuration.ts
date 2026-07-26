/**
 * Read-only image auditing and ledger-driven canonical PNG materialization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import {
  FaceDetectionImageRequest,
  FaceDetectionModelConfig,
  FaceDetectionService,
  makeFaceDetectionService,
  withDetector,
} from "@beep/face-detection";
import { A, Str } from "@beep/utils";
import { Console, Effect, FileSystem, MutableHashMap, MutableHashSet, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import sharp from "sharp";
import { hashFileSha256 as hashFileSha256Hex } from "../../../internal/cli/FsGuards.ts";
import { FilesCommandError, formatPlatformError } from "../Files.errors.ts";
import { isSupportedMetadataImageExtension, normalizeBareExtension } from "../Files.media.ts";
import {
  encodeImageAuditManifest,
  ImageAuditCluster,
  ImageAuditEntry,
  ImageAuditFaceMetrics,
  ImageAuditManifest,
  ImageAuditMetadataPresence,
  ImageAuditQualityMetrics,
  ImageAuditSimilarityPair,
  ImageAuditSkippedEntry,
  ImageAuditSummary,
} from "./ImageAudit.schemas.ts";
import {
  decodeImageCurationDecisionDocumentJson,
  encodeImageCurationManifest,
  ImageCurationManifest,
  ImageCurationManifestEntry,
  ImageCurationSummary,
} from "./ImageCuration.schemas.ts";
import { FileSha256Hash } from "./Media.schemas.ts";
import type { LoadedFaceDetector } from "@beep/face-detection";
import type { Terminal } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ImageAuditOptions } from "./ImageAudit.schemas.ts";
import type {
  ImageCurationCrop,
  ImageCurationDecision,
  ImageCurationDecisionDocument,
  ImageCurationDisposition,
  ImageCurationOptions,
} from "./ImageCuration.schemas.ts";

// cspell:ignore Iptc iptc

type SharpInstance = ReturnType<typeof sharp>;
type SharpMetadata = Awaited<ReturnType<SharpInstance["metadata"]>>;

interface AuditSourceFile {
  readonly extension: string;
  readonly name: string;
  readonly path: string;
  readonly relativePath: string;
  readonly size: string;
}

interface AuditSourceCollection {
  readonly canonicalDirectory: string;
  readonly files: ReadonlyArray<AuditSourceFile>;
  readonly skipped: ReadonlyArray<ImageAuditSkippedEntry>;
}

interface AuditedPixels {
  readonly colorHash: string;
  readonly decodedPixelSha256: FileSha256Hash;
  readonly height: number;
  readonly metadata: ImageAuditMetadataPresence;
  readonly perceptualHash: string;
  readonly quality: ImageAuditQualityMetrics;
  readonly width: number;
}

interface PreparedCurationEntry {
  readonly decision: ImageCurationDecision;
  readonly outputName: string;
  readonly outputPath: string;
  readonly outputRelativePath: string;
  readonly source: AuditSourceFile;
}

interface PixelStatistics {
  readonly darkCount: number;
  readonly histogram: Uint32Array;
  readonly lightCount: number;
  readonly luminance: Uint8Array;
  readonly luminanceTotal: number;
  readonly rgSquaredTotal: number;
  readonly rgTotal: number;
  readonly ybSquaredTotal: number;
  readonly ybTotal: number;
}

interface ValidatedSourceDecision {
  readonly decision: ImageCurationDecision;
  readonly hash: FileSha256Hash;
  readonly source: AuditSourceFile;
}

interface NamedSourceDecision extends ValidatedSourceDecision {
  readonly outputName: string;
}

interface ValidatedDecisionLedger {
  readonly decisions: ImageCurationDecisionDocument;
  readonly manifestPath: string;
  readonly outputDirectory: string;
  readonly prepared: ReadonlyArray<PreparedCurationEntry>;
  readonly sourceDirectory: string;
}

interface OrientedImageDimensions {
  readonly height: number;
  readonly width: number;
}

interface MaterializedPng extends OrientedImageDimensions {
  readonly size: number;
}

interface OptionalManifestDecisionFields {
  crop?: ImageCurationCrop;
  duplicateClusterId?: string;
  sessionId?: string;
}

interface ImagePathOperations {
  readonly basename: (value: string) => string;
  readonly isAbsolute: (value: string) => boolean;
  readonly join: (...paths: ReadonlyArray<string>) => string;
  readonly relative: (from: string, to: string) => string;
}

const decodeFileSha256Hash = S.decodeUnknownEffect(FileSha256Hash);
const encodeUnknownJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const byAuditSourceName = Order.mapInput(Order.String, (source: AuditSourceFile) => source.name);
const byAuditEntryName = Order.mapInput(Order.String, (entry: ImageAuditEntry) => entry.sourceName);
const bySkippedEntryName = Order.mapInput(Order.String, (entry: ImageAuditSkippedEntry) => entry.sourceName);
const roundMetric = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

const fileSha256 = Effect.fn("Files.imageCurationFileSha256")(function* (
  filePath: string
): Effect.fn.Return<FileSha256Hash, FilesCommandError, FileSystem.FileSystem | Crypto.Crypto> {
  const hex = yield* hashFileSha256Hex(filePath, (cause) =>
    FilesCommandError.new(cause, `Failed to hash image source "${filePath}"`)
  );
  return yield* decodeFileSha256Hash(`sha256:${hex}`).pipe(
    Effect.mapError((cause) => FilesCommandError.new(cause, `Failed to validate image hash for "${filePath}"`))
  );
});

const checkedHash = Effect.fn("Files.imageCurationCheckedHash")(function* (
  hex: string,
  context: string
): Effect.fn.Return<FileSha256Hash, FilesCommandError> {
  return yield* decodeFileSha256Hash(`sha256:${hex}`).pipe(
    Effect.mapError((cause) => FilesCommandError.new(cause, `Failed to validate ${context} hash`))
  );
});

const isDirectSafeName = (path: Pick<ImagePathOperations, "basename">, value: string): boolean =>
  Str.isNonEmpty(value) &&
  value !== "." &&
  value !== ".." &&
  path.basename(value) === value &&
  !value.includes("/") &&
  !value.includes("\\") &&
  !value.includes("\0");

const collectAuditSources = Effect.fn("Files.collectImageAuditSources")(function* (
  directory: string
): Effect.fn.Return<AuditSourceCollection, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolvedDirectory = path.resolve(directory);
  const canonicalDirectory = yield* fs
    .realPath(resolvedDirectory)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to resolve image audit directory", resolvedDirectory, { cause })
      )
    );
  const directoryStat = yield* fs
    .stat(canonicalDirectory)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to stat image audit directory", canonicalDirectory, { cause })
      )
    );

  if (directoryStat.type !== "Directory") {
    return yield* FilesCommandError.make({
      message: `Image audit source must be a directory: "${canonicalDirectory}"`,
    });
  }

  const names = yield* fs
    .readDirectory(canonicalDirectory)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to read image audit directory", canonicalDirectory, { cause })
      )
    );
  let files = A.empty<AuditSourceFile>();
  let skipped = A.empty<ImageAuditSkippedEntry>();

  for (const name of A.sort(names, Order.String)) {
    const sourcePath = path.join(canonicalDirectory, name);
    const canonicalPath = yield* fs.realPath(sourcePath).pipe(Effect.option);

    if (O.isNone(canonicalPath) || canonicalPath.value !== sourcePath) {
      skipped = A.append(
        skipped,
        ImageAuditSkippedEntry.make({
          message: "Symlinks and unresolvable entries are not audited.",
          sourceName: name,
          sourcePath,
        })
      );
      continue;
    }

    const stat = yield* fs
      .stat(sourcePath)
      .pipe(
        Effect.mapError((cause) => formatPlatformError("Failed to stat image audit source", sourcePath, { cause }))
      );

    if (stat.type !== "File") {
      skipped = A.append(
        skipped,
        ImageAuditSkippedEntry.make({
          message: "Only direct regular image files are audited.",
          sourceName: name,
          sourcePath,
        })
      );
      continue;
    }

    const extension = path.extname(name);
    if (!isSupportedMetadataImageExtension(normalizeBareExtension(extension))) {
      skipped = A.append(
        skipped,
        ImageAuditSkippedEntry.make({
          message: "File extension is not supported by the image audit decoder.",
          sourceName: name,
          sourcePath,
        })
      );
      continue;
    }

    files = A.append(files, {
      extension,
      name,
      path: sourcePath,
      relativePath: path.relative(canonicalDirectory, sourcePath),
      size: `${stat.size}`,
    });
  }

  return {
    canonicalDirectory,
    files: A.sort(files, byAuditSourceName),
    skipped: A.sort(skipped, bySkippedEntryName),
  };
});

const bitsToHex = (bits: ReadonlyArray<boolean>): string => {
  let output = "";
  for (let index = 0; index < bits.length; index += 4) {
    let nibble = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      nibble = nibble * 2 + (bits[index + offset] === true ? 1 : 0);
    }
    output += nibble.toString(16);
  }
  return output;
};

const perceptualHashFromGray = (data: Uint8Array): string => {
  const bits: Array<boolean> = [];
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 12; x += 1) {
      bits.push((data[y * 13 + x] ?? 0) > (data[y * 13 + x + 1] ?? 0));
    }
  }
  return bitsToHex(bits);
};

const colorHashFromRgb = (data: Uint8Array, channels: number): string => {
  let output = "";
  for (let pixel = 0; pixel < 16; pixel += 1) {
    const offset = pixel * channels;
    output += Math.floor((data[offset] ?? 0) / 16).toString(16);
    output += Math.floor((data[offset + 1] ?? 0) / 16).toString(16);
    output += Math.floor((data[offset + 2] ?? 0) / 16).toString(16);
  }
  return output;
};

const numericAt = (data: Uint8Array | Uint32Array, index: number): number => data[index] ?? 0;

const collectPixelStatistics = (data: Uint8Array, pixelCount: number, channels: number): PixelStatistics => {
  const luminance = new Uint8Array(pixelCount);
  const histogram = new Uint32Array(256);
  let darkCount = 0;
  let lightCount = 0;
  let luminanceTotal = 0;
  let rgTotal = 0;
  let ybTotal = 0;
  let rgSquaredTotal = 0;
  let ybSquaredTotal = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * channels;
    const red = numericAt(data, offset);
    const green = numericAt(data, offset + 1);
    const blue = numericAt(data, offset + 2);
    const value = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
    const rg = red - green;
    const yb = (red + green) / 2 - blue;
    luminance[index] = value;
    histogram[value] = numericAt(histogram, value) + 1;
    luminanceTotal += value;
    rgTotal += rg;
    ybTotal += yb;
    rgSquaredTotal += rg * rg;
    ybSquaredTotal += yb * yb;
    if (value <= 5) darkCount += 1;
    if (value >= 250) lightCount += 1;
  }

  return {
    darkCount,
    histogram,
    lightCount,
    luminance,
    luminanceTotal,
    rgSquaredTotal,
    rgTotal,
    ybSquaredTotal,
    ybTotal,
  };
};

const edgeEnergyFromLuminance = (luminance: Uint8Array, width: number, height: number): number => {
  let edgeTotal = 0;
  let edgeCount = 0;
  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const value = numericAt(luminance, y * width + x);
      edgeTotal += Math.abs(value - numericAt(luminance, y * width + x - 1));
      edgeTotal += Math.abs(value - numericAt(luminance, (y - 1) * width + x));
      edgeCount += 2;
    }
  }
  return edgeCount === 0 ? 0 : edgeTotal / edgeCount;
};

const entropyFromHistogram = (histogram: Uint32Array, pixelCount: number): number => {
  let entropyBits = 0;
  for (const count of histogram) {
    if (count === 0) continue;
    const probability = count / pixelCount;
    entropyBits -= probability * Math.log2(probability);
  }
  return entropyBits;
};

const colorfulnessFromStatistics = (statistics: PixelStatistics, pixelCount: number): number => {
  const rgMean = statistics.rgTotal / pixelCount;
  const ybMean = statistics.ybTotal / pixelCount;
  const rgStd = Math.sqrt(Math.max(0, statistics.rgSquaredTotal / pixelCount - rgMean * rgMean));
  const ybStd = Math.sqrt(Math.max(0, statistics.ybSquaredTotal / pixelCount - ybMean * ybMean));
  return Math.sqrt(rgStd * rgStd + ybStd * ybStd) + 0.3 * Math.sqrt(rgMean * rgMean + ybMean * ybMean);
};

const qualityMetricsFromRgb = (data: Uint8Array, width: number, height: number, channels: number) => {
  const pixelCount = width * height;
  const statistics = collectPixelStatistics(data, pixelCount, channels);
  return ImageAuditQualityMetrics.make({
    colorfulness: roundMetric(colorfulnessFromStatistics(statistics, pixelCount)),
    darkClipPct: roundMetric((statistics.darkCount * 100) / pixelCount),
    edgeEnergy: roundMetric(edgeEnergyFromLuminance(statistics.luminance, width, height)),
    entropyBits: roundMetric(entropyFromHistogram(statistics.histogram, pixelCount)),
    lightClipPct: roundMetric((statistics.lightCount * 100) / pixelCount),
    meanLuminance: roundMetric(statistics.luminanceTotal / pixelCount),
  });
};

const hasEmbeddedMetadata = (value: Uint8Array | undefined): boolean => value !== undefined && value.length > 0;

const imageAuditMetadataPresence = (metadata: SharpMetadata): ImageAuditMetadataPresence => {
  const presence = {
    hasExif: hasEmbeddedMetadata(metadata.exif),
    hasIcc: hasEmbeddedMetadata(metadata.icc),
    hasIptc: hasEmbeddedMetadata(metadata.iptc),
    hasXmp: hasEmbeddedMetadata(metadata.xmp),
  };
  if (metadata.orientation === undefined) {
    return ImageAuditMetadataPresence.make({
      ...presence,
      orientationApplied: false,
    });
  }
  return ImageAuditMetadataPresence.make({
    ...presence,
    orientation: metadata.orientation,
    orientationApplied: metadata.orientation !== 1,
  });
};

const analyzePixels = Effect.fn("Files.analyzeImageAuditPixels")(function* (
  source: AuditSourceFile
): Effect.fn.Return<AuditedPixels, FilesCommandError> {
  const metadata = yield* Effect.tryPromise({
    try: () => sharp(source.path, { failOn: "error" }).metadata(),
    catch: FilesCommandError.new(`Failed to decode image audit pixels for "${source.path}"`),
  });
  const decoded = yield* Effect.tryPromise({
    try: () =>
      sharp(source.path, { failOn: "error" })
        .rotate()
        .flatten({ background: { b: 255, g: 255, r: 255 } })
        .toColorspace("srgb")
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    catch: FilesCommandError.new(`Failed to decode image audit pixels for "${source.path}"`),
  });
  const rawOptions = {
    raw: {
      channels: decoded.info.channels,
      height: decoded.info.height,
      width: decoded.info.width,
    },
  } as const;
  const [perceptual, color, quality] = yield* Effect.all(
    [
      Effect.tryPromise({
        try: () =>
          sharp(decoded.data, rawOptions)
            .resize(13, 12, { fit: "fill" })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true }),
        catch: FilesCommandError.new(`Failed to compute perceptual hash for "${source.path}"`),
      }),
      Effect.tryPromise({
        try: () =>
          sharp(decoded.data, rawOptions).resize(4, 4, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true }),
        catch: FilesCommandError.new(`Failed to compute color hash for "${source.path}"`),
      }),
      Effect.tryPromise({
        try: () =>
          sharp(decoded.data, rawOptions)
            .resize(256, 256, { fit: "inside", withoutEnlargement: true })
            .raw()
            .toBuffer({ resolveWithObject: true }),
        catch: FilesCommandError.new(`Failed to compute quality metrics for "${source.path}"`),
      }),
    ],
    { concurrency: 3 }
  );
  const decodedHeader = new TextEncoder().encode(
    `${decoded.info.width}x${decoded.info.height}x${decoded.info.channels}:`
  );
  const decodedHash = createHash("sha256").update(decodedHeader).update(decoded.data).digest("hex");

  return {
    colorHash: colorHashFromRgb(color.data, color.info.channels),
    decodedPixelSha256: yield* checkedHash(decodedHash, "decoded-pixel"),
    height: decoded.info.height,
    metadata: imageAuditMetadataPresence(metadata),
    perceptualHash: perceptualHashFromGray(perceptual.data),
    quality: qualityMetricsFromRgb(quality.data, quality.info.width, quality.info.height, quality.info.channels),
    width: decoded.info.width,
  };
});

const analyzeFaceMetrics = Effect.fn("Files.analyzeImageAuditFaces")(function* (
  detector: LoadedFaceDetector,
  source: AuditSourceFile,
  minConfidence: number
): Effect.fn.Return<ImageAuditFaceMetrics, FilesCommandError> {
  const detection = yield* detector
    .detect(
      FaceDetectionImageRequest.make({
        imagePath: source.path,
        minConfidence,
      })
    )
    .pipe(
      Effect.mapError((cause) =>
        FilesCommandError.make({
          cause,
          message: `Face detection failed for "${source.path}": ${cause.message}`,
        })
      )
    );
  const primary = A.head(detection.faces);

  if (O.isNone(primary)) {
    return ImageAuditFaceMetrics.make({ faceCount: 0 });
  }

  return ImageAuditFaceMetrics.make({
    faceCount: A.length(detection.faces),
    primaryFaceAreaPct: roundMetric(
      (primary.value.box.width * primary.value.box.height * 100) / (detection.width * detection.height)
    ),
    primaryFaceConfidence: roundMetric(primary.value.confidence),
    primaryFaceHeight: roundMetric(primary.value.box.height),
    primaryFaceWidth: roundMetric(primary.value.box.width),
  });
});

const hexHammingDistance = (left: string, right: string): number => {
  let distance = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const xor = Number.parseInt(left[index] ?? "0", 16) ^ Number.parseInt(right[index] ?? "0", 16);
    distance += xor.toString(2).replaceAll("0", "").length;
  }
  return distance + Math.abs(left.length - right.length) * 4;
};

const colorHashDistance = (left: string, right: string): number => {
  let total = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    total += Math.abs(Number.parseInt(left[index] ?? "0", 16) - Number.parseInt(right[index] ?? "0", 16));
  }
  return roundMetric(length === 0 ? 1 : total / (length * 15));
};

const candidateSimilarityPairs = (entries: ReadonlyArray<ImageAuditEntry>) => {
  let pairs = A.empty<ImageAuditSimilarityPair>();
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    const left = entries[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const right = entries[rightIndex];
      if (right === undefined) continue;
      const perceptualDistance = hexHammingDistance(left.perceptualHash, right.perceptualHash);
      if (perceptualDistance > 24) continue;
      const colorDistance = colorHashDistance(left.colorHash, right.colorHash);
      if (colorDistance > 0.42) continue;
      pairs = A.append(
        pairs,
        ImageAuditSimilarityPair.make({
          colorDistance,
          perceptualDistance,
          sourceNameA: left.sourceName,
          sourceNameB: right.sourceName,
        })
      );
    }
  }
  return pairs;
};

const duplicateClusters = (
  entries: ReadonlyArray<ImageAuditEntry>,
  pairs: ReadonlyArray<ImageAuditSimilarityPair>
): ReadonlyArray<ImageAuditCluster> => {
  const indexByName = MutableHashMap.empty<string, number>();
  const parents = entries.map((_entry, index) => index);
  entries.forEach((entry, index) => MutableHashMap.set(indexByName, entry.sourceName, index));

  const find = (index: number): number => {
    let current = index;
    while (parents[current] !== current) current = parents[current] ?? current;
    let compressed = index;
    while (parents[compressed] !== current) {
      const next = parents[compressed] ?? current;
      parents[compressed] = current;
      compressed = next;
    }
    return current;
  };

  for (const pair of pairs) {
    if (pair.perceptualDistance > 12 || pair.colorDistance > 0.3) continue;
    const left = MutableHashMap.get(indexByName, pair.sourceNameA);
    const right = MutableHashMap.get(indexByName, pair.sourceNameB);
    if (O.isNone(left) || O.isNone(right)) continue;
    const leftRoot = find(left.value);
    const rightRoot = find(right.value);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  }

  const grouped = MutableHashMap.empty<number, ReadonlyArray<string>>();
  entries.forEach((entry, index) => {
    const root = find(index);
    MutableHashMap.set(
      grouped,
      root,
      pipe(MutableHashMap.get(grouped, root), O.getOrElse(A.empty<string>), A.append(entry.sourceName))
    );
  });

  return A.fromIterable(MutableHashMap.values(grouped))
    .filter((names) => names.length > 1)
    .map((names) => A.sort(names, Order.String))
    .sort((left, right) => (left[0] ?? "").localeCompare(right[0] ?? ""))
    .map((names, index) =>
      ImageAuditCluster.make({
        id: `duplicate-${`${index + 1}`.padStart(3, "0")}`,
        sourceNames: names as [string, ...Array<string>],
      })
    );
};

const candidateSessionClusters = (entries: ReadonlyArray<ImageAuditEntry>): ReadonlyArray<ImageAuditCluster> => {
  const groups = MutableHashMap.empty<string, ReadonlyArray<string>>();
  for (const entry of entries) {
    const match = /^([0-9]+)\.[0-9]+\.[^.]+$/u.exec(entry.sourceName);
    if (match?.[1] === undefined) continue;
    MutableHashMap.set(
      groups,
      match[1],
      pipe(MutableHashMap.get(groups, match[1]), O.getOrElse(A.empty<string>), A.append(entry.sourceName))
    );
  }

  return A.fromIterable(groups)
    .filter(([, names]) => names.length > 1)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([prefix, names]) =>
      ImageAuditCluster.make({
        id: `filename-session-${prefix}`,
        sourceNames: A.sort(names, Order.String) as [string, ...Array<string>],
      })
    );
};

const writeJsonAtomically = Effect.fn("Files.writeImageCurationJsonAtomically")(function* (
  filePath: string,
  value: unknown,
  overwrite: boolean,
  description: string
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = path.resolve(filePath);
  const exists = yield* fs
    .exists(resolved)
    .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to inspect ${description}`, resolved, { cause })));

  if (exists && !overwrite) {
    return yield* FilesCommandError.make({
      message: `Refusing to overwrite existing ${description}: "${resolved}"`,
    });
  }
  if (exists) {
    const stat = yield* fs
      .stat(resolved)
      .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to stat ${description}`, resolved, { cause })));
    if (stat.type !== "File") {
      return yield* FilesCommandError.make({
        message: `Refusing to overwrite non-file ${description}: "${resolved}"`,
      });
    }
  }

  const parent = path.dirname(resolved);
  yield* fs
    .makeDirectory(parent, { recursive: true })
    .pipe(
      Effect.mapError((cause) => formatPlatformError(`Failed to create ${description} directory`, parent, { cause }))
    );
  yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({ directory: parent, prefix: ".beep-files-image-json-" })
      .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to stage ${description}`, parent, { cause }))),
    Effect.fnUntraced(function* (tempDir) {
      const tempPath = path.join(tempDir, path.basename(resolved));
      const content = pipe(
        yield* encodeUnknownJson(value).pipe(
          Effect.mapError((cause) => FilesCommandError.new(cause, `Failed to encode ${description}`))
        ),
        Str.concat("\n")
      );
      yield* fs
        .writeFileString(tempPath, content)
        .pipe(
          Effect.mapError((cause) => formatPlatformError(`Failed to write staged ${description}`, tempPath, { cause }))
        );
      if (exists) yield* fs.remove(resolved, { force: true }).pipe(Effect.ignore);
      yield* fs
        .rename(tempPath, resolved)
        .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to commit ${description}`, resolved, { cause })));
    }),
    (tempDir) => fs.remove(tempDir, { force: true, recursive: true }).pipe(Effect.ignore)
  );
});

/**
 * Audit direct images without mutating their source directory.
 *
 * @category use-cases
 * @since 0.0.0
 */
export const auditImagesImpl = Effect.fn("FilesCommandService.auditImages")(function* (
  options: ImageAuditOptions
): Effect.fn.Return<
  ImageAuditManifest,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal | ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto
> {
  if (options.minConfidence < 0 || options.minConfidence > 1) {
    return yield* FilesCommandError.make({
      message: "Image audit --min-confidence must be between 0 and 1.",
    });
  }

  const path = yield* Path.Path;
  const sources = yield* collectAuditSources(options.dir);
  const manifestPath = path.resolve(options.manifest);
  let entries = A.empty<ImageAuditEntry>();
  let skipped = sources.skipped;

  yield* withDetector(
    FaceDetectionModelConfig.make({ modelPath: path.resolve(options.modelPath) }),
    Effect.fnUntraced(function* (detector) {
      for (const source of sources.files) {
        const result = yield* Effect.all(
          [analyzePixels(source), analyzeFaceMetrics(detector, source, options.minConfidence), fileSha256(source.path)],
          { concurrency: 3 }
        ).pipe(Effect.result);

        if (result._tag === "Failure") {
          skipped = A.append(
            skipped,
            ImageAuditSkippedEntry.make({
              message: result.failure.message,
              sourceName: source.name,
              sourcePath: source.path,
            })
          );
          continue;
        }

        const [pixels, faces, sourceSha256] = result.success;
        entries = A.append(
          entries,
          ImageAuditEntry.make({
            aspectRatio: roundMetric(pixels.width / pixels.height),
            colorHash: pixels.colorHash,
            decodedPixelSha256: pixels.decodedPixelSha256,
            extension: source.extension,
            faces,
            height: pixels.height,
            metadata: pixels.metadata,
            perceptualHash: pixels.perceptualHash,
            quality: pixels.quality,
            sourceName: source.name,
            sourcePath: source.path,
            sourceRelativePath: source.relativePath,
            sourceSha256,
            sourceSizeBytes: `${source.size}`,
            width: pixels.width,
          })
        );
      }
    })
  ).pipe(
    Effect.provideService(FaceDetectionService, makeFaceDetectionService()),
    Effect.mapError((cause) =>
      FilesCommandError.make({
        cause,
        message: `Failed to load or run image audit face model: ${cause.message}`,
      })
    )
  );

  entries = A.sort(entries, byAuditEntryName);
  skipped = A.sort(skipped, bySkippedEntryName);
  const similarityPairs = candidateSimilarityPairs(entries);
  const duplicates = duplicateClusters(entries, similarityPairs);
  const sessions = candidateSessionClusters(entries);
  const faceImageCount = A.length(A.filter(entries, (entry) => entry.faces.faceCount > 0));
  const multiFaceImageCount = A.length(A.filter(entries, (entry) => entry.faces.faceCount > 1));
  const summary = ImageAuditSummary.make({
    analyzedCount: A.length(entries),
    duplicateClusterCount: A.length(duplicates),
    faceImageCount,
    multiFaceImageCount,
    noFaceImageCount: A.length(entries) - faceImageCount,
    sessionClusterCount: A.length(sessions),
    similarityPairCount: A.length(similarityPairs),
    skippedCount: A.length(skipped),
    totalCount: A.length(entries) + A.length(skipped),
  });
  const manifest = ImageAuditManifest.make({
    duplicateClusters: duplicates,
    entries,
    manifestPath,
    modelPath: path.resolve(options.modelPath),
    schemaVersion: "beep.files.image-audit.v1",
    sessionClusters: sessions,
    similarityPairs,
    skipped,
    sourceDirectory: sources.canonicalDirectory,
    summary,
  });
  const encoded = yield* encodeImageAuditManifest(manifest).pipe(
    Effect.mapError((cause) => FilesCommandError.new(cause, "Failed to encode image audit manifest"))
  );
  yield* writeJsonAtomically(manifestPath, encoded, options.overwrite, "image audit manifest");
  yield* Console.log(
    `files audit-images: audited ${summary.analyzedCount} image(s), skipped ${summary.skippedCount}, found ${summary.duplicateClusterCount} candidate duplicate cluster(s), and wrote "${manifestPath}".`
  );
  return manifest;
});

const dispositionDirectories = {
  "active-core": "canonical/active/core",
  "active-extended": "canonical/active/extended",
  "archive-earlier-life": "archive/earlier-life",
  "archive-identity-ambiguous": "archive/identity-ambiguous",
  "archive-other-people": "archive/other-people",
  "archive-synthetic-filtered": "archive/synthetic-filtered",
  "archive-technical-quality": "archive/technical-quality",
  holdout: "canonical/holdout",
  "reserve-near-duplicate": "reserve/near-duplicate",
} as const satisfies Readonly<Record<ImageCurationDisposition, string>>;

const dispositionDirectory = (disposition: ImageCurationDisposition): string => dispositionDirectories[disposition];

const pathsOverlap = (
  path: Pick<ImagePathOperations, "isAbsolute" | "relative">,
  left: string,
  right: string
): boolean => {
  const relative = path.relative(left, right);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const requireCleanCurationSources = Effect.fn("Files.requireCleanCurationSources")(function* (
  sources: AuditSourceCollection
): Effect.fn.Return<void, FilesCommandError> {
  if (A.isReadonlyArrayNonEmpty(sources.skipped)) {
    const count = A.length(sources.skipped);
    return yield* FilesCommandError.make({
      message: `Curation requires a clean direct-image source directory; audit skipped ${count} ${
        count === 1 ? "entry" : "entries"
      }.`,
    });
  }
});

const readDecisionDocument = Effect.fn("Files.readImageCurationDecisionDocument")(function* (
  decisionDocumentPath: string
): Effect.fn.Return<ImageCurationDecisionDocument, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(decisionDocumentPath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to read image curation decision ledger", decisionDocumentPath, { cause })
      )
    );
  return yield* decodeImageCurationDecisionDocumentJson(content).pipe(
    Effect.mapError((cause) =>
      FilesCommandError.new(cause, `Failed to decode image curation decision ledger "${decisionDocumentPath}"`)
    )
  );
});

const validateCurationRoots = Effect.fn("Files.validateImageCurationRoots")(function* (
  options: ImageCurationOptions,
  sources: AuditSourceCollection,
  decisions: ImageCurationDecisionDocument
): Effect.fn.Return<{ readonly manifestPath: string; readonly outputDirectory: string }, FilesCommandError, Path.Path> {
  const path = yield* Path.Path;
  const recordedSourceDirectory = path.resolve(decisions.sourceDirectory);
  if (recordedSourceDirectory !== sources.canonicalDirectory) {
    return yield* FilesCommandError.make({
      message: `Decision ledger sourceDirectory "${recordedSourceDirectory}" does not match "${sources.canonicalDirectory}".`,
    });
  }

  const outputDirectory = path.resolve(options.outDir);
  const outputOverlapsSource =
    pathsOverlap(path, sources.canonicalDirectory, outputDirectory) ||
    pathsOverlap(path, outputDirectory, sources.canonicalDirectory);
  if (outputOverlapsSource) {
    return yield* FilesCommandError.make({
      message: `Curation output directory must not overlap source directory "${sources.canonicalDirectory}".`,
    });
  }

  const defaultManifestPath = path.join(outputDirectory, "manifests", "image-curation-manifest.json");
  return {
    manifestPath: path.resolve(
      pipe(
        options.manifest,
        O.getOrElse(() => defaultManifestPath)
      )
    ),
    outputDirectory,
  };
});

const indexCurationDecisions = Effect.fn("Files.indexImageCurationDecisions")(function* (
  decisions: ReadonlyArray<ImageCurationDecision>
): Effect.fn.Return<MutableHashMap.MutableHashMap<string, ImageCurationDecision>, FilesCommandError, Path.Path> {
  const path = yield* Path.Path;
  const decisionsByName = MutableHashMap.empty<string, ImageCurationDecision>();
  for (const decision of decisions) {
    if (!isDirectSafeName(path, decision.sourceName)) {
      return yield* FilesCommandError.make({
        message: `Unsafe curation decision sourceName: "${decision.sourceName}"`,
      });
    }
    if (MutableHashMap.has(decisionsByName, decision.sourceName)) {
      return yield* FilesCommandError.make({
        message: `Duplicate curation decision for sourceName "${decision.sourceName}".`,
      });
    }
    MutableHashMap.set(decisionsByName, decision.sourceName, decision);
  }
  return decisionsByName;
});

const namesOrNone = (names: ReadonlyArray<string>): string => (names.length === 0 ? "none" : names.join(", "));

const requireExactDecisionCoverage = Effect.fn("Files.requireExactImageCurationDecisionCoverage")(function* (
  sources: ReadonlyArray<AuditSourceFile>,
  decisions: ReadonlyArray<ImageCurationDecision>,
  decisionsByName: MutableHashMap.MutableHashMap<string, ImageCurationDecision>
): Effect.fn.Return<void, FilesCommandError> {
  const sourceNames = MutableHashSet.fromIterable(sources.map((source) => source.name));
  const missing = sources
    .filter((source) => !MutableHashMap.has(decisionsByName, source.name))
    .map((source) => source.name);
  const extra = decisions
    .filter((decision) => !MutableHashSet.has(sourceNames, decision.sourceName))
    .map((decision) => decision.sourceName);
  if (missing.length > 0 || extra.length > 0) {
    return yield* FilesCommandError.make({
      message: `Curation ledger must contain exactly one decision per source (missing: ${namesOrNone(
        missing
      )}; extra: ${namesOrNone(extra)}).`,
    });
  }
});

const validateSourceDecisionHashes = Effect.fn("Files.validateImageCurationSourceHashes")(function* (
  sources: ReadonlyArray<AuditSourceFile>,
  decisionsByName: MutableHashMap.MutableHashMap<string, ImageCurationDecision>
): Effect.fn.Return<ReadonlyArray<ValidatedSourceDecision>, FilesCommandError, FileSystem.FileSystem | Crypto.Crypto> {
  let validated = A.empty<ValidatedSourceDecision>();
  for (const source of sources) {
    const decision = MutableHashMap.get(decisionsByName, source.name);
    if (O.isNone(decision)) {
      return yield* FilesCommandError.make({ message: `Missing decision for "${source.name}".` });
    }
    const hash = yield* fileSha256(source.path);
    if (hash !== decision.value.sourceSha256) {
      return yield* FilesCommandError.make({
        message: `Source hash mismatch for "${source.name}": decision=${decision.value.sourceSha256}, actual=${hash}.`,
      });
    }
    validated = A.append(validated, { decision: decision.value, hash, source });
  }
  return validated;
});

const collisionSafeOutputName = (
  hash: FileSha256Hash,
  usedNames: MutableHashMap.MutableHashMap<string, FileSha256Hash>
): string => {
  const hex = hash.slice("sha256:".length);
  let prefixLength = 20;
  let outputName = `twv1_${hex.slice(0, prefixLength)}.png`;
  while (
    pipe(
      MutableHashMap.get(usedNames, outputName),
      O.exists((existingHash) => existingHash !== hash)
    )
  ) {
    prefixLength += 1;
    outputName = `twv1_${hex.slice(0, prefixLength)}.png`;
  }
  return outputName;
};

const allocateCurationOutputNames = (
  validated: ReadonlyArray<ValidatedSourceDecision>
): ReadonlyArray<NamedSourceDecision> => {
  const usedNames = MutableHashMap.empty<string, FileSha256Hash>();
  return validated.map((entry) => {
    const outputName = collisionSafeOutputName(entry.hash, usedNames);
    MutableHashMap.set(usedNames, outputName, entry.hash);
    return { ...entry, outputName };
  });
};

const prepareCurationEntries = (
  path: Pick<ImagePathOperations, "join">,
  outputDirectory: string,
  entries: ReadonlyArray<NamedSourceDecision>
): ReadonlyArray<PreparedCurationEntry> =>
  entries.map(({ decision, outputName, source }) => {
    const outputRelativePath = path.join(dispositionDirectory(decision.disposition), outputName);
    return {
      decision,
      outputName,
      outputPath: path.join(outputDirectory, outputRelativePath),
      outputRelativePath,
      source,
    };
  });

const validateDecisionLedger = Effect.fn("Files.validateImageCurationDecisionLedger")(function* (
  options: ImageCurationOptions
): Effect.fn.Return<ValidatedDecisionLedger, FilesCommandError, FileSystem.FileSystem | Path.Path | Crypto.Crypto> {
  const path = yield* Path.Path;
  const sources = yield* collectAuditSources(options.dir);
  yield* requireCleanCurationSources(sources);
  const decisionDocumentPath = path.resolve(options.decisionsPath);
  const decisions = yield* readDecisionDocument(decisionDocumentPath);
  const roots = yield* validateCurationRoots(options, sources, decisions);
  const decisionsByName = yield* indexCurationDecisions(decisions.decisions);
  yield* requireExactDecisionCoverage(sources.files, decisions.decisions, decisionsByName);
  const validatedSources = yield* validateSourceDecisionHashes(sources.files, decisionsByName);
  const prepared = prepareCurationEntries(path, roots.outputDirectory, allocateCurationOutputNames(validatedSources));

  return {
    decisions,
    manifestPath: roots.manifestPath,
    outputDirectory: roots.outputDirectory,
    prepared,
    sourceDirectory: sources.canonicalDirectory,
  };
});

const cropWithinBounds = (crop: ImageCurationCrop, width: number, height: number): boolean =>
  crop.left + crop.width <= width && crop.top + crop.height <= height;

const quarterTurnOrientations = MutableHashSet.make(5, 6, 7, 8);

const inspectOrientedDimensions = Effect.fn("Files.inspectOrientedImageDimensions")(function* (
  source: AuditSourceFile
): Effect.fn.Return<OrientedImageDimensions, FilesCommandError> {
  const metadata = yield* Effect.tryPromise({
    try: () => sharp(source.path, { failOn: "error" }).metadata(),
    catch: FilesCommandError.new(`Failed to inspect canonical PNG source "${source.path}"`),
  });
  const quarterTurn = MutableHashSet.has(quarterTurnOrientations, metadata.orientation ?? 1);
  const width = quarterTurn ? metadata.height : metadata.width;
  const height = quarterTurn ? metadata.width : metadata.height;
  if (width === undefined || height === undefined) {
    return yield* FilesCommandError.make({
      message: `Image decoder did not report usable dimensions for "${source.path}".`,
    });
  }
  return { height, width };
});

const validateCurationCrop = Effect.fn("Files.validateImageCurationCrop")(function* (
  entry: PreparedCurationEntry,
  dimensions: OrientedImageDimensions
): Effect.fn.Return<ImageCurationCrop | undefined, FilesCommandError> {
  const crop = entry.decision.crop;
  if (crop === undefined) return undefined;
  if (!cropWithinBounds(crop, dimensions.width, dimensions.height)) {
    return yield* FilesCommandError.make({
      message: `Crop ${crop.left},${crop.top},${crop.width}x${crop.height} exceeds ${dimensions.width}x${dimensions.height} for "${entry.source.name}".`,
    });
  }
  return crop;
});

const canonicalPngPipeline = (source: AuditSourceFile, crop: ImageCurationCrop | undefined): SharpInstance => {
  const pipeline = sharp(source.path, { failOn: "error" })
    .rotate()
    .flatten({ background: { b: 255, g: 255, r: 255 } })
    .toColorspace("srgb")
    .removeAlpha();
  if (crop === undefined) return pipeline;
  return pipeline.extract({
    height: crop.height,
    left: crop.left,
    top: crop.top,
    width: crop.width,
  });
};

const materializeCanonicalPng = Effect.fn("Files.materializeCanonicalPng")(function* (
  entry: PreparedCurationEntry,
  tempPath: string
): Effect.fn.Return<MaterializedPng, FilesCommandError> {
  const dimensions = yield* inspectOrientedDimensions(entry.source);
  const crop = yield* validateCurationCrop(entry, dimensions);
  const pipeline = canonicalPngPipeline(entry.source, crop);
  const result = yield* Effect.tryPromise({
    try: () =>
      pipeline
        .png({
          adaptiveFiltering: true,
          compressionLevel: 9,
          force: true,
          palette: false,
        })
        .toFile(tempPath),
    catch: FilesCommandError.new(`Failed to materialize canonical PNG for "${entry.source.path}"`),
  });
  return {
    height: result.height,
    size: result.size,
    width: result.width,
  };
});

const optionalManifestDecisionFields = (decision: ImageCurationDecision): OptionalManifestDecisionFields => {
  const fields: OptionalManifestDecisionFields = {};
  if (decision.crop !== undefined) fields.crop = decision.crop;
  if (decision.duplicateClusterId !== undefined) fields.duplicateClusterId = decision.duplicateClusterId;
  if (decision.sessionId !== undefined) fields.sessionId = decision.sessionId;
  return fields;
};

const makeCurationManifestEntry = (
  entry: PreparedCurationEntry,
  output: MaterializedPng,
  outputSha256: FileSha256Hash
): ImageCurationManifestEntry =>
  ImageCurationManifestEntry.make({
    ...optionalManifestDecisionFields(entry.decision),
    disposition: entry.decision.disposition,
    outputHeight: output.height,
    outputName: entry.outputName,
    outputPath: entry.outputPath,
    outputRelativePath: entry.outputRelativePath,
    outputSha256,
    outputSizeBytes: `${output.size}`,
    outputWidth: output.width,
    reasons: entry.decision.reasons,
    sourceName: entry.source.name,
    sourcePath: entry.source.path,
    sourceRelativePath: entry.source.relativePath,
    sourceSha256: entry.decision.sourceSha256,
  });

const curationSummary = (
  decisions: ReadonlyArray<ImageCurationDecision>,
  dryRun: boolean,
  materializedCount: number
): ImageCurationSummary =>
  ImageCurationSummary.make({
    archiveCount: A.length(A.filter(decisions, (decision) => decision.disposition.startsWith("archive-"))),
    coreCount: A.length(A.filter(decisions, (decision) => decision.disposition === "active-core")),
    dryRun,
    extendedCount: A.length(A.filter(decisions, (decision) => decision.disposition === "active-extended")),
    holdoutCount: A.length(A.filter(decisions, (decision) => decision.disposition === "holdout")),
    materializedCount,
    plannedCount: A.length(decisions),
    reserveCount: A.length(A.filter(decisions, (decision) => decision.disposition === "reserve-near-duplicate")),
  });

/**
 * Validate a complete decision ledger and materialize metadata-free PNG derivatives.
 *
 * @category use-cases
 * @since 0.0.0
 */
export const curateImagesImpl = Effect.fn("FilesCommandService.curateImages")(function* (
  options: ImageCurationOptions
): Effect.fn.Return<
  ImageCurationSummary,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | Terminal.Terminal | ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const validated = yield* validateDecisionLedger(options);
  const dryRunSummary = curationSummary(validated.decisions.decisions, true, 0);

  if (options.dryRun) {
    for (const entry of validated.prepared) {
      yield* Console.log(`${entry.source.name} -> ${entry.outputRelativePath} [${entry.decision.disposition}]`);
    }
    yield* Console.log(
      `files curate-images: dry run validated ${dryRunSummary.plannedCount} hash-pinned decision(s); no files written.`
    );
    return dryRunSummary;
  }

  for (const entry of validated.prepared) {
    const exists = yield* fs
      .exists(entry.outputPath)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to inspect curation output", entry.outputPath, { cause })
        )
      );
    if (exists && !options.overwrite) {
      return yield* FilesCommandError.make({
        message: `Refusing to overwrite existing curation output: "${entry.outputPath}"`,
      });
    }
    if (exists) {
      const stat = yield* fs
        .stat(entry.outputPath)
        .pipe(
          Effect.mapError((cause) => formatPlatformError("Failed to stat curation output", entry.outputPath, { cause }))
        );
      if (stat.type !== "File") {
        return yield* FilesCommandError.make({
          message: `Refusing to overwrite non-file curation output: "${entry.outputPath}"`,
        });
      }
    }
  }

  const manifestExists = yield* fs
    .exists(validated.manifestPath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to inspect image curation manifest", validated.manifestPath, { cause })
      )
    );
  if (manifestExists && !options.overwrite) {
    return yield* FilesCommandError.make({
      message: `Refusing to overwrite existing image curation manifest: "${validated.manifestPath}"`,
    });
  }

  yield* fs
    .makeDirectory(validated.outputDirectory, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create image curation output directory", validated.outputDirectory, { cause })
      )
    );

  const manifestEntries = yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({ directory: validated.outputDirectory, prefix: ".beep-files-curate-images-" })
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to create image curation staging directory", validated.outputDirectory, { cause })
        )
      ),
    Effect.fnUntraced(function* (tempDirectory) {
      let completed = A.empty<ImageCurationManifestEntry>();
      let index = 0;
      for (const entry of validated.prepared) {
        const tempPath = path.join(tempDirectory, `${`${index}`.padStart(4, "0")}-${entry.outputName}`);
        const output = yield* materializeCanonicalPng(entry, tempPath);
        const outputSha256 = yield* fileSha256(tempPath);
        const destinationDirectory = path.dirname(entry.outputPath);
        yield* fs
          .makeDirectory(destinationDirectory, { recursive: true })
          .pipe(
            Effect.mapError((cause) =>
              formatPlatformError("Failed to create curation destination directory", destinationDirectory, { cause })
            )
          );
        if (options.overwrite) yield* fs.remove(entry.outputPath, { force: true }).pipe(Effect.ignore);
        yield* fs
          .rename(tempPath, entry.outputPath)
          .pipe(
            Effect.mapError((cause) =>
              formatPlatformError("Failed to commit canonical curation output", entry.outputPath, { cause })
            )
          );
        completed = A.append(completed, makeCurationManifestEntry(entry, output, outputSha256));
        index += 1;
      }
      return completed;
    }),
    (tempDirectory) => fs.remove(tempDirectory, { recursive: true, force: true }).pipe(Effect.ignore)
  );

  const summary = curationSummary(validated.decisions.decisions, false, A.length(manifestEntries));
  const manifest = ImageCurationManifest.make({
    decisionDocumentPath: path.resolve(options.decisionsPath),
    entries: manifestEntries,
    manifestPath: validated.manifestPath,
    outputDirectory: validated.outputDirectory,
    schemaVersion: "beep.files.image-curation.v1",
    sourceDirectory: validated.sourceDirectory,
    summary,
  });
  const encoded = yield* encodeImageCurationManifest(manifest).pipe(
    Effect.mapError((cause) => FilesCommandError.new(cause, "Failed to encode image curation manifest"))
  );
  yield* writeJsonAtomically(validated.manifestPath, encoded, options.overwrite, "image curation manifest");
  yield* Console.log(
    `files curate-images: materialized ${summary.materializedCount} metadata-free PNG derivative(s) and wrote "${validated.manifestPath}".`
  );
  return summary;
});
