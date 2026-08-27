/**
 * Ontology workbench Inspector region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  applyOntologyInspectorActionAtom,
  ontologyInspectorFormStateAtom,
  ontologyPathAtom,
  ontologyPredicateSuggestionsAtom,
  selectedOntologyResourceAtom,
  setOntologyInspectorInputAtoms,
  setOntologyInspectorObjectKindAtom,
} from "@beep/ontology-client/aggregates/Session";
import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { Input } from "@beep/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@beep/ui/components/native-select";
import { A, O } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { valueFromEvent } from "./Session.workbench.shared.ts";
import type { OntologyInspectorFormState, OntologyInspectorResource } from "@beep/ontology-client/aggregates/Session";
import type { JSX } from "react";

const resourceBadgeVariant = (resource: OntologyInspectorResource): "default" | "secondary" =>
  resource.classification === "tbox" ? "default" : "secondary";

const OntologyInspectorSummary = (): JSX.Element => {
  const selected = useAtomValue(selectedOntologyResourceAtom);

  return (
    <section className="border-b p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Inspector</h2>
        {O.match(selected, {
          onNone: () => <Badge variant="outline">None</Badge>,
          onSome: (resource) => <Badge variant={resourceBadgeVariant(resource)}>{resource.classification}</Badge>,
        })}
      </div>
      {O.match(selected, {
        onNone: () => <p className="text-sm text-muted-foreground">No resource selected.</p>,
        onSome: (resource) => (
          <div className="space-y-2 text-sm">
            <div className="font-medium">{resource.label}</div>
            <div className="break-all font-mono text-xs text-muted-foreground">{resource.iri}</div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{resource.kind}</Badge>
              {A.map(resource.sourcePartitions, (partition) => (
                <Badge key={partition} variant="outline">
                  {partition}
                </Badge>
              ))}
            </div>
          </div>
        ),
      })}
    </section>
  );
};

const TripleValidationMessages = ({ state }: { readonly state: OntologyInspectorFormState }): JSX.Element => (
  <>
    {state.showSubjectError ? (
      <p className="text-destructive text-xs">Subject must be an IRI (e.g. https://example.org/pizza#Pizza).</p>
    ) : null}
    {state.showPredicateError ? (
      <p className="text-destructive text-xs">
        Predicate must be an IRI (e.g. http://www.w3.org/2000/01/rdf-schema#label).
      </p>
    ) : null}
    {state.showObjectError ? <p className="text-destructive text-xs">An IRI object must be an IRI.</p> : null}
  </>
);

// The zero-behavior extraction keeps the established form validation and
// gesture guards together so every action reads one consistent input snapshot.
// fallow-ignore-next-line complexity -- form keeps validation and action guards on one atom-backed input snapshot
const OntologyAddTripleForm = (): JSX.Element => {
  const form = useAtomValue(ontologyInspectorFormStateAtom);
  const predicateSuggestions = useAtomValue(ontologyPredicateSuggestionsAtom);
  const setSubject = useAtomSet(setOntologyInspectorInputAtoms("subject"));
  const setPredicate = useAtomSet(setOntologyInspectorInputAtoms("predicate"));
  const setObject = useAtomSet(setOntologyInspectorInputAtoms("object"));
  const setObjectKind = useAtomSet(setOntologyInspectorObjectKindAtom);
  const applyAction = useAtomSet(applyOntologyInspectorActionAtom);

  return (
    <section className="border-b p-3">
      <h2 className="mb-2 text-sm font-semibold">Add Triple</h2>
      <div className="space-y-2">
        <Input
          aria-label="Subject IRI"
          aria-invalid={form.showSubjectError}
          value={form.subject}
          onChange={(event) => setSubject(valueFromEvent(event))}
        />
        <Input
          aria-label="Predicate IRI"
          aria-invalid={form.showPredicateError}
          list="ontology-predicate-suggestions"
          value={form.predicate}
          onChange={(event) => setPredicate(valueFromEvent(event))}
        />
        <datalist id="ontology-predicate-suggestions">
          {A.map(predicateSuggestions, (suggestion) => (
            <option key={suggestion.iri} value={suggestion.iri}>
              {suggestion.label}
            </option>
          ))}
        </datalist>
        <div className="flex gap-2">
          <NativeSelect
            aria-label="Object type"
            className="w-28 shrink-0"
            value={form.objectKind}
            onChange={(event) => setObjectKind(valueFromEvent(event))}
          >
            <NativeSelectOption value="literal">Literal</NativeSelectOption>
            <NativeSelectOption value="iri">IRI</NativeSelectOption>
          </NativeSelect>
          <Input
            aria-label="Object value"
            aria-invalid={form.showObjectError}
            value={form.object}
            onChange={(event) => setObject(valueFromEvent(event))}
          />
        </div>
        <TripleValidationMessages state={form} />
        <Button
          className="w-full disabled:bg-muted disabled:text-muted-foreground"
          size="sm"
          type="button"
          disabled={!form.canApplyTriple}
          onClick={() => applyAction("addTriple")}
        >
          Apply
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={!form.canApplyGraphGesture}
            onClick={() => applyAction("connect")}
          >
            Connect
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={!form.canApplyGraphGesture}
            onClick={() => applyAction("delete")}
          >
            Delete
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={!form.canApplyGraphGesture}
            onClick={() => applyAction("expand")}
          >
            Expand
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={!form.canApplyGraphGesture}
            onClick={() => applyAction("instantiate")}
          >
            Instantiate
          </Button>
        </div>
      </div>
    </section>
  );
};

/**
 * Selected-resource details, Add Triple form, and graph gestures.
 *
 * **Example** (Import OntologyInspectorRegion)
 *
 * ```tsx
 * import { OntologyInspectorRegion } from "@beep/ontology-ui"
 *
 * console.log(OntologyInspectorRegion)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OntologyInspectorRegion(): JSX.Element {
  const path = useAtomValue(ontologyPathAtom);

  return (
    <>
      <OntologyInspectorSummary />
      {O.isNone(path) ? (
        // Same honest empty state Explorer/Source use: a sessionless Add Triple
        // form is all disabled buttons dressed up as an invitation to type.
        <p className="flex min-h-0 flex-1 items-center justify-center p-3 text-sm text-muted-foreground">
          No ontology file open
        </p>
      ) : (
        <OntologyAddTripleForm />
      )}
    </>
  );
}
