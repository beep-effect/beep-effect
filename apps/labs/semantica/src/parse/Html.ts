import { Match, Number as N, Result, Tuple } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

/**
 * HTML5 named references decoded by the C0 extractor.
 *
 * **Details**
 *
 * The supported set is `amp`, `apos`, `copy`, `gt`, `hellip`, `lt`, `mdash`,
 * `ndash`, `nbsp`, `quot`, `reg`, and `trade`. Numeric decimal and hexadecimal
 * references are also decoded. Unknown named references remain byte-for-byte
 * text.
 *
 * @category constants
 * @since 0.0.0
 */
const HTML5_NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  copy: "©",
  gt: ">",
  hellip: "…",
  lt: "<",
  mdash: "—",
  ndash: "–",
  nbsp: " ",
  quot: '"',
  reg: "®",
  trade: "™",
};

const HIDDEN_ELEMENTS: Readonly<Record<string, true>> = {
  head: true,
  script: true,
  style: true,
};

const BLOCK_ELEMENTS: Readonly<Record<string, true>> = {
  address: true,
  article: true,
  aside: true,
  blockquote: true,
  br: true,
  caption: true,
  dd: true,
  div: true,
  dl: true,
  dt: true,
  fieldset: true,
  figcaption: true,
  figure: true,
  footer: true,
  form: true,
  h1: true,
  h2: true,
  h3: true,
  h4: true,
  h5: true,
  h6: true,
  header: true,
  hr: true,
  li: true,
  main: true,
  nav: true,
  ol: true,
  p: true,
  pre: true,
  section: true,
  table: true,
  tbody: true,
  td: true,
  tfoot: true,
  th: true,
  thead: true,
  tr: true,
  ul: true,
};

interface ParsedTag {
  readonly closing: boolean;
  readonly end: number;
  readonly name: string;
}

const charAt = (text: string, index: number): string => O.getOrElse(Str.charAt(text, index), () => Str.empty);

const truncated = (): Result.Result<never, "truncated"> => Result.fail("truncated");

const findFrom = (text: string, needle: string, start: number): O.Option<number> => {
  const limit = Str.length(text) - Str.length(needle);
  let index = start;
  while (index <= limit) {
    if (Str.startsWith(needle, index)(text)) {
      return O.some(index);
    }
    index += 1;
  }
  return O.none();
};

const isWhitespace = (character: string): boolean =>
  Str.Equivalence(character, " ") ||
  Str.Equivalence(character, "\n") ||
  Str.Equivalence(character, "\r") ||
  Str.Equivalence(character, "\t") ||
  Str.Equivalence(character, "\f");

const findTagEnd = (html: string, start: number): Result.Result<number, "truncated"> => {
  const size = Str.length(html);
  let quote: string = Str.empty;
  let end = start + 1;
  while (end < size) {
    const character = charAt(html, end);
    const inQuote = Str.isNonEmpty(quote);
    const match = Match.value({
      closesQuote: inQuote && Str.Equivalence(character, quote),
      closesTag: Str.Equivalence(character, ">"),
      inQuote,
      opensDoubleQuote: Str.Equivalence(character, '"'),
      opensSingleQuote: Str.Equivalence(character, "'"),
    }).pipe(
      Match.when({ closesQuote: true }, () => {
        quote = Str.empty;
        return O.none<number>();
      }),
      Match.when({ inQuote: true }, () => O.none<number>()),
      Match.when({ opensDoubleQuote: true }, () => {
        quote = '"';
        return O.none<number>();
      }),
      Match.when({ opensSingleQuote: true }, () => {
        quote = "'";
        return O.none<number>();
      }),
      Match.when({ closesTag: true }, () => O.some(end)),
      Match.orElse(() => O.none<number>())
    );
    if (O.isSome(match)) {
      return Result.succeed(match.value);
    }
    end += 1;
  }
  return truncated();
};

const findTagNameEnd = (tagBody: string): number => {
  let nameEnd = 0;
  while (nameEnd < Str.length(tagBody)) {
    const candidate = charAt(tagBody, nameEnd);
    if (isWhitespace(candidate) || Str.Equivalence(candidate, "/")) {
      break;
    }
    nameEnd += 1;
  }
  return nameEnd;
};

const parseTag = (html: string, start: number): Result.Result<ParsedTag, "truncated"> =>
  findTagEnd(html, start).pipe(
    Result.map((end) => {
      const raw = Str.trim(Str.slice(start + 1, end)(html));
      const closing = Str.startsWith("/")(raw);
      const tagBody = Match.value(closing).pipe(
        Match.when(true, () => Str.slice(1)(raw)),
        Match.orElse(() => raw)
      );
      const nameEnd = findTagNameEnd(tagBody);
      return { closing, end, name: Str.toLowerCase(Str.slice(0, nameEnd)(tagBody)) };
    })
  );

