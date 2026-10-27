/**
 * Runtime builders shared by `LiteralKit` and `MappedLiteralKit`: helper-key
 * derivation, keyed record construction, dispatch, and static attachment.
 *
 * **Details**
 *
 * Every builder takes the literal tuple and the keys derived from it once, so a
 * kit computes each key one time at construction instead of once per helper.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { A, R } from "@beep/utils";
import { identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import { LiteralKitKeyCollisionError, LiteralKitUnhandledCaseError } from "../LiteralKit.errors.ts";
import type * as S from "effect/Schema";
import type * as SchemaAST from "effect/SchemaAST";

type LiteralValue = SchemaAST.LiteralValue;
type Literals = A.NonEmptyReadonlyArray<LiteralValue>;
type Keys = A.NonEmptyReadonlyArray<string>;
type Handler = (value: LiteralValue) => unknown;
type Cases = Record<string, Handler>;
type Dispatcher = (...args: ReadonlyArray<unknown>) => unknown;

const literalKeyByType: Readonly<Record<string, (literal: LiteralValue) => string>> = {
  boolean: (literal) => (literal === true ? "true" : "false"),
  bigint: (literal) => `bigint${literal}n`,
  number: (literal) => `number${literal}`,
  string: String,
};

/**
 * Derives the helper key of one literal: strings as-is, `number200`,
 * `bigint1n`, `true` / `false`.
 *
 * **Details**
 *
 * A record keyed by `typeof` rather than an `effect/Match` pipeline: this runs
 * on every dispatch, and the four entries are the closed `LiteralValue` union,
 * so one property lookup replaces a matcher's allocation and type cost. A value
 * outside the union (a cast, `undefined`, `null`) falls back to `String` here;
 * dispatch never keys such a value, so it always reaches the miss path.
 *
 * **Example** (Derive helper keys)
 *
 * ```ts
 * import { literalKey } from "@beep/schema/LiteralKit/internal/builders"
 *
 * console.log([literalKey("draft"), literalKey(200), literalKey(true), literalKey(BigInt(1))])
 * // ["draft", "number200", "true", "bigint1n"]
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const literalKey = (literal: LiteralValue): string => (literalKeyByType[typeof literal] ?? String)(literal);

/**
 * Derives the helper keys of a literal tuple, in tuple order.
 *
 * **Example** (Derive a tuple's keys)
 *
 * ```ts
 * import { deriveKeys } from "@beep/schema/LiteralKit/internal/builders"
 *
 * console.log(deriveKeys(["ok", 404])) // ["ok", "number404"]
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const deriveKeys = (literals: Literals): Keys => A.map(literals, literalKey);

const unhandled = (literals: Literals, key: string, value: LiteralValue): never => {
  throw LiteralKitUnhandledCaseError.make({ key: String(key), value, literals });
};

/**
 * Dispatches `value` to its case by helper key, through an own-property lookup
 * so prototype members never match. A miss goes to `orElse` when present and
 * otherwise throws {@link LiteralKitUnhandledCaseError}.
 */
// The hit path is one own-property check and one call; `orElse` is consulted
// only on a miss, so a total `match` allocates nothing per dispatch.
const dispatch = (literals: Literals, cases: Cases, value: LiteralValue, orElse: O.Option<Handler>): unknown => {
  // Only a value of a literal type is keyed: `String(null)` is `"null"`, which
  // could otherwise reach a `"null"` member's case.
  const keyer = literalKeyByType[typeof value];
  const key = keyer === undefined ? String(value) : keyer(value);
  if (keyer !== undefined && R.has(cases, key)) {
    return cases[key]!(value);
  }
  return O.match(orElse, { onNone: () => unhandled(literals, key, value), onSome: (fallback) => fallback(value) });
};

