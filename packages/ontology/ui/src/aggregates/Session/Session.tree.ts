/**
 * Ontology Session tree view-model helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resourceVisibleInViewMode } from "@beep/ontology-use-cases/aggregates/Session";
import { A, O } from "@beep/utils";
import { MutableHashMap, MutableHashSet, pipe } from "effect";
import { dual } from "effect/Function";
import type {
  OntologyResourceSummary,
  OntologySnapshot,
  OntologyViewMode,
} from "@beep/ontology-use-cases/aggregates/Session";

const emptyStrings: () => ReadonlyArray<string> = A.empty;

type OntologyTreeItem = {
  readonly id: string;
  readonly label: string;
  readonly children?: ReadonlyArray<OntologyTreeItem>;
};

/**
 * Build a tree-safe hierarchy view from the ontology snapshot.
 *
 * **Gotchas**
 *
 * Inferred subclass closure can make the hierarchy a DAG. MUI tree items need
 * unique ids, so each resource is emitted once and path cycles are skipped.
 *
 * **Example** (Build tree items from snapshot)
 *
 * ```ts
 * import { ontologyTreeItemsFor } from "@beep/ontology-ui/aggregates/Session"
 * import { OntologyMetrics, OntologySnapshot } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const items = ontologyTreeItemsFor(
 *   OntologySnapshot.make({
 *     sessionId: "session-1",
 *     resources: [],
 *     hierarchy: [],
 *     metrics: OntologyMetrics.make({
 *       quadCount: 0,
 *       resourceCount: 0,
 *       classCount: 0,
 *       propertyCount: 0,
 *       individualCount: 0,
 *       tboxCount: 0,
 *       aboxCount: 0
 *     })
 *   }),
 *   "all"
 * )
 *
 * console.log(items.length)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ontologyTreeItemsFor: {
  (mode: OntologyViewMode): (snapshot: OntologySnapshot) => ReadonlyArray<OntologyTreeItem>;
  (snapshot: OntologySnapshot, mode: OntologyViewMode): ReadonlyArray<OntologyTreeItem>;
} = dual(2, (snapshot: OntologySnapshot, mode: OntologyViewMode): ReadonlyArray<OntologyTreeItem> => {
  const visible = A.filter(snapshot.resources, (resource) => resourceVisibleInViewMode(resource, mode));
  const visibleIds = MutableHashSet.fromIterable(A.map(visible, (resource) => resource.iri));
  const resourcesByIri = MutableHashMap.fromIterable(A.map(visible, (resource) => [resource.iri, resource] as const));
  const childrenByIri = MutableHashMap.fromIterable(
    A.map(snapshot.hierarchy, (entry) => [entry.iri, entry.childIris] as const)
  );
  const emittedIds = MutableHashSet.empty<string>();

  const hasVisibleParent = (resource: OntologyResourceSummary): boolean =>
    pipe(
      resource.parentIris,
      A.some((parentIri) => MutableHashSet.has(visibleIds, parentIri))
    );

  const toItem = (resource: OntologyResourceSummary, path: ReadonlyArray<string>): O.Option<OntologyTreeItem> => {
    if (MutableHashSet.has(emittedIds, resource.iri) || pipe(path, A.contains(resource.iri))) {
      return O.none();
    }

    MutableHashSet.add(emittedIds, resource.iri);

    const children = pipe(
      MutableHashMap.get(childrenByIri, resource.iri),
      O.getOrElse(emptyStrings),
      A.filter((childIri) => MutableHashSet.has(visibleIds, childIri)),
      A.filter((childIri) => !MutableHashSet.has(emittedIds, childIri)),
      A.filter((childIri) => !pipe(path, A.contains(childIri)))
    );
    const childItems = A.flatMap(children, (childIri) =>
      pipe(
        MutableHashMap.get(resourcesByIri, childIri),
        O.flatMap((child) => toItem(child, pipe(path, A.append(resource.iri)))),
        O.toArray
      )
    );
    return O.some(
      childItems.length === 0
        ? { id: resource.iri, label: resource.label }
        : { id: resource.iri, label: resource.label, children: childItems }
    );
  };

  const roots = pipe(
    visible,
    A.filter((resource) => !hasVisibleParent(resource))
  );
  const seeds = roots.length === 0 ? visible : roots;

  return pipe(
    seeds,
    A.flatMap((resource) => pipe(toItem(resource, []), O.toArray))
  );
});
