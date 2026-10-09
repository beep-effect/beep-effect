/**
 * Schema boundaries for the identifier and title portions of classification XML.
 * @packageDocumentation
 * @since 0.0.0
 */

import { decodeXmlTextAs } from "@beep/schema/Xml";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  ClassificationConcept,
  ClassificationError,
  CpcSymbol,
  classificationConceptIri,
  classificationSchemeIri,
  IpcSymbol,
  NiceBasicNumber,
  NiceClassNumber,
} from "../Classification.models.ts";
import type { ClassificationPin } from "../Classification.models.ts";

const TextNode = S.Struct({ text: S.OptionFromOptionalKey(S.String) });
const Text = S.Union([S.String, TextNode]);
const TitlePart = S.Struct({ text: S.OptionFromOptionalKey(Text) });
const IpcTitle = S.Struct({
  title: S.OptionFromOptionalKey(S.Struct({ titlePart: S.ArrayEnsure(TitlePart) })),
});

const IpcEntryFields = S.Struct({
  kind: S.String,
  symbol: S.OptionFromOptionalKey(S.String),
  textBody: S.OptionFromOptionalKey(IpcTitle),
});

interface IpcEntryEncoded extends S.Codec.Encoded<typeof IpcEntryFields> {
  readonly ipcEntry?: IpcEntryEncoded | readonly IpcEntryEncoded[];
}

class IpcEntry extends S.Class<IpcEntry>("ClassificationXml/IpcEntry")({
  ...IpcEntryFields.fields,
  ipcEntry: S.ArrayEnsure(S.suspend((): S.Codec<IpcEntry, IpcEntryEncoded> => IpcEntry)).pipe(
    S.withDecodingDefaultKey(Effect.succeed([]))
  ),
}) {}

const CpcTitlePart = S.Struct({
  text: S.OptionFromOptionalKey(Text),
  "CPC-specific-text": S.OptionFromOptionalKey(S.Struct({ text: S.ArrayEnsure(Text) })),
});
const CpcTitle = S.Struct({ "title-part": S.ArrayEnsure(CpcTitlePart) });

const CpcEntryFields = S.Struct({
  "classification-symbol": S.String,
  "class-title": S.OptionFromOptionalKey(CpcTitle),
});

interface CpcEntryEncoded extends S.Codec.Encoded<typeof CpcEntryFields> {
  readonly "classification-item"?: CpcEntryEncoded | readonly CpcEntryEncoded[];
}

class CpcEntry extends S.Class<CpcEntry>("ClassificationXml/CpcEntry")({
  ...CpcEntryFields.fields,
  "classification-item": S.ArrayEnsure(S.suspend((): S.Codec<CpcEntry, CpcEntryEncoded> => CpcEntry)).pipe(
    S.withDecodingDefaultKey(Effect.succeed([]))
  ),
}) {}

const NiceGoods = S.Struct({ basicNumber: S.String, id: S.String });
const NiceClass = S.Struct({
  id: S.String,
  classNumber: S.String,
  isGoodOrService: S.Literals(["good", "service"]),
  GoodOrService: S.ArrayEnsure(NiceGoods).pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
});
const NiceClassText = S.Struct({
  idRef: S.String,
  Heading: S.Struct({ HeadingItem: S.ArrayEnsure(TextNode) }),
});
const NiceGoodText = S.Struct({
  idRef: S.String,
  Indication: S.ArrayEnsure(S.Struct({ Label: S.ArrayEnsure(TextNode) })),
});

// Unknown XML properties (notes, definitions, references and warnings) are
// deliberately discarded by the schema. They cannot enter the CPC projection.
const IpcDocument = S.Struct({
  IPCScheme: S.Struct({ edition: S.String, ipcEntry: S.ArrayEnsure(IpcEntry) }),
});
const CpcDocument = S.Struct({
  "class-scheme": S.Struct({
    "publication-date": S.String,
    "scheme-type": S.Literal("cpc"),
    "classification-item": S.ArrayEnsure(CpcEntry),
  }),
});
const NiceStructureDocument = S.Struct({
  ClassificationTopStructure: S.Struct({
    edition: S.String,
    version: S.String,
    Class: S.ArrayEnsure(NiceClass),
  }),
});
const NiceTextDocument = S.Struct({
  ClassificationTexts: S.Struct({
    edition: S.String,
    version: S.String,
    language: S.Literal("en"),
    ClassesTexts: S.Struct({ ClassTexts: S.ArrayEnsure(NiceClassText) }),
    GoodsAndServicesTexts: S.Struct({ GoodOrServiceTexts: S.ArrayEnsure(NiceGoodText) }),
  }),
});

