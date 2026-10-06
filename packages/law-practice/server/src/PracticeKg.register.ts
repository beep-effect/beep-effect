/**
 * The attorney's docket register as a practice knowledge-graph build input:
 * row schema, JSONL reader, and the two lookups the build derives from it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, HashSet, MutableHashMap, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("PracticeKg.register");

/**
 * One row of the attorney's docket register.
 *
 * **Details**
 *
 * The register is converted to JSONL outside the repo, one object per line.
 * `client` is the practice's client number, `docket` the full docket code
 * without a client prefix, and `clientName` the client's name as the register
 * writes it. `clientName` is null, or absent, when the register row carries
 * none.
 *
 * **Example** (Decode a register row)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PracticeKgDocketRegisterRow } from "../../src/PracticeKg.register.ts"
 *
 * const row = S.decodeUnknownSync(PracticeKgDocketRegisterRow)({
 *   client: "12345",
 *   clientName: "Example Client",
 *   docket: "10008US01"
 * })
 *
 * console.log(row.clientName) // "Example Client"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgDocketRegisterRow extends S.Class<PracticeKgDocketRegisterRow>($I`PracticeKgDocketRegisterRow`)(
  {
    client: S.NonEmptyString,
    clientName: S.NullOr(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(null)),
      S.withDecodingDefaultTypeKey(Effect.succeed(null))
    ),
    docket: S.NonEmptyString,
  },
  $I.annote("PracticeKgDocketRegisterRow", {
    description: "Client number, docket code, and client name from one row of the attorney's docket register.",
  })
) {}

/**
 * Failure reading the docket register file.
 *
 * **Details**
 *
 * `lineNumber` is the one-based line that failed to decode and is absent when
 * the file itself could not be read. The message never quotes the line: the
 * register is client material.
 *
 * **Gotchas**
 *
 * The field is not called `line`: Bun's errors already carry a numeric `line`
 * property of their own, which would shadow an absent one.
 *
 * **Example** (Make a register error)
 *
 * ```ts
 * import { PracticeKgDocketRegisterError } from "../../src/PracticeKg.register.ts"
 *
 * const error = PracticeKgDocketRegisterError.make({
 *   lineNumber: 3,
 *   message: 'Docket register "/corpus/register.jsonl" line 3 is not a valid register row.',
 *   path: "/corpus/register.jsonl"
 * })
 *
 * console.log(error._tag) // "PracticeKgDocketRegisterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgDocketRegisterError extends S.TaggedError<PracticeKgDocketRegisterError>(
  $I`PracticeKgDocketRegisterError`
)(
  "PracticeKgDocketRegisterError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    lineNumber: S.optionalKey(S.Finite),
    message: S.NonEmptyString,
    path: S.String,
  },
  $I.annoteError<PracticeKgDocketRegisterError>("PracticeKgDocketRegisterError", {
    description: "Failure while reading or decoding the attorney's docket register JSONL file.",
  })
) {}

const decodeRegisterLine = S.decodeUnknownEffect(S.fromJsonString(PracticeKgDocketRegisterRow));
const lineBreakPattern = /\r?\n/u;

/**
 * Read the docket register JSONL file.
 *
 * **Details**
 *
 * Blank lines are skipped. Every other line must be one JSON object that
 * decodes as a {@link PracticeKgDocketRegisterRow}; the first line that does
 * not fails the read with its line number. Rows come back in file order.
 *
 * **Example** (Read a register file)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { readPracticeKgDocketRegister } from "../../src/PracticeKg.register.ts"
 *
 * const rows = readPracticeKgDocketRegister("/corpus/incoming/docket-register.jsonl")
 *
 * console.log(Effect.isEffect(rows)) // true
 * ```
 *
 * @param path - JSONL file with one register row per line.
 * @returns Decoded register rows in file order.
 * @effects Reads the file through the ambient filesystem.
 * @category use-cases
 * @since 0.0.0
 */
