import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import { PageImage, PageOcrRequest } from "@beep/file-processing/PageOcr";
import {
  makeTesseractPageOcrEngine,
  parseTesseractLanguages,
  parseTesseractScript,
  parseTesseractTsv,
  planTesseractLanguages,
  TESSERACT_ENGINE_ID,
  TesseractConfig,
  TesseractScript,
  tesseractLanguagesForScript,
  VERSION,
} from "@beep/tesseract";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import type { PageImageMediaType } from "@beep/file-processing/PageOcr";

const hex = Str.repeat(64)("a");
const digest = ContentDigest.make(`sha256:${hex}`);

const tsvHeader = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";
const tsvWord = (block: number, paragraph: number, line: number, confidence: string, text: string): string =>
  `5\t1\t${block}\t${paragraph}\t${line}\t1\t0\t0\t9\t9\t${confidence}\t${text}`;

// Stands in for the tesseract binary. The page image's bytes pick the
// behavior, so one stub covers a clean page, a blank page, a low-confidence
// page, a crash and a hang. Recognition arguments are appended to a log.
const tesseractStub = (
  argsLog: string,
  options: { readonly listLangsFails?: boolean; readonly version?: string } = {}
) =>
  `#!/usr/bin/env bash
case "$1" in
  --version) printf '${options.version ?? "tesseract 5.5.3\\n leptonica-1.85.0\\n"}'; exit 0 ;;
  --list-langs) ${
    options.listLangsFails === true
      ? "exit 1"
      : `printf 'List of available languages in "/usr/share/tessdata/" (2):\\neng\\nosd\\n'; exit 0`
  } ;;
esac
printf '%s\\n' "$*" >> "${argsLog}"
page="$(cat "$1")"
if [ "$page" = "crash" ]; then exit 134; fi
if [ "$page" = "hang" ]; then exec sleep 20; fi
if [ "$3" = "--psm" ]; then printf 'Page number: 0\\nOrientation in degrees: 0\\nScript: Han\\nScript confidence: 3.10\\n'; exit 0; fi
printf '%s\\n' '${tsvHeader}'
if [ "$page" = "blank" ]; then exit 0; fi
if [ "$page" = "faint" ]; then printf '%s\\n' '${tsvWord(1, 1, 1, "30", "smudge")}'; exit 0; fi
printf '%s\\n' '${tsvWord(1, 1, 1, "90", "Synthetic")}' '${tsvWord(1, 1, 1, "80", "page")}'
exit 0
`;

const fixture = Effect.fn("TesseractTest.fixture")(function* (
  options: { readonly listLangsFails?: boolean; readonly version?: string } = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "tesseract-test-" });
  const argsLog = path.join(directory, "args.log");
  const tesseractPath = path.join(directory, "tesseract-stub");
  yield* fs.writeFileString(tesseractPath, tesseractStub(argsLog, options));
  yield* fs.chmod(tesseractPath, 0o755);
  return {
    argsLog: fs.readFileString(argsLog),
    missingPath: path.join(directory, "no-such-tesseract"),
    tesseractPath,
  };
});

const pageImage = (content: string, mediaType: PageImageMediaType = "image/png"): PageImage =>
  PageImage.make({ bytes: new TextEncoder().encode(content), digest, dpi: 300, mediaType });

const pageRequest = (
  content: string,
  overrides: {
    readonly languages?: ReadonlyArray<string>;
    readonly maxOutputChars?: number;
    readonly mediaType?: PageImageMediaType;
  } = {}
): PageOcrRequest =>
  PageOcrRequest.make({
    image: pageImage(content, overrides.mediaType),
    languages: overrides.languages ?? ["eng"],
    operationId: OperationId.make(`operation:${hex}`),
    pageCount: 1,
    pageNumber: 1,
    sourceArtifactId: ArtifactId.make(`artifact:${hex}`),
    sourceDigest: digest,
    textFormat: "plain-text",
    ...(overrides.maxOutputChars === undefined ? {} : { maxOutputChars: overrides.maxOutputChars }),
  });

it("applies the documented configuration defaults", () => {
  const config = TesseractConfig.make({});

  expect(config).toEqual(S.decodeUnknownSync(TesseractConfig)({}));
  expect(config.tesseractPath).toBe("tesseract");
  expect(config.pageTimeoutMillis).toBe(60_000);
  expect(VERSION).toBe("0.0.0");
});

it("routes every script to language models that end in the English fallback", () => {
  const routed = A.map(TesseractScript.literals, tesseractLanguagesForScript);

  expect(A.map(routed, (languages) => A.join(A.takeRight(languages, 1), ""))).toEqual(A.map(routed, () => "eng"));
  expect(tesseractLanguagesForScript("Latin")).toEqual(["eng"]);
  expect(tesseractLanguagesForScript("Han")).toEqual(["chi_sim", "chi_tra", "eng"]);
  expect(tesseractLanguagesForScript("Katakana")).toEqual(["jpn", "eng"]);
  expect(tesseractLanguagesForScript("Hangul")).toEqual(["kor", "eng"]);
});

