/** Private source loading, hash deduplication and counts-only census.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeM365ContactsId } from "@beep/identity/packages";
import { parseOutlookCsv, parseVcards } from "@beep/law-practice-server/DocumentIdentification";
import { normaliseContacts } from "@beep/law-practice-use-cases/DocumentIdentification";
import { parseCsvRows } from "@beep/schema/CsvParser";
import { ParserOptions } from "@beep/schema/ParserOptions";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ContactCensus, ContactsError, CsvCensus } from "./Contacts.schemas.ts";
import type { ContactInputs } from "./Contacts.schemas.ts";

const $I = $PracticeM365ContactsId.create("Contacts.source");
class SourceFile extends S.Class<SourceFile>($I`SourceFile`)(
  { hash: S.NonEmptyString, text: S.String },
  $I.annote("SourceFile", { description: "Private hash-deduplicated source text." })
) {}
const failInput = () => ContactsError.make({ reason: "input" });

/** Hash bytes using the runtime cryptography service.
 * **Example** (Compose a checksum)
 * ```ts
 * import { checksum } from "@/Contacts.source"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(checksum(new Uint8Array()))) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const checksum = Effect.fn("Contacts.checksum")(function* (bytes: Uint8Array) {
  return Hex.encode(yield* (yield* Crypto.Crypto).digest("SHA-256", bytes));
});
const readSources = Effect.fn("Contacts.readSources")(function* (paths: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.forEach(
    paths,
    Effect.fnUntraced(function* (path) {
      const bytes = yield* fs.readFile(path).pipe(Effect.mapError(failInput));
      return SourceFile.make({
        hash: yield* checksum(bytes),
        text: yield* Effect.try({
          try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
          catch: failInput,
        }),
      });
    }),
    { concurrency: 1 }
  );
});
const personalEmails = (cards: ReturnType<typeof normaliseContacts>) =>
  HashSet.fromIterable(
    A.flatMap(cards, (card) =>
      A.map(
        A.filter(card.emails, (email) => !email.role),
        (email) => email.address
      )
    )
  );

/** Load the existing parsers and normalizer without exposing source content.
 * **Example** (Compose a source read)
 * ```ts
 * import { loadContacts } from "@/Contacts.source"
 * import { ContactInputs } from "@/Contacts.schemas"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(loadContacts(ContactInputs.make({ csv: ["fixture.csv"], vcf: [] }), false))) // true
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const loadContacts = Effect.fn("Contacts.load")(function* (inputs: ContactInputs, census: boolean) {
  if (A.isReadonlyArrayEmpty(inputs.csv) || (!census && A.isReadonlyArrayNonEmpty(inputs.vcf)))
    return yield* Effect.fail(failInput());
  const files = yield* readSources(inputs.csv);
  const unique = A.dedupeWith(files, (a, b) => a.hash === b.hash);
  const parsed = yield* Effect.forEach(unique, (file) => parseOutlookCsv(file.text).pipe(Effect.mapError(failInput)), {
    concurrency: 1,
  });
  const raw = A.flatten(parsed);
  const contacts = normaliseContacts(raw);
  const unidentifiable = A.length(A.filter(raw, (card) => A.isReadonlyArrayEmpty(normaliseContacts([card]))));
  if (!census) return { contacts, unidentifiable, census: O.none() };
  const csvInputs = yield* Effect.forEach(
    unique,
    Effect.fnUntraced(function* (file, index) {
      const rows = yield* parseCsvRows(file.text, ParserOptions.new()).pipe(Effect.mapError(failInput));
      const cards = O.getOrElse(A.get(parsed, index), () => []);
      const individual = A.map(cards, (card) => A.head(normaliseContacts([card])));
      return CsvCensus.make({
        sha256: Str.slice(0, 12)(file.hash),
        inputsSharingHash: A.length(A.filter(files, (other) => other.hash === file.hash)),
        columnCount: O.match(A.head(rows), { onNone: () => 0, onSome: A.length }),
        headerNames: O.getOrElse(A.head(rows), () => []),
        recordCount: A.length(cards),
        withEmail: A.length(A.filter(individual, (card) => O.exists(card, (c) => A.isReadonlyArrayNonEmpty(c.emails)))),
        withNonRoleEmail: A.length(
          A.filter(individual, (card) => O.exists(card, (c) => A.some(c.emails, (email) => !email.role)))
        ),
        roleOnly: A.length(
          A.filter(individual, (card) =>
            O.exists(card, (c) => A.isReadonlyArrayNonEmpty(c.emails) && A.every(c.emails, (email) => email.role))
          )
        ),
      });
    }),
    { concurrency: 1 }
  );
  const vcfFiles = A.dedupeWith(yield* readSources(inputs.vcf), (a, b) => a.hash === b.hash);
  const vcfRaw = A.flatten(
    yield* Effect.forEach(vcfFiles, (file) => parseVcards(file.text).pipe(Effect.mapError(failInput)), {
      concurrency: 1,
    })
  );
  const vcf = normaliseContacts(vcfRaw);
  const csvEmails = personalEmails(contacts);
  const overlaps = A.filter(vcf, (card) =>
    A.some(card.emails, (email) => !email.role && HashSet.has(csvEmails, email.address))
  );
  return {
    contacts,
    unidentifiable,
    census: O.some(
      ContactCensus.make({
        csvInputs,
        csvNormalized: A.length(contacts),
        unidentifiable,
        vcfCards: A.length(vcfRaw),
        vcfNormalized: A.length(vcf),
        vcfOverlap: A.length(overlaps),
        vcfOnly: A.length(vcf) - A.length(overlaps),
      })
    ),
  };
});
