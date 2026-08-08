/**
 * Docs aggregation command implementation.
 *
 * This command delegates to the shared human-first docgen aggregation helper so
 * `beep docs aggregate` and `beep docgen aggregate` cannot drift.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { aggregateGeneratedDocs } from "../Docgen/internal/Operations.ts";

const packageFlag = Flag.string("package").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("Limit aggregation to one workspace package"),
  Flag.optional
);
const filterFlag = Flag.string("filter").pipe(
  Flag.withDescription('Compatibility selector for commands like "bun run docgen --filter=@beep/schema"'),
  Flag.optional
);
const cleanFlag = Flag.boolean("clean").pipe(
  Flag.withDescription("Remove the generated docs directory (docs/generated) before aggregating")
);

const resolveAggregateSelector = Effect.fn("DocsAggregate.resolveAggregateSelector")(function* (
  packageSelector: O.Option<string>,
  filterSelector: O.Option<string>
) {
  if (
    O.isSome(packageSelector) &&
    O.isSome(filterSelector) &&
    !Str.equivalence(packageSelector.value, filterSelector.value)
  ) {
    return yield* DomainError.make({
      message: `Received conflicting selectors --package=${packageSelector.value} and --filter=${filterSelector.value}.`,
    });
  }

  return O.isSome(packageSelector) ? packageSelector : filterSelector;
});

const aggregateDocs = Effect.fn(function* (selector: O.Option<string>, clean: boolean) {
  const results = yield* aggregateGeneratedDocs({
    clean,
    ...O.getSomesStruct({ package: selector }),
  });

  yield* A.match(results, {
    onEmpty: () => Console.log("docs aggregate: no generated package docs found"),
    onNonEmpty: (nonEmptyResults) =>
      Effect.forEach(
        nonEmptyResults,
        (result) => Console.log(`docs aggregate: ${result.packagePath} -> docs/generated/${result.docsOutputPath}`),
        { discard: true }
      ),
  });
});

/**
 * Aggregate generated package docs into the root `docs/generated/` layout.
 *
 * **Example** (Log aggregate command name)
 *
 * ```ts
 * console.log("docsAggregateCommand")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const docsAggregateCommand = Command.make(
  "aggregate",
  {
    package: packageFlag,
    filter: filterFlag,
    clean: cleanFlag,
  },
  ({ package: packageSelector, filter: filterSelector, clean }) =>
    resolveAggregateSelector(packageSelector, filterSelector).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (selector) {
          return yield* aggregateDocs(selector, clean);
        })
      ),
      Effect.catchTags({
        DomainError: Effect.fn(function* (error) {
          yield* Console.error(`docs aggregate: ${error.message}`);
          return yield* failWithReportedExit(`docs aggregate: ${error.message}`);
        }),
        NoSuchFileError: Effect.fn(function* (error) {
          yield* Console.error(`docs aggregate: ${error.message}`);
          return yield* failWithReportedExit(`docs aggregate: ${error.message}`);
        }),
      })
    )
).pipe(Command.withDescription("Aggregate generated docs into the root docs/generated layout"));
