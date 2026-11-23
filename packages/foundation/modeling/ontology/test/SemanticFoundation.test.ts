import { IRI, IRIReference } from "@beep/identity/Iri";
import { $SemanticFoundationId } from "@beep/identity/packages";
import { ConceptAlignment } from "@beep/ontology/ConceptScheme";
import {
  DocumentClass,
  FilingSegment,
  isFilingSegment,
  TaxonomyConcept,
  TaxonomySeed,
} from "@beep/ontology/SemanticFoundation.models";
import { SemanticFoundationSeed } from "@beep/ontology/SemanticFoundation.seed";
import { LibrarianInput, runLibrarianLoop } from "@beep/ontology/TaxonomyRegistry";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeLibrarianInputResult = S.decodeResult(LibrarianInput);
const decodeUnknownFilingSegmentOption = S.decodeUnknownOption(FilingSegment);
const encodeFilingSegmentOption = S.encodeOption(FilingSegment);

const emailMessageIri = IRIReference.make($SemanticFoundationId.create("concept/email-message").iri);
const folioAlignment = ConceptAlignment.make({
  predicate: "skos:closeMatch",
  target: IRI.make("https://folio.openlegalstandard.org/RDQy4rbUg82ScgiiXEQ7ZBU"),
  source: IRI.makeOption("https://folio.openlegalstandard.org/RDQy4rbUg82ScgiiXEQ7ZBU/jsonld"),
});

const alignedSeed = TaxonomySeed.make({
  ...SemanticFoundationSeed,
  concepts: A.map(SemanticFoundationSeed.concepts, (concept) =>
    concept.iri === emailMessageIri ? TaxonomyConcept.make({ ...concept, alignments: [folioAlignment] }) : concept
  ),
});

it.layer(Layer.empty, { timeout: "30 seconds" })("semantic foundation", (it) => {
  it.effect(
    "runs the librarian loop over an aligned concept",
    Effect.fnUntraced(function* () {
      const conceptIri = emailMessageIri;
      const output = yield* runLibrarianLoop(
        alignedSeed,
        LibrarianInput.make({
          client: "acme",
          conceptIri,
          documentClass: "received",
          fileName: "intake-email.eml",
          matter: "aurora",
        })
      );
      expect(output.conceptIri).toBe(conceptIri);
      expect(output.documentClass).toBe("received");
      expect(output.alignments).toEqual([folioAlignment]);
      expect(A.map(output.filingPaths, (filingPath) => filingPath.path)).toEqual([
        "vault/acme/aurora/email-messages/received/intake-email.eml",
        "box-mirror/acme/aurora/email-messages/received/intake-email.eml",
      ]);
      expect(DocumentClass.literals).toEqual([
        "draft",
        "redline",
        "filed",
        "received",
        "privileged",
        "extracted-child",
      ]);
    })
  );

  it.effect.prop(
    "round-trips generated filing segments and never admits separators",
    [Arbitrary.schema(FilingSegment)],
    ([segment]) =>
      Effect.sync(() => {
        const decoded = O.flatMap(encodeFilingSegmentOption(segment), decodeUnknownFilingSegmentOption);
        pipe(
          O.exists(decoded, (value) => value === segment),
          assertTrue
        );
        pipe(isFilingSegment(segment), assertTrue);
      }),
    { arbitrary: fcRuns() }
  );

  it.effect(
    "rejects traversal segments in librarian input at decode time",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.sync(() =>
        decodeLibrarianInputResult({
          client: "acme",
          conceptIri: emailMessageIri,
          documentClass: "received",
          fileName: "../../other-matter/document.pdf",
          matter: "aurora",
        })
      );
      expect(decoded._tag).toBe("Failure");
    })
  );
});
