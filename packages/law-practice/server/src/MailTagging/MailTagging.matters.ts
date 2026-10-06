/**
 * The matter directory over a practice knowledge-graph bundle's DuckDB matter
 * tables, with contact addresses from a private overlay file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { PatentNumber, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain";
import { PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import {
  MailDomain,
  MatterClientKey,
  MatterDocketNumber,
  MatterIndex,
  MatterIndexEntry,
  MatterKey,
  UnattributedMatter,
} from "@beep/law-practice-domain/values/MailTagging";
import { MailTaggingPortError, MatterDirectory, MatterDirectoryShape } from "@beep/law-practice-use-cases/MailTagging";
import { EmailString } from "@beep/schema/Email";
import { Effect, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeStateFileAt } from "../internal/MailTaggingStateFile.ts";
import { MailTaggingStateLocation } from "./MailTagging.state.ts";
import type { MailTaggingStateError } from "@beep/law-practice-use-cases/MailTagging";
import type { FileSystem } from "effect";

const $I = $LawPracticeServerId.create("MailTagging/MailTagging.matters");

const contactsFile = "matter-contacts.json";
const listSeparator = " | ";

/**
 * Contact addresses and sender domains of one matter, as the attorney curates
 * them in the private `matter-contacts.json` overlay.
 *
 * **Details**
 *
 * The practice knowledge graph has no contact-to-matter relation, so contacts
 * come from this file. An address may be listed under more than one family
 * key; it is loaded as written. That such an address never routes an
 * attachment is the filer's rule, not a reason to drop data here.
 *
 * **Example** (Describe one matter's contacts)
 *
 * ```ts
 * import { MatterContacts } from "@beep/law-practice-server/MailTagging"
 * import { EmailString } from "@beep/schema/Email"
 *
 * const contacts = MatterContacts.make({
 *   familyKey: "1234.10001",
 *   addresses: [EmailString.make("counsel@acme.example.test")]
 * })
 * console.log(contacts.domains.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterContacts extends S.Class<MatterContacts>($I`MatterContacts`)(
  {
    familyKey: S.NonEmptyString.annotateKey({
      description: "Practice-KG family key of the matter the contacts belong to.",
    }),
    addresses: S.Array(EmailString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Email addresses of the matter's contacts, normalized on decode.",
      }),
    domains: S.Array(MailDomain)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Lowercase sender domains associated with the matter's client.",
      }),
  },
  $I.annote("MatterContacts", {
    description: "Curated contact addresses and sender domains of one matter.",
  })
) {}

/**
 * JSON codec of the whole `matter-contacts.json` overlay: an array of
 * {@link MatterContacts}.
 *
 * **Example** (Guard a decoded overlay)
 *
 * ```ts
 * import { MatterContactsJson } from "@beep/law-practice-server/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MatterContactsJson)([])) // true
 * console.log(S.is(MatterContactsJson)([{ familyKey: "" }])) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MatterContactsJson = MatterContacts.pipe(
  S.Array,
  S.fromJsonString,
  $I.annoteSchema("MatterContactsJson", {
    description: "JSON document listing the curated contacts of every matter that has some.",
  })
);

/**
 * Runtime type for {@link MatterContactsJson}.
 *
 * @category models
 * @since 0.0.0
 */
export type MatterContactsJson = typeof MatterContactsJson.Type;

class MatterRow extends S.Class<MatterRow>($I`MatterRow`)(
  {
    familyKey: S.String,
    client: S.String.pipe(S.NullOr, S.optionalKey),
    epistemicStatus: PracticeKgEpistemicStatus,
  },
  $I.annote("MatterRow", {
    description: "The columns of the bundle's matters table the directory reads.",
  })
) {}

class MatterDocketRow extends S.Class<MatterDocketRow>($I`MatterDocketRow`)(
  {
    familyKey: S.String,
    docket: S.String,
    docketKey: S.String,
    applicationNumbers: S.String.pipe(S.NullOr, S.optionalKey),
    patentNumbers: S.String.pipe(S.NullOr, S.optionalKey),
  },
  $I.annote("MatterDocketRow", {
    description: "The columns of the bundle's matter_dockets table the directory reads.",
  })
) {}

const mattersSql = `
SELECT family_key AS "familyKey", client, epistemic_status AS "epistemicStatus"
FROM matters
ORDER BY family_key`;

