// The workbook part and what hangs off it: the sheets with their names, states and paths, the date system, the
// number format of every style, the shared text table, and the names of the parts that are not modelled.
import { $XlsxId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { MAX_FORMAT_CHARS, XlsxNumberFormat } from "../XlsxCell.schema.ts";
import { DamagedXml, LimitExceeded, MissingPart, NoSheets, NotAWorkbook } from "../XlsxDiagnostic.schema.ts";
import { XlsxFormatKind } from "../XlsxFormatKind.schema.ts";
import { XlsxDateSystem } from "../XlsxSerial.schema.ts";
import { XlsxDroppedPart, XlsxSheetName, XlsxSheetState } from "../XlsxWorkbook.schema.ts";
import { Caps, census, collect, sniffContainer, stop } from "./container.ts";
import { builtinFormats, classify, isDateFormat, renderDate } from "./numberFormat.ts";
import {
  attribute,
  child,
  children,
  eventsOf,
  isTrue,
  localName,
  relationshipsOf,
  relationshipsPath,
  rootOf,
  unescaped,
} from "./ooxml.ts";
import { detached, isXmlSafe } from "./text.ts";
import type { XlsxLimit } from "../XlsxDiagnostic.schema.ts";
import type { XlsxDroppedKind } from "../XlsxWorkbook.schema.ts";
import type { Relationship, XmlElement, XmlEvent } from "./ooxml.ts";

const $I = $XlsxId.create("internal/workbookPart");

/** A sheet as the workbook part names it, and where its XML is. */
export class SheetEntry extends S.Opaque<SheetEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    name: XlsxSheetName.pipe(S.annotateKey({ description: "The sheet's name" })),
    path: S.String.pipe(S.annotateKey({ description: "Where the sheet's XML is in the archive" })),
    state: XlsxSheetState.pipe(S.annotateKey({ description: "Whether the sheet is shown" })),
  }).pipe($I.annoteSchema("SheetEntry", { description: "A sheet as the workbook part names it" }))
) {}

/** A style's number format, with what the sheet reader asks of it worked out once. */
export class StyleFormat extends S.Opaque<StyleFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    dated: S.Boolean.pipe(S.annotateKey({ description: "Whether a number under it is a date" })),
    format: XlsxNumberFormat,
    notShown: S.Boolean.pipe(
      S.annotateKey({ description: "Whether a number or a date under it has no displayed text worked out" })
    ),
  }).pipe($I.annoteSchema("StyleFormat", { description: "A style's number format as the sheet reader asks of it" }))
) {
  /** The General format, which a cell with no style or an unknown one is read under. */
  static readonly general: StyleFormat = StyleFormat.make({
    format: XlsxNumberFormat.general,
    dated: false,
    notShown: false,
  });
}

/** A workbook opened: everything but its sheets' rows. */
export class Opened extends S.Opaque<Opened, { readonly brand: unique symbol }>()(
  S.Struct({
    bytes: S.Uint8Array.pipe(S.annotateKey({ description: "The file's bytes, for the passes that read the sheets" })),
    // `annotateKey` on the Opaque itself would drop its brand. An opened workbook is built, never decoded or
    // encoded, so its decoded side (`toType`) is all of it and keeps the brand under the key's description.
    caps: S.toType(Caps).pipe(S.annotateKey({ description: "The caps of the read, as plain numbers" })),
    dateSystem: XlsxDateSystem.pipe(S.annotateKey({ description: "The day the workbook's date serials count from" })),
    dropped: S.Array(XlsxDroppedPart).pipe(S.annotateKey({ description: "Parts the file held that are not modelled" })),
    sheets: S.NonEmptyArray(SheetEntry).pipe(S.annotateKey({ description: "The sheets, in the workbook's order" })),
    strings: S.Array(S.String).pipe(S.annotateKey({ description: "The shared text table" })),
    styles: S.Array(StyleFormat).pipe(S.annotateKey({ description: "The number format of each style index" })),
  }).pipe($I.annoteSchema("Opened", { description: "A workbook opened: everything but its sheets' rows" }))
) {}

const general = StyleFormat.general;

