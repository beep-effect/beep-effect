/** Observable builtin call boundaries adapted from the pinned clean.py probe.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import type {
  CitationCleanerFailure,
  CitationCleanerObject,
  CitationCleanerProduced,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import type { CitationBuiltinCleanerName } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type * as S from "effect/Schema";

const sourceFailureType = (error: CitationCleanerFailure) => {
  if (error.reason === "builtin-input-type") return "builtins.TypeError";
  if (error.reason === "html-parse-error") return "lxml.etree.ParserError";
  if (error.reason === "html-unicode-encoding-declaration") return "builtins.ValueError";
  if (error.reason === "html-unicode-decode-error") return "builtins.UnicodeDecodeError";
  return "builtins.RuntimeError";
};
/** Observe real invocation, preserving its result/error and reserving no invented output.
 * Events contain normalized values and failure categories, never source exception messages.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationBuiltinObservation = Effect.fn("CleanerSourceTest.makeBuiltinObservation")(function* (
  present: (value: CitationCleanerObject) => Effect.Effect<S.Json, CitationCleanerFailure>,
  record: (event: S.Json) => Effect.Effect<void>
) {
  return Effect.fn("CleanerSourceTest.observeBuiltin")(function* (
    name: CitationBuiltinCleanerName,
    value: CitationCleanerObject,
    body: Effect.Effect<CitationCleanerProduced, CitationCleanerFailure | CitationSafetyLimitExceeded>
  ) {
    yield* record({ kind: "builtin-enter", name, value: yield* present(value) });
    const result = yield* body.pipe(
      Effect.tapError((error) =>
        record(
          error._tag === "CitationSafetyLimitExceeded"
            ? { kind: "builtin-resource-failure", name, limit: error.limit }
            : { kind: "builtin-raise", name, failure: { pythonType: sourceFailureType(error) } }
        )
      )
    );
    yield* record({ kind: "builtin-return", name, value: yield* present(result.value) });
    return result;
  });
});
