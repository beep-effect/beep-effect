/**
 * TSDoc parser adapter for the oxlint runtime.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import * as NodeURL from "node:url";
import { $LintRulesId } from "@beep/identity/packages";
import { TextRange, TSDocConfiguration, TSDocParser } from "@microsoft/tsdoc";
import { TSDocConfigFile } from "@microsoft/tsdoc-config";
import { defineRule } from "@oxlint/plugins";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LintRulesId.create("rules/tsdoc-syntax");
class TSDocConfigurationError extends S.TaggedError<TSDocConfigurationError, { readonly brand: unique symbol }>()(
  "TSDocConfigurationError",
  {
    message: S.NonEmptyString,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("TSDocConfigurationError", { description: "TSDoc config could not be loaded or applied." })
) {}

const loadFreshConfigurationPerFile = Effect.fn("Docs.loadTSDocConfiguration")(function* () {
  const file = yield* Effect.try({
    try: () =>
      TSDocConfigFile.loadFile(NodeURL.fileURLToPath(new URL("../../../../../../tsdoc.json", import.meta.url))),
    catch: (cause) => TSDocConfigurationError.make({ message: "Error loading repository TSDoc configuration.", cause }),
  });
  if (file.fileNotFound || file.hasErrors) {
    const summary = file.getErrorSummary();
    return yield* TSDocConfigurationError.make({
      message: summary || "Repository tsdoc.json is missing.",
      cause: summary,
    });
  }
  return yield* Effect.try({
    try: () => {
      const config = new TSDocConfiguration();
      file.configureParser(config);
      return config;
    },
    catch: (cause) =>
      TSDocConfigurationError.make({ message: "Error applying repository TSDoc configuration.", cause }),
  });
});

/**
 * Report each TSDoc diagnostic using the existing repository tag configuration.
 *
 * **Example** (Inspect the parser rule)
 * ```ts
 * import plugin from "@beep/lint-rules/oxlint-docs"
 * console.log(plugin.rules["tsdoc-syntax"]?.meta.type)
 * ```
 * @category tools
 * @since 0.1.0
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Validate documentation syntax with the repository TSDoc parser configuration." },
  },
  create(context) {
    const loaded = Effect.runSync(loadFreshConfigurationPerFile().pipe(Effect.result));
    if (Result.isFailure(loaded)) {
      return {
        Program(node) {
          context.report({ node, message: loaded.failure.message });
        },
      };
    }
    const parser = new TSDocParser(loaded.success);
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (
            comment.type !== "Block" ||
            !Str.startsWith("*")(comment.value) ||
            comment.range[1] - comment.range[0] < 5
          )
            continue;
          const parsed = parser.parseRange(
            TextRange.fromStringRange(context.sourceCode.text, comment.range[0], comment.range[1])
          );
          for (const message of parsed.log.messages) {
            context.report({
              loc: {
                start: context.sourceCode.getLocFromIndex(message.textRange.pos),
                end: context.sourceCode.getLocFromIndex(message.textRange.end),
              },
              message: `${message.messageId}: ${message.unformattedText}`,
            });
          }
        }
      },
    };
  },
});