/** What the sheet reader needs to know of a number format. */
export const styleOf = (format: XlsxNumberFormat): StyleFormat => {
  const dated = isDateFormat(format.code);
  return StyleFormat.make({
    format,
    dated,
    notShown: dated ? O.isNone(renderDate(format.code, 1, "1900")) : XlsxFormatKind.guards.Other(classify(format.code)),
  });
};

const malformed = (path: string, reason: string) =>
  stop(DamagedXml.make({ path: Str.slice(0, 1024)(path), line: 0, column: 0, reason }));

const endsWith = (type: string, kind: string): boolean => Str.endsWith(`/${kind}`)(type);

/** The number format of each style index, from the styles part. */
const stylesOf = Effect.fnUntraced(function* (input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly caps: Caps;
}) {
  const root = yield* rootOf({ path: input.path, bytes: input.bytes, cellChars: input.caps.cellChars });
  let codes = HashMap.empty<number, string>();
  const numFmts = O.match(child(root, "numFmts"), { onNone: A.empty<XmlElement>, onSome: children("numFmt") });
  // crispen: a fold into a persistent HashMap; a later `numFmt` of an id replaces an earlier one, as Excel reads it.
  for (const numFmt of numFmts) {
    const id = Number(numFmt.attributes.numFmtId);
    const code = numFmt.attributes.formatCode ?? "";
    if (Number.isInteger(id) && id >= 0 && id <= 65_535 && code.length <= MAX_FORMAT_CHARS && isXmlSafe(code)) {
      codes = HashMap.set(codes, id, code);
    }
  }
  const formats = MutableHashMap.empty<number, StyleFormat>();
  const formatOf = (id: number): StyleFormat => {
    const known = MutableHashMap.get(formats, id);
    if (O.isSome(known)) return known.value;
    const code = O.orElse(HashMap.get(codes, id), () => HashMap.get(builtinFormats, id));
    const made = O.match(code, {
      onNone: () => (id === 0 ? general : styleOf(XlsxNumberFormat.make({ id, code: "General" }))),
      onSome: (text) => styleOf(XlsxNumberFormat.make({ id, code: text })),
    });
    MutableHashMap.set(formats, id, made);
    return made;
  };
  const xfs = O.match(child(root, "cellXfs"), { onNone: A.empty<XmlElement>, onSome: children("xf") });
  const styles = A.map(xfs, (xf) => {
    const id = Number(xf.attributes.numFmtId ?? "0");
    return Number.isInteger(id) && id >= 0 && id <= 65_535 ? formatOf(id) : general;
  });
  const countOf = (name: string): number =>
    O.match(child(root, name), {
      onNone: () => 0,
      onSome: (element) => A.length(A.filter(element.children, P.not(P.isString))),
    });
  const more = countOf("fonts") > 1 || countOf("fills") > 2 || countOf("borders") > 1 || countOf("dxfs") > 0;
  return { styles, more };
});

/** The shared text table: each entry's text, its formatted runs joined and its phonetic runs left out. */
const stringsOf = Effect.fnUntraced(function* (input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly caps: Caps;
}) {
  // crispen: a state machine over every event of the shared text table, which can run to millions of entries; the
  // depths and the text so far are its state, kept in locals for the hot loop.
  const strings: Array<string> = [];
  let depth = 0;
  let entryAt = -1;
  let phoneticAt = -1;
  let textAt = -1;
  let text = "";
  let failed: O.Option<XlsxLimit> = O.none();
  const step = (event: XmlEvent): void => {
    if (event._tag === "StartElement") {
      depth += 1;
      const name = localName(event.name);
      if (entryAt === -1) {
        if (name === "si" && depth === 2) {
          entryAt = depth;
          text = "";
        }
      } else if (phoneticAt === -1) {
        if (name === "rPh") phoneticAt = depth;
        else if (name === "t") textAt = depth;
      }
    } else if (event._tag === "EndElement") {
      if (depth === textAt) textAt = -1;
      else if (depth === phoneticAt) phoneticAt = -1;
      else if (depth === entryAt) {
        entryAt = -1;
        if (strings.length >= input.caps.sharedStrings) failed = O.some("sharedStrings");
        else if (text.length > input.caps.cellChars) failed = O.some("cellChars");
        else strings.push(detached(unescaped(text)));
      }
      depth -= 1;
    } else if (event._tag === "Text" && textAt !== -1) text += event.text;
  };
  yield* eventsOf({ path: input.path, body: Stream.make(input.bytes), cellChars: input.caps.cellChars }).pipe(
    Stream.takeWhile(() => O.isNone(failed)),
    Stream.runForEachArray((events) =>
      Effect.sync(() => {
        for (const event of events) if (O.isNone(failed)) step(event);
      })
    )
  );
  if (O.isSome(failed)) {
    return yield* Effect.fail(stop(LimitExceeded.make({ limit: failed.value, path: Str.slice(0, 1024)(input.path) })));
  }
  return strings;
});

