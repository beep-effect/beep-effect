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
import { Caps, census, collect, partKey, sniffContainer, stop } from "./container.ts";
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
import type { XlsxFatal, XlsxLimit } from "../XlsxDiagnostic.schema.ts";
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

/** The content types part, by its `partKey`. */
const contentTypes = partKey("[Content_Types].xml");

const endsWith = (type: string, kind: string): boolean => Str.endsWith(`/${kind}`)(type);

/** Whether a number format id is one a workbook may write: a whole number from 0 to 65535. */
const isFormatId = (id: number): boolean => Number.isInteger(id) && id >= 0 && id <= 65_535;

/** The elements named `name` under the child `parent` of `root`, none when it has no such child. */
const grandchildren = (root: XmlElement, parent: string, name: string): ReadonlyArray<XmlElement> =>
  O.match(child(root, parent), { onNone: A.empty<XmlElement>, onSome: children(name) });

/** The custom number format codes a styles part writes, by id. */
const customCodes = (root: XmlElement): HashMap.HashMap<number, string> => {
  let codes = HashMap.empty<number, string>();
  // crispen: a fold into a persistent HashMap; a later `numFmt` of an id replaces an earlier one, as Excel reads it.
  for (const numFmt of grandchildren(root, "numFmts", "numFmt")) {
    const id = Number(numFmt.attributes.numFmtId);
    const code = numFmt.attributes.formatCode ?? "";
    if (isFormatId(id) && code.length <= MAX_FORMAT_CHARS && isXmlSafe(code)) codes = HashMap.set(codes, id, code);
  }
  return codes;
};

/** The format a number format id names: a custom code, a built-in one, or General under that id. */
const formatOfId = (codes: HashMap.HashMap<number, string>, id: number): StyleFormat =>
  O.match(
    O.orElse(HashMap.get(codes, id), () => HashMap.get(builtinFormats, id)),
    {
      onNone: () => (id === 0 ? general : styleOf(XlsxNumberFormat.make({ id, code: "General" }))),
      onSome: (text) => styleOf(XlsxNumberFormat.make({ id, code: text })),
    }
  );

/** Whether a styles part styles more than number formats: a second font or border, a fill, a differential style. */
const stylesMore = (root: XmlElement): boolean => {
  const countOf = (name: string): number =>
    O.match(child(root, name), {
      onNone: () => 0,
      onSome: (element) => A.length(A.filter(element.children, P.not(P.isString))),
    });
  return countOf("fonts") > 1 || countOf("fills") > 2 || countOf("borders") > 1 || countOf("dxfs") > 0;
};

