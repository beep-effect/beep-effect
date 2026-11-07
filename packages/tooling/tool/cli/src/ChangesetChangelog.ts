/**
 * Changesets changelog formatter: GitHub-enriched lines with a plain fallback.
 *
 * **Details**
 *
 * `.changeset/config.json` names this module as `@beep/repo-cli/ChangesetChangelog`.
 * Changesets resolves it from `.changeset/` and loads it with a dynamic
 * `import()` under the Node runtime that runs `changeset version`, so the file
 * keeps to Node-erasable TypeScript and imports only `effect/*` leaves and the
 * Changesets formatters.
 *
 * Each line comes from `@changesets/changelog-github`. Only its transient
 * GitHub failures (validation timeouts, fetch or parse errors, a missing
 * `GITHUB_TOKEN`) fall back to `@changesets/cli/changelog`, after a
 * `[changeset-changelog]` warning on stderr; every other error propagates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import githubChangelog from "@changesets/changelog-github";
import fallbackChangelog from "@changesets/cli/changelog";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

type ChangelogFunctions = typeof githubChangelog;
type ReleaseLineArgs = Parameters<ChangelogFunctions["getReleaseLine"]>;
type DependencyReleaseLineArgs = Parameters<ChangelogFunctions["getDependencyReleaseLine"]>;

const TRANSIENT_GITHUB_ERROR_MESSAGES: ReadonlyArray<string> = [
  "Timeout on validation of query",
  "An error occurred when fetching data from GitHub",
  "Failed to parse data from GitHub",
  "GITHUB_TOKEN",
];

/**
 * A changelog formatter rejected; `cause` is the formatter's own rejection value.
 *
 * **Example** (Wrap a formatter rejection)
 *
 * ```ts
 * import { ChangelogLineError } from "@beep/repo-cli/ChangesetChangelog"
 *
 * const error = ChangelogLineError.make({ cause: new Error("GITHUB_TOKEN missing") })
 * console.log(error._tag) // "ChangelogLineError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ChangelogLineError extends S.TaggedError<ChangelogLineError, { readonly brand: unique symbol }>()(
  "ChangelogLineError",
  { cause: S.Defect({ includeStack: true }) }
) {}

// `String(...)` keeps the rendering the original CommonJS module used for non-Error rejections.
const errorMessage = (error: unknown): string => (P.isError(error) ? error.message : String(error));

const isTransientGitHubError = (error: ChangelogLineError): boolean => {
  const message = errorMessage(error.cause);
  return A.some(TRANSIENT_GITHUB_ERROR_MESSAGES, (transient) => Str.includes(transient)(message));
};

const attempt = (line: () => string | PromiseLike<string>) =>
  Effect.tryPromise({ try: () => Promise.resolve(line()), catch: (cause) => ChangelogLineError.make({ cause }) });

const withFallback = (
  operation: string,
  github: () => string | PromiseLike<string>,
  fallback: () => string | PromiseLike<string>
): Promise<string> =>
  Effect.runPromise(
    attempt(github).pipe(
      Effect.catchIf(isTransientGitHubError, (error) =>
        Console.error(
          `[changeset-changelog] GitHub changelog enrichment failed during ${operation}; using plain changelog fallback.\n${errorMessage(error.cause)}`
        ).pipe(Effect.andThen(attempt(fallback)))
      ),
      // The promise boundary: Changesets must see exactly the value the formatter rejected with.
      Effect.catchTag("ChangelogLineError", (error) => Effect.die(error.cause))
    )
  );

/**
 * Render one changeset's release line, falling back on transient GitHub errors.
 *
 * **Details**
 *
 * Changesets calls the data-first form with all three arguments; the
 * data-last form takes the version type and options first.
 *
 * **Example** (Confirm the Changesets contract)
 *
 * ```ts
 * import { getReleaseLine } from "@beep/repo-cli/ChangesetChangelog"
 *
 * console.log(typeof getReleaseLine) // "function"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const getReleaseLine: {
  (type: ReleaseLineArgs[1], options: ReleaseLineArgs[2]): (changeset: ReleaseLineArgs[0]) => Promise<string>;
  (changeset: ReleaseLineArgs[0], type: ReleaseLineArgs[1], options: ReleaseLineArgs[2]): Promise<string>;
} = dual(3, (changeset: ReleaseLineArgs[0], type: ReleaseLineArgs[1], options: ReleaseLineArgs[2]) =>
  withFallback(
    "release line generation",
    () => githubChangelog.getReleaseLine(changeset, type, options),
    () => fallbackChangelog.getReleaseLine(changeset, type, options)
  )
);

/**
 * Render the dependency-update release line, falling back on transient GitHub errors.
 *
 * **Details**
 *
 * Changesets calls the data-first form with all three arguments; the
 * data-last form takes the updated dependencies and options first.
 *
 * **Example** (Confirm the Changesets contract)
 *
 * ```ts
 * import { getDependencyReleaseLine } from "@beep/repo-cli/ChangesetChangelog"
 *
 * console.log(typeof getDependencyReleaseLine) // "function"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const getDependencyReleaseLine: {
  (
    dependenciesUpdated: DependencyReleaseLineArgs[1],
    options: DependencyReleaseLineArgs[2]
  ): (changesets: DependencyReleaseLineArgs[0]) => Promise<string>;
  (
    changesets: DependencyReleaseLineArgs[0],
    dependenciesUpdated: DependencyReleaseLineArgs[1],
    options: DependencyReleaseLineArgs[2]
  ): Promise<string>;
} = dual(
  3,
  (
    changesets: DependencyReleaseLineArgs[0],
    dependenciesUpdated: DependencyReleaseLineArgs[1],
    options: DependencyReleaseLineArgs[2]
  ) =>
    withFallback(
      "dependency release line generation",
      () => githubChangelog.getDependencyReleaseLine(changesets, dependenciesUpdated, options),
      () => fallbackChangelog.getDependencyReleaseLine(changesets, dependenciesUpdated, options)
    )
);
