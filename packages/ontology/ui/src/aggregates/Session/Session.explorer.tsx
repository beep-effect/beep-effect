/**
 * Ontology workbench Explorer region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ontologySearchQueryAtom,
  ontologySearchResultsAtom,
  ontologySnapshotAtom,
  ontologyViewModeAtom,
  selectedOntologyResourceIriAtom,
  visibleOntologyResourcesAtom,
} from "@beep/ontology-client/aggregates/Session";
import { Input } from "@beep/ui/components/input";
import { O } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { ontologyTreeItemsFor } from "./Session.tree.js";
import { valueFromEvent } from "./Session.workbench.shared.js";
import type { JSX } from "react";

/**
 * Search controls and resource tree for the ontology workbench.
 *
 * @example
 * ```tsx
 * import { OntologyExplorerRegion } from "@beep/ontology-ui"
 *
 * console.log(OntologyExplorerRegion)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OntologyExplorerRegion(): JSX.Element {
  const snapshot = useAtomValue(ontologySnapshotAtom);
  const mode = useAtomValue(ontologyViewModeAtom);
  const searchQuery = useAtomValue(ontologySearchQueryAtom);
  const searchResults = useAtomValue(ontologySearchResultsAtom);
  const selectedIri = useAtomValue(selectedOntologyResourceIriAtom);
  const visibleResources = useAtomValue(visibleOntologyResourcesAtom);
  const setSearchQuery = useAtomSet(ontologySearchQueryAtom);
  const setSelectedIri = useAtomSet(selectedOntologyResourceIriAtom);
  const treeItems = ontologyTreeItemsFor(snapshot, mode);

  return (
    <aside className="flex min-h-0 flex-col border-r">
      <div className="border-b p-3">
        <Input
          aria-label="Search ontology resources"
          placeholder="Search resources"
          value={searchQuery}
          onChange={(event) => setSearchQuery(valueFromEvent(event))}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{visibleResources.length} visible</span>
          <span>{searchResults.length} matches</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <RichTreeView
          items={treeItems}
          selectedItems={O.getOrNull(selectedIri)}
          onSelectedItemsChange={(_, itemId) => setSelectedIri(O.fromNullishOr(itemId))}
        />
      </div>
    </aside>
  );
}
