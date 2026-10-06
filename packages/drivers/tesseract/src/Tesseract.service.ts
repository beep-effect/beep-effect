/**
 * Tesseract as a page OCR engine behind the `@beep/file-processing` contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PageOcrEngineIdentity, PageOcrError, PageOcrResult, PageOcrTiming } from "@beep/file-processing/PageOcr";
import { A, O, Str } from "@beep/utils";
import { Clock, Effect, FileSystem, Match, Path, pipe, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { parseTesseractLanguages, parseTesseractScript, parseTesseractTsv } from "./Tesseract.schema.ts";
import type { PageImage, PageImageMediaType, PageOcrEngineShape, PageOcrRequest } from "@beep/file-processing/PageOcr";
import type { TesseractConfig, TesseractScript } from "./Tesseract.schema.ts";

const forceKillAfterMillis = 5_000;
const lowConfidenceLine = 0.7;

/**
 * Stable engine id recorded with every page this driver reads.
 *
 * **Example** (Read the engine id)
 *
 * ```ts
 * import { TESSERACT_ENGINE_ID } from "@beep/tesseract"
 *
 * console.log(TESSERACT_ENGINE_ID) // "tesseract"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TESSERACT_ENGINE_ID = "tesseract";

/**
 * Page OCR engine plus the Tesseract-specific facts a caller routes on: installed language models and script detection.
 *
 * **Example** (Check for a language model)
 *
 * ```ts
 * import type { TesseractEngineShape } from "@beep/tesseract"
 *
 * const hasEnglish = (engine: TesseractEngineShape) => engine.installedLanguages.includes("eng")
 * console.log(typeof hasEnglish) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type TesseractEngineShape = PageOcrEngineShape & {
  readonly detectScript: (image: PageImage) => Effect.Effect<O.Option<TesseractScript>>;
  readonly installedLanguages: ReadonlyArray<string>;
};

const imageExtension: (mediaType: PageImageMediaType) => string = Match.type<PageImageMediaType>().pipe(
  Match.when("image/png", () => "png"),
  Match.when("image/jpeg", () => "jpg"),
  Match.when("image/tiff", () => "tif"),
  Match.exhaustive
);

/**
 * Create the Tesseract page OCR engine by probing the installed binary.
 *
 * **Details**
 *
 * Construction runs `tesseract --version` and `tesseract --list-langs` once and fails with `engine-unavailable` when the binary cannot run, so a caller learns at start-up, not per page. `recognizePage` writes the page image to a scoped temporary file, runs `tesseract <image> - -l <languages> tsv` under the per-page timeout, and returns the text with the mean word confidence; a crash is `recognition-failed` for that page only. `detectScript` runs orientation and script detection and yields none when the `osd` model is missing or the page has too little text to decide.
 *
 * **Example** (Read the installed language models)
 *
 * ```ts
 * import { makeTesseractPageOcrEngine, TesseractConfig } from "@beep/tesseract"
 * import { Effect } from "effect"
 *
 * const program = makeTesseractPageOcrEngine(TesseractConfig.make({})).pipe(
 *   Effect.map((engine) => engine.installedLanguages)
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param config - Executable path and per-page timeout.
 * @returns The engine, with the process spawner and filesystem captured.
 * @category constructors
 * @since 0.0.0
 */
