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
  longerThan,
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
    // decision: opaque-fields-take-no-key-annotation
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

const contentTypes = partKey("[Content_Types].xml");

const endsWith = (type: string, kind: string): boolean => Str.endsWith(`/${kind}`)(type);

const isFormatId = (id: number): boolean => Number.isInteger(id) && id >= 0 && id <= 65_535;

const grandchildren = (root: XmlElement, parent: string, name: string): ReadonlyArray<XmlElement> =>
  O.match(child(root, parent), { onNone: A.empty<XmlElement>, onSome: children(name) });

const customCodes = (root: XmlElement): HashMap.HashMap<number, string> => {
  let lastCodeById = HashMap.empty<number, string>();
  for (const numFmt of grandchildren(root, "numFmts", "numFmt")) {
    const id = Number(numFmt.attributes.numFmtId);
    const code = numFmt.attributes.formatCode ?? "";
    if (isFormatId(id) && code.length <= MAX_FORMAT_CHARS && isXmlSafe(code))
      lastCodeById = HashMap.set(lastCodeById, id, code);
  }
  return lastCodeById;
};

const formatOfId = (codes: HashMap.HashMap<number, string>, id: number): StyleFormat =>
  O.match(
    O.orElse(HashMap.get(codes, id), () => HashMap.get(builtinFormats, id)),
    {
      onNone: () => (id === 0 ? general : styleOf(XlsxNumberFormat.make({ id, code: "General" }))),
      onSome: (text) => styleOf(XlsxNumberFormat.make({ id, code: text })),
    }
  );

const stylesBeyondNumberFormats = (root: XmlElement): boolean => {
  const countOf = (name: string): number =>
    O.match(child(root, name), {
      onNone: () => 0,
      onSome: (element) => A.length(A.filter(element.children, P.not(P.isString))),
    });
  return countOf("fonts") > 1 || countOf("fills") > 2 || countOf("borders") > 1 || countOf("dxfs") > 0;
};

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
  return { styles, more: stylesBeyondNumberFormats(root) };
});

const sliceBytes = 65_536;

const slicesOf = (bytes: Uint8Array): Stream.Stream<Uint8Array> =>
  Stream.fromIterable(
    A.makeBy(Math.ceil(bytes.length / sliceBytes), (i) => bytes.subarray(i * sliceBytes, (i + 1) * sliceBytes)),
    { chunkSize: 1 }
  );

const stringsOf = Effect.fnUntraced(function* (input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly caps: Caps;
}) {
  // decision: hot-paths-are-mutable-loops
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
    else if (longerThan(text, input.caps.cellChars)) failed = O.some("cellChars");
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
  yield* eventsOf({ path: input.path, body: slicesOf(input.bytes), cellChars: input.caps.cellChars }).pipe(
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

type HeldByPartKey = MutableHashMap.MutableHashMap<string, Uint8Array>;

const missing = (path: string) => stop(MissingPart.make({ path: Str.slice(0, 1024)(path) }));

const partOf = Effect.fnUntraced(function* (kept: HeldByPartKey, path: string) {
  const found = MutableHashMap.get(kept, partKey(path));
  return O.isSome(found) ? found.value : yield* Effect.fail(missing(path));
});

const heldOnCensus = (key: string): boolean =>
  Str.endsWith(".rels")(key) ||
  key === contentTypes ||
  (Str.endsWith(".xml")(key) && !Str.includes("/worksheets/")(key));

const admitted = (bytes: Uint8Array, caps: Caps): Effect.Effect<void, XlsxFatal> => {
  if (bytes.length > caps.inputBytes) return Effect.fail(stop(LimitExceeded.make({ limit: "inputBytes", path: "" })));
  const container = sniffContainer(bytes);
  return container === "workbook" || container === "macroWorkbook"
    ? Effect.void
    : Effect.fail(stop(NotAWorkbook.make({ container })));
};

const relationshipsFrom = Effect.fnUntraced(function* (kept: HeldByPartKey, part: string, caps: Caps) {
  const path = relationshipsPath(part);
  const root = yield* rootOf({ path, bytes: yield* partOf(kept, path), cellChars: caps.cellChars });
  return relationshipsOf(root, part);
});

const workbookPathOf = Effect.fnUntraced(function* (input: {
  readonly kept: HeldByPartKey;
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

const linksById = (links: ReadonlyArray<Relationship>): MutableHashMap.MutableHashMap<string, Relationship> => {
  const byId = MutableHashMap.empty<string, Relationship>();
  for (const link of links) if (!MutableHashMap.has(byId, link.id)) MutableHashMap.set(byId, link.id, link);
  return byId;
};

const withWanted = Effect.fnUntraced(function* (input: {
  readonly bytes: Uint8Array;
  readonly kept: HeldByPartKey;
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

interface SheetContext {
  readonly linkById: MutableHashMap.MutableHashMap<string, Relationship>;
  readonly present: MutableHashSet.MutableHashSet<string>;
  readonly workbookPath: string;
}

const isSheetName = S.is(XlsxSheetName);
const isSheetState = S.is(XlsxSheetState);

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

const sheetsOf = Effect.fnUntraced(function* (root: XmlElement, context: SheetContext, caps: Caps) {
  // decision: hot-paths-are-mutable-loops
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
 *
 * **Details**
 *
 * Every part is looked up by its `partKey`, as OPC compares names; a finding names the part as it was written. Every
 * small XML part is held on the census, so the workbook part, the styles and the shared text are usually in hand
 * without a second pass; a sheet's own XML is not held, wherever the workbook says it is. The styles part is read,
 * and is also listed as dropped when it styles more than number formats, which are all a read keeps of it.
 *
 * **Gotchas**
 *
 * The shared text table reaches the XML reader in slices, each a view into the part and its own pull. The reader
 * hands on every event a slice completes before it can stop, so a whole part in one piece would be read to its end
 * before a cap on its entries could stop it; in slices, a read stops within a slice of the cap.
 */
export const open = Effect.fnUntraced(function* (input: { readonly bytes: Uint8Array; readonly caps: Caps }) {
  const { bytes, caps } = input;
  yield* admitted(bytes, caps);
  const first = yield* census({ bytes, caps, keep: heldOnCensus });
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
  // decision: engine-makes-skip-filters
  return Opened.make(
    { bytes, caps, dateSystem, sheets, styles: styled.styles, strings, dropped },
    { disableChecks: true }
  );
});