const textValue = Match.type<typeof Text.Type>().pipe(
  Match.when(S.is(S.String), (text) => text),
  Match.orElse((node) => O.getOrElse(node.text, () => ""))
);
const label = (texts: readonly string[]) => A.join(A.filter(A.map(texts, Str.trim), Str.isNonEmpty), "; ");
const sourceFailure = (detail: string) => ClassificationError.make({ reason: "source-parse", detail });
const makeConcept = Effect.fnUntraced(function* (
  pin: ClassificationPin,
  notation: string,
  prefLabel: string,
  parent: O.Option<ClassificationConcept>,
  depth: number
) {
  yield* pin.kind === "ipc"
    ? S.decodeEffect(IpcSymbol)(notation)
    : pin.kind === "cpc"
      ? S.decodeEffect(CpcSymbol)(notation)
      : S.decodeEffect(S.Union([NiceClassNumber, NiceBasicNumber]))(notation);
  return yield* S.decodeEffect(ClassificationConcept)({
    kind: pin.kind,
    edition: pin.edition,
    schemeIri: classificationSchemeIri(pin),
    notation,
    prefLabel,
    iri: classificationConceptIri(pin, notation),
    broader: A.map(O.toArray(parent), (value) => value.iri),
    depth,
  });
});

const ipcNotation = (raw: string) =>
  Str.length(raw) === 14
    ? `${Str.slice(0, 4)(raw)}${Str.replace(/^0+/, "")(Str.slice(4, 8)(raw))}/${Str.padEnd(2, "0")(Str.replace(/0+$/, "")(Str.slice(8)(raw)))}`
    : raw;

const IpcConceptEntryKind = S.String.check(S.isPattern(/^(?:s|c|u|m|\d+)$/));
const isIpcConceptEntryKind = S.is(IpcConceptEntryKind);

const walkIpc = Effect.fnUntraced(function* (
  entries: readonly IpcEntry[],
  pin: ClassificationPin,
  parent: O.Option<ClassificationConcept>
): Effect.fn.Return<readonly ClassificationConcept[], ClassificationError> {
  const branches = yield* Effect.forEach(
    entries,
    Effect.fnUntraced(function* (entry) {
      const admitted = isIpcConceptEntryKind(entry.kind);
      const title = O.flatMap(entry.textBody, (body) => body.title);
      const parts = O.map(title, (value) =>
        A.map(value.titlePart, (part) => O.match(part.text, { onNone: () => "", onSome: textValue }))
      );
      const prefLabel = label(O.getOrElse(parts, () => []));
      const symbol = O.map(entry.symbol, ipcNotation);
      const concept =
        admitted && O.isSome(symbol) && Str.isNonEmpty(prefLabel)
          ? O.some(
              yield* makeConcept(
                pin,
                symbol.value,
                prefLabel,
                parent,
                O.match(parent, { onNone: () => 0, onSome: (value) => value.depth + 1 })
              ).pipe(Effect.mapError(() => sourceFailure("Invalid IPC symbol")))
            )
          : O.none<ClassificationConcept>();
      const children = yield* walkIpc(
        entry.ipcEntry,
        pin,
        O.orElse(concept, () => parent)
      );
      return A.appendAll(O.toArray(concept), children);
    })
  );
  return A.flatten(branches);
});

