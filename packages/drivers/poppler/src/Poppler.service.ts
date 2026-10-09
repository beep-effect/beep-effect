/**
 * Poppler-backed PDF page counting and page rasterization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- each process driver owns its spawn-and-capture step (tika, tesseract, poppler); drivers do not depend on each other and no shared capture helper exists below repo-cli.

import { ContentDigest } from "@beep/file-processing/Artifact";
import { PageImage } from "@beep/file-processing/PageOcr";
import { A, O, Str } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Num from "effect/Number";
import * as Path from "effect/Path";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Stream from "effect/Stream";
import { PopplerError } from "./Poppler.schema.ts";
import type { PopplerConfig } from "./Poppler.schema.ts";

const forceKillAfterMillis = 5_000;
const pagesPrefix = "Pages:";

const tiffLittleEndian = 0x4949;
const tiffBigEndian = 0x4d4d;
const tiffMagic = 42;
const tiffEntryBytes = 12;

// Byte order, magic number and first directory offset of a classic TIFF.
const tiffHeader = (
  bytes: Uint8Array
): O.Option<{ readonly firstDirectory: number; readonly littleEndian: boolean; readonly view: DataView }> => {
  if (bytes.byteLength < 8) {
    return O.none();
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = view.getUint16(0, false);
  const littleEndian = order === tiffLittleEndian;
  return (littleEndian || order === tiffBigEndian) && view.getUint16(2, littleEndian) === tiffMagic
    ? O.some({ firstDirectory: view.getUint32(4, littleEndian), littleEndian, view })
    : O.none();
};

// Length of the directory chain, or none when it runs off the end or loops.
const tiffDirectoryChain = (view: DataView, littleEndian: boolean, firstDirectory: number): O.Option<number> => {
  const seen = MutableHashSet.empty<number>();
  let offset = firstDirectory;
  let frames = 0;
  while (offset !== 0) {
    const next =
      offset + 2 > view.byteLength
        ? view.byteLength
        : offset + 2 + view.getUint16(offset, littleEndian) * tiffEntryBytes;
    if (next + 4 > view.byteLength || MutableHashSet.has(seen, offset)) {
      return O.none();
    }
    MutableHashSet.add(seen, offset);
    frames += 1;
    offset = view.getUint32(next, littleEndian);
  }
  return O.some(frames);
};

/**
 * Count the frames (image file directories) of a TIFF from its bytes, without decoding any image.
 *
 * **Details**
 *
 * Walks the directory chain from the header: each directory holds a two-byte entry count, that many twelve-byte entries, and the offset of the next directory, zero at the end. Bytes that are not a classic TIFF (wrong byte-order mark or magic number) or whose chain runs off the end or loops yield none, so a caller treats them as a file it cannot describe, not as one frame.
 *
 * **Example** (Count a one-frame TIFF)
 *
 * ```ts
 * import { tiffFrameCount } from "@beep/poppler"
 * import * as O from "effect/Option"
 *
 * // Little-endian header, one directory at offset 8 with zero entries and no successor.
 * const bytes = new Uint8Array([0x49, 0x49, 42, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0])
 * console.log(O.getOrNull(tiffFrameCount(bytes))) // 1
 * console.log(O.isNone(tiffFrameCount(new Uint8Array([1, 2, 3])))) // true
 * ```
 *
 * @param bytes - The whole TIFF file.
 * @returns The frame count, or none when the bytes are not a readable classic TIFF.
 * @category utilities
 * @since 0.0.0
 */
export const tiffFrameCount = (bytes: Uint8Array): O.Option<number> =>
  pipe(
    tiffHeader(bytes),
    O.flatMap(({ firstDirectory, littleEndian, view }) => tiffDirectoryChain(view, littleEndian, firstDirectory)),
    O.filter((frames) => frames > 0)
  );

