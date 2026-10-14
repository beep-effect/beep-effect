/**
 * Private parser for `pdftotext -bbox-layout` XHTML: page → flow → block →
 * line → word, each with `xMin`/`yMin`/`xMax`/`yMax` in points from the
 * page's top-left corner.
 *
 * @internal
 */

import { A, O, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import { PdfToolsError } from "../PdfTools.errors.ts";
import { PdfRect, TextBlock } from "../PdfTools.models.ts";

const PAGE = /<page\b[^>]*>([\s\S]*?)<\/page>/;
const BLOCK = /<block\b([^>]*)>([\s\S]*?)<\/block>/g;
const LINE = /<line\b[^>]*>([\s\S]*?)<\/line>/g;
const WORD = /<word\b[^>]*>([\s\S]*?)<\/word>/g;
const ATTRIBUTE = /([A-Za-z]+)="([^"]*)"/g;
const ENTITY = /&(#x[0-9A-Fa-f]+|#[0-9]+|amp|lt|gt|quot|apos);/g;

const NAMED_ENTITIES = HashMap.fromIterable([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

const parseError = (message: string): PdfToolsError => PdfToolsError.make({ reason: "parse", message });

const decodeEntity = (_match: string, body: string): string =>
  body.startsWith("#x")
    ? String.fromCodePoint(Number.parseInt(body.slice(2), 16))
    : body.startsWith("#")
      ? String.fromCodePoint(Number.parseInt(body.slice(1), 10))
      : pipe(
          HashMap.get(NAMED_ENTITIES, body),
          O.getOrElse(() => `&${body};`)
        );

const decodeText = (text: string): string => text.replace(ENTITY, decodeEntity);

const attributes = (raw: string): HashMap.HashMap<string, string> =>
  HashMap.fromIterable(A.map(A.fromIterable(raw.matchAll(ATTRIBUTE)), (match) => [match[1] ?? "", match[2] ?? ""]));

const coordinate = (attrs: HashMap.HashMap<string, string>, name: string): number => {
  const value = pipe(HashMap.get(attrs, name), O.map(Number), O.filter(Number.isFinite));
  if (O.isNone(value)) {
    throw parseError(`A pdftotext block has no numeric ${name}.`);
  }
  return value.value;
};

const lineText = (line: string): string =>
  pipe(
    A.fromIterable(line.matchAll(WORD)),
    A.map((match) => decodeText(match[1] ?? "")),
    A.join(" ")
  );

const blockOf = (match: RegExpExecArray | RegExpMatchArray): TextBlock => {
  const attrs = attributes(match[1] ?? "");
  const text = pipe(
    A.fromIterable((match[2] ?? "").matchAll(LINE)),
    A.map((line) => lineText(line[1] ?? "")),
    A.filter(Str.isNonEmpty),
    A.join("\n")
  );
  return TextBlock.make({
    text,
    rect: PdfRect.make({
      xMin: coordinate(attrs, "xMin"),
      yMin: coordinate(attrs, "yMin"),
      xMax: coordinate(attrs, "xMax"),
      yMax: coordinate(attrs, "yMax"),
    }),
  });
};

/**
 * Parse the first page of `pdftotext -bbox-layout` output into text blocks,
 * in document order; blocks without words are dropped.
 *
 * @internal
 */
export const parseBboxLayout = (xhtml: string): ReadonlyArray<TextBlock> => {
  const page = PAGE.exec(xhtml);
  if (page === null) {
    throw parseError("pdftotext -bbox-layout output has no page.");
  }
  return pipe(
    A.fromIterable((page[1] ?? "").matchAll(BLOCK)),
    A.map(blockOf),
    A.filter((block) => Str.isNonEmpty(block.text))
  );
};
