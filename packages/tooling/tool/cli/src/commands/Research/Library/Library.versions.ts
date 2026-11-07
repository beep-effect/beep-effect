/**
 * Source-bound cited revision selection.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import type { LibraryCatalog, LibrarySource } from "./Library.schemas.ts";

// Catalogs are immutable values: one revision index per catalog reference makes per-source lookups constant.
let lastRevisionIndex: O.Option<readonly [LibraryCatalog, HashMap.HashMap<string, ReadonlyArray<string>>]> = O.none();

const citedRevisionIndex = (catalog: LibraryCatalog): HashMap.HashMap<string, ReadonlyArray<string>> => {
  if (O.isSome(lastRevisionIndex) && lastRevisionIndex.value[0] === catalog) return lastRevisionIndex.value[1];
  let index = HashMap.empty<string, Array<string>>();
  for (const occurrence of catalog.occurrences) {
    const existing = HashMap.get(index, occurrence.sourceId);
    if (O.isSome(existing)) existing.value.push(occurrence.revision);
    else index = HashMap.set(index, occurrence.sourceId, [occurrence.revision]);
  }
  lastRevisionIndex = O.some([catalog, index] as const);
  return index;
};

/**
 * Select current citation revisions, retaining historical fallback for uncited sources.
 * **Example** (Inspect required revisions)
 * ```ts
 * import { libraryCitedRevisions } from "@beep/repo-cli/test/ResearchLibrary"
 * import type { LibraryCatalog, LibrarySource } from "@beep/repo-cli/commands/Research"
 * const required = (catalog: LibraryCatalog, source: LibrarySource) => libraryCitedRevisions(catalog, source)
 * console.log(typeof required) // function
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const libraryCitedRevisions: {
  (source: LibrarySource): (catalog: LibraryCatalog) => ReadonlyArray<string>;
  (catalog: LibraryCatalog, source: LibrarySource): ReadonlyArray<string>;
} = dual(2, (catalog: LibraryCatalog, source: LibrarySource): ReadonlyArray<string> => {
  const cited = A.dedupe(O.getOrElse(HashMap.get(citedRevisionIndex(catalog), source.id), A.empty<string>));
  return A.isReadonlyArrayNonEmpty(cited)
    ? cited
    : A.dedupe([source.revision, ...A.map(source.versions, (item) => item.revision)]);
});
