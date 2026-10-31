/**
 * Flags, configuration paths and package resolution shared by the lint subcommands.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { normalizePath } from "@beep/schema";
import { Str } from "@beep/utils";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Path from "effect/Path";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";

/** Root config the deprecated-apis oxlint profile reads. @internal @since 0.0.0 */
export const OXLINT_DEPRECATED_APIS_CONFIG = ".oxlintrc.deprecated-apis.jsonc";

/** Root config the circular-import oxlint profile reads. @internal @since 0.0.0 */
export const OXLINT_CIRCULAR_CONFIG = ".oxlintrc.circular.json";

/** Whether a candidate path stays inside the lint root. @internal @since 0.0.0 */
export const isContainedLintPath: {
  (root: string, candidate: string): (path: Path.Path) => boolean;
  (path: Path.Path, root: string, candidate: string): boolean;
} = dual(3, (path: Path.Path, root: string, candidate: string): boolean => {
  const relativeFromRoot = normalizePath(path.relative(root, candidate));

  return (
    relativeFromRoot === "" ||
    relativeFromRoot === "." ||
    (!path.isAbsolute(relativeFromRoot) && relativeFromRoot !== ".." && !Str.startsWith("../")(relativeFromRoot))
  );
});

/** `--package` flag of the package-scoped lint subcommands. @internal @since 0.0.0 */
export const lintPackageFlag = Flag.String("package").pipe(Flag.optional);
/** `--base` flag of the root sweep subcommands. @internal @since 0.0.0 */
export const lintBaseFlag = Flag.String("base").pipe(Flag.withDefault("origin/main"));
/** `--full` flag of the root sweep subcommands. @internal @since 0.0.0 */
export const lintFullFlag = Flag.Boolean("full").pipe(Flag.withDefault(false));

/** Resolve a `--package` directory to a repo-relative prefix inside the repository. @internal @since 0.0.0 */
export const resolveLintPackage = Effect.fn("Lint.resolvePackage")(function* (root: string, directory: string) {
  const path = yield* Path.Path;
  const absolute = path.resolve(directory);
  if (!isContainedLintPath(path, root, absolute)) {
    return yield* failWithReportedExit("Lint package directory must stay inside the repository.");
  }
  return normalizePath(path.relative(root, absolute)) || ".";
});
