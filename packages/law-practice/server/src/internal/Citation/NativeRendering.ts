/** Capture existing Unicode, clock and text-capacity services for native rendering.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { CitationInvocation } from "./Invocation.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";

/** Retain the installed operation and read invocation capacity at call time.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeRendering = Effect.fn("Citation.makeNativeRendering")(function* <E>(
  policy: unknown,
  invalid: () => E
) {
  const limits = yield* decodeCitationRegexPolicy(policy, invalid);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const unicode = yield* makeCitationPythonUnicode(limits, timing.operation);
  const budget = CitationInvocation.use(({ budget }) => Effect.succeed(budget));
  return { limits, timing, unicode, budget };
});