const matterDocketsSql = `
SELECT family_key AS "familyKey", docket, docket_key AS "docketKey",
  array_to_string(application_numbers, '${listSeparator}') AS "applicationNumbers",
  array_to_string(patent_numbers, '${listSeparator}') AS "patentNumbers"
FROM matter_dockets
ORDER BY docket_key`;

const decodeMatterRows = S.decodeUnknownEffect(S.Array(MatterRow));
const decodeMatterDocketRows = S.decodeUnknownEffect(S.Array(MatterDocketRow));
const decodeContacts = S.decodeUnknownEffect(MatterContactsJson);
const decodeMatterKey = S.decodeUnknownOption(MatterKey);
const decodeClientKey = S.decodeUnknownOption(MatterClientKey);
const decodeDocketNumber = S.decodeUnknownOption(MatterDocketNumber);
const decodeApplicationNumber = S.decodeUnknownOption(UsptoNormalizedApplicationNumber);
const decodePatentNumber = S.decodeUnknownOption(PatentNumber);

type TaggableKeys = {
  readonly matterKey: MatterKey;
  readonly clientKey: MatterClientKey;
};

type Bundle = {
  readonly dockets: Record<string, ReadonlyArray<MatterDocketRow>>;
  readonly contacts: Record<string, MatterContacts>;
};

// A row may carry a list column as null, or not at all, when the list is empty.
const splitList = (value: string | null | undefined): ReadonlyArray<string> =>
  A.filter(A.flatMap(O.toArray(O.fromNullishOr(value)), Str.split(listSeparator)), Str.isNonEmpty);

// A value the domain schema rejects is dropped: one malformed number must not hide a matter.
const decoded =
  <Value>(decode: (input: unknown) => O.Option<Value>) =>
  (values: ReadonlyArray<string>): ReadonlyArray<Value> =>
    A.getSomes(A.map(A.dedupe(values), decode));

const mergedContacts = (existing: MatterContacts, next: MatterContacts): MatterContacts =>
  MatterContacts.make({
    familyKey: existing.familyKey,
    addresses: A.union(existing.addresses, next.addresses),
    domains: A.union(existing.domains, next.domains),
  });

const familyKeyOf = (row: { readonly familyKey: string }): string => row.familyKey;

const contactsByFamily = (rows: ReadonlyArray<MatterContacts>): Record<string, MatterContacts> =>
  R.map(A.groupBy(rows, familyKeyOf), (group) =>
    A.reduce(A.tailNonEmpty(group), A.headNonEmpty(group), mergedContacts)
  );

const identifiersOf = (bundle: Bundle, matter: MatterRow) => {
  const dockets = O.getOrElse(R.get(bundle.dockets, matter.familyKey), (): ReadonlyArray<MatterDocketRow> => []);
  return {
    docketNumbers: decoded(decodeDocketNumber)(A.flatMap(dockets, (docket) => [docket.docket, docket.docketKey])),
    applicationNumbers: decoded(decodeApplicationNumber)(
      A.flatMap(dockets, (docket) => splitList(docket.applicationNumbers))
    ),
    patentNumbers: decoded(decodePatentNumber)(A.flatMap(dockets, (docket) => splitList(docket.patentNumbers))),
  };
};

// D-11: a matter is a tag target only with a client number and a verified family.
const taggableKeys = (matter: MatterRow): O.Option<TaggableKeys> =>
  O.filter(
    O.all({
      matterKey: decodeMatterKey(matter.familyKey),
      clientKey: O.flatMap(O.fromNullishOr(matter.client), decodeClientKey),
    }),
    () => !PracticeKgEpistemicStatus.is["recycled-unverified"](matter.epistemicStatus)
  );

const entryOf =
  (bundle: Bundle) =>
  (matter: MatterRow): O.Option<MatterIndexEntry> =>
    O.map(taggableKeys(matter), (keys) =>
      MatterIndexEntry.make({
        ...keys,
        ...identifiersOf(bundle, matter),
        contactAddresses: A.flatMap(O.toArray(R.get(bundle.contacts, matter.familyKey)), (found) => found.addresses),
        contactDomains: A.flatMap(O.toArray(R.get(bundle.contacts, matter.familyKey)), (found) => found.domains),
      })
    );

const unattributedOf =
  (bundle: Bundle) =>
  (matter: MatterRow): UnattributedMatter =>
    UnattributedMatter.make({
      ...identifiersOf(bundle, matter),
      familyKeys: decoded(decodeDocketNumber)([matter.familyKey]),
    });

