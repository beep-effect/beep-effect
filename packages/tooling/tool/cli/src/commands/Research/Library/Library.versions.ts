/** Source-bound cited revision selection.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import type { LibraryCatalog, LibrarySource } from "./Library.schemas.ts";

/** Select current citation revisions, retaining historical fallback for uncited sources.
 * **Example** (Inspect required revisions)
 * ```ts
 * import { libraryCitedRevisions } from "@beep/repo-cli/test/ResearchLibrary"
 * import type { LibraryCatalog, LibrarySource } from "@beep/repo-cli/commands/Research"
 * const required = (catalog: LibraryCatalog, source: LibrarySource) => libraryCitedRevisions(catalog, source)
 * console.log(typeof required) // function
 * ```
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const libraryCitedRevisions: {
  (source: LibrarySource): (catalog: LibraryCatalog) => ReadonlyArray<string>;
  (catalog: LibraryCatalog, source: LibrarySource): ReadonlyArray<string>;
} = dual(2, (catalog: LibraryCatalog, source: LibrarySource): ReadonlyArray<string> => {
  const cited = A.dedupe(
    A.map(
      A.filter(catalog.occurrences, (item) => item.sourceId === source.id),
      (item) => item.revision
    )
  );
  return A.isReadonlyArrayNonEmpty(cited)
    ? cited
    : A.dedupe([source.revision, ...A.map(source.versions, (item) => item.revision)]);
});