it("plans languages from the detected script and reports missing models", () => {
  const undetected = planTesseractLanguages(O.none(), ["eng", "osd"]);
  const chineseWithoutModels = planTesseractLanguages(O.some("Han"), ["eng", "osd"]);
  const chineseWithModels = planTesseractLanguages(["chi_sim", "chi_tra", "eng"])(O.some("Han"));
  const nothingInstalled = planTesseractLanguages(O.none(), []);

  expect(undetected.selected).toEqual(["eng"]);
  expect(undetected.missing).toEqual([]);
  expect(undetected.script).toBeUndefined();
  expect(chineseWithoutModels.script).toBe("Han");
  expect(chineseWithoutModels.requested).toEqual(["chi_sim", "chi_tra", "eng"]);
  expect(chineseWithoutModels.selected).toEqual(["eng"]);
  expect(chineseWithoutModels.missing).toEqual(["chi_sim", "chi_tra"]);
  expect(chineseWithModels.selected).toEqual(["chi_sim", "chi_tra", "eng"]);
  expect(nothingInstalled.selected).toEqual([]);
  expect(nothingInstalled.missing).toEqual(["eng"]);
});

it("parses the language list and the detected script", () => {
  expect(parseTesseractLanguages('List of available languages in "/usr/share/tessdata/" (2):\neng\n\n osd \n')).toEqual(
    ["eng", "osd"]
  );
  assertSome(parseTesseractScript("Rotate: 0\nScript: Han\nScript confidence: 3.1\n"), "Han");
  assertNone(parseTesseractScript("Script: Klingon\n"));
  assertNone(parseTesseractScript("Too few characters. Skipping this page\n"));
});

it("rebuilds lines, paragraphs and the mean confidence from TSV", () => {
  const reading = parseTesseractTsv(
    A.join(
      [
        tsvHeader,
        "4\t1\t1\t1\t1\t0\t0\t0\t9\t9\t-1\t",
        tsvWord(1, 1, 1, "90", "First"),
        tsvWord(1, 1, 1, "80", "line"),
        tsvWord(1, 1, 2, "70", "second"),
        tsvWord(1, 1, 2, "96.5", "   "),
        tsvWord(1, 2, 1, "not-a-number", "next\tparagraph"),
        "5\ttruncated",
      ],
      "\n"
    )
  );
  const blank = parseTesseractTsv(`${tsvHeader}\n`);

  expect(reading.text).toBe("First line\nsecond\n\nnext\tparagraph");
  expect(reading.wordCount).toBe(4);
  expect(reading.meanConfidence).toBeCloseTo(0.6, 10);
  expect(blank.text).toBe("");
  expect(blank.wordCount).toBe(0);
  expect(blank.meanConfidence).toBeUndefined();
});