/**
 * Rasterizer contract: count the pages of a PDF and render one page to a grayscale PNG.
 *
 * **Example** (Describe a rasterizer call)
 *
 * ```ts
 * import type { PopplerRasterizerShape } from "@beep/poppler"
 *
 * const firstPage = (rasterizer: PopplerRasterizerShape) => rasterizer.renderPage("/tmp/synthetic.pdf", 1)
 * console.log(typeof firstPage) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type PopplerRasterizerShape = {
  readonly pageCount: (pdfPath: string) => Effect.Effect<number, PopplerError>;
  readonly probe: Effect.Effect<void, PopplerError>;
  readonly renderPage: (pdfPath: string, pageNumber: number) => Effect.Effect<PageImage, PopplerError>;
};

/**
 * Create a rasterizer that shells out to `pdfinfo` and `pdftoppm`.
 *
 * **Details**
 *
 * `probe` runs `pdfinfo -v` and `pdftoppm -v` once so a caller learns at start-up, not per file, that a tool is missing. `pageCount` reads the `Pages:` line of `pdfinfo`. `renderPage` renders one page with `pdftoppm -gray -png` at the configured resolution into a scoped temporary directory and returns the bytes with their SHA-256 digest, so two engines reading the same page can prove they saw the same image. Every call carries the configured timeout; a missing binary is `engine-unavailable`.
 *
 * **Example** (Count the pages of a PDF)
 *
 * ```ts
 * import { makePopplerRasterizer, PopplerConfig } from "@beep/poppler"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const rasterizer = yield* makePopplerRasterizer(PopplerConfig.make({}))
 *   return yield* rasterizer.pageCount("/tmp/synthetic.pdf")
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param config - Tool paths, render resolution and per-call timeout.
 * @returns The rasterizer, with the process spawner and filesystem captured.
 * @category constructors
 * @since 0.0.0
 */
export const makePopplerRasterizer = Effect.fn("Poppler.makeRasterizer")(function* (
  config: PopplerConfig
): Effect.fn.Return<
  PopplerRasterizerShape,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const run = Effect.fn("Poppler.run")(function* (
    tool: string,
    args: ReadonlyArray<string>
  ): Effect.fn.Return<string, PopplerError> {
    const command = ChildProcess.make(tool, args, {
      forceKillAfter: `${forceKillAfterMillis} millis`,
      stderr: "ignore",
      stdin: "ignore",
      stdout: "pipe",
    });
    const result = yield* Effect.scoped(
      spawner
        .spawn(command)
        .pipe(
          Effect.flatMap((handle) =>
            Effect.all(
              { exitCode: handle.exitCode, stdout: handle.stdout.pipe(Stream.decodeText(), Stream.mkString) },
              { concurrency: "unbounded" }
            )
          )
        )
    ).pipe(
      Effect.mapError(() =>
        PopplerError.make({ message: `${tool} could not be started.`, reason: "engine-unavailable" })
      ),
      Effect.timeoutOrElse({
        duration: `${config.timeoutMillis} millis`,
        orElse: () =>
          Effect.fail(
            PopplerError.make({ message: `${tool} exceeded ${config.timeoutMillis} ms.`, reason: "timed-out" })
          ),
      })
    );
    if (result.exitCode !== 0) {
      return yield* PopplerError.make({
        message: `${tool} exited with status ${result.exitCode}.`,
        reason: "process-failed",
      });
    }
    return result.stdout;
  });

  return {
    probe: Effect.forEach([config.pdfinfoPath, config.pdftoppmPath], (tool) => run(tool, ["-v"]), {
      discard: true,
    }),
    pageCount: Effect.fn("Poppler.pageCount")(function* (pdfPath) {
      const stdout = yield* run(config.pdfinfoPath, [pdfPath]);
      return yield* pipe(
        Str.split(stdout, "\n"),
        A.findFirst(Str.startsWith(pagesPrefix)),
        O.flatMap((line) => Num.parse(Str.trim(Str.slice(Str.length(pagesPrefix))(line)))),
        O.filter((pages) => Number.isSafeInteger(pages) && pages > 0),
        Effect.fromOption,
        Effect.mapError(() =>
          PopplerError.make({ message: "pdfinfo reported no usable page count.", reason: "output-invalid" })
        )
      );
    }),
    renderPage: Effect.fn("Poppler.renderPage")(function* (pdfPath, pageNumber) {
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const directory = yield* fs.makeTempDirectoryScoped({ prefix: "beep-poppler-" });
          const page = `${pageNumber}`;
          yield* run(config.pdftoppmPath, [
            "-r",
            `${config.dpi}`,
            "-gray",
            "-png",
            "-singlefile",
            "-f",
            page,
            "-l",
            page,
            pdfPath,
            path.join(directory, "page"),
          ]);
          const bytes = yield* fs.readFile(path.join(directory, "page.png"));
          return PageImage.make({
            bytes,
            digest: ContentDigest.make(`sha256:${bytesToHex(sha256(bytes))}`),
            dpi: config.dpi,
            mediaType: "image/png",
          });
        })
      ).pipe(
        Effect.catchTag("PlatformError", () =>
          Effect.fail(PopplerError.make({ message: "pdftoppm produced no page image.", reason: "output-invalid" }))
        )
      );
    }),
  };
});
