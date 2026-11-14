/** Capture existing Unicode, clock and text-capacity services for native rendering.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { CitationInvocation } from "./Invocation.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { makeCitationRegexTiming } from "./RegexPolicy.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

/** Retain the installed operation and read invocation capacity at call time.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeRendering = Effect.fn("Citation.makeNativeRendering")(function* (
  limits: CitationEngineLimits
) {
  const timing = yield* makeCitationRegexTiming(limits, true);
  const unicode = yield* makeCitationPythonUnicode(limits, timing.operation);
  const budget = CitationInvocation.useSync(({ budget }) => budget);
  return { limits, timing, unicode, budget };
});
