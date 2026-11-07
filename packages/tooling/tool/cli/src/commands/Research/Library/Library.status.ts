/**
 * Explicit research library accounting.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { LibraryError } from "./Library.errors.ts";
import { libraryHopTotals } from "./Library.hopStatus.ts";
import { loadCatalog } from "./Library.store.ts";
import {
  LibraryCountRow,
  LibraryViewRow,
  libraryViewDataset,
  occurrenceIndex,
  privatePartition,
  reportIndex,
  runView,
  sourceIndex,
  statusCounts,
} from "./Library.views.ts";

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
export const libraryStatus = Effect.fn("Research.Library.status")(function* (
  root: string,
  includePrivate = false,
  summary = false,
  intakeId: O.Option<string> = O.none()
) {
  const catalog = yield* loadCatalog(root);
  if (summary === true) {
    // The per-hop and partition lines straight from the catalog, without the SPARQL view dataset.
    const resolved = O.flatMap(intakeId, (wanted) =>
      A.findFirst(catalog.intakes, (intake) => intake.id === wanted || intake.date === wanted)
    );
    if (O.isSome(intakeId) && O.isNone(resolved))
      return yield* LibraryError.make({ message: `No intake matches ${intakeId.value}.`, cause: intakeId.value });
    const scope = O.map(resolved, (intake) => intake.id);
    const files = O.match(resolved, {
      onNone: () => A.flatMap(catalog.intakes, (i) => i.files),
      onSome: (i) => i.files,
    });
    const privateFiles = A.filter(files, (file) => file.accessClass === "private").length;
    const snapshots = HashSet.fromIterable(A.map(files, (file) => file.snapshotPath));
    const referenced = A.filter(files, (file) => file.retention === "referenced").length;
    yield* Console.log(
      `library status (summary${O.isSome(scope) ? `, intake ${scope.value}` : ""}): intake files=${files.length} private=${privateFiles} referenced media=${referenced}`
    );
    const scoped = HashSet.fromIterable(
      A.map(
        A.filter(catalog.derivations, (d) => O.match(scope, { onNone: () => true, onSome: (id) => d.intakeId === id })),
        (d) => d.derivedId
      )
    );
    yield* Console.log(
      `private partition: documents=${A.filter(catalog.documents, (d) => d.accessClass === "private" && HashSet.has(snapshots, d.snapshotPath)).length} sources=${A.filter(catalog.sources, (s) => s.accessClass === "private" && (O.isNone(scope) || HashSet.has(scoped, s.id))).length}`
    );
    const hops = yield* libraryHopTotals(root, catalog, undefined, scope);
    return yield* Effect.forEach(hops, (line) => Console.log(line), { discard: true });
  }
  const dataset = yield* libraryViewDataset(root, catalog);
  const counts = yield* runView(dataset, statusCounts, LibraryCountRow, includePrivate);
  const partition = yield* runView(dataset, privatePartition, LibraryCountRow, true);
  const documents = yield* runView(dataset, reportIndex, LibraryViewRow, includePrivate);
  const sources = yield* runView(dataset, sourceIndex, LibraryViewRow, includePrivate);
  const occurrences = yield* runView(dataset, occurrenceIndex, LibraryViewRow, includePrivate);
  const count = (kind: string, category: string) =>
    A.reduce(counts, 0, (total, row) => total + (row.kind === kind && row.category === category ? row.count : 0));
  const privateCount = (kind: string) =>
    A.reduce(partition, 0, (total, row) => total + (row.kind === kind ? row.count : 0));
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
  for (const row of counts) {
    if (row.kind === "Claim" && row.category !== undefined) versionCategories[row.category] = row.count;
    if (row.kind === "Source" && row.category !== undefined) sourceCategories[row.category] = row.count;
  }
  const format = (counts: Record<string, number>) =>
    A.join(
      A.map(R.toEntries(counts), ([category, count]) => `${category}=${count}`),
      " "
    );
  yield* Console.log(
    `library status: reports=${documents.length} sources=${sources.length} occurrences=${occurrences.length}`
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
    yield* Console.log(`historical capture attempts ${status}=${count("Capture", status)}`);
  }
  yield* Console.log(
    `route probes verified=${count("Qualification", "verified")} failed=${count("Qualification", "failed")}; run verify for the integrity gate`
  );
  yield* Console.log(
    `private partition: documents=${privateCount("Report")} sources=${privateCount("Source")} artifacts=${privateCount("Artifact")} occurrences=${privateCount("Occurrence")}`
  );
  const hops = yield* libraryHopTotals(root, catalog);
  yield* Effect.forEach(hops, (line) => Console.log(line), { discard: true });
});