it.layer(NodeServices.layer, { timeout: "60 seconds" })("Tesseract page OCR engine", (it) => {
  it.effect(
    "probes the binary for its version and installed language models",
    Effect.fnUntraced(function* () {
      const { tesseractPath } = yield* fixture();
      const engine = yield* makeTesseractPageOcrEngine(TesseractConfig.make({ tesseractPath }));
      const unversioned = yield* fixture({ version: "" });
      const unversionedEngine = yield* makeTesseractPageOcrEngine(
        TesseractConfig.make({ tesseractPath: unversioned.tesseractPath })
      );

      expect(engine.identity.engineId).toBe(TESSERACT_ENGINE_ID);
      expect(engine.identity.family).toBe("tesseract");
      expect(engine.identity.version).toBe("tesseract 5.5.3");
      expect(engine.installedLanguages).toEqual(["eng", "osd"]);
      expect(unversionedEngine.identity.version).toBe("unknown");
    })
  );

  it.effect(
    "fails construction when the binary is missing or cannot list its models",
    Effect.fnUntraced(function* () {
      const { missingPath } = yield* fixture();
      const broken = yield* fixture({ listLangsFails: true });

      const missing = yield* makeTesseractPageOcrEngine(TesseractConfig.make({ tesseractPath: missingPath })).pipe(
        Effect.flip
      );
      const unlisted = yield* makeTesseractPageOcrEngine(
        TesseractConfig.make({ tesseractPath: broken.tesseractPath })
      ).pipe(Effect.flip);

      expect(missing.reason).toBe("engine-unavailable");
      expect(missing.message).toBe("Tesseract is not available on this host.");
      expect(unlisted.reason).toBe("engine-unavailable");
      expect(unlisted.message).toBe("Tesseract could not list its language models.");
    })
  );

  it.effect(
    "reads a page with the requested languages and reports its mean confidence",
    Effect.fnUntraced(function* () {
      const { argsLog, tesseractPath } = yield* fixture();
      const engine = yield* makeTesseractPageOcrEngine(TesseractConfig.make({ tesseractPath }));

      const result = yield* engine.recognizePage(pageRequest("clean", { languages: ["chi_sim", "eng"] }));
      yield* engine.recognizePage(pageRequest("clean", { languages: [], mediaType: "image/jpeg" }));
      yield* engine.recognizePage(pageRequest("clean", { mediaType: "image/tiff" }));
      const calls = A.filter(Str.split(yield* argsLog, "\n"), Str.isNonEmpty);

      expect(result.text).toBe("Synthetic page");
      expect(result.confidence).toBeCloseTo(0.85, 10);
      expect(result.warnings).toEqual([]);
      expect(result.engine.engineId).toBe(TESSERACT_ENGINE_ID);
      expect(result.imageDigest).toBe(digest);
      expect(result.textFormat).toBe("plain-text");
      expect(A.map(calls, (call) => Str.split(call, " ").slice(1))).toEqual([
        ["-", "-l", "chi_sim+eng", "tsv"],
        ["-", "-l", "eng", "tsv"],
        ["-", "-l", "eng", "tsv"],
      ]);
      expect(
        A.map(calls, (call) => A.join(A.takeRight(Str.split(A.headNonEmpty(Str.split(call, " ")), "."), 1), ""))
      ).toEqual(["png", "jpg", "tif"]);
    })
  );

  it.effect(
    "flags blank and low-confidence pages instead of failing them",
    Effect.fnUntraced(function* () {
      const { tesseractPath } = yield* fixture();
      const engine = yield* makeTesseractPageOcrEngine(TesseractConfig.make({ tesseractPath }));

      const blank = yield* engine.recognizePage(pageRequest("blank"));
      const faint = yield* engine.recognizePage(pageRequest("faint"));

      expect(blank.text).toBe("");
      expect(blank.confidence).toBeUndefined();
      expect(blank.warnings).toEqual(["empty-output"]);
      expect(faint.text).toBe("smudge");
      expect(faint.confidence).toBeCloseTo(0.3, 10);
      expect(faint.warnings).toEqual(["low-confidence"]);
    })
  );

  it.effect(
    "fails only the page on a crash, a timeout, an output limit or an unstageable image",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { tesseractPath } = yield* fixture();
      const engine = yield* makeTesseractPageOcrEngine(TesseractConfig.make({ tesseractPath }));
      const impatient = yield* makeTesseractPageOcrEngine(
        TesseractConfig.make({ pageTimeoutMillis: 300, tesseractPath })
      );
      // A filesystem whose temporary directory cannot be created.
      const unstageable = yield* makeTesseractPageOcrEngine(TesseractConfig.make({ tesseractPath })).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          makeTempDirectoryScoped: () => fs.makeTempDirectoryScoped({ directory: "/nonexistent/beep-tesseract-test" }),
        })
      );

      const crashed = yield* engine.recognizePage(pageRequest("crash")).pipe(Effect.flip);
      // Live clock: the timeout races a real subprocess, which the test clock never advances past.
      const timedOut = yield* impatient.recognizePage(pageRequest("hang")).pipe(Effect.flip, TestClock.withLive);
      const overLimit = yield* engine.recognizePage(pageRequest("clean", { maxOutputChars: 3 })).pipe(Effect.flip);
      const withinLimit = yield* engine.recognizePage(pageRequest("clean", { maxOutputChars: 200 }));
      const unstaged = yield* unstageable.recognizePage(pageRequest("clean")).pipe(Effect.flip);
      const afterCrash = yield* engine.recognizePage(pageRequest("clean"));

      expect(crashed.reason).toBe("recognition-failed");
      expect(crashed.message).toContain("status 134");
      expect(timedOut.reason).toBe("recognition-timed-out");
      expect(overLimit.reason).toBe("output-limit-exceeded");
      expect(overLimit.pageNumber).toBe(1);
      expect(withinLimit.text).toBe("Synthetic page");
      expect(unstaged.reason).toBe("recognition-failed");
      expect(unstaged.message).toBe("The page image could not be staged for Tesseract.");
      expect(afterCrash.text).toBe("Synthetic page");
    })
  );

  it.effect(
    "detects the script of a page and yields none when detection fails",
    Effect.fnUntraced(function* () {
      const { tesseractPath } = yield* fixture();
      const engine = yield* makeTesseractPageOcrEngine(TesseractConfig.make({ tesseractPath }));

      assertSome(yield* engine.detectScript(pageImage("clean")), "Han");
      assertNone(yield* engine.detectScript(pageImage("crash")));
    })
  );
});
