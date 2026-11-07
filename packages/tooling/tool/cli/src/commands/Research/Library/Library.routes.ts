/**
 * Composed acquisition routes: inventory with hops, the Box route and the hop-gate report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { acquireLibrary } from "./Library.acquire.ts";
import { libraryBoxAdapter, registerLibraryBoxSources } from "./Library.box.ts";
import { libraryQualificationValid } from "./Library.evidence.ts";
import { LibraryHopPolicy } from "./Library.hopPolicy.ts";
import { libraryHopTotals } from "./Library.hopStatus.ts";
import { LibraryHopGateInput, libraryHopGate, libraryLiveConcepts, recordLibraryHops } from "./Library.hops.ts";
import { inventoryLibrary } from "./Library.inventory.ts";
import { LibraryQualifyOptions, qualifyLibrary } from "./Library.qualify.ts";
import { LibraryAcquireOptions } from "./Library.schemas.ts";
import { loadCatalog, withCatalog } from "./Library.store.ts";
import type { LibraryBoxAcquireOptions } from "./Library.box.ts";
import type { LibraryIntake, LibraryInventoryOptions } from "./Library.schemas.ts";

/**
 * Inventory the inputs, then record hop-1 derivations and hop-2 identities for every intake.
 *
 * **Example** (Build an inventory effect)
 *
 * ```ts
 * import { inventoryLibraryWithHops, LibraryInventoryOptions } from "@beep/repo-cli/commands/Research"
 *
 * console.log(inventoryLibraryWithHops(LibraryInventoryOptions.make({ libraryRoot: "/library", inputRoots: [] })).pipe !== undefined)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const inventoryLibraryWithHops = Effect.fn("Library.inventoryWithHops")(function* (
  options: LibraryInventoryOptions
) {
  const path = yield* Path.Path;
  yield* inventoryLibrary(options);
  const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  // Derive hops only for the intake this run recorded: its roots are exactly the requested roots.
  const roots = HashSet.fromIterable(A.map(options.inputRoots, (root) => path.resolve(root)));
  return yield* withCatalog(options.libraryRoot, (catalog) => {
    const current = A.filter(
      catalog.intakes,
      (intake) =>
        intake.inputRoots.length === HashSet.size(roots) &&
        A.every(intake.inputRoots, (root) => HashSet.has(roots, path.resolve(root.path)))
    );
    const byCreation = Order.mapInput(Str.Order, (intake: LibraryIntake) => intake.createdAt);
    // Default roots are resolved inside inventory; then the newest intake is the one just recorded.
    const latest = A.last(A.sort(A.isReadonlyArrayNonEmpty(current) ? current : catalog.intakes, byCreation));
    return recordLibraryHops(
      options.libraryRoot,
      catalog,
      recordedAt,
      A.map(A.fromOption(latest), (intake) => intake.id)
    );
  });
});

/**
 * Register the selected Box files, qualify the Box route by a real download if needed, then acquire.
 *
 * **Details**
 *
 * Each file gets its own start and terminal receipt and the catalog is written after every file,
 * because Box quota is not observable. A file version already captured readable is not downloaded
 * again; failed files retry only with `retryFailed`.
 *
 * **Example** (Build a Box acquisition)
 *
 * ```ts
 * import { acquireLibraryBox, LibraryBoxAcquireOptions } from "@beep/repo-cli/commands/Research"
 *
 * console.log(acquireLibraryBox("/library", LibraryBoxAcquireOptions.make({ folderIds: ["0"], fileIds: [] })).pipe !== undefined)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const acquireLibraryBox = Effect.fn("Library.acquireBox")(function* (
  root: string,
  options: LibraryBoxAcquireOptions
) {
  const sourceIds = yield* registerLibraryBoxSources(root, options);
  if (A.isReadonlyArrayEmpty(sourceIds)) return yield* loadCatalog(root);
  const catalog = yield* loadCatalog(root);
  const previous = A.findLast(catalog.qualifications, (item) => item.adapter === libraryBoxAdapter && item.required);
  const qualified =
    O.isSome(previous) &&
    (yield* libraryQualificationValid(root, catalog, previous.value).pipe(Effect.orElseSucceed(() => false)));
  if (!qualified)
    yield* qualifyLibrary(
      root,
      LibraryQualifyOptions.make({ adapters: [libraryBoxAdapter], sourceIds: A.take(sourceIds, 1), maxProbes: 1 })
    );
  return yield* acquireLibrary(
    root,
    LibraryAcquireOptions.make({ sourceIds, concurrency: 1, retryFailed: options.retryFailed })
  );
});

/**
 * Print hop totals and up to `limit` hop-2 gate decisions under the given policy.
 *
 * **Example** (Build a hop report)
 *
 * ```ts
 * import { libraryHopReport } from "@beep/repo-cli/commands/Research"
 *
 * console.log(libraryHopReport("/library", 20).pipe !== undefined)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const libraryHopReport = Effect.fn("Library.hopReport")(function* (
  root: string,
  limit: number,
  policy: LibraryHopPolicy = LibraryHopPolicy.make({})
) {
  const catalog = yield* loadCatalog(root);
  for (const line of yield* libraryHopTotals(root, catalog, policy)) yield* Console.log(line);
  const concepts = yield* libraryLiveConcepts(policy);
  const decisions = libraryHopGate(catalog, LibraryHopGateInput.make({ concepts, policy }));
  for (const decision of A.take(decisions, limit)) {
    const url = O.getOrElse(
      O.map(
        A.findFirst(catalog.sources, (source) => source.id === decision.sourceId),
        (source) => source.canonicalUrl
      ),
      () => ""
    );
    yield* Console.log(
      `${decision.admitted ? "admit" : "refuse"} ${decision.reason} ${decision.domain} ${decision.sourceId} ${url}`
    );
  }
  return decisions;
});
