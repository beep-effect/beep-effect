// The workbook part and what hangs off it: the sheets with their names, states and paths, the date system, the
// number format of every style, the shared text table, and the names of the parts that are not modelled.
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { MAX_FORMAT_CHARS, XlsxNumberFormat } from "../XlsxCell.schema.ts";
import { DamagedXml, LimitExceeded, MissingPart, NoSheets, NotAWorkbook } from "../XlsxDiagnostic.schema.ts";
import { XlsxDroppedPart, XlsxSheetName } from "../XlsxWorkbook.schema.ts";
import { census, collect, sniffContainer, stop } from "./container.ts";
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
import { isXmlSafe } from "./text.ts";
import { detached } from "./trusted.ts";
import type { XlsxDateSystem } from "../XlsxSerial.schema.ts";
import type { XlsxDroppedKind, XlsxSheetState } from "../XlsxWorkbook.schema.ts";
import type { Caps } from "./container.ts";
import type { Relationship, XmlEvent } from "./ooxml.ts";

/** A sheet as the workbook part names it, and where its XML is. */
export interface SheetEntry {
  readonly name: XlsxSheetName;
  readonly path: string;
  readonly state: XlsxSheetState;
}

/** A style's number format, with what the sheet reader asks of it worked out once. */
export interface StyleFormat {
  /** Whether a number under it is a date. */
  readonly dated: boolean;
  readonly format: XlsxNumberFormat;
  /** Whether a number or a date under it has no displayed text worked out. */
  readonly notShown: boolean;
}

/** A workbook opened: everything but its sheets' rows. */
export interface Opened {
  readonly bytes: Uint8Array;
  readonly caps: Caps;
  readonly dateSystem: XlsxDateSystem;
  readonly dropped: ReadonlyArray<XlsxDroppedPart>;
  readonly sheets: ReadonlyArray<SheetEntry>;
  readonly strings: ReadonlyArray<string>;
  readonly styles: ReadonlyArray<StyleFormat>;
}

const general: StyleFormat = { format: XlsxNumberFormat.general, dated: false, notShown: false };

/** What the sheet reader needs to know of a number format. */
export const styleOf = (format: XlsxNumberFormat): StyleFormat => {
  const dated = isDateFormat(format.code);
  return {
    format,
    dated,
    notShown: dated
      ? renderDate({ code: format.code, serial: 1, date1904: false }) === undefined
      : classify(format.code).kind === "Other",
  };
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
  const numFmts = child({ of: root, name: "numFmts" });
  if (numFmts !== undefined) {
    for (const numFmt of children({ of: numFmts, name: "numFmt" })) {
      const id = Number(numFmt.attributes.numFmtId);
      const code = numFmt.attributes.formatCode ?? "";
      if (Number.isInteger(id) && id >= 0 && id <= 65_535 && code.length <= MAX_FORMAT_CHARS && isXmlSafe(code)) {
        codes = HashMap.set(codes, id, code);
      }
    }
  }
  const formats = MutableHashMap.empty<number, StyleFormat>();
  const formatOf = (id: number): StyleFormat => {
    const known = MutableHashMap.get(formats, id);
    if (O.isSome(known)) return known.value;
    const code = O.orElse(HashMap.get(codes, id), () => R.get(builtinFormats, String(id)));
    const made = O.match(code, {
      onNone: () => (id === 0 ? general : styleOf(XlsxNumberFormat.make({ id, code: "General" }))),
      onSome: (text) => styleOf(XlsxNumberFormat.make({ id, code: text })),
    });
    MutableHashMap.set(formats, id, made);
    return made;
  };
  const cellXfs = child({ of: root, name: "cellXfs" });
  const styles = A.map(cellXfs === undefined ? [] : children({ of: cellXfs, name: "xf" }), (xf) => {
    const id = Number(xf.attributes.numFmtId ?? "0");
    return Number.isInteger(id) && id >= 0 && id <= 65_535 ? formatOf(id) : general;
  });
  const countOf = (name: string): number => {
    const element = child({ of: root, name });
    return element === undefined ? 0 : A.length(A.filter(element.children, (c) => typeof c !== "string"));
  };
  const more = countOf("fonts") > 1 || countOf("fills") > 2 || countOf("borders") > 1 || countOf("dxfs") > 0;
  return { styles, more };
});

/** The shared text table: each entry's text, its formatted runs joined and its phonetic runs left out. */
const stringsOf = Effect.fnUntraced(function* (input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly caps: Caps;
}) {
  const strings: Array<string> = [];
  let depth = 0;
  let entryAt = -1;
  let phoneticAt = -1;
  let textAt = -1;
  let text = "";
  let failed: O.Option<"sharedStrings" | "cellChars"> = O.none();
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
    return relationshipsOf({ root, part });
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
  const properties = child({ of: root, name: "workbookPr" });
  const dateSystem: XlsxDateSystem =
    properties !== undefined && isTrue(properties.attributes.date1904) ? "1904" : "1900";
  const listed = child({ of: root, name: "sheets" });
  const sheets: Array<SheetEntry> = [];
  const names = MutableHashSet.empty<string>();
  const read = MutableHashSet.make(workbookPath, ...O.toArray(stylesPath), ...O.toArray(stringsPath));
  for (const sheet of listed === undefined ? [] : children({ of: listed, name: "sheet" })) {
    const id = attribute({ attributes: sheet.attributes, name: "id" });
    const link = A.findFirst(links, (r) => r.id === id);
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
    const state = sheet.attributes.state;
    sheets.push({
      name,
      state: state === "hidden" ? "hidden" : state === "veryHidden" ? "veryHidden" : "visible",
      path: link.value.path,
    });
    MutableHashSet.add(read, link.value.path);
    if (sheets.length > caps.sheets) return yield* Effect.fail(stop(LimitExceeded.make({ limit: "sheets", path: "" })));
  }
  if (sheets.length === 0) return yield* Effect.fail(stop(NoSheets.make({})));
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
  const dropped: Array<XlsxDroppedPart> = [];
  for (const path of first.paths) {
    if (path.length > 1024 || Str.endsWith(".rels")(path) || path === "[Content_Types].xml") continue;
    if (MutableHashSet.has(read, path)) {
      if (styled.more && O.contains(stylesPath, path)) dropped.push(XlsxDroppedPart.make({ path, kind: "styles" }));
      continue;
    }
    dropped.push(XlsxDroppedPart.make({ path, kind: droppedKindOf(path) }));
  }
  const opened: Opened = { bytes, caps, dateSystem, sheets, styles: styled.styles, strings, dropped };
  return opened;
});
