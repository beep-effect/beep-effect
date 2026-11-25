import { Literal, MakeQuadOptionsInput, makeBlankNode, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { Str } from "@beep/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import type { GraphTerm, NamedNode, ObjectTerm, Quad, Subject } from "@beep/rdf/Rdf";

const iriPattern = "<[^>]*>";
const blankPattern = "_:\\S+";
const literalPattern = '"(?:[^"\\\\]|\\\\.)*"(?:\\^\\^<[^>]*>|@[A-Za-z]+(?:-[A-Za-z0-9]+)*)?';
const termPattern = `(${iriPattern}|${blankPattern}|${literalPattern})`;
const linePattern = new RegExp(
  `^${termPattern}\\s+${termPattern}\\s+${termPattern}(?:\\s+${termPattern})?\\s*\\.\\s*$`,
  "u"
);
const literalParts = /^"((?:[^"\\]|\\.)*)"(?:\^\^<([^>]*)>|@(.+))?$/u;

const echar: Readonly<Record<string, string>> = {
  t: "\t",
  b: "\b",
  n: "\n",
  r: "\r",
  f: "\f",
  '"': '"',
  "'": "'",
  "\\": "\\",
};

const unescape: (text: string) => string = Str.replaceAllWith(
  /\\(?:u([0-9A-Fa-f]{4})|U([0-9A-Fa-f]{8})|(.))/gu,
  (_match, ...groups) => {
    const [short, long, single] = A.map(A.take(groups, 3), (group) => (P.isString(group) ? group : undefined));
    return pipe(
      O.fromUndefinedOr(short ?? long),
      O.map((hex) => String.fromCodePoint(Number.parseInt(hex, 16))),
      O.getOrElse(() => echar[single ?? ""] ?? "")
    );
  }
);

const iriOf = (token: string): NamedNode => makeNamedNode(unescape(Str.slice(1, -1)(token)));

const subjectOf = (token: string): Subject =>
  Str.startsWith("_:")(token) ? makeBlankNode(Str.slice(2)(token)) : iriOf(token);

const objectOf = (token: string): ObjectTerm => {
  if (!Str.startsWith('"')(token)) {
    return subjectOf(token);
  }
  const [, value = "", datatype, language] = literalParts.exec(token) ?? [];
  const lexical = unescape(value);
  return Result.getOrThrow(
    Literal.fromParts(
      language === undefined
        ? { value: lexical, datatype: datatype ?? "http://www.w3.org/2001/XMLSchema#string" }
        : { value: lexical, datatype: "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString", language }
    )
  );
};

const graphOf = (token: string | undefined): GraphTerm | undefined =>
  token === undefined ? undefined : subjectOf(token);

const quadOf = (line: string): Quad => {
  const [, subject = "", predicate = "", object = "", graph] = linePattern.exec(line) ?? [];
  const graphTerm = graphOf(graph);
  return makeQuad(
    subjectOf(subject),
    iriOf(predicate),
    graphTerm === undefined
      ? MakeQuadOptionsInput.make({ object: objectOf(object) })
      : MakeQuadOptionsInput.make({ object: objectOf(object), graph: graphTerm })
  );
};

export const parseNQuads = (text: string): ReadonlyArray<Quad> =>
  pipe(
    Str.split("\n")(text),
    A.map(Str.trim),
    A.filter((line) => Str.isNonEmpty(line) && !Str.startsWith("#")(line)),
    A.map(quadOf)
  );