export const readPracticeKgDocketRegister = Effect.fn("PracticeKg.readDocketRegister")(function* (
  path: string
): Effect.fn.Return<ReadonlyArray<PracticeKgDocketRegisterRow>, PracticeKgDocketRegisterError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(path).pipe(
    Effect.mapError((cause) =>
      PracticeKgDocketRegisterError.make({
        cause,
        message: `Failed reading docket register "${path}".`,
        path,
      })
    )
  );
  const numbered = A.filter(
    A.map(Str.split(text, lineBreakPattern), (content, index) => ({ content, lineNumber: index + 1 })),
    ({ content }) => Str.isNonEmpty(Str.trim(content))
  );
  return yield* Effect.forEach(numbered, ({ content, lineNumber }) =>
    decodeRegisterLine(content).pipe(
      Effect.mapError((cause) =>
        PracticeKgDocketRegisterError.make({
          cause,
          lineNumber,
          message: `Docket register "${path}" line ${lineNumber} is not a valid register row.`,
          path,
        })
      )
    )
  );
});

const addTo = (
  map: MutableHashMap.MutableHashMap<string, HashSet.HashSet<string>>,
  key: string,
  value: string
): void => {
  MutableHashMap.set(
    map,
    key,
    HashSet.add(
      pipe(
        MutableHashMap.get(map, key),
        O.getOrElse(() => HashSet.empty<string>())
      ),
      value
    )
  );
};

const soleMember = (values: HashSet.HashSet<string>): O.Option<string> =>
  pipe(A.fromIterable(values), (members) => (A.length(members) === 1 ? A.head(members) : O.none()));

const soleValueLookup =
  (map: MutableHashMap.MutableHashMap<string, HashSet.HashSet<string>>) =>
  (key: string): O.Option<string> =>
    pipe(MutableHashMap.get(map, key), O.flatMap(soleMember));

/**
 * Index the register by docket: which single client it lists for a docket.
 *
 * **Details**
 *
 * Docket codes compare upper-cased and trimmed. The lookup answers only when
 * the register lists exactly one client number for the docket; a docket listed
 * under two clients is ambiguous and answers none.
 *
 * **Example** (Look up a docket's client)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { PracticeKgDocketRegisterRow, practiceKgRegisterDocketClients } from "../../src/PracticeKg.register.ts"
 *
 * const clientOf = practiceKgRegisterDocketClients([
 *   PracticeKgDocketRegisterRow.make({ client: "12345", docket: "10008US01" })
 * ])
 *
 * console.log(O.getOrNull(clientOf("10008us01"))) // "12345"
 * ```
 *
 * @param rows - Register rows.
 * @returns Lookup from a docket code to its only listed client.
 * @category use-cases
 * @since 0.0.0
 */
export const practiceKgRegisterDocketClients = (
  rows: ReadonlyArray<PracticeKgDocketRegisterRow>
): ((docket: string) => O.Option<string>) => {
  const clients = MutableHashMap.empty<string, HashSet.HashSet<string>>();
  A.forEach(rows, (row) => addTo(clients, Str.toUpperCase(Str.trim(row.docket)), Str.trim(row.client)));
  const lookup = soleValueLookup(clients);
  return (docket) => lookup(Str.toUpperCase(Str.trim(docket)));
};

/**
 * Index the register by client number: the one name it gives that client.
 *
 * **Details**
 *
 * Names compare trimmed. The lookup answers only when every register row that
 * names the client agrees; a client listed under two names, or never named,
 * answers none so the build writes no name instead of guessing.
 *
 * **Example** (Look up a client's name)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { PracticeKgDocketRegisterRow, practiceKgRegisterClientNames } from "../../src/PracticeKg.register.ts"
 *
 * const nameOf = practiceKgRegisterClientNames([
 *   PracticeKgDocketRegisterRow.make({ client: "12345", clientName: "Example Client", docket: "10008US01" })
 * ])
 *
 * console.log(O.getOrNull(nameOf("12345"))) // "Example Client"
 * ```
 *
 * @param rows - Register rows.
 * @returns Lookup from a client number to its only listed name.
 * @category use-cases
 * @since 0.0.0
 */
export const practiceKgRegisterClientNames = (
  rows: ReadonlyArray<PracticeKgDocketRegisterRow>
): ((client: string) => O.Option<string>) => {
  const names = MutableHashMap.empty<string, HashSet.HashSet<string>>();
  const named = A.getSomes(
    A.map(rows, (row) =>
      pipe(
        O.fromNullishOr(row.clientName),
        O.map(Str.trim),
        O.filter(Str.isNonEmpty),
        O.map((name) => [Str.trim(row.client), name] as const)
      )
    )
  );
  A.forEach(named, ([client, name]) => addTo(names, client, name));
  return soleValueLookup(names);
};