const droppedKindOf = (path: string): XlsxDroppedKind => {
  const has = (piece: string): boolean => Str.includes(piece)(path);
  if (has("/theme/")) return "theme";
  if (has("vbaProject")) return "macros";
  if (has("/charts/") || has("/chartsheets/")) return "chart";
  if (has("/drawings/") || has("/media/")) return "drawing";
  if (has("omments")) return "comments";
  if (has("/tables/")) return "table";
  if (has("pivot")) return "pivot";
  if (has("/externalLinks/")) return "externalLink";
  if (Str.startsWith("docProps/")(path)) return "properties";
  return "other";
};

/**
 * Opens a workbook: checks what the file is, counts every part against the caps, and reads the workbook part, the
 * styles and the shared text. The sheets' own XML is left for the pass that reads rows.
 */
export const open = Effect.fnUntraced(function* (input: { readonly bytes: Uint8Array; readonly caps: Caps }) {
  const { bytes, caps } = input;
  if (bytes.length > caps.inputBytes) {
    return yield* Effect.fail(stop(LimitExceeded.make({ limit: "inputBytes", path: "" })));
  }
  const container = sniffContainer(bytes);
  if (container !== "workbook" && container !== "macroWorkbook") {
    return yield* Effect.fail(stop(NotAWorkbook.make({ container })));
  }
  const first = yield* census({
    bytes,
    caps,
    // Every small XML part is held on this pass, so the workbook part, the styles and the shared text are usually
    // in hand without a second one; a sheet's own XML is not held, wherever the workbook says it is.
    keep: (path) =>
      Str.endsWith(".rels")(path) ||
      path === "[Content_Types].xml" ||
      (Str.endsWith(".xml")(path) && !Str.includes("/worksheets/")(path)),
  });
  const present = MutableHashSet.fromIterable(first.paths);
  const partOf = Effect.fnUntraced(function* (from: { readonly kept: typeof first.kept; readonly path: string }) {
    const found = MutableHashMap.get(from.kept, from.path);
    return O.isSome(found)
      ? found.value
      : yield* Effect.fail(stop(MissingPart.make({ path: Str.slice(0, 1024)(from.path) })));
  });
  const relationships = Effect.fnUntraced(function* (part: string) {
    const path = relationshipsPath(part);
    const root = yield* rootOf({ path, bytes: yield* partOf({ kept: first.kept, path }), cellChars: caps.cellChars });
    return relationshipsOf(root, part);
  });
  const rootRelationships = MutableHashSet.has(present, "_rels/.rels") ? yield* relationships("") : [];
  const workbookPath = O.getOrElse(
    O.map(
      A.findFirst(rootRelationships, (r) => endsWith(r.type, "officeDocument")),
      (r) => r.path
    ),
    () => "xl/workbook.xml"
  );
  if (!MutableHashSet.has(present, workbookPath)) {
    return yield* Effect.fail(stop(MissingPart.make({ path: Str.slice(0, 1024)(workbookPath) })));
  }
  const links: ReadonlyArray<Relationship> = yield* relationships(workbookPath);
  // Each sheet names its relationship by id. The file decides how many of each there are, so the links are indexed
  // once, the first of an id kept, and every sheet's lookup is one hash probe rather than a scan of the links.
  const linkById = MutableHashMap.empty<string, Relationship>();
  for (const link of links) if (!MutableHashMap.has(linkById, link.id)) MutableHashMap.set(linkById, link.id, link);
  const pathOfKind = (kind: string): O.Option<string> =>
    O.filter(
      O.map(
        A.findFirst(links, (r) => endsWith(r.type, kind)),
        (r) => r.path
      ),
      (path) => MutableHashSet.has(present, path)
    );
  const stylesPath = pathOfKind("styles");
  const stringsPath = pathOfKind("sharedStrings");
  const wanted = MutableHashSet.fromIterable(
    A.filter(
      [workbookPath, ...O.toArray(stylesPath), ...O.toArray(stringsPath)],
      (path) => !MutableHashMap.has(first.kept, path)
    )
  );
  const second =
    MutableHashSet.size(wanted) === 0
      ? first.kept
      : yield* collect({ bytes, wanted: (path) => MutableHashSet.has(wanted, path) });
  for (const [path, part] of first.kept) if (!MutableHashMap.has(second, path)) MutableHashMap.set(second, path, part);
  const root = yield* rootOf({
    path: workbookPath,
    bytes: yield* partOf({ kept: second, path: workbookPath }),
    cellChars: caps.cellChars,
  });
  const dateSystem: XlsxDateSystem = O.exists(child(root, "workbookPr"), (properties) =>
    isTrue(properties.attributes.date1904)
  )
    ? "1904"
    : "1900";
  const listed = O.match(child(root, "sheets"), { onNone: A.empty<XmlElement>, onSome: children("sheet") });
  // crispen: each listed sheet can stop the open with its own finding, so this is a loop with early returns.
  const sheets: Array<SheetEntry> = [];
  const names = MutableHashSet.empty<string>();
  const read = MutableHashSet.make(workbookPath, ...O.toArray(stylesPath), ...O.toArray(stringsPath));
  for (const sheet of listed) {
    const link = O.flatMap(attribute(sheet.attributes, "id"), (id) => MutableHashMap.get(linkById, id));
    if (O.isNone(link))
      return yield* Effect.fail(malformed(workbookPath, "a sheet names a relationship the workbook lacks"));
    if (!endsWith(link.value.type, "worksheet")) continue;
    if (!MutableHashSet.has(present, link.value.path)) {
      return yield* Effect.fail(stop(MissingPart.make({ path: Str.slice(0, 1024)(link.value.path) })));
    }
    const written = sheet.attributes.name ?? "";
    const name = written === "" ? `Sheet${sheets.length + 1}` : written;
    if (!S.is(XlsxSheetName)(name)) return yield* Effect.fail(malformed(workbookPath, "a sheet's name cannot be read"));
    if (MutableHashSet.has(names, Str.toLowerCase(name))) {
      return yield* Effect.fail(malformed(workbookPath, "two sheets have one name"));
    }
    MutableHashSet.add(names, Str.toLowerCase(name));
    const state = sheet.attributes.state ?? "visible";
    sheets.push(
      SheetEntry.make({ name, state: S.is(XlsxSheetState)(state) ? state : "visible", path: link.value.path })
    );
    MutableHashSet.add(read, link.value.path);
    if (sheets.length > caps.sheets) return yield* Effect.fail(stop(LimitExceeded.make({ limit: "sheets", path: "" })));
  }
  if (!A.isArrayNonEmpty(sheets)) return yield* Effect.fail(stop(NoSheets.make({})));
  const styled = O.isSome(stylesPath)
    ? yield* stylesOf({
        path: stylesPath.value,
        bytes: yield* partOf({ kept: second, path: stylesPath.value }),
        caps,
      })
    : { styles: [], more: false };
  const strings = O.isSome(stringsPath)
    ? yield* stringsOf({
        path: stringsPath.value,
        bytes: yield* partOf({ kept: second, path: stringsPath.value }),
        caps,
      })
    : [];
  // crispen: one pass over every path the census saw, with a skip for each part that is read or is plumbing.
  const dropped: Array<XlsxDroppedPart> = [];
  for (const path of first.paths) {
    if (path.length > 1024 || Str.endsWith(".rels")(path) || path === "[Content_Types].xml") continue;
    if (MutableHashSet.has(read, path)) {
      if (styled.more && O.contains(stylesPath, path)) dropped.push(XlsxDroppedPart.make({ path, kind: "styles" }));
      continue;
    }
    dropped.push(XlsxDroppedPart.make({ path, kind: droppedKindOf(path) }));
  }
  // `disableChecks` keeps the shape checked and skips the filters: the shared text table can hold millions of
  // entries, each already held to the caps as it was read.
  return Opened.make(
    { bytes, caps, dateSystem, sheets, styles: styled.styles, strings, dropped },
    { disableChecks: true }
  );
});
