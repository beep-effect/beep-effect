/**
 * Explicit research library accounting.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import { libraryEffectiveCaptures, libraryEffectiveCategory } from "./Library.evidence.ts";
import { loadCatalog } from "./Library.store.ts";

/**
 * Show source and attempt categories separately without claiming integrity verification.
 * **Example** (Inspect library progress)
 * ```ts
 * import { libraryStatus } from "@beep/repo-cli/commands/Research"
 * const status = libraryStatus("/library")
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const libraryStatus = Effect.fn("Research.Library.status")(function* (root: string) {
  const catalog = yield* loadCatalog(root);
  const versionCategories: Record<string, number> = {
    readable: 0,
    unavailable: 0,
    ambiguous: 0,
    incomplete: 0,
    "tool-blocked": 0,
    internal: 0,
    operational: 0,
    "non-reference": 0,
    missing: 0,
  };
  const sourceCategories: Record<string, number> = { ...versionCategories };
  for (const source of catalog.sources) {
    const current = yield* libraryEffectiveCaptures(root, catalog, source);
    const categories = A.map(current, (item) => item.category);
    for (const category of categories) versionCategories[category] = (versionCategories[category] ?? 0) + 1;
    const primary = libraryEffectiveCategory(categories);
    sourceCategories[primary] = (sourceCategories[primary] ?? 0) + 1;
  }
  const format = (counts: Record<string, number>) =>
    A.join(
      A.map(R.toEntries(counts), ([category, count]) => `${category}=${count}`),
      " "
    );
  yield* Console.log(
    `library status: reports=${catalog.documents.length} sources=${catalog.sources.length} occurrences=${catalog.occurrences.length}`
  );
  yield* Console.log(`current source claims (least complete required version): ${format(sourceCategories)}`);
  yield* Console.log(
    `current source/version claims: ${format(versionCategories)}; readable claims require verify for integrity, reviewed categories are hash-bound and never read`
  );
  for (const status of [
    "running",
    "interrupted",
    "readable",
    "blocked",
    "failed",
    "unsupported",
    "unavailable",
    "non-reference",
  ]) {
    yield* Console.log(
      `historical capture attempts ${status}=${A.filter(catalog.captures, (capture) => capture.status === status).length}`
    );
  }
  yield* Console.log(
    `route probes verified=${A.filter(catalog.qualifications, (item) => item.status === "verified").length} failed=${A.filter(catalog.qualifications, (item) => item.status === "failed").length}; run verify for the integrity gate`
  );
});