export const makeTesseractPageOcrEngine = Effect.fn("Tesseract.makePageOcrEngine")(function* (
  config: TesseractConfig
): Effect.fn.Return<
  TesseractEngineShape,
  PageOcrError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const fail = (reason: "engine-unavailable" | "recognition-failed" | "recognition-timed-out", message: string) =>
    PageOcrError.make({ engineId: TESSERACT_ENGINE_ID, message, reason });

  const run = Effect.fn("Tesseract.run")(function* (
    args: ReadonlyArray<string>
  ): Effect.fn.Return<string, PageOcrError> {
    const command = ChildProcess.make(config.tesseractPath, args, {
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
      Effect.mapError(() => fail("engine-unavailable", "Tesseract could not be started.")),
      Effect.timeoutOrElse({
        duration: `${config.pageTimeoutMillis} millis`,
        orElse: () =>
          Effect.fail(fail("recognition-timed-out", `Tesseract exceeded ${config.pageTimeoutMillis} ms on one page.`)),
      })
    );
    if (result.exitCode !== 0) {
      return yield* fail("recognition-failed", `Tesseract exited with status ${result.exitCode}.`);
    }
    return result.stdout;
  });

  const withImageFile = <A>(
    image: PageImage,
    use: (imagePath: string) => Effect.Effect<A, PageOcrError>
  ): Effect.Effect<A, PageOcrError> =>
    Effect.scoped(
      Effect.gen(function* () {
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "beep-tesseract-" });
        const imagePath = path.join(directory, `page.${imageExtension(image.mediaType)}`);
        yield* fs.writeFile(imagePath, image.bytes);
        return imagePath;
      }).pipe(
        Effect.mapError(() => fail("recognition-failed", "The page image could not be staged for Tesseract.")),
        Effect.flatMap(use)
      )
    );

  const versionOutput = yield* run(["--version"]).pipe(
    Effect.mapError(() => fail("engine-unavailable", "Tesseract is not available on this host."))
  );
  const version = pipe(
    A.head(Str.split(versionOutput, "\n")),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => "unknown")
  );
  const installedLanguages = parseTesseractLanguages(
    yield* run(["--list-langs"]).pipe(
      Effect.mapError(() => fail("engine-unavailable", "Tesseract could not list its language models."))
    )
  );
  const identity = PageOcrEngineIdentity.make({ engineId: TESSERACT_ENGINE_ID, family: "tesseract", version });

  return {
    detectScript: Effect.fn("Tesseract.detectScript")(function* (image) {
      return yield* withImageFile(image, (imagePath) => run([imagePath, "-", "--psm", "0", "-l", "osd"])).pipe(
        Effect.map(parseTesseractScript),
        Effect.orElseSucceed(() => O.none<TesseractScript>())
      );
    }),
    identity,
    installedLanguages,
    recognizePage: Effect.fn("Tesseract.recognizePage")(function* (request: PageOcrRequest) {
      const started = yield* Clock.currentTimeMillis;
      const languages = A.match(request.languages, {
        onEmpty: () => "eng",
        onNonEmpty: A.join("+"),
      });
      const tsv = yield* withImageFile(request.image, (imagePath) => run([imagePath, "-", "-l", languages, "tsv"]));
      const reading = parseTesseractTsv(tsv);
      if (O.exists(O.fromUndefinedOr(request.maxOutputChars), (limit) => Str.length(reading.text) > limit)) {
        return yield* PageOcrError.make({
          engineId: TESSERACT_ENGINE_ID,
          message: "The page text exceeds the requested output limit.",
          operationId: request.operationId,
          pageNumber: request.pageNumber,
          reason: "output-limit-exceeded",
          sourceArtifactId: request.sourceArtifactId,
        });
      }
      const confidence = O.fromUndefinedOr(reading.meanConfidence);
      return PageOcrResult.make({
        engine: identity,
        imageDigest: request.image.digest,
        operationId: request.operationId,
        pageNumber: request.pageNumber,
        sourceArtifactId: request.sourceArtifactId,
        sourceDigest: request.sourceDigest,
        text: reading.text,
        textFormat: "plain-text",
        timing: PageOcrTiming.make({ recognizeMillis: (yield* Clock.currentTimeMillis) - started }),
        warnings: A.getSomes([
          reading.wordCount === 0 ? O.some("empty-output" as const) : O.none(),
          O.exists(confidence, (value) => value < lowConfidenceLine) ? O.some("low-confidence" as const) : O.none(),
        ]),
        ...O.getSomesStruct({ confidence }),
      });
    }),
  };
});
