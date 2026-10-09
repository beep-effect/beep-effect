/**
 * Outlook CSV and vCard file adapters.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  ContactCardSource,
  ContactCardSourceShape,
  IdentificationError,
  RawContactCard,
} from "@beep/law-practice-use-cases/DocumentIdentification";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as M from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("DocumentIdentification/Identification.contacts");
const invalid = () => IdentificationError.make({ operation: "contact-parse", reason: "invalid-input" });
const opt = (s: string) => (Str.isNonEmpty(Str.trim(s)) ? O.some(Str.trim(s)) : O.none());
const nonempty = (xs: ReadonlyArray<string>) => A.filter(A.map(xs, Str.trim), Str.isNonEmpty);
// One cell and its terminator: a quoted cell (doubled quotes escape, trailing blanks tolerated) or a bare cell.
const csvCell = /("(?:[^"]|"")*"[ \t]*|[^",\r\n]*)(,|\r\n|\n|\r|$)/uy;
const unquote = (cell: string) =>
  Str.startsWith('"')(cell) ? Str.replace(/""/gu, '"')(Str.slice(1, -1)(Str.trimEnd(cell))) : cell;
// The next cell must start exactly at `at`; a stray quote or an unterminated quoted cell matches nothing.
const nextCell = (text: string, at: number): RegExpExecArray => {
  csvCell.lastIndex = at;
  const match = csvCell.exec(text);
  if (match === null || match.index !== at) throw invalid();
  return match;
};
// Rows made only of empty cells (blank lines) are dropped.
const pushRow = (rows: Array<Array<string>>, row: Array<string>) =>
  A.some(row, Str.isNonEmpty) ? rows.push(row) : rows.length;
const parseCsv = (input: string): Array<Array<string>> => {
  const text = Str.replace(/^\uFEFF/u, "")(input);
  const rows: Array<Array<string>> = [];
  let row: Array<string> = [];
  let at = 0;
  let last = "";
  while (at < text.length) {
    const match = nextCell(text, at);
    row.push(unquote(match[1] ?? ""));
    at += match[0].length;
    last = match[2] ?? "";
    if (last !== ",") {
      pushRow(rows, row);
      row = [];
    }
  }
  // A file that ends with a comma and no final newline still owes its last, empty cell.
  if (last === ",") row.push("");
  if (row.length > 0) rows.push(row);
  return rows;
};

/**
 * Parses Outlook CSV including quoted delimiters, escaped quotes and embedded newlines.
 * **Example** (Read a synthetic card)
 *
 * ```ts
 * import { parseOutlookCsv } from "@beep/law-practice-server/DocumentIdentification"
 * import * as Effect from "effect/Effect"
 * const cards = Effect.runSync(parseOutlookCsv("First Name,Last Name\nAlex,Example\n"))
 * console.log(cards[0]?.displayName) // "Alex Example"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseOutlookCsv = (text: string): Effect.Effect<ReadonlyArray<RawContactCard>, IdentificationError> =>
  Effect.try({
    try: () => {
      const [header, ...rows] = parseCsv(text);
      if (
        header === undefined ||
        !A.some(header, (h) => A.contains(["First Name", "Full Name", "Company"], Str.trim(h)))
      )
        throw invalid();
      return A.map(rows, (row) => {
        if (row.length !== header.length) throw invalid();
        const values = M.fromIterable(A.map(header, (h, i) => [Str.trim(h), Str.trim(row[i] ?? "")] as const));
        const get = (key: string) => O.getOrElse(M.get(values, key), () => "");
        const displayName =
          get("Full Name") || A.join(nonempty(A.map(["First Name", "Middle Name", "Last Name", "Suffix"], get)), " ");
        return RawContactCard.make({
          displayName,
          organization: opt(get("Company")),
          titles: nonempty([get("Job Title")]),
          emails: nonempty(A.map(["E-mail Address", "E-mail 2 Address", "E-mail 3 Address"], get)),
          phones: nonempty(
            A.map(
              A.filter(header, (h) => /(?:Phone(?: 2)?|Fax)$/u.test(h)),
              get
            )
          ),
          addresses: nonempty(
            A.map(["Business", "Home", "Other"], (kind) =>
              A.join(
                nonempty(
                  A.map(["Street", "City", "State", "Postal Code", "Country/Region"], (f) => get(`${kind} ${f}`))
                ),
                ", "
              )
            )
          ),
          source: "outlook-csv",
        });
      });
    },
    catch: invalid,
  });
const unescape = (s: string) =>
  Str.replace(/\\\\/gu, "\\")(Str.replace(/\\([,;:])/gu, "$1")(Str.replace(/\\[nN]/gu, "\n")(s)));
const components = (s: string) => A.map(Str.split(s, /(?<!\\);/u), unescape);

type CardFields = M.MutableHashMap<string, Array<string>>;
const fieldValues = (values: CardFields, key: string) => O.getOrElse(M.get(values, key), () => []);
const firstValue = (values: CardFields, key: string) => O.getOrElse(A.head(fieldValues(values, key)), () => "");
const cardFrom = (values: CardFields): RawContactCard => {
  if (!A.contains(["3.0", "4.0"], firstValue(values, "VERSION"))) throw invalid();
  const n = components(firstValue(values, "N"));
  const get = (key: string) => fieldValues(values, key);
  return RawContactCard.make({
    displayName:
      unescape(firstValue(values, "FN")) ||
      A.join(nonempty([n[3] ?? "", n[1] ?? "", n[2] ?? "", n[0] ?? "", n[4] ?? ""]), " "),
    organization: opt(A.join(nonempty(components(firstValue(values, "ORG"))), " ")),
    titles: A.map(get("TITLE"), unescape),
    emails: A.map(get("EMAIL"), unescape),
    phones: A.map(get("TEL"), (s) => unescape(Str.replace(/^tel:/iu, "")(s))),
    addresses: A.map(get("ADR"), (s) => A.join(nonempty(components(s)), ", ")),
    source: "vcard",
  });
};
const addProperty = (values: CardFields, line: string) => {
  const colon = line.indexOf(":");
  if (colon < 0) throw invalid();
  const prop = Str.slice(0, colon)(line);
  if (/ENCODING=QUOTED-PRINTABLE/iu.test(prop)) throw invalid();
  // Inline binary (PHOTO, LOGO, KEY, SOUND) never carries contact text; skip it.
  if (/ENCODING=(?:B|BASE64)(?:;|$)/iu.test(prop)) return;
  const key = Str.toUpperCase(Str.replace(/^[^.]+\./u, "")(Str.split(prop, ";")[0] ?? ""));
  M.set(values, key, [...fieldValues(values, key), Str.slice(colon + 1)(line)]);
};
/**
 * Parses vCard 3.0 and 4.0, unfolding lines and preserving grouped property values.
 * Skips inline binary properties such as photos; rejects incomplete cards and quoted-printable text
 * rather than silently corrupting contacts.
 * **Example** (Read a vCard)
 *
 * ```ts
 * import { parseVcards } from "@beep/law-practice-server/DocumentIdentification"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(parseVcards("BEGIN:VCARD\nVERSION:4.0\nFN:Alex Example\nEND:VCARD")).length) // 1
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseVcards = (text: string): Effect.Effect<ReadonlyArray<RawContactCard>, IdentificationError> =>
  Effect.try({
    try: () => {
      const lines = Str.split(Str.replace(/\n[ \t]/gu, "")(Str.replace(/\r*\n|\r/gu, "\n")(text)), "\n");
      const result: Array<RawContactCard> = [];
      let fields: O.Option<M.MutableHashMap<string, Array<string>>> = O.none();
      A.forEach(lines, (line) => {
        if (Str.trim(line) === "") return;
        if (Str.toUpperCase(line) === "BEGIN:VCARD") {
          if (O.isSome(fields)) throw invalid();
          fields = O.some(M.empty());
          return;
        }
        if (O.isNone(fields)) throw invalid();
        if (Str.toUpperCase(line) === "END:VCARD") {
          result.push(cardFrom(fields.value));
          fields = O.none();
          return;
        }
        addProperty(fields.value, line);
      });
      if (O.isSome(fields)) throw invalid();
      return result;
    },
    catch: invalid,
  });

/**
 * Private contact-file locations, both supplied by the caller.
 * **Example** (Configure synthetic paths)
 *
 * ```ts
 * import { ContactFilesConfig } from "@beep/law-practice-server/DocumentIdentification"
 * console.log(ContactFilesConfig.make({ csvPath: "input.csv", vcardPath: "input.vcf" }).csvPath) // "input.csv"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ContactFilesConfig extends S.Class<ContactFilesConfig>($I`ContactFilesConfig`)(
  { csvPath: S.NonEmptyString, vcardPath: S.NonEmptyString },
  $I.annote("ContactFilesConfig", { description: "Explicit contact input path pair." })
) {}
/**
 * Contact file configuration tag.
 * **Example** (Provide paths)
 *
 * ```ts
 * import { ContactFilesLocation, ContactFilesConfig } from "@beep/law-practice-server/DocumentIdentification"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(Layer.succeed(ContactFilesLocation, ContactFilesConfig.make({ csvPath: "input.csv", vcardPath: "input.vcf" })))) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ContactFilesLocation extends Context.Service<ContactFilesLocation, ContactFilesConfig>()(
  $I`ContactFilesLocation`
) {}
const makeContactCardSourceFile = Effect.fn("DocumentIdentification.Identification.contacts.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const config = yield* ContactFilesLocation;
  const read = Effect.fn("ContactCardSource.cards")(function* () {
    const csv = yield* fs
      .readFileString(config.csvPath)
      .pipe(Effect.mapError(() => IdentificationError.make({ operation: "contact-read", reason: "unavailable" })));
    const vcf = yield* fs
      .readFileString(config.vcardPath)
      .pipe(Effect.mapError(() => IdentificationError.make({ operation: "contact-read", reason: "unavailable" })));
    return [...(yield* parseOutlookCsv(csv)), ...(yield* parseVcards(vcf))];
  });
  return ContactCardSourceShape.make({
    cards: Stream.fromEffect(read()).pipe(Stream.flatMap(Stream.fromIterable)),
  });
});

/**
 * Reads the CSV and vCard path pair through FileSystem; no private values enter errors.
 * **Example** (Inspect the contact layer)
 *
 * ```ts
 * import { ContactCardSourceFile } from "@beep/law-practice-server/DocumentIdentification"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(ContactCardSourceFile)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ContactCardSourceFile = Layer.effect(ContactCardSource, makeContactCardSourceFile());
