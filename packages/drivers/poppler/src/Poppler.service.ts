/**
 * Poppler-backed PDF page counting and page rasterization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ContentDigest } from "@beep/file-processing/Artifact";
import { PageImage } from "@beep/file-processing/PageOcr";
import { A, O, Str } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Effect, FileSystem, Path, pipe, Stream } from "effect";
import * as Num from "effect/Number";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { PopplerError } from "./Poppler.schema.ts";
import type { PopplerConfig } from "./Poppler.schema.ts";

const forceKillAfterMillis = 5_000;
const pagesPrefix = "Pages:";

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
  readonly renderPage: (pdfPath: string, pageNumber: number) => Effect.Effect<PageImage, PopplerError>;
};

/**
 * Create a rasterizer that shells out to `pdfinfo` and `pdftoppm`.
 *
 * **Details**
 *
 * `pageCount` reads the `Pages:` line of `pdfinfo`. `renderPage` renders one page with `pdftoppm -gray -png` at the configured resolution into a scoped temporary directory and returns the bytes with their SHA-256 digest, so two engines reading the same page can prove they saw the same image. Every call carries the configured timeout; a missing binary is `engine-unavailable`.
 *
 * **Example** (Count the pages of a PDF)
 *
 * ```ts
 * import { makePopplerRasterizer, PopplerConfig } from "@beep/poppler"
 * import { Effect } from "effect"
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
