/**
 * Configuration, script and language models, and output parsers for the Tesseract driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TesseractId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Effect, Match, pipe } from "effect";
import { dual } from "effect/Function";
import * as Num from "effect/Number";
import * as S from "effect/Schema";

const $I = $TesseractId.create("Tesseract.schema");

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).annotate({
  identifier: $I`PosInt`,
  title: "PosInt",
  description: "An integer greater than zero.",
});

const UnitInterval = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }));

const defaultPageTimeoutMillis = PosInt.make(60_000);
const fallbackLanguage = "eng";
const scriptPrefix = "Script:";
const wordLevel = "5";

/**
 * Configuration for the Tesseract command-line engine.
 *
 * **Example** (Default engine configuration)
 *
 * ```ts
 * import { TesseractConfig } from "@beep/tesseract"
 *
 * const config = TesseractConfig.make({})
 * console.log(config.tesseractPath) // "tesseract"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class TesseractConfig extends S.Class<TesseractConfig>($I`TesseractConfig`)(
  {
    pageTimeoutMillis: PosInt.pipe(
      S.withConstructorDefault(Effect.succeed(defaultPageTimeoutMillis)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultPageTimeoutMillis))
    ).annotateKey({ description: "Timeout in milliseconds for one Tesseract call on one page." }),
    tesseractPath: S.NonEmptyString.pipe(
      S.withConstructorDefault(Effect.succeed("tesseract")),
      S.withDecodingDefaultTypeKey(Effect.succeed("tesseract"))
    ).annotateKey({ description: "Executable path or command name of tesseract." }),
  },
  $I.annote("TesseractConfig", {
    description: "Executable path and per-page timeout for the Tesseract command-line engine.",
  })
) {}

/**
 * Writing systems Tesseract's orientation and script detection can name and this driver routes.
 *
 * **Example** (Check a detected script)
 *
 * ```ts
 * import { TesseractScript } from "@beep/tesseract"
 *
 * console.log(TesseractScript.literals.includes("Han")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TesseractScript = LiteralKit([
  "Latin",
  "Han",
  "Japanese",
  "Hiragana",
  "Katakana",
  "Hangul",
  "Cyrillic",
  "Arabic",
  "Hebrew",
  "Greek",
  "Devanagari",
]).pipe(
  $I.annoteSchema("TesseractScript", {
    description: "Writing systems Tesseract's orientation and script detection can name and this driver routes.",
  })
);

/**
 * Type for {@link TesseractScript}.
 *
 * **Example** (Annotate a detected script)
 *
 * ```ts
 * import type { TesseractScript } from "@beep/tesseract"
 *
 * const script: TesseractScript = "Latin"
 * console.log(script)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TesseractScript = typeof TesseractScript.Type;

/**
 * Language models that read a script, in the order Tesseract should load them.
 *
 * **Example** (Models for Chinese and Latin pages)
 *
 * ```ts
 * import { tesseractLanguagesForScript } from "@beep/tesseract"
 *
 * console.log(tesseractLanguagesForScript("Han")) // ["chi_sim", "chi_tra", "eng"]
 * console.log(tesseractLanguagesForScript("Latin")) // ["eng"]
 * ```
 *
 * @param script - The detected writing system.
 * @returns The traineddata names to request for that script.
 * @category utilities
 * @since 0.0.0
 */
export const tesseractLanguagesForScript: (script: TesseractScript) => ReadonlyArray<string> =
  Match.type<TesseractScript>().pipe(
    Match.when("Latin", () => [fallbackLanguage]),
    Match.when("Han", () => ["chi_sim", "chi_tra", fallbackLanguage]),
    Match.whenOr("Japanese", "Hiragana", "Katakana", () => ["jpn", fallbackLanguage]),
    Match.when("Hangul", () => ["kor", fallbackLanguage]),
    Match.when("Cyrillic", () => ["rus", fallbackLanguage]),
    Match.when("Arabic", () => ["ara", fallbackLanguage]),
    Match.when("Hebrew", () => ["heb", fallbackLanguage]),
    Match.when("Greek", () => ["ell", fallbackLanguage]),
    Match.when("Devanagari", () => ["hin", fallbackLanguage]),
    Match.exhaustive
  );