/** The number format of each style index, from the styles part. */
const stylesOf = Effect.fnUntraced(function* (input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly caps: Caps;
}) {
  const root = yield* rootOf({ path: input.path, bytes: input.bytes, cellChars: input.caps.cellChars });
  const codes = customCodes(root);
  const formats = MutableHashMap.empty<number, StyleFormat>();
  const formatOf = (id: number): StyleFormat => {
    const known = MutableHashMap.get(formats, id);
    if (O.isSome(known)) return known.value;
    const made = formatOfId(codes, id);
    MutableHashMap.set(formats, id, made);
    return made;
  };
  const styles = A.map(grandchildren(root, "cellXfs", "xf"), (xf) => {
    const id = Number(xf.attributes.numFmtId ?? "0");
    return isFormatId(id) ? formatOf(id) : general;
  });
  return { styles, more: stylesMore(root) };
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
  const startElement = (name: string): void => {
    depth += 1;
    if (entryAt === -1 && name === "si" && depth === 2) {
      entryAt = depth;
      text = "";
    } else if (entryAt !== -1 && phoneticAt === -1) {
      if (name === "rPh") phoneticAt = depth;
      else if (name === "t") textAt = depth;
    }
  };
  const endEntry = (): void => {
    entryAt = -1;
    if (strings.length >= input.caps.sharedStrings) failed = O.some("sharedStrings");
    else if (text.length > input.caps.cellChars) failed = O.some("cellChars");
    else strings.push(detached(unescaped(text)));
  };
  const endElement = (): void => {
    if (depth === textAt) textAt = -1;
    else if (depth === phoneticAt) phoneticAt = -1;
    else if (depth === entryAt) endEntry();
    depth -= 1;
  };
  const step = (event: XmlEvent): void => {
    if (event._tag === "StartElement") startElement(localName(event.name));
    else if (event._tag === "EndElement") endElement();
    else if (event._tag === "Text" && textAt !== -1) text += event.text;
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

/**
 * What a part the read leaves out holds, by the pieces of its name as OPC compares them; the first that matches
 * names it.
 */
const droppedKinds: ReadonlyArray<readonly [pieces: ReadonlyArray<string>, kind: XlsxDroppedKind]> = A.map(
  [
    [["/theme/"], "theme"],
    [["vbaProject"], "macros"],
    [["/charts/", "/chartsheets/"], "chart"],
    [["/drawings/", "/media/"], "drawing"],
    [["omments"], "comments"],
    [["/tables/"], "table"],
    [["pivot"], "pivot"],
    [["/externalLinks/"], "externalLink"],
  ] satisfies ReadonlyArray<readonly [ReadonlyArray<string>, XlsxDroppedKind]>,
  ([pieces, kind]) => [A.map(pieces, partKey), kind] as const
);

const docProps = partKey("docProps/");

/** What a part the read leaves out holds, from its name as OPC compares it. */
const droppedKindOf = (path: string): XlsxDroppedKind => {
  const key = partKey(path);
  return O.getOrElse(
    O.map(
      A.findFirst(droppedKinds, ([pieces]) => A.some(pieces, (piece) => Str.includes(piece)(key))),
      ([, kind]) => kind
    ),
    () => (Str.startsWith(docProps)(key) ? "properties" : "other")
  );
};

/** The parts a pass held, by their `partKey`. */
type Kept = MutableHashMap.MutableHashMap<string, Uint8Array>;

const missing = (path: string) => stop(MissingPart.make({ path: Str.slice(0, 1024)(path) }));

const partOf = Effect.fnUntraced(function* (kept: Kept, path: string) {
  const found = MutableHashMap.get(kept, partKey(path));
  return O.isSome(found) ? found.value : yield* Effect.fail(missing(path));
});

/** Every small XML part is held on the census, so the workbook part, the styles and the shared text are usually in
 * hand without a second pass; a sheet's own XML is not held, wherever the workbook says it is. */
const heldOnCensus = (key: string): boolean =>
  Str.endsWith(".rels")(key) ||
  key === contentTypes ||
  (Str.endsWith(".xml")(key) && !Str.includes("/worksheets/")(key));

/** Refuses a file that is too large or is not a workbook, before any part is inflated. */
const admitted = (bytes: Uint8Array, caps: Caps): Effect.Effect<void, XlsxFatal> => {
  if (bytes.length > caps.inputBytes) return Effect.fail(stop(LimitExceeded.make({ limit: "inputBytes", path: "" })));
  const container = sniffContainer(bytes);
  return container === "workbook" || container === "macroWorkbook"
    ? Effect.void
    : Effect.fail(stop(NotAWorkbook.make({ container })));
};

/** The relationships a part names, read from its relationships part. */
const relationshipsFrom = Effect.fnUntraced(function* (kept: Kept, part: string, caps: Caps) {
  const path = relationshipsPath(part);
  const root = yield* rootOf({ path, bytes: yield* partOf(kept, path), cellChars: caps.cellChars });
  return relationshipsOf(root, part);
});

/** Where the workbook part is: as the package's relationships name it, else where Excel writes it. */
const workbookPathOf = Effect.fnUntraced(function* (input: {
  readonly kept: Kept;
  readonly present: MutableHashSet.MutableHashSet<string>;
  readonly caps: Caps;
}) {
  const rootRelationships = MutableHashSet.has(input.present, partKey("_rels/.rels"))
    ? yield* relationshipsFrom(input.kept, "", input.caps)
    : [];
  return O.getOrElse(
    O.map(
      A.findFirst(rootRelationships, (r) => endsWith(r.type, "officeDocument")),
      (r) => r.path
    ),
    () => "xl/workbook.xml"
  );
});

/**
 * Each sheet names its relationship by id. The file decides how many of each there are, so the links are indexed
 * once, the first of an id kept, and every sheet's lookup is one hash probe rather than a scan of the links.
 */
const linksById = (links: ReadonlyArray<Relationship>): MutableHashMap.MutableHashMap<string, Relationship> => {
  const byId = MutableHashMap.empty<string, Relationship>();
  for (const link of links) if (!MutableHashMap.has(byId, link.id)) MutableHashMap.set(byId, link.id, link);
  return byId;
};

/** The parts of the census, with those `wanted` that it did not hold read in a second pass. */
const withWanted = Effect.fnUntraced(function* (input: {
  readonly bytes: Uint8Array;
  readonly kept: Kept;
  readonly wanted: ReadonlyArray<string>;
}) {
  const wanted = MutableHashSet.fromIterable(
    A.filter(A.map(input.wanted, partKey), (key) => !MutableHashMap.has(input.kept, key))
  );
  if (MutableHashSet.size(wanted) === 0) return input.kept;
  const second = yield* collect({ bytes: input.bytes, wanted: (key) => MutableHashSet.has(wanted, key) });
  for (const [key, part] of input.kept) if (!MutableHashMap.has(second, key)) MutableHashMap.set(second, key, part);
  return second;
});

/** What a workbook's sheets are read against: the parts present, the workbook part's path and its links. */
interface SheetContext {
  readonly linkById: MutableHashMap.MutableHashMap<string, Relationship>;
  readonly present: MutableHashSet.MutableHashSet<string>;
  readonly workbookPath: string;
}

const isSheetName = S.is(XlsxSheetName);
const isSheetState = S.is(XlsxSheetState);

/** A listed sheet as an entry, none when its link is not a worksheet; a sheet that cannot be read stops the open. */
const sheetEntryOf = Effect.fnUntraced(function* (
  sheet: XmlElement,
  context: SheetContext,
  names: MutableHashSet.MutableHashSet<string>,
  position: number
) {
  const link = O.flatMap(attribute(sheet.attributes, "id"), (id) => MutableHashMap.get(context.linkById, id));
  if (O.isNone(link)) {
    return yield* Effect.fail(malformed(context.workbookPath, "a sheet names a relationship the workbook lacks"));
  }
  if (!endsWith(link.value.type, "worksheet")) return O.none<SheetEntry>();
  if (!MutableHashSet.has(context.present, partKey(link.value.path)))
    return yield* Effect.fail(missing(link.value.path));
  const name = yield* sheetNameOf(sheet.attributes.name ?? "", position, names, context.workbookPath);
  const state = sheet.attributes.state ?? "visible";
  return SheetEntry.makeOption({ name, state: isSheetState(state) ? state : "visible", path: link.value.path });
});

/** A sheet's name, `Sheet<position>` when it writes none; one that cannot be read or repeats another stops the open. */
const sheetNameOf = Effect.fnUntraced(function* (
  written: string,
  position: number,
  names: MutableHashSet.MutableHashSet<string>,
  workbookPath: string
) {
  const name = written === "" ? `Sheet${position}` : written;
  if (!isSheetName(name)) return yield* Effect.fail(malformed(workbookPath, "a sheet's name cannot be read"));
  if (MutableHashSet.has(names, Str.toLowerCase(name))) {
    return yield* Effect.fail(malformed(workbookPath, "two sheets have one name"));
  }
  MutableHashSet.add(names, Str.toLowerCase(name));
  return name;
});

/** The workbook's sheets, in its order; each listed sheet can stop the open with its own finding. */
const sheetsOf = Effect.fnUntraced(function* (root: XmlElement, context: SheetContext, caps: Caps) {
  // crispen: each listed sheet can stop the open with its own finding, so this is a loop with early returns.
  const sheets: Array<SheetEntry> = [];
  const names = MutableHashSet.empty<string>();
  for (const sheet of grandchildren(root, "sheets", "sheet")) {
    const entry = yield* sheetEntryOf(sheet, context, names, sheets.length + 1);
    if (O.isNone(entry)) continue;
    sheets.push(entry.value);
    if (sheets.length > caps.sheets) return yield* Effect.fail(stop(LimitExceeded.make({ limit: "sheets", path: "" })));
  }
  if (!A.isArrayNonEmpty(sheets)) return yield* Effect.fail(stop(NoSheets.make({})));
  return sheets;
});

/**
 * A part the census saw that the read leaves out, none for one that is read or is plumbing. The styles part is
 * read, and is also listed as dropped when `moreStyles` names it: what it styles beyond number formats is not kept.
 */
const droppedPartOf = (
  path: string,
  read: MutableHashSet.MutableHashSet<string>,
  moreStyles: O.Option<string>
): O.Option<XlsxDroppedPart> => {
  const key = partKey(path);
  if (path.length > 1024 || Str.endsWith(".rels")(key) || key === contentTypes) return O.none();
  if (!MutableHashSet.has(read, key)) return XlsxDroppedPart.makeOption({ path, kind: droppedKindOf(path) });
  return O.exists(moreStyles, (styles) => partKey(styles) === key)
    ? XlsxDroppedPart.makeOption({ path, kind: "styles" })
    : O.none();
};

/**
 * Opens a workbook: checks what the file is, counts every part against the caps, and reads the workbook part, the
 * styles and the shared text. The sheets' own XML is left for the pass that reads rows.
 */
export const open = Effect.fnUntraced(function* (input: { readonly bytes: Uint8Array; readonly caps: Caps }) {
  const { bytes, caps } = input;
  yield* admitted(bytes, caps);
  const first = yield* census({ bytes, caps, keep: heldOnCensus });
  // Every part is looked up by its `partKey`, as OPC compares names; a finding names the part as it was written.
  const present = MutableHashSet.fromIterable(A.map(first.paths, partKey));
  const workbookPath = yield* workbookPathOf({ kept: first.kept, present, caps });
  if (!MutableHashSet.has(present, partKey(workbookPath))) return yield* Effect.fail(missing(workbookPath));
  const links: ReadonlyArray<Relationship> = yield* relationshipsFrom(first.kept, workbookPath, caps);
  const pathOfKind = (kind: string): O.Option<string> =>
    O.filter(
      O.map(
        A.findFirst(links, (r) => endsWith(r.type, kind)),
        (r) => r.path
      ),
      (path) => MutableHashSet.has(present, partKey(path))
    );
  const stylesPath = pathOfKind("styles");
  const stringsPath = pathOfKind("sharedStrings");
  const readParts = [workbookPath, ...O.toArray(stylesPath), ...O.toArray(stringsPath)];
  const second = yield* withWanted({ bytes, kept: first.kept, wanted: readParts });
  const root = yield* rootOf({
    path: workbookPath,
    bytes: yield* partOf(second, workbookPath),
    cellChars: caps.cellChars,
  });
  const dateSystem: XlsxDateSystem = O.exists(child(root, "workbookPr"), (properties) =>
    isTrue(properties.attributes.date1904)
  )
    ? "1904"
    : "1900";
  const sheets = yield* sheetsOf(root, { linkById: linksById(links), present, workbookPath }, caps);
  const read = MutableHashSet.fromIterable(A.map([...readParts, ...A.map(sheets, (sheet) => sheet.path)], partKey));
  const styled = yield* O.match(stylesPath, {
    onNone: () => Effect.succeed({ styles: A.empty<StyleFormat>(), more: false }),
    onSome: (path) => Effect.flatMap(partOf(second, path), (part) => stylesOf({ path, bytes: part, caps })),
  });
  const strings = yield* O.match(stringsPath, {
    onNone: () => Effect.succeed(A.empty<string>()),
    onSome: (path) => Effect.flatMap(partOf(second, path), (part) => stringsOf({ path, bytes: part, caps })),
  });
  const moreStyles = O.filter(stylesPath, () => styled.more);
  const dropped = A.getSomes(A.map(first.paths, (path) => droppedPartOf(path, read, moreStyles)));
  // `disableChecks` keeps the shape checked and skips the filters: the shared text table can hold millions of
  // entries, each already held to the caps as it was read.
  return Opened.make(
    { bytes, caps, dateSystem, sheets, styles: styled.styles, strings, dropped },
    { disableChecks: true }
  );
});