/**
 * Decode only the admitted symbol and title tree of an IPC edition.
 *
 * **Example** (Parse a pinned IPC XML master file)
 *
 * ```ts
 * import { parseIpc } from "./ClassificationXml.ts"
 * import { ClassificationPin } from "@beep/ontology/Classification.models"
 * const pin = ClassificationPin.make({ kind: "ipc", edition: "2026.01" })
 * const program = parseIpc('<IPCScheme edition="20260101"><ipcEntry kind="s" symbol="A"><textBody><title><titlePart><text>Synthetic section</text></titlePart></title></textBody></ipcEntry></IPCScheme>', pin)
 * console.log(program)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const parseIpc = Effect.fnUntraced(function* (content: string, pin: ClassificationPin) {
  const { IPCScheme: document } = yield* decodeXmlTextAs(IpcDocument)(content).pipe(
    Effect.mapError(() => sourceFailure("Invalid IPC XML"))
  );
  yield* Effect.filterOrFail(
    Effect.succeed(document.edition),
    (edition) => `${Str.slice(0, 4)(edition)}.${Str.slice(4, 6)(edition)}` === pin.edition,
    () => sourceFailure("IPC source edition differs from its pin")
  );
  return yield* walkIpc(document.ipcEntry, pin, O.none());
});

const cpcLabel = (title: typeof CpcTitle.Type) =>
  label(
    A.flatMap(title["title-part"], (part) =>
      A.appendAll(
        A.map(O.toArray(part.text), textValue),
        O.match(part["CPC-specific-text"], { onNone: () => [], onSome: (value) => A.map(value.text, textValue) })
      )
    )
  );
const prefixParent = (notation: string) =>
  Match.value(Str.length(notation)).pipe(
    Match.when(1, O.none<string>),
    Match.when(3, () => O.some(Str.slice(0, 1)(notation))),
    Match.when(4, () => O.some(Str.slice(0, 3)(notation))),
    Match.orElse(() => O.some(Str.slice(0, 4)(notation)))
  );
const walkCpc = Effect.fnUntraced(function* (
  entries: readonly CpcEntry[],
  pin: ClassificationPin,
  parent: O.Option<ClassificationConcept>
): Effect.fn.Return<readonly ClassificationConcept[], ClassificationError> {
  const branches = yield* Effect.forEach(
    entries,
    Effect.fnUntraced(function* (entry) {
      const notation = entry["classification-symbol"];
      const title = O.match(entry["class-title"], { onNone: () => "", onSome: cpcLabel });
      const prefLabel = Str.isNonEmpty(title) ? title : notation;
      const repeated = O.exists(parent, (value) => value.notation === notation);
      const depth = O.match(parent, {
        onNone: () =>
          Match.value(Str.length(notation)).pipe(
            Match.when(1, () => 0),
            Match.when(3, () => 1),
            Match.when(4, () => 2),
            Match.orElse(() => 3)
          ),
        onSome: (value) => value.depth + 1,
      });
      const concept = repeated
        ? O.map(parent, (value) => ClassificationConcept.make({ ...value, prefLabel }))
        : O.some(
            yield* makeConcept(pin, notation, prefLabel, parent, depth).pipe(
              Effect.mapError(() => sourceFailure("Invalid CPC symbol"))
            )
          );
      const withRootParent = O.map(concept, (value) =>
        O.isNone(parent)
          ? ClassificationConcept.make({
              ...value,
              broader: A.map(O.toArray(prefixParent(notation)), (symbol) => classificationConceptIri(pin, symbol)),
            })
          : value
      );
      const children = yield* walkCpc(
        entry["classification-item"],
        pin,
        O.orElse(withRootParent, () => parent)
      );
      return A.appendAll(O.toArray(withRootParent), children);
    })
  );
  return A.flatten(branches);
});
/**
 * Keep symbol, title and hierarchy facts; discard definitions, references, notes and warnings.
 *
 * **Example** (Parse a pinned CPC XML scheme file)
 *
 * ```ts
 * import { parseCpc } from "./ClassificationXml.ts"
 * import { ClassificationPin } from "@beep/ontology/Classification.models"
 * const pin = ClassificationPin.make({ kind: "cpc", edition: "2026.08" })
 * const program = parseCpc('<class-scheme publication-date="2026-08-01" scheme-type="cpc"><classification-item><classification-symbol>A</classification-symbol></classification-item></class-scheme>', pin)
 * console.log(program)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const parseCpc = Effect.fnUntraced(function* (content: string, pin: ClassificationPin) {
  const { "class-scheme": document } = yield* decodeXmlTextAs(CpcDocument)(content).pipe(
    Effect.mapError(() => sourceFailure("Invalid CPC XML"))
  );
  yield* Effect.filterOrFail(
    Effect.succeed(document["publication-date"]),
    (edition) => Str.replace("-", ".")(Str.slice(0, 7)(edition)) === pin.edition,
    () => sourceFailure("CPC source edition differs from its pin")
  );
  return yield* walkCpc(document["classification-item"], pin, O.none());
});

/**
 * Join classes and basic terms by source identifiers without label inference.
 *
 * **Example** (Join pinned Nice structure and English titles)
 *
 * ```ts
 * import { parseNice } from "./ClassificationXml.ts"
 * import { ClassificationPin } from "@beep/ontology/Classification.models"
 * const pin = ClassificationPin.make({ kind: "nice", edition: "13-2026" })
 * const structure = '<ClassificationTopStructure edition="13" version="2026"><Class id="class1" classNumber="1" isGoodOrService="good"/></ClassificationTopStructure>'
 * const titles = '<ClassificationTexts edition="13" version="2026" language="en"><ClassesTexts><ClassTexts idRef="class1"><Heading><HeadingItem id="heading">Synthetic class</HeadingItem></Heading></ClassTexts></ClassesTexts><GoodsAndServicesTexts><GoodOrServiceTexts idRef="unused"><Indication><Label id="label">Synthetic term</Label></Indication></GoodOrServiceTexts></GoodsAndServicesTexts></ClassificationTexts>'
 * const program = parseNice(structure, titles, pin)
 * console.log(program)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const parseNice = Effect.fnUntraced(function* (
  structureContent: string,
  textContent: string,
  pin: ClassificationPin
) {
  const { ClassificationTopStructure: structure } = yield* decodeXmlTextAs(NiceStructureDocument)(
    structureContent
  ).pipe(Effect.mapError(() => sourceFailure("Invalid Nice structure XML")));
  const { ClassificationTexts: texts } = yield* decodeXmlTextAs(NiceTextDocument)(textContent).pipe(
    Effect.mapError(() => sourceFailure("Invalid Nice text XML"))
  );
  yield* Effect.filterOrFail(
    Effect.succeed(structure),
    (value) =>
      `${value.edition}-${value.version}` === pin.edition && `${texts.edition}-${texts.version}` === pin.edition,
    () => sourceFailure("Nice source editions differ from their pin")
  );
  const classTexts = HashMap.fromIterable(
    A.map(texts.ClassesTexts.ClassTexts, (value): readonly [string, typeof NiceClassText.Type] => [value.idRef, value])
  );
  const goodTexts = HashMap.fromIterable(
    A.map(texts.GoodsAndServicesTexts.GoodOrServiceTexts, (value): readonly [string, typeof NiceGoodText.Type] => [
      value.idRef,
      value,
    ])
  );
  return A.flatten(
    yield* Effect.forEach(
      structure.Class,
      Effect.fnUntraced(function* (entry) {
        const classText = yield* Effect.fromOption(HashMap.get(classTexts, entry.id), () =>
          sourceFailure("Nice class title missing")
        );
        const classConcept = yield* makeConcept(
          pin,
          entry.classNumber,
          label(A.map(classText.Heading.HeadingItem, (node) => O.getOrElse(node.text, () => ""))),
          O.none(),
          0
        ).pipe(Effect.mapError(() => sourceFailure("Invalid Nice class")));
        const goods = yield* Effect.forEach(
          entry.GoodOrService,
          Effect.fnUntraced(function* (good) {
            const text = yield* Effect.fromOption(HashMap.get(goodTexts, good.id), () =>
              sourceFailure("Nice basic title missing")
            );
            const prefLabel = label(
              A.flatMap(text.Indication, (value) => A.map(value.Label, (node) => O.getOrElse(node.text, () => "")))
            );
            return yield* makeConcept(
              pin,
              `${Str.padStart(2, "0")(entry.classNumber)}${good.basicNumber}`,
              prefLabel,
              O.some(classConcept),
              1
            ).pipe(Effect.mapError(() => sourceFailure("Invalid Nice basic number")));
          })
        );
        return A.prepend(goods, classConcept);
      })
    )
  );
});