/**
 * Language choice for one source: what the script asks for, what is installed, and what is missing.
 *
 * **Example** (Build a plan by hand)
 *
 * ```ts
 * import { TesseractLanguagePlan } from "@beep/tesseract"
 *
 * const plan = TesseractLanguagePlan.make({ missing: ["chi_sim"], requested: ["chi_sim", "eng"], selected: ["eng"] })
 * console.log(plan.selected) // ["eng"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TesseractLanguagePlan extends S.Class<TesseractLanguagePlan>($I`TesseractLanguagePlan`)(
  {
    missing: S.Array(S.NonEmptyString),
    requested: S.Array(S.NonEmptyString),
    script: S.optionalKey(TesseractScript),
    selected: S.Array(S.NonEmptyString),
  },
  $I.annote("TesseractLanguagePlan", {
    description:
      "Language choice for one source: the models its script asks for, the installed ones that will be used, and the missing ones.",
  })
) {}

/**
 * Choose the installed language models for a detected script, falling back to English.
 *
 * **Details**
 *
 * An undetected script requests English alone. Requested models that are not installed are reported in `missing` instead of failing the read; `selected` keeps the installed ones in request order and is empty only when not even English is installed.
 *
 * **Example** (Plan a Chinese page without Chinese models)
 *
 * ```ts
 * import { planTesseractLanguages } from "@beep/tesseract"
 * import * as O from "effect/Option"
 *
 * const plan = planTesseractLanguages(O.some("Han"), ["eng", "osd"])
 * console.log(plan.selected) // ["eng"]
 * console.log(plan.missing) // ["chi_sim", "chi_tra"]
 * ```
 *
 * @param script - The detected script, if detection produced one.
 * @param installed - The traineddata names Tesseract reports as installed.
 * @returns The plan with requested, selected and missing models.
 * @category utilities
 * @since 0.0.0
 */
export const planTesseractLanguages: {
  (script: O.Option<TesseractScript>, installed: ReadonlyArray<string>): TesseractLanguagePlan;
  (installed: ReadonlyArray<string>): (script: O.Option<TesseractScript>) => TesseractLanguagePlan;
} = dual(2, (script: O.Option<TesseractScript>, installed: ReadonlyArray<string>): TesseractLanguagePlan => {
  const requested = O.match(script, {
    onNone: (): ReadonlyArray<string> => [fallbackLanguage],
    onSome: tesseractLanguagesForScript,
  });
  const isInstalled = (language: string): boolean => A.contains(installed, language);
  return TesseractLanguagePlan.make({
    missing: A.filter(requested, (language) => !isInstalled(language)),
    requested,
    selected: A.filter(requested, isInstalled),
    ...O.getSomesStruct({ script }),
  });
});

/**
 * Read the installed language models from `tesseract --list-langs` output.
 *
 * **Example** (Parse the language list)
 *
 * ```ts
 * import { parseTesseractLanguages } from "@beep/tesseract"
 *
 * console.log(parseTesseractLanguages('List of available languages in "/usr/share/tessdata/" (2):\neng\nosd\n')) // ["eng", "osd"]
 * ```
 *
 * @param output - Standard output of `tesseract --list-langs`.
 * @returns The traineddata names, without the header line.
 * @category utilities
 * @since 0.0.0
 */
export const parseTesseractLanguages = (output: string): ReadonlyArray<string> =>
  pipe(
    Str.split(output, "\n"),
    A.map(Str.trim),
    A.filter((line) => Str.isNonEmpty(line) && !pipe(line, Str.includes(" ")))
  );

/**
 * Read the detected script from Tesseract's orientation and script detection output.
 *
 * **Example** (Parse a detected script)
 *
 * ```ts
 * import { parseTesseractScript } from "@beep/tesseract"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(parseTesseractScript("Rotate: 0\nScript: Han\nScript confidence: 3.1\n"))) // "Han"
 * console.log(O.isNone(parseTesseractScript("Script: Klingon\n"))) // true
 * ```
 *
 * @param output - Standard output of `tesseract <image> - --psm 0 -l osd`.
 * @returns The script when the output names one this driver routes.
 * @category utilities
 * @since 0.0.0
 */
