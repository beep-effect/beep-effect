/**
 * The failure signature: a short stable hash over the error name, the
 * assertion shape, the top frame's function and a location bucket, so the
 * same failure keeps its signature when unrelated code moves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fnv1a64Hex } from "./internal/fnv.ts";
import { optionalSlot } from "./internal/slots.ts";
import { Count, Position } from "./Scalars.ts";

const $I = $GateReportId.create("FailureSignature");

const ASSERTION =
  /(toBe|toEqual|toContain|toMatch|toThrow|toBeNull|toBeUndefined|toBeTruthy|toBeFalsy|toBeGreaterThan|toBeLessThan|toBeInstanceOf|toBeCloseTo|toHaveBeenCalled|toHaveBeenCalledWith|toHaveProperty|toHaveLength)\s*\(([^)]*)\)/u;

const TYPE_TAGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\d+(\.\d+)?$/u, "<number>"],
  [/^["'`]/u, "<string>"],
  [/^(true|false)$/u, "<boolean>"],
  [/^null$/u, "<null>"],
  [/^undefined$/u, "<undefined>"],
  [/^[{[]/u, "<object>"],
];

const typeTagOf = (literal: string): string => {
  const trimmed = Str.trim(literal);
  return trimmed === ""
    ? ""
    : pipe(
        A.findFirst(TYPE_TAGS, ([pattern]) => pattern.test(trimmed)),
        O.map(([, tag]) => tag),
        O.getOrElse(() => "<expr>")
      );
};

/**
 * The shape of an assertion message: the matcher name and a type tag for its
 * argument, or `None` when the message names no known matcher.
 *
 * **Example** (Normalize an assertion)
 *
 * ```ts
 * import { normalizeAssertionShape } from "@beep/gate-report/FailureSignature";
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrNull(normalizeAssertionShape("expect(x).toBe(42)"))); // toBe(<number>)
 * console.log(O.isNone(normalizeAssertionShape("not an assertion"))); // true
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const normalizeAssertionShape = (message: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(ASSERTION.exec(message)),
    O.map((match) => {
      const tag = typeTagOf(match[2] ?? "");
      const matcher = match[1] ?? "";
      return tag === "" ? matcher : `${matcher}(${tag})`;
    })
  );

/**
 * What a failure signature is computed over.
 *
 * **Details**
 *
 * `functionBoundaryLine` is the line of the enclosing function's start when
 * an adapter can find it; the model takes no parser dependency, so it never
 * computes one. Without it the raw line is bucketed to tens; without either
 * the location is unknown.
 *
 * **Example** (Build an input)
 *
 * ```ts
 * import { FailureSignatureInput } from "@beep/gate-report/FailureSignature";
 *
 * const input = FailureSignatureInput.make({ errorName: "AssertionError", assertionMessage: "expect(x).toBe(5)", topFrameFunction: "f" });
 * console.log(input.errorName); // AssertionError
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FailureSignatureInput extends S.Opaque<FailureSignatureInput, { readonly brand: unique symbol }>()(
  S.Struct({
    errorName: S.String,
    assertionMessage: S.String,
    topFrameFunction: S.String,
    functionBoundaryLine: optionalSlot(Position),
    rawLine: optionalSlot(Count),
  }).pipe(
    $I.annoteSchema("FailureSignatureInput", {
      description: "The error name, assertion message, top frame function and line a failure signature hashes.",
    })
  )
) {}

const lineCoordinate = (input: FailureSignatureInput): string =>
  pipe(
    input.functionBoundaryLine,
    O.map((line) => `fb:${line}`),
    O.orElse(() => O.map(input.rawLine, (line) => `raw:${Math.floor(line / 10) * 10}`)),
    O.getOrElse(() => "raw:?")
  );

/**
 * The failure signature: 16 hex digits over the error name, the assertion
 * shape, the top frame's function and the location bucket.
 *
 * **Example** (Sign two drifted failures)
 *
 * ```ts
 * import { FailureSignatureInput, failureSignature } from "@beep/gate-report/FailureSignature";
 * import * as O from "effect/Option";
 *
 * const at = (line: number) =>
 *   failureSignature(FailureSignatureInput.make({
 *     errorName: "AssertionError", assertionMessage: "expect(x).toBe(5)", topFrameFunction: "f", rawLine: O.some(line),
 *   }));
 * console.log(at(47) === at(49)); // true
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const failureSignature = (input: FailureSignatureInput): string => {
  const shape = O.getOrElse(normalizeAssertionShape(input.assertionMessage), () => "<unknown>");
  return fnv1a64Hex(`${input.errorName}|${shape}|${input.topFrameFunction}|${lineCoordinate(input)}`);
};