/**
 * The runtime `match` function: `(cases)` returns a dispatcher, `(value, cases)`
 * dispatches at once. Exhaustiveness is a property of its type; a miss throws.
 *
 * **Example** (Dispatch through an untyped matcher)
 *
 * ```ts
 * import { makeMatch } from "@beep/schema/LiteralKit/internal/builders"
 *
 * const match = makeMatch(["on", "off"])
 * console.log(match("on", { on: () => 1, off: () => 0 })) // 1
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const makeMatch = (literals: Literals): Dispatcher =>
  function match(...args: ReadonlyArray<unknown>): unknown {
    if (args.length === 1) {
      const cases = args[0] as Cases;
      return (value: LiteralValue) => dispatch(literals, cases, value, O.none());
    }
    return dispatch(literals, args[1] as Cases, args[0] as LiteralValue, O.none());
  };

/**
 * The runtime `matchOrElse` function: `(cases, orElse)` returns a dispatcher,
 * `(value, cases, orElse)` dispatches at once. The fallback receives every
 * member without a case.
 *
 * **Example** (Fall back for unhandled members)
 *
 * ```ts
 * import { makeMatchOrElse } from "@beep/schema/LiteralKit/internal/builders"
 *
 * const matchOrElse = makeMatchOrElse(["on", "off", "auto"])
 * console.log(matchOrElse("auto", { on: () => 1 }, () => -1)) // -1
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const makeMatchOrElse = (literals: Literals): Dispatcher =>
  function matchOrElse(...args: ReadonlyArray<unknown>): unknown {
    if (args.length === 2) {
      const cases = args[0] as Cases;
      const orElse = O.some(args[1] as Handler);
      return (value: LiteralValue) => dispatch(literals, cases, value, orElse);
    }
    return dispatch(literals, args[1] as Cases, args[0] as LiteralValue, O.some(args[2] as Handler));
  };

/**
 * Multi-argument builders, grouped as methods so each has one call shape.
 *
 * **Example** (Build an enum record)
 *
 * ```ts
 * import { deriveKeys, literalKitBuilders } from "@beep/schema/LiteralKit/internal/builders"
 *
 * console.log(literalKitBuilders.enum(["ok", 404], deriveKeys(["ok", 404]))) // { ok: "ok", number404: 404 }
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const literalKitBuilders = {
  /**
   * Throws {@link LiteralKitKeyCollisionError} when two distinct literals
   * derive the same helper key. A repeated identical literal maps the key to
   * the same value and is allowed, so kits composed from overlapping literal
   * lists stay valid.
   */
  assertUniqueHelperKeys(literals: Literals, keys: Keys): void {
    A.reduce(
      A.zip(keys, literals),
      HashMap.empty<string, LiteralValue>(),
      (seen, [key, literal]: readonly [string, LiteralValue]) => {
        const existing = HashMap.get(seen, key);
        if (O.isSome(existing) && !Object.is(existing.value, literal)) {
          throw LiteralKitKeyCollisionError.make({ key, existing: existing.value, incoming: literal });
        }
        return HashMap.set(seen, key, literal);
      }
    );
  },

  /**
   * Builds one record keyed by helper key in a single pass.
   */
  keyed<V>(literals: Literals, keys: Keys, value: (literal: LiteralValue) => V): Record<string, V> {
    return R.fromEntries(A.zipWith(keys, literals, (key, literal) => [key, value(literal)] as const));
  },

  /**
   * The `Enum` record: helper key to the literal itself.
   */
  enum(literals: Literals, keys: Keys): Record<string, LiteralValue> {
    return this.keyed(literals, keys, identity);
  },

  /**
   * The `is` record: helper key to a strict-equality guard for that literal.
   */
  guards(literals: Literals, keys: Keys): Record<string, (input: unknown) => boolean> {
    return this.keyed(literals, keys, (literal) => (input: unknown) => input === literal);
  },

  /**
   * Attaches `makeStatics(schema)` to `schema` as readonly, non-configurable
   * properties and overrides `rebuild` so every derivation re-attaches them.
   *
   * Upstream `annotate`, `annotateKey` and `check` all return
   * `this.rebuild(ast)`, so this one override keeps the helpers on whatever
   * upstream returns. Each static is defined with an explicit readonly,
   * non-configurable descriptor.
   */
  attachStatics<T extends S.Top, Statics extends Record<string, unknown>>(
    schema: T,
    makeStatics: (schema: T) => Statics
  ): T & Statics {
    const upstreamRebuild: (ast: SchemaAST.AST) => S.Top = schema.rebuild;
    const installed = Object.defineProperties(
      schema,
      R.map(
        makeStatics(schema),
        (value): PropertyDescriptor => ({
          value,
          enumerable: true,
          writable: false,
          configurable: false,
        })
      )
    ) as T & Statics;
    const reattach = (rebuilt: S.Top): S.Top => this.attachStatics(rebuilt as T, makeStatics);
    Object.defineProperty(installed, "rebuild", {
      value(this: S.Top, ast: SchemaAST.AST): S.Top {
        return reattach(upstreamRebuild.call(this, ast));
      },
      enumerable: false,
      writable: false,
      configurable: true,
    });
    return installed;
  },
};
