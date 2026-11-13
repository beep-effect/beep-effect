/**
 * The one table from a type tag to the codec of its values, for the tags every universe reads alike.
 *
 * **Details**
 *
 * Foundry describes data in several type universes (property types, action
 * parameter types, the data types of struct fields, query data types, agent
 * data types) that reuse the same tags. For most leaf tags the value is the
 * same thing in all of them. {@link sharedCodec} states those rows once: each
 * universe's projection from a type to a codec spreads this table, adds the
 * rows only it has, and reads a leaf type by indexing with its tag. A tag with
 * no row and no handler is then a compile error in that projection, and the
 * question "is a `date` read the same way here as there" has one answer by
 * construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Struct from "effect/Struct";
import { CipherText } from "../CipherText/CipherText.model.ts";
import { SharedValueKind } from "../DataType/DataType.values.ts";
import { GeoJsonObject } from "../Geo/Geo.model.ts";
import { MediaReference } from "../Media/Media.model.ts";
import {
  BinaryValue,
  BooleanValue,
  ByteValue,
  DateValue,
  DecimalValue,
  DoubleValue,
  FloatValue,
  IntegerValue,
  LongValue,
  MarkingValue,
  ShortValue,
  StringValue,
  TimestampValue,
} from "./Value.model.ts";

/**
 * The codec of one value of each shared tag: wire JSON on the encoded side, domain value on the type side.
 *
 * **Details**
 *
 * The keys are exactly the tags of `SharedValueKind`: the table is its rows
 * picked by that kit, so a tag of the kit without a row does not compile and a
 * row whose tag the kit does not have is not in the table. Each key keeps the
 * type of its own codec, so `sharedCodec.long` is statically the codec of a
 * `bigint` and the typed specs of `Model` recover their value types from it by
 * indexed access.
 *
 * A universe reads a tag that is not here with a row of its own. `attachment`
 * is one: a property holds a reference record, an argument the identifier.
 *
 * **Gotchas**
 *
 * `decimal` ignores the precision and scale its type may state: `BigDecimal`
 * carries its own scale, and the platform's rounding rule is not pinned down.
 *
 * **Example** (Read a row and keep its type)
 *
 * ```ts import.meta.vitest name="Read a row and keep its type"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { sharedCodec } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const badge = await Effect.runPromise(S.decodeEffect(sharedCodec.long)("9007199254740993"))
 * const wire = await Effect.runPromise(S.encodeEffect(sharedCodec.long)(badge + BigInt(1)))
 * wire // => "9007199254740994"
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const sharedCodec = Struct.pick(
  {
    boolean: BooleanValue,
    byte: ByteValue,
    short: ShortValue,
    integer: IntegerValue,
    long: LongValue,
    float: FloatValue,
    double: DoubleValue,
    // crispen: precision and scale are not yet enforced on values; BigDecimal carries its own scale,
    // so a scale check can be added here once the platform's rounding rule is pinned down.
    decimal: DecimalValue,
    string: StringValue,
    date: DateValue,
    timestamp: TimestampValue,
    binary: BinaryValue,
    marking: MarkingValue,
    cipherText: CipherText,
    mediaReference: MediaReference,
    geoshape: GeoJsonObject,
  },
  SharedValueKind.literals
);
