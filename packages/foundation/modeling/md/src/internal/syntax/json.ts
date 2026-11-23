/**
 * JSON projection for decoded frontmatter values.
 *
 * YAML and TOML engines return values JSON cannot carry: TOML date-times are
 * class instances, big integers are `bigint`, and both formats spell
 * non-finite numbers. `Md.Document.frontmatter` is a `JsonObject`, so the
 * bridge projects each decoded value into JSON and records every value it had
 * to change as a coercion addressed by an RFC 6901 JSON pointer.
 *
 * @since 0.0.0
 */

import { $MdId } from "@beep/identity/packages";
import * as A from "@beep/utils/Array";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $MdId.create("internal/syntax/json");

/**
 * One value the projection had to change, addressed by a JSON pointer into the
 * projected frontmatter.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class JsonCoercion extends S.Opaque<JsonCoercion, { readonly brand: unique symbol }>()(
  S.Struct({
    pointer: S.String.pipe(
      $I.annoteKey("JsonCoercion.pointer", { description: "RFC 6901 pointer to the changed value." })
    ),
    detail: S.String.pipe($I.annoteKey("JsonCoercion.detail", { description: "What the projection changed." })),
  }).pipe(
    $I.annoteSchema("JsonCoercion", {
      description: "One frontmatter value the JSON projection had to change.",
    })
  )
) {}

/**
 * The projected value (`None` when the value had no JSON form and was dropped)
 * and the coercions made on the way.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class JsonProjection extends S.Opaque<JsonProjection, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.Option(S.Json).pipe(
      $I.annoteKey("JsonProjection.value", { description: "The projected JSON value, or None when it was dropped." })
    ),
    coercions: S.Array(JsonCoercion).pipe(
      $I.annoteKey("JsonProjection.coercions", { description: "Every value the projection changed." })
    ),
  }).pipe(
    $I.annoteSchema("JsonProjection", {
      description: "A frontmatter value projected into JSON with its coercions.",
    })
  )
) {}

const escapePointerToken: (token: string) => string = flow(Str.replaceAll("~", "~0"), Str.replaceAll("/", "~1"));

const childPointer = (pointer: string, token: string | number): string =>
  `${pointer}/${P.isNumber(token) ? `${token}` : escapePointerToken(token)}`;

const isPlainRecord = (value: object): value is Readonly<Record<string, unknown>> => {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
};

const hasOwnToString = (value: object): boolean => value.toString !== Object.prototype.toString;

const describe = (value: unknown): string =>
  P.isObjectOrArray(value) ? (value.constructor?.name ?? "object") : typeof value;

const coerced = (
  out: Array<JsonCoercion>,
  pointer: string,
  detail: string,
  value: O.Option<S.Json>
): O.Option<S.Json> => {
  out.push(JsonCoercion.make({ pointer, detail }));
  return value;
};

const projectBigInt = (value: bigint, pointer: string, out: Array<JsonCoercion>): O.Option<S.Json> => {
  const number = Number(value);
  return Number.isSafeInteger(number)
    ? O.some(number)
    : coerced(out, pointer, "bigint outside the safe integer range became its decimal string", O.some(`${value}`));
};

const projectNumber = (value: number, pointer: string, out: Array<JsonCoercion>): O.Option<S.Json> =>
  Number.isFinite(value) ? O.some(value) : coerced(out, pointer, `non-finite number ${value} was dropped`, O.none());

const projectDate = (value: Date, pointer: string, out: Array<JsonCoercion>): O.Option<S.Json> =>
  Number.isNaN(value.getTime())
    ? coerced(out, pointer, "invalid Date was dropped", O.none())
    : coerced(out, pointer, "Date became its ISO 8601 string", O.some(value.toISOString()));

const projectArray = (value: ReadonlyArray<unknown>, pointer: string, out: Array<JsonCoercion>): S.Json =>
  A.map(value, (item, index) => {
    const itemPointer = childPointer(pointer, index);
    const coercionsBeforeDroppedLeafElement = out.length;
    return O.getOrElse(project(item, itemPointer, out), () => {
      out.length = coercionsBeforeDroppedLeafElement;
      out.push(JsonCoercion.make({ pointer: itemPointer, detail: "array element without a JSON form became null" }));
      return null;
    });
  });

const projectRecord = (
  value: Readonly<Record<string, unknown>>,
  pointer: string,
  out: Array<JsonCoercion>
): S.JsonObject => R.getSomes(R.map(value, (item, key) => project(item, childPointer(pointer, key), out)));

const projectObject = (value: object, pointer: string, out: Array<JsonCoercion>): O.Option<S.Json> => {
  if (A.isArray(value)) {
    return O.some(projectArray(value, pointer, out));
  }
  if (value instanceof Date) {
    return projectDate(value, pointer, out);
  }
  if (isPlainRecord(value)) {
    return O.some(projectRecord(value, pointer, out));
  }
  return hasOwnToString(value)
    ? coerced(out, pointer, `${describe(value)} became its string form`, O.some(`${value}`))
    : coerced(out, pointer, `${describe(value)} without a JSON form was dropped`, O.none());
};

const project = (value: unknown, pointer: string, out: Array<JsonCoercion>): O.Option<S.Json> => {
  if (P.isNull(value) || P.isString(value) || P.isBoolean(value)) {
    return O.some(value);
  }
  if (P.isNumber(value)) {
    return projectNumber(value, pointer, out);
  }
  if (P.isBigInt(value)) {
    return projectBigInt(value, pointer, out);
  }
  if (P.isObjectOrArray(value)) {
    return projectObject(value, pointer, out);
  }
  return coerced(out, pointer, `${describe(value)} without a JSON form was dropped`, O.none());
};

/**
 * Project a decoded frontmatter value into JSON, recording every coercion.
 *
 * @internal
 * @category mapping
 * @since 0.0.0
 */
export const projectJson = (value: unknown): JsonProjection => {
  const coercions: Array<JsonCoercion> = [];
  const projected = project(value, "", coercions);
  return JsonProjection.make({ value: projected, coercions });
};

/**
 * Whether a projected JSON value is a JSON object (not an array or scalar).
 *
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const isJsonObject = (value: S.Json): value is S.JsonObject => P.isObject(value);
