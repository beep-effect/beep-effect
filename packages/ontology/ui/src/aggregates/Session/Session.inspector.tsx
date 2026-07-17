/**
 * Ontology workbench Inspector region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ApplyOntologyBatchInput,
  ApplyOntologyGraphGestureInput,
  applyOntologyBatchAtom,
  applyOntologyGraphGestureAtom,
  objectInputAtom,
  objectKindAtom,
  ontologyPredicateSuggestionsAtom,
  ontologySessionAtom,
  predicateInputAtom,
  selectedOntologyResourceAtom,
  subjectInputAtom,
} from "@beep/ontology-client/aggregates/Session";
import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session";
import { OntologyGraphGesture } from "@beep/ontology-use-cases/aggregates/Session";
import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { Input } from "@beep/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@beep/ui/components/native-select";
import { A, O, Str } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { iriFieldValid, valueFromEvent } from "./Session.workbench.shared.js";
import type { OntologyResourceSummary } from "@beep/ontology-use-cases/aggregates/Session";
import type { JSX } from "react";

type TripleValues = {
  readonly object: string;
  readonly objectKind: "iri" | "literal";
  readonly predicate: string;
  readonly subject: string;
};

type TripleValidationMessagesProps = TripleValues & {
  readonly objectValid: boolean;
  readonly predicateValid: boolean;
  readonly subjectValid: boolean;
};

const resourceBadgeVariant = (resource: OntologyResourceSummary): "default" | "secondary" =>
  resource.classification === "tbox" ? "default" : "secondary";

const applyTriple = (
  canApplyTriple: boolean,
  values: TripleValues,
  applyBatch: (input: ApplyOntologyBatchInput) => void
): void => {
  if (!canApplyTriple) return;
  const quad = makeQuad(
    makeNamedNode(Str.trim(values.subject)),
    makeNamedNode(Str.trim(values.predicate)),
    values.objectKind === "iri" ? makeNamedNode(Str.trim(values.object)) : makeLiteral(values.object, XSD_STRING.value)
  );
  applyBatch(
    ApplyOntologyBatchInput.make({
      operations: [
        ChangeOperation.make({
          kind: "addQuad",
          partition: "asserted",
          quad,
        }),
      ],
    })
  );
};

const applyEdgeGesture = (
  canApplyGraphGesture: boolean,
  kind: "connect" | "delete" | "expand",
  values: TripleValues,
  applyGraphGesture: (input: ApplyOntologyGraphGestureInput) => void
): void => {
  if (!canApplyGraphGesture) return;
  applyGraphGesture(
    ApplyOntologyGraphGestureInput.make({
      gesture: OntologyGraphGesture.make({
        kind,
        sourceIri: Str.trim(values.subject),
        predicateIri: Str.trim(values.predicate),
        targetIri: Str.trim(values.object),
      }),
    })
  );
};

const applyInstantiateGesture = (
  canApplyGraphGesture: boolean,
  values: TripleValues,
  applyGraphGesture: (input: ApplyOntologyGraphGestureInput) => void
): void => {
  if (!canApplyGraphGesture) return;
  applyGraphGesture(
    ApplyOntologyGraphGestureInput.make({
      gesture: OntologyGraphGesture.make({
        kind: "instantiate",
        classIri: Str.trim(values.subject),
        instanceIri: Str.trim(values.object),
      }),
    })
  );
};

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

const TripleValidationMessages = ({
  object,
  objectKind,
  objectValid,
  predicate,
  predicateValid,
  subject,
  subjectValid,
}: TripleValidationMessagesProps): JSX.Element => (
  <>
    {Str.isNonEmpty(Str.trim(subject)) && !subjectValid ? (
      <p className="text-destructive text-xs">Subject must be an IRI (e.g. https://example.org/pizza#Pizza).</p>
    ) : null}
    {Str.isNonEmpty(Str.trim(predicate)) && !predicateValid ? (
      <p className="text-destructive text-xs">
        Predicate must be an IRI (e.g. http://www.w3.org/2000/01/rdf-schema#label).
      </p>
    ) : null}
    {objectKind === "iri" && Str.isNonEmpty(Str.trim(object)) && !objectValid ? (
      <p className="text-destructive text-xs">An IRI object must be an IRI.</p>
    ) : null}
  </>
);

// The zero-behavior extraction keeps the established form validation and
// gesture guards together so every action reads one consistent input snapshot.
// fallow-ignore-next-line complexity
const OntologyAddTripleForm = (): JSX.Element => {
  const session = useAtomValue(ontologySessionAtom);
  const predicateSuggestions = useAtomValue(ontologyPredicateSuggestionsAtom);
  const subject = useAtomValue(subjectInputAtom);
  const predicate = useAtomValue(predicateInputAtom);
  const object = useAtomValue(objectInputAtom);
  const objectKind = useAtomValue(objectKindAtom);
  const setSubject = useAtomSet(subjectInputAtom);
  const setPredicate = useAtomSet(predicateInputAtom);
  const setObject = useAtomSet(objectInputAtom);
  const setObjectKind = useAtomSet(objectKindAtom);
  const applyBatch = useAtomSet(applyOntologyBatchAtom);
  const applyGraphGesture = useAtomSet(applyOntologyGraphGestureAtom);
  const subjectValid = iriFieldValid(subject);
  const predicateValid = iriFieldValid(predicate);
  const objectValid = objectKind === "iri" ? iriFieldValid(object) : Str.isNonEmpty(Str.trim(object));
  const canApplyTriple = subjectValid && predicateValid && objectValid;
  const canApplyGraphGesture = canApplyTriple && objectKind === "iri";
  const values: TripleValues = { object, objectKind, predicate, subject };

  return (
    <section className="border-b p-3">
      <h2 className="mb-2 text-sm font-semibold">Add Triple</h2>
      <div className="space-y-2">
        <Input
          aria-label="Subject IRI"
          aria-invalid={Str.isNonEmpty(Str.trim(subject)) && !subjectValid}
          value={subject}
          onChange={(event) => setSubject(valueFromEvent(event))}
        />
        <Input
          aria-label="Predicate IRI"
          aria-invalid={Str.isNonEmpty(Str.trim(predicate)) && !predicateValid}
          list="ontology-predicate-suggestions"
          value={predicate}
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
            value={objectKind}
            onChange={(event) =>
              Match.value(valueFromEvent(event)).pipe(
                Match.when("iri", setObjectKind),
                Match.when("literal", setObjectKind),
                Match.orElse(() => undefined)
              )
            }
          >
            <NativeSelectOption value="literal">Literal</NativeSelectOption>
            <NativeSelectOption value="iri">IRI</NativeSelectOption>
          </NativeSelect>
          <Input
            aria-label="Object value"
            aria-invalid={Str.isNonEmpty(Str.trim(object)) && !objectValid}
            value={object}
            onChange={(event) => setObject(valueFromEvent(event))}
          />
        </div>
        <TripleValidationMessages
          object={object}
          objectKind={objectKind}
          objectValid={objectValid}
          predicate={predicate}
          predicateValid={predicateValid}
          subject={subject}
          subjectValid={subjectValid}
        />
        <Button
          className="w-full"
          size="sm"
          type="button"
          disabled={O.isNone(session) || !canApplyTriple}
          onClick={() => applyTriple(canApplyTriple, values, applyBatch)}
        >
          Apply
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={!canApplyGraphGesture}
            onClick={() => applyEdgeGesture(canApplyGraphGesture, "connect", values, applyGraphGesture)}
          >
            Connect
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={!canApplyGraphGesture}
            onClick={() => applyEdgeGesture(canApplyGraphGesture, "delete", values, applyGraphGesture)}
          >
            Delete
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={!canApplyGraphGesture}
            onClick={() => applyEdgeGesture(canApplyGraphGesture, "expand", values, applyGraphGesture)}
          >
            Expand
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={!canApplyGraphGesture}
            onClick={() => applyInstantiateGesture(canApplyGraphGesture, values, applyGraphGesture)}
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
 * @example
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
  return (
    <>
      <OntologyInspectorSummary />
      <OntologyAddTripleForm />
    </>
  );
}
