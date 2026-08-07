/**
 * Ontology workbench SPARQL region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  applyOntologySparqlExampleAtom,
  ontologyInferredViewAtom,
  ontologySessionAtom,
  ontologySparqlErrorAtom,
  ontologySparqlExamplesAtom,
  ontologySparqlProfileAtom,
  ontologySparqlQueryAtom,
  ontologySparqlResultAtom,
  runOntologySparqlAtom,
} from "@beep/ontology-client/aggregates/Session";
import { OntologySparqlPanelProfile } from "@beep/ontology-use-cases/aggregates/Session";
import { serializeQuad, serializeTerm } from "@beep/rdf/Rdf";
import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@beep/ui/components/native-select";
import { Textarea } from "@beep/ui/components/textarea";
import { A, O, R, Str } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { pipe } from "effect";
import * as S from "effect/Schema";
import { valueFromEvent } from "./Session.workbench.shared.ts";
import type { RunOntologySparqlResult } from "@beep/ontology-use-cases/aggregates/Session";
import type { JSX, KeyboardEvent } from "react";

const isOntologySparqlPanelProfile = S.is(OntologySparqlPanelProfile);

const sparqlResultPreview = (result: RunOntologySparqlResult): JSX.Element => {
  if (result.result.profile === "select") {
    return (
      <div className="space-y-2">
        {result.result.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rows.</p>
        ) : (
          A.map(A.take(result.result.rows, 8), (row, index) => (
            <div key={index} className="rounded-md border p-2 font-mono text-[11px]">
              {A.map(R.toEntries(row), ([name, term]) => (
                <div key={name} className="grid grid-cols-[70px_minmax(0,1fr)] gap-2">
                  <span className="text-muted-foreground">?{name}</span>
                  <span className="break-all">{serializeTerm(term)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    );
  }

  if (result.result.profile === "construct") {
    return (
      <div className="space-y-2">
        {result.result.dataset.quads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quads.</p>
        ) : (
          A.map(A.take(result.result.dataset.quads, 8), (quad, index) => (
            <div key={`${index}-${serializeQuad(quad)}`} className="rounded-md border p-2 font-mono text-[11px]">
              {serializeQuad(quad)}
            </div>
          ))
        )}
      </div>
    );
  }

  if (result.result.profile === "ask") {
    return (
      <p className="text-sm font-medium" data-testid="sparql-ask-result">
        {result.result.value ? "Yes — the pattern matches." : "No — the pattern does not match."}
      </p>
    );
  }

  return <p className="text-sm text-muted-foreground">Unsupported result.</p>;
};

const noSparqlResult = (): JSX.Element => <p className="text-sm text-muted-foreground">No query result.</p>;

const sparqlErrorView = (error: string): JSX.Element => <p className="text-sm text-destructive">{error}</p>;

const sparqlResultView = (result: RunOntologySparqlResult): JSX.Element => (
  <div className="space-y-2">
    <div className="flex flex-wrap gap-1">
      {result.result.profile === "ask" ? null : <Badge variant="outline">LIMIT {result.effectiveLimit}</Badge>}
      {result.limitInjected ? <Badge variant="secondary">injected</Badge> : null}
      {result.truncated ? <Badge variant="destructive">truncated</Badge> : null}
    </div>
    {sparqlResultPreview(result)}
  </div>
);

const sparqlResultPanel = (error: O.Option<string>, result: O.Option<RunOntologySparqlResult>): JSX.Element =>
  pipe(
    error,
    O.map(sparqlErrorView),
    O.getOrElse(() => pipe(result, O.map(sparqlResultView), O.getOrElse(noSparqlResult)))
  );

/**
 * Query profile, examples, editor, execution action, and result preview.
 *
 * **Example** (Import OntologySparqlRegion)
 *
 * ```tsx
 * import { OntologySparqlRegion } from "@beep/ontology-ui"
 *
 * console.log(OntologySparqlRegion)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OntologySparqlRegion(): JSX.Element {
  const session = useAtomValue(ontologySessionAtom);
  const inferredView = useAtomValue(ontologyInferredViewAtom);
  const sparqlProfile = useAtomValue(ontologySparqlProfileAtom);
  const sparqlQuery = useAtomValue(ontologySparqlQueryAtom);
  const sparqlExamples = useAtomValue(ontologySparqlExamplesAtom);
  const sparqlResult = useAtomValue(ontologySparqlResultAtom);
  const sparqlError = useAtomValue(ontologySparqlErrorAtom);
  const setSparqlProfile = useAtomSet(ontologySparqlProfileAtom);
  const setSparqlQuery = useAtomSet(ontologySparqlQueryAtom);
  const applySparqlExample = useAtomSet(applyOntologySparqlExampleAtom);
  const runSparql = useAtomSet(runOntologySparqlAtom);
  const canRunSparql = O.isSome(session) && Str.isNonEmpty(Str.trim(sparqlQuery));

  const runSparqlFromKeyboard = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (canRunSparql) runSparql(undefined);
    }
  };

  const selectSparqlExample = (exampleId: string): void => {
    if (Str.isNonEmpty(exampleId)) applySparqlExample(exampleId);
  };

  return (
    <section className="border-b p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">SPARQL</h2>
        <Badge variant={inferredView ? "secondary" : "outline"}>{inferredView ? "inferred" : "asserted"}</Badge>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <NativeSelect
            aria-label="SPARQL profile"
            value={sparqlProfile}
            onChange={(event) => {
              const value = valueFromEvent(event);
              if (isOntologySparqlPanelProfile(value)) setSparqlProfile(value);
            }}
          >
            <NativeSelectOption value="select">SELECT</NativeSelectOption>
            <NativeSelectOption value="construct">CONSTRUCT</NativeSelectOption>
            <NativeSelectOption value="ask">ASK</NativeSelectOption>
          </NativeSelect>
          <NativeSelect
            aria-label="SPARQL examples"
            value=""
            onChange={(event) => selectSparqlExample(valueFromEvent(event))}
          >
            <NativeSelectOption value="">Examples</NativeSelectOption>
            {A.map(sparqlExamples, (example) => (
              <NativeSelectOption key={example.id} value={example.id}>
                {example.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Textarea
          aria-label="SPARQL query"
          className="h-40 resize-none font-mono text-xs leading-5"
          value={sparqlQuery}
          onChange={(event) => setSparqlQuery(valueFromEvent(event))}
          onKeyDown={runSparqlFromKeyboard}
        />
        <Button
          // Disabled must read as inactive, not as broken primary chrome: a
          // muted chip at full opacity instead of a washed-out green
          // (QA finding R1-07 — the low-contrast state was the disabled one).
          className="w-full dark:text-foreground disabled:bg-muted disabled:text-muted-foreground dark:disabled:text-muted-foreground disabled:opacity-100"
          size="sm"
          type="button"
          disabled={!canRunSparql}
          onClick={() => runSparql(undefined)}
        >
          Run
        </Button>
        <div className="rounded-md border p-2 text-xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium">Result</span>
            {O.match(sparqlResult, {
              onNone: () => <Badge variant="outline">empty</Badge>,
              onSome: (result) => (
                <Badge variant={result.truncated ? "destructive" : "secondary"}>
                  {result.displayedResultCount}/{result.rawResultCount}
                </Badge>
              ),
            })}
          </div>
          {sparqlResultPanel(sparqlError, sparqlResult)}
        </div>
      </div>
    </section>
  );
}