export const parseTesseractScript = (output: string): O.Option<TesseractScript> =>
  pipe(
    Str.split(output, "\n"),
    A.findFirst(Str.startsWith(scriptPrefix)),
    O.map((line) => Str.trim(Str.slice(Str.length(scriptPrefix))(line))),
    O.flatMap(S.decodeUnknownOption(TesseractScript))
  );

/**
 * Text and word statistics read from one page.
 *
 * **Example** (Build a page reading by hand)
 *
 * ```ts
 * import { TesseractPageReading } from "@beep/tesseract"
 *
 * const reading = TesseractPageReading.make({ meanConfidence: 0.91, text: "Synthetic page", wordCount: 2 })
 * console.log(reading.wordCount) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TesseractPageReading extends S.Class<TesseractPageReading>($I`TesseractPageReading`)(
  {
    meanConfidence: S.optionalKey(UnitInterval),
    text: S.String,
    wordCount: S.Natural,
  },
  $I.annote("TesseractPageReading", {
    description: "Text of one page with its word count and mean word confidence on a zero-to-one scale.",
  })
) {}

const groupAdjacent = <T>(
  items: ReadonlyArray<T>,
  same: (left: T, right: T) => boolean
): ReadonlyArray<A.NonEmptyArray<T>> =>
  A.match(items, {
    onEmpty: (): ReadonlyArray<A.NonEmptyArray<T>> => [],
    onNonEmpty: A.groupWith(same),
  });

/**
 * Rebuild page text and mean word confidence from Tesseract's TSV output.
 *
 * **Details**
 *
 * Only word rows (level 5) with non-blank text count. Words of one line are joined by a space, lines by a newline, and a blank line separates paragraphs. The mean confidence is Tesseract's per-word score averaged and scaled from 0-100 to 0-1; a page with no words has none.
 *
 * **Example** (Parse two words on one line)
 *
 * ```ts
 * import { parseTesseractTsv } from "@beep/tesseract"
 *
 * const header = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"
 * const reading = parseTesseractTsv(`${header}\n5\t1\t1\t1\t1\t1\t0\t0\t9\t9\t90\tSynthetic\n5\t1\t1\t1\t1\t2\t9\t0\t9\t9\t80\tpage\n`)
 * console.log(reading.text) // "Synthetic page"
 * console.log(reading.meanConfidence) // 0.85
 * ```
 *
 * @param tsv - Standard output of `tesseract <image> - tsv`.
 * @returns The page text, its word count and its mean word confidence.
 * @category utilities
 * @since 0.0.0
 */
export const parseTesseractTsv = (tsv: string): TesseractPageReading => {
  const words = pipe(
    Str.split(tsv, "\n"),
    A.map((line) => Str.split(line, "\t")),
    A.filter((fields) => A.length(fields) >= 12 && A.headNonEmpty(fields) === wordLevel),
    A.map((fields) => {
      const [block, paragraph, line] = A.take(A.drop(fields, 2), 3);
      return {
        confidence: O.getOrElse(O.flatMap(A.get(fields, 10), Num.parse), () => 0),
        line: `${block}.${paragraph}.${line}`,
        paragraph: `${block}.${paragraph}`,
        text: A.join(A.drop(fields, 11), "\t"),
      };
    }),
    A.filter((word) => Str.isNonEmpty(Str.trim(word.text)))
  );
  const lines = A.map(
    groupAdjacent(words, (left, right) => left.line === right.line),
    (group) => ({
      paragraph: A.headNonEmpty(group).paragraph,
      text: A.join(
        A.map(group, (word) => word.text),
        " "
      ),
    })
  );
  const paragraphs = A.map(
    groupAdjacent(lines, (left, right) => left.paragraph === right.paragraph),
    (group) =>
      A.join(
        A.map(group, (line) => line.text),
        "\n"
      )
  );
  const wordCount = A.length(words);
  return TesseractPageReading.make({
    text: A.join(paragraphs, "\n\n"),
    wordCount: S.Natural.make(wordCount),
    ...O.getSomesStruct({
      meanConfidence:
        wordCount === 0
          ? O.none<number>()
          : O.some(
              Num.clamp({ maximum: 1, minimum: 0 })(
                A.reduce(words, 0, (total, word) => total + word.confidence) / wordCount / 100
              )
            ),
    }),
  });
};