const numericEntity = (body: string): O.Option<string> => {
  if (!Str.startsWith("#")(body)) {
    return O.none();
  }
  const numberText = Str.slice(1)(body);
  const encoded = Str.startsWith("x")(Str.toLowerCase(numberText)) ? `0x${Str.slice(1)(numberText)}` : numberText;
  return N.parse(encoded).pipe(
    O.filter((value) => N.remainder(1)(value) === 0),
    O.filter((value) => value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)),
    O.map(Str.String.fromCodePoint)
  );
};

const decodeEntity = (body: string): O.Option<string> =>
  O.orElse(numericEntity(body), () => R.get(HTML5_NAMED_ENTITIES, body));

const decodeEntityAt = (html: string, start: number): O.Option<readonly [string, number]> =>
  findFrom(html, ";", start + 1).pipe(
    O.flatMap((end) =>
      decodeEntity(Str.slice(start + 1, end)(html)).pipe(O.map((decoded) => Tuple.make(decoded, end + 1)))
    )
  );

const appendTagBoundary = (output: string, hiddenElement: O.Option<string>, tag: ParsedTag): string =>
  Match.value({
    block: R.has(BLOCK_ELEMENTS, tag.name),
    hidden: O.isSome(hiddenElement),
    opensHidden: !tag.closing && R.has(HIDDEN_ELEMENTS, tag.name),
  }).pipe(
    Match.when({ hidden: true }, () => output),
    Match.when({ opensHidden: true }, () => output),
    Match.when({ block: true }, () => Str.concat(output, "\n")),
    Match.orElse(() => output)
  );

const updateHiddenElement = (hiddenElement: O.Option<string>, tag: ParsedTag): O.Option<string> =>
  Match.value({
    closesHidden: tag.closing && hiddenElement.pipe(O.exists((hiddenName) => Str.Equivalence(tag.name, hiddenName))),
    opensHidden: O.isNone(hiddenElement) && !tag.closing && R.has(HIDDEN_ELEMENTS, tag.name),
  }).pipe(
    Match.when({ closesHidden: true }, () => O.none<string>()),
    Match.when({ opensHidden: true }, () => O.some(tag.name)),
    Match.orElse(() => hiddenElement)
  );

/**
 * Extracts deterministic text from a small HTML document.
 *
 * **Details**
 *
 * The extractor drops `head`, `script`, and `style` content, writes one newline
 * for each block-element boundary, decodes the documented entity set, and does
 * not collapse source whitespace. EOF inside a tag, quoted attribute, or HTML
 * comment returns `truncated`.
 *
 * @category parsing
 * @since 0.0.0
 */
export const extractHtmlText = (html: string): Result.Result<string, "truncated"> => {
  const size = Str.length(html);
  let hiddenElement = O.none<string>();
  let output: string = Str.empty;
  let index = 0;

  while (index < size) {
    const character = charAt(html, index);
    const step = Match.value({
      comment: Str.startsWith("<!--", index)(html),
      entity: O.isNone(hiddenElement) && Str.Equivalence(character, "&"),
      tag: Str.Equivalence(character, "<"),
      visible: O.isNone(hiddenElement),
    }).pipe(
      Match.when({ comment: true }, () =>
        findFrom(html, "-->", index + 4).pipe(
          O.match({
            onNone: truncated,
            onSome: (end) => {
              index = end + 3;
              return Result.succeed(undefined);
            },
          })
        )
      ),
      Match.when({ tag: true }, () =>
        parseTag(html, index).pipe(
          Result.map((tag) => {
            output = appendTagBoundary(output, hiddenElement, tag);
            hiddenElement = updateHiddenElement(hiddenElement, tag);
            index = tag.end + 1;
          })
        )
      ),
      Match.when({ entity: true }, () =>
        Result.succeed(
          decodeEntityAt(html, index).pipe(
            O.match({
              onNone: () => {
                output = Str.concat(output, character);
                index += 1;
              },
              onSome: ([decoded, nextIndex]) => {
                output = Str.concat(output, decoded);
                index = nextIndex;
              },
            })
          )
        )
      ),
      Match.when({ visible: true }, () => {
        output = Str.concat(output, character);
        index += 1;
        return Result.succeed(undefined);
      }),
      Match.orElse(() => {
        index += 1;
        return Result.succeed(undefined);
      })
    );
    if (Result.isFailure(step)) {
      return Result.fail(step.failure);
    }
  }

  return Result.succeed(output);
};
