// The XML of a workbook's parts, read with Effect's XML reader. This is the only file that imports
// `effect/encoding/Xml`. That reader reports names as written and has no namespace option, so elements and
// attributes are matched by their local name: `x:row` is `row`. It expands no entity declared in a DOCTYPE and
// reads no outside resource.
import { $XlsxId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Xml from "effect/encoding/Xml";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { DamagedXml, LimitExceeded } from "../XlsxDiagnostic.schema.ts";
import { stop } from "./container.ts";
import type { XlsxFatal } from "../XlsxDiagnostic.schema.ts";

const $I = $XlsxId.create("internal/ooxml");

/** One event of a part's XML. */
export type XmlEvent = Xml.Event;

/** A small part read whole: an element with its attributes and children. */
export type XmlElement = Xml.Element;

/** A name without its namespace prefix. */
export const localName = (name: string): string => {
  // Read for every element of every sheet: a loop that allocates nothing when there is no prefix.
  for (let i = name.length - 1; i >= 0; i -= 1) if (name[i] === ":") return Str.slice(i + 1)(name);
  return name;
};

/** An attribute by its local name, whatever prefix the file gave it. */
export const attribute = (input: {
  readonly attributes: Readonly<Record<string, string>>;
  readonly name: string;
}): O.Option<string> =>
  O.orElse(R.get(input.attributes, input.name), () =>
    O.map(
      A.findFirst(R.toEntries(input.attributes), ([key]) => localName(key) === input.name),
      ([, value]) => value
    )
  );

/** Whether an attribute says yes, as `1` or `true`. */
export const isTrue = (value: string | undefined): boolean => value === "1" || value === "true";

const path1024 = Str.slice(0, 1024);

const failure =
  (path: string) =>
  (error: Xml.XmlError | XlsxFatal): XlsxFatal =>
    Xml.isXmlError(error)
      ? error.kind === "Limit"
        ? stop(LimitExceeded.make({ limit: "xml", path: path1024(path) }))
        : stop(
            DamagedXml.make({
              path: path1024(path),
              line: error.line ?? 0,
              column: error.column ?? 0,
              reason: Str.slice(0, 255)(error.message),
            })
          )
      : error;

/** How large one XML token may be and how deep elements may nest, from the cap on a cell's characters. */
const decodeOptions = (cellChars: number): Xml.DecodeOptions => ({
  maxTokenSize: Math.max(cellChars * 8, 65_536),
  maxDepth: 256,
  positions: true,
});

/** The events of a part's XML, from the stream of its bytes. */
export const eventsOf = <E extends XlsxFatal>(input: {
  readonly path: string;
  readonly body: Stream.Stream<Uint8Array, E>;
  readonly cellChars: number;
}): Stream.Stream<XmlEvent, XlsxFatal> =>
  input.body.pipe(
    Stream.pipeThroughChannel(Xml.decode(decodeOptions(input.cellChars))),
    Stream.mapError(failure(input.path))
  );

/** A small part read whole into its root element. */
export const rootOf = Effect.fnUntraced(function* (input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly cellChars: number;
}) {
  const roots = yield* Stream.make(input.bytes).pipe(
    Stream.pipeThroughChannel(Xml.decode(decodeOptions(input.cellChars))),
    Stream.pipeThroughChannel(Xml.elements(["*"], { maxElementSize: Number.POSITIVE_INFINITY })),
    Stream.mapError(failure(input.path)),
    Stream.runCollect
  );
  const root = roots[0];
  return root === undefined
    ? yield* Effect.fail(
        stop(
          DamagedXml.make({ path: path1024(input.path), line: 0, column: 0, reason: "the part has no root element" })
        )
      )
    : root;
});

/** The child elements of an element with a local name. */
export const children = (input: { readonly of: XmlElement; readonly name: string }): ReadonlyArray<XmlElement> =>
  A.filter(
    input.of.children,
    (child): child is XmlElement => !P.isString(child) && localName(child.name) === input.name
  );

/** The first child element with a local name. */
export const child = (input: { readonly of: XmlElement; readonly name: string }): O.Option<XmlElement> =>
  A.head(children(input));

/** One relationship of a part: its id, what kind of part it points at, and that part's path in the archive. */
export class Relationship extends S.Opaque<Relationship, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.pipe(S.annotateKey({ description: "The relationship's id within its part" })),
    path: S.String.pipe(S.annotateKey({ description: "The target part's path in the archive" })),
    type: S.String.pipe(S.annotateKey({ description: "The relationship type URI: what kind of part it points at" })),
  }).pipe($I.annoteSchema("Relationship", { description: "One relationship of an OOXML part" }))
) {}

/** The folder of a part's path, with its trailing slash, or the empty text at the root. */
const folderOf = (path: string): string =>
  O.match(Str.lastIndexOf("/")(path), { onNone: () => "", onSome: (at) => Str.slice(0, at + 1)(path) });

/** The path a relationship's target names, from the part that holds the relationship. */
const resolve = (from: string, target: string): string => {
  if (Str.startsWith("/")(target)) return Str.slice(1)(target);
  const parts: Array<string> = [];
  for (const piece of Str.split("/")(`${folderOf(from)}${target}`)) {
    if (piece === "" || piece === ".") continue;
    if (piece === "..") parts.pop();
    else parts.push(piece);
  }
  return A.join(parts, "/");
};

/** Where a part keeps its relationships: `xl/workbook.xml` keeps them in `xl/_rels/workbook.xml.rels`. */
export const relationshipsPath = (part: string): string => {
  const folder = folderOf(part);
  return `${folder}_rels/${Str.slice(folder.length)(part)}.rels`;
};

/** The relationships a `.rels` part lists, their targets resolved from the part they belong to. */
export const relationshipsOf = (input: {
  readonly root: XmlElement;
  readonly part: string;
}): ReadonlyArray<Relationship> =>
  A.map(children({ of: input.root, name: "Relationship" }), (element) =>
    Relationship.make({
      id: element.attributes.Id ?? "",
      type: element.attributes.Type ?? "",
      path: resolve(input.part, element.attributes.Target ?? ""),
    })
  );

const escape = /_x([0-9A-Fa-f]{4})_/g;

/** Cell text as it is meant: Excel writes a character XML cannot hold as `_xHHHH_`. */
export const unescaped = (text: string): string => {
  if (!Str.includes("_x")(text)) return text;
  let out = "";
  let at = 0;
  for (const found of Str.matchAll(escape)(text)) {
    const index = found.index ?? 0;
    out += Str.slice(at, index)(text) + String.fromCharCode(Number.parseInt(found[1] ?? "0", 16));
    at = index + found[0].length;
  }
  return out + Str.slice(at)(text);
};