const indexOf = (bundle: Bundle, matters: ReadonlyArray<MatterRow>, builtAt: DateTime.Utc): MatterIndex =>
  MatterIndex.make({
    entries: A.getSomes(A.map(matters, entryOf(bundle))),
    unattributed: A.map(
      A.filter(matters, (matter) => O.isNone(taggableKeys(matter))),
      unattributedOf(bundle)
    ),
    builtAt,
  });

const unreadable = (table: string) => () =>
  MailTaggingPortError.during("MatterDirectory", "snapshot", `${table} table unreadable`);

const makeMatterDirectory = Effect.gen(function* () {
  const db = yield* DuckDb;
  const path = yield* Path.Path;
  const location = yield* MailTaggingStateLocation;
  const overlay = yield* makeStateFileAt("matter-contacts", path.join(location.stateDirectory, contactsFile));
  const contacts = yield* Effect.flatMap(
    overlay.read,
    O.match({
      onNone: () => Effect.succeed<ReadonlyArray<MatterContacts>>([]),
      onSome: (text) => Effect.mapError(decodeContacts(text), overlay.corrupt(O.none())),
    })
  );
  const byFamily = contactsByFamily(contacts);

  return MatterDirectoryShape.make({
    snapshot: Effect.gen(function* () {
      const matters = yield* db
        .query(mattersSql)
        .pipe(Effect.flatMap(decodeMatterRows), Effect.mapError(unreadable("matters")));
      const dockets = yield* db
        .query(matterDocketsSql)
        .pipe(Effect.flatMap(decodeMatterDocketRows), Effect.mapError(unreadable("matter_dockets")));
      const builtAt = yield* DateTime.now;
      return indexOf({ dockets: A.groupBy(dockets, familyKeyOf), contacts: byFamily }, matters, builtAt);
    }).pipe(Effect.withSpan("MatterDirectoryPracticeKg.snapshot")),
  });
});

/**
 * Layer providing the matter directory from a practice knowledge-graph bundle.
 *
 * **Details**
 *
 * `snapshot` reads the bundle's `matters` and `matter_dockets` tables through
 * the same `DuckDb` service the matter lookup uses, so the host opens the
 * bundle once, read-only. A matter is taggable only when it has a client
 * number and its epistemic status is not `recycled-unverified`; its entry
 * carries the family key as the matter key, and every docket code and
 * client-keyed docket key, application number, and patent number of its
 * dockets. Every other matter becomes an unattributed identifier set that
 * also carries its family key, so a reference to it goes to the attorney.
 * A value the domain schemas reject, such as an application number that is
 * not eight digits, is dropped; the matter stays.
 *
 * The two queries name the columns they read, so a column the bundle adds,
 * such as `client_name`, is never selected. A row whose `client` is null, or
 * that arrives without the key, is an unattributed matter, not a failure.
 *
 * Contacts come from `matter-contacts.json` in the state directory, read once
 * when the layer is built: an array of {@link MatterContacts}. A missing file
 * means no matter has contacts. A file that does not decode fails the layer
 * with a `MailTaggingStateError`; nothing is tagged from a half-read overlay.
 *
 * **Gotchas**
 *
 * Build the layer once per run. The overlay is not re-read by `snapshot`, so
 * a long-lived process that keeps one instance would miss an edit to it.
 *
 * **Example** (Wire the directory over a bundle)
 *
 * ```ts
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import {
 *   MailTaggingStateConfig,
 *   MailTaggingStateLocation,
 *   MatterDirectoryPracticeKg
 * } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Directory = MatterDirectoryPracticeKg.pipe(
 *   Layer.provide(
 *     Layer.merge(
 *       DuckDb.makeNodeLayer(
 *         DuckDbConnectionOptions.make({
 *           databaseOptions: { access_mode: "READ_ONLY" },
 *           databasePath: "bundle/practice.duckdb"
 *         })
 *       ),
 *       Layer.succeed(
 *         MailTaggingStateLocation,
 *         MailTaggingStateConfig.make({ stateDirectory: "state/practice-mail-tagging" })
 *       )
 *     )
 *   )
 * )
 * console.log(Layer.isLayer(Directory)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MatterDirectoryPracticeKg: Layer.Layer<
  MatterDirectory,
  MailTaggingStateError,
  DuckDb | MailTaggingStateLocation | FileSystem.FileSystem | Path.Path
> = Layer.effect(MatterDirectory, makeMatterDirectory);
