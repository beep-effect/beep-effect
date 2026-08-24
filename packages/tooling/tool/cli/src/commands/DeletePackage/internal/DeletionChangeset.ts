/**
 * Canonical delete-package changeset rendering and validation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str, Text, thunkFalse } from "@beep/utils";
import { Effect } from "effect";
import { changesetPackageReferencesFromText } from "../../Quality/ChangesetGraph.ts";

/**
 * Render the exact empty changeset written for a deleted workspace package.
 *
 * **Example** (Render a deletion note)
 *
 * ```ts
 * import { renderCanonicalDeletionChangeset } from "@beep/repo-cli/commands/DeletePackage/internal/DeletionChangeset"
 *
 * console.log(renderCanonicalDeletionChangeset("@beep/probe"))
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const renderCanonicalDeletionChangeset = (packageName: string): string =>
  Text.joinLines(["---", "{}", "---", "", `No release: remove \`${packageName}\` from the workspace.`, ""]);

/**
 * Parse and verify that a changeset is the exact deletion note for one package.
 *
 * **Details**
 *
 * Malformed frontmatter returns `false`. Empty frontmatter alone is insufficient;
 * the body and final newline must also match the canonical note.
 *
 * **Example** (Reject a note for another package)
 *
 * ```ts
 * import { isCanonicalDeletionChangeset } from "@beep/repo-cli/commands/DeletePackage/internal/DeletionChangeset"
 * import { Effect } from "effect"
 *
 * const note = "---\n{}\n---\n\nNo release: remove `@beep/other` from the workspace.\n"
 * Effect.runPromise(isCanonicalDeletionChangeset(".changeset/delete-probe.md", note, "@beep/probe")).then(console.log)
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const isCanonicalDeletionChangeset = Effect.fn("DeletePackage.isCanonicalDeletionChangeset")(function* (
  file: string,
  content: string,
  packageName: string
) {
  const hasCanonicalFrontmatter = yield* changesetPackageReferencesFromText(file, content).pipe(
    Effect.map(A.isReadonlyArrayEmpty),
    Effect.orElseSucceed(thunkFalse)
  );

  return hasCanonicalFrontmatter && Str.equivalence(content, renderCanonicalDeletionChangeset(packageName));
});
