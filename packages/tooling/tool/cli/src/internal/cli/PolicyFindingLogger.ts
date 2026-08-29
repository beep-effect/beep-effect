import { thunkEmptyStr } from "@beep/utils";
import { Console, Effect, SchemaGetter } from "effect";
import * as O from "effect/Option";

const stringifyJsonLine = SchemaGetter.stringifyJson({ space: 0 });

/**
 * Builds the shared human-readable and machine-readable logger used by policy lints.
 *
 * **Example** (Construct finding logger)
 *
 * ```ts
 * import { Effect } from "effect"
 *
 * const logger = makePolicyFindingLogger({
 *   issuePrefix: "[example:issue] ",
 *   encode: (finding: { readonly message: string }) => Effect.succeed(finding),
 *   renderSummary: (finding) => finding.message,
 * })
 * console.log(Effect.isEffect(logger.render({ message: "example" })))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makePolicyFindingLogger = <Finding, EncodeError, EncodeRequirements>(options: {
  readonly issuePrefix: string;
  readonly encode: (finding: Finding) => Effect.Effect<unknown, EncodeError, EncodeRequirements>;
  readonly renderSummary: (finding: Finding) => string;
}) => {
  const render = Effect.fn("PolicyFindingLogger.render")(function* (finding: Finding) {
    const encoded = yield* options.encode(finding);
    const rendered = yield* stringifyJsonLine.run(O.some(encoded), {});
    return `${options.issuePrefix}${O.getOrElse(rendered, thunkEmptyStr)}`;
  });

  const log = Effect.fn("PolicyFindingLogger.log")(function* (finding: Finding) {
    yield* Console.error(options.renderSummary(finding));
    yield* Console.error(yield* render(finding));
  });

  return { log, render } as const;
};
