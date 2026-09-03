/**
 * Shared Apache Tika response parsing and metadata stringification.
 *
 * The tika-app `-J -t` stdout payload and the Tika Server `PUT /rmeta/text`
 * response body share one wire shape — a JSON array of metadata records
 * carrying the extracted text under `X-TIKA:content` — so both engines decode
 * through this module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TikaId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import { Effect } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { makeTikaError } from "./Tika.errors.ts";
import type { TikaError } from "./Tika.errors.ts";

const $I = $TikaId.create("Tika.response");

const tikaContentKey = "X-TIKA:content";

/**
 * Trim-normalized text emitted from Apache Tika JSON content.
 *
 * **Example** (Create from unknown string)
 *
 * ```ts
 * import { TikaContentText } from "@beep/tika"
 *
 * const text = TikaContentText.decodeUnknownSync("  hello corpus\n")
 * console.log(text) // "hello corpus"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TikaContentText = S.Trim.pipe(
  $I.annoteSchema("TikaContentText", {
    description: "Trim-normalized text emitted from the Apache Tika JSON content field.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownOption", "decodeUnknownSync"])
);

/**
 * Type for {@link TikaContentText}.
 *
 * **Example** (Annotate typed content text)
 *
 * ```ts
 * import type { TikaContentText } from "@beep/tika"
 *
 * const text: TikaContentText = "hello corpus"
 * console.log(text)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type TikaContentText = typeof TikaContentText.Type;

const decodeTikaJsonRows = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.Record(S.String, S.Unknown))));

const metadataValueToString = (value: unknown): O.Option<string> => {
  if (P.isString(value)) {
    return O.some(value);
  }
  if (A.isArray(value)) {
    const strings = A.filter(value, P.isString);
    return A.length(strings) === 0 ? O.none() : O.some(A.join(strings, "; "));
  }
  if (P.isNumber(value) || P.isBoolean(value)) {
    return O.some(`${value}`);
  }
  return O.none();
};

/**
 * Decode the first metadata record from an Apache Tika JSON payload.
 *
 * **Example** (Decode JSON metadata array)
 *
 * ```ts
 * import { decodeTikaResponseRecord } from "@beep/tika"
 * import { Effect } from "effect"
 *
 * const program = decodeTikaResponseRecord('[{"Content-Type":"text/plain"}]')
 *
 * Effect.runPromise(program).then((record) => console.log(record["Content-Type"])) // "text/plain"
 * ```
 *
 * @effects Fails with a `response-decoding` {@link TikaError} when the payload is not a JSON array of records or is empty.
 * @category combinators
 * @since 0.0.0
 */
export const decodeTikaResponseRecord = (
  payload: string
): Effect.Effect<Readonly<Record<string, unknown>>, TikaError> =>
  decodeTikaJsonRows(payload).pipe(
    Effect.mapError(() => makeTikaError("response-decoding")),
    Effect.flatMap((rows) =>
      A.head(rows).pipe(Effect.fromOption(() => makeTikaError("response-decoding", { cause: "empty tika -J array" })))
    )
  );

/**
 * Stringify an Apache Tika metadata record, dropping the extracted-text key.
 *
 * **Details**
 *
 * String values pass through, string arrays join with `"; "`, numbers and
 * booleans stringify, and every other value is dropped.
 *
 * **Example** (Stringify metadata record values)
 *
 * ```ts
 * import { stringifyTikaMetadata } from "@beep/tika"
 *
 * const metadata = stringifyTikaMetadata({
 *   "Content-Type": "text/plain",
 *   "X-TIKA:Parsed-By": ["CompositeParser", "TXTParser"],
 *   "X-TIKA:content": "hello"
 * })
 * console.log(metadata["X-TIKA:Parsed-By"]) // "CompositeParser; TXTParser"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const stringifyTikaMetadata = (record: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> =>
  R.getSomes(R.map(R.remove(record, tikaContentKey), metadataValueToString));

/**
 * Read the trim-normalized extracted text from an Apache Tika metadata record.
 *
 * **Example** (Read content from metadata)
 *
 * ```ts
 * import { readTikaContentText } from "@beep/tika"
 * import { O } from "@beep/utils"
 *
 * const text = readTikaContentText({ "X-TIKA:content": "\n  hello corpus\n" })
 * console.log(O.getOrElse(text, () => "")) // "hello corpus"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const readTikaContentText = (record: Readonly<Record<string, unknown>>): O.Option<TikaContentText> =>
  O.fromUndefinedOr(record[tikaContentKey]).pipe(O.flatMap(TikaContentText.decodeUnknownOption));

// Output-budget arithmetic lives with its only consumer in `Tika.server.ts`;
// the tika-app engine declares no budget, so it is not a shared response concern.
