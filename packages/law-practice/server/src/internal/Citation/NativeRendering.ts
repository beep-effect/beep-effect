/** Capture existing Unicode, clock and text-capacity services for native rendering.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { makeCitationTextBudget } from "./TextBudget.ts";

/** Retain the constructing caller's operation and capacity owner across later calls.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeRendering = Effect.fn("Citation.makeNativeRendering")(function* <E>(
  policy: unknown,
  invalid: () => E
) {
  const limits = yield* decodeCitationRegexPolicy(policy, invalid);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const unicode = yield* makeCitationPythonUnicode(limits, timing.operation);
  const enclosing = yield* Effect.serviceOption(CitationTextBudget);
  if (O.isSome(enclosing) && enclosing.value.maximum > limits.producedTextUtf16) return yield* Effect.fail(invalid());
  const budget = O.isSome(enclosing) ? Effect.succeed(enclosing.value) : makeCitationTextBudget(limits);
  return { limits, timing, unicode, budget };
});
