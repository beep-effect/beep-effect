/**
 * Internal string helpers used by the Chalk renderer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ChalkId } from "@beep/identity/packages";
import { Str } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ChalkId.create("Domain");

const NonNegativeInteger = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NonNegativeInteger", {
    description: "A non-negative integer used for string index positions.",
  })
);

const indexOfOrNotFound = (text: string, substring: string): number =>
  pipe(
    text,
    Str.indexOf(substring),
    O.getOrElse(() => -1)
  );

const indexOfFromOrNotFound = (text: string, substring: string, fromIndex: number): number => {
  const searchStart = Math.min(Math.max(fromIndex, 0), Str.length(text));

  return pipe(
    text,
    Str.slice(searchStart),
    Str.indexOf(substring),
    O.map((index) => index + searchStart),
    O.getOrElse(() => -1)
  );
};

const replaceAllLoop = (text: string, substring: string, replacer: string): string => {
  let index = indexOfOrNotFound(text, substring);
  const substringLength = substring.length;
  let endIndex = 0;
  let result = "";

  do {
    result += Str.slice(endIndex, index)(text) + substring + replacer;
    endIndex = index + substringLength;
    index = indexOfFromOrNotFound(text, substring, endIndex);
  } while (index !== -1);

  result += Str.slice(endIndex)(text);

  return result;
};

const renderLineBreak = (gotCR: boolean): string => (gotCR ? "\r\n" : "\n");

const renderLineBreakSliceEnd = (nextIndex: number, gotCR: boolean): number => (gotCR ? nextIndex - 1 : nextIndex);

/**
 * Replace every later occurrence of a substring while preserving the first occurrence.
 *
 * @example
 * ```ts
 * import { stringReplaceAll } from "./Utilities.ts"
 *
 * const rendered = stringReplaceAll("a-b-c", "-", { replacer: "+" })
 * console.log(rendered)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
class StringReplaceAllOptionsModel extends S.Class<StringReplaceAllOptionsModel>($I`StringReplaceAllOptions`)(
  {
    replacer: S.String,
  },
  $I.annote("StringReplaceAllOptions", {
    description: "Replacement text used by Chalk string replacement helpers.",
  })
) {}

type StringReplaceAllOptions = typeof StringReplaceAllOptionsModel.Encoded;

export const stringReplaceAll: {
  (text: string, substring: string, options: StringReplaceAllOptions): string;
  (substring: string, options: StringReplaceAllOptions): (text: string) => string;
} = dual(3, (text: string, substring: string, options: StringReplaceAllOptions): string =>
  pipe(
    text,
    O.liftPredicate(Str.includes(substring)),
    O.map(() => replaceAllLoop(text, substring, options.replacer)),
    O.getOrElse(() => text)
  )
);

/**
 * Encase each line break with close and reopen ANSI sequences.
 *
 * @example
 * ```ts
 * import { stringEncaseCRLFWithFirstIndex } from "./Utilities.ts"
 *
 * const rendered = stringEncaseCRLFWithFirstIndex("a\nb", "<close>", { postfix: "<open>", index: 1 })
 * console.log(rendered)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
class StringEncaseCrlfOptionsModel extends S.Class<StringEncaseCrlfOptionsModel>($I`StringEncaseCrlfOptions`)(
  {
    index: NonNegativeInteger,
    postfix: S.String,
  },
  $I.annote("StringEncaseCrlfOptions", {
    description: "Line-break position and reopen text used by Chalk CRLF encasing helpers.",
  })
) {}

type StringEncaseCrlfOptions = typeof StringEncaseCrlfOptionsModel.Encoded;

export const stringEncaseCRLFWithFirstIndex: {
  (text: string, prefix: string, options: StringEncaseCrlfOptions): string;
  (prefix: string, options: StringEncaseCrlfOptions): (text: string) => string;
} = dual(3, (text: string, prefix: string, options: StringEncaseCrlfOptions): string => {
  let endIndex = 0;
  let result = "";
  let nextIndex = options.index;

  do {
    const gotCR = text[nextIndex - 1] === "\r";

    result +=
      Str.slice(endIndex, renderLineBreakSliceEnd(nextIndex, gotCR))(text) +
      prefix +
      renderLineBreak(gotCR) +
      options.postfix;
    endIndex = nextIndex + 1;
    nextIndex = indexOfFromOrNotFound(text, "\n", endIndex);
  } while (nextIndex !== -1);

  result += Str.slice(endIndex)(text);

  return result;
});
