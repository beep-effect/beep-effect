import { IRI } from "@beep/identity/Iri";
import { $SemanticFoundationId } from "@beep/identity/packages";
import {
  DocumentClass,
  FilingSegment,
  IntakeTaxonomy,
  isFilingSegment,
} from "@beep/law-practice-domain/values/IntakeTaxonomy";
import { intakeScheme, intakeTaxonomy } from "@beep/law-practice-domain/values/LegalVocabularyPack";
import {
  IntakeTaxonomySchemeMismatch,
  LibrarianInput,
  runLibrarianLoop,
  TaxonomyConceptNotFound,
  UnsupportedDocumentClass,
} from "@beep/law-practice-domain/values/LibrarianLoop";
import { ConceptAlignment, ConceptScheme, ConceptSchemePin } from "@beep/ontology/ConceptScheme";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { legalPackLayer, loadLegalPack } from "./support/LegalPack.ts";
import type { IntakeFiling } from "@beep/law-practice-domain/values/IntakeTaxonomy";

const decodeLibrarianInputResult = S.decodeUnknownResult(LibrarianInput);
const decodeUnknownFilingSegmentOption = S.decodeUnknownOption(FilingSegment);
const encodeFilingSegmentOption = S.encodeOption(FilingSegment);

const concept = (path: string) => IRI.make($SemanticFoundationId.create(path).iri);
const emailMessage = concept("concept/email-message");
const folioAlignment = ConceptAlignment.make({
  predicate: "skos:closeMatch",
  target: IRI.make("https://folio.openlegalstandard.org/RDQy4rbUg82ScgiiXEQ7ZBU"),
  source: IRI.makeOption("https://folio.openlegalstandard.org/RDQy4rbUg82ScgiiXEQ7ZBU/jsonld"),
});

const input = (conceptIri: IRI, documentClass: DocumentClass) =>
  LibrarianInput.make({ client: "acme", conceptIri, documentClass, fileName: "intake-email.eml", matter: "aurora" });

const loadIntake = Effect.fnUntraced(function* () {
  const pack = yield* loadLegalPack();
  const scheme = yield* intakeScheme(pack);
  const taxonomy = yield* intakeTaxonomy(pack);
  return { scheme, taxonomy };
});

const expectDeclaredEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  pipe(same(first, second), assertTrue);
  pipe(same(first, different), assertFalse);
};

it.layer(legalPackLayer, { timeout: "30 seconds" })("librarian loop", (it) => {
  it.effect(
    "files an aligned email message under every root through the path template",
    Effect.fnUntraced(function* () {
      const { scheme, taxonomy } = yield* loadIntake();
      const output = yield* runLibrarianLoop(scheme, taxonomy, input(emailMessage, "received"));
      expect(output.conceptIri).toBe(emailMessage);
      expect(output.documentClass).toBe("received");
      expect(A.fromIterable(output.alignments)).toEqual([folioAlignment]);
      expect(A.map(output.filingPaths, (filingPath) => [filingPath.kind, filingPath.path])).toEqual([
        ["local-vault", "vault/acme/aurora/email-messages/received/intake-email.eml"],
        ["box-mirror", "box-mirror/acme/aurora/email-messages/received/intake-email.eml"],
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

  it.effect(
    "refuses a document class the concept does not admit",
    Effect.fnUntraced(function* () {
      const { scheme, taxonomy } = yield* loadIntake();
      const error = yield* runLibrarianLoop(scheme, taxonomy, input(emailMessage, "filed")).pipe(Effect.flip);
      expect(S.is(UnsupportedDocumentClass)(error)).toBe(true);
    })
  );

  it.effect(
    "refuses a concept outside the scheme and a scheme concept the taxonomy does not file",
    Effect.fnUntraced(function* () {
      const { scheme, taxonomy } = yield* loadIntake();
      const outside = yield* runLibrarianLoop(scheme, taxonomy, input(concept("concept/missing"), "received")).pipe(
        Effect.flip
      );
      expect(S.is(TaxonomyConceptNotFound)(outside)).toBe(true);
      const unfiled = IntakeTaxonomy.make({
        ...taxonomy,
        filings: A.filter(taxonomy.filings, (filing: IntakeFiling) => filing.concept !== emailMessage),
      });
      const missing = yield* runLibrarianLoop(scheme, unfiled, input(emailMessage, "received")).pipe(Effect.flip);
      expect(S.is(TaxonomyConceptNotFound)(missing)).toBe(true);
    })
  );

  it.effect(
    "refuses a taxonomy pinned to another scheme version",
    Effect.fnUntraced(function* () {
      const { scheme, taxonomy } = yield* loadIntake();
      const other = ConceptScheme.make({ ...scheme, version: "2.0.0" });
      const error = yield* runLibrarianLoop(other, taxonomy, input(emailMessage, "received")).pipe(Effect.flip);
      expect(S.is(IntakeTaxonomySchemeMismatch)(error)).toBe(true);
      expect(S.is(IntakeTaxonomySchemeMismatch)(error) && error.given.version).toBe("2.0.0");
    })
  );

  it.effect(
    "rejects traversal segments in librarian input at decode time",
    Effect.fnUntraced(function* () {
      const decoded = decodeLibrarianInputResult({
        client: "acme",
        conceptIri: emailMessage,
        documentClass: "received",
        fileName: "../../other-matter/document.pdf",
        matter: "aurora",
      });
      expect(decoded._tag).toBe("Failure");
      expect(A.map([".", "..", "a\\b", "a\u0000b", "a/b"], isFilingSegment)).toEqual([
        false,
        false,
        false,
        false,
        false,
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

  it("compares TaxonomyConceptNotFound and UnsupportedDocumentClass by declared fields", () => {
    expectDeclaredEquivalence(
      S.toEquivalence(TaxonomyConceptNotFound),
      TaxonomyConceptNotFound.make({ conceptIri: IRI.make("https://example.test/missing") }),
      TaxonomyConceptNotFound.make({ conceptIri: IRI.make("https://example.test/missing") }),
      TaxonomyConceptNotFound.make({ conceptIri: IRI.make("https://example.test/other") })
    );
    const conceptIri = IRI.make("https://example.test/example");
    expectDeclaredEquivalence(
      S.toEquivalence(UnsupportedDocumentClass),
      UnsupportedDocumentClass.make({ conceptIri, documentClass: "filed" }),
      UnsupportedDocumentClass.make({ conceptIri, documentClass: "filed" }),
      UnsupportedDocumentClass.make({ conceptIri, documentClass: "received" })
    );
    expect(HashSet.size(HashSet.make(ConceptSchemePin.make({ scheme: conceptIri, version: "1" })))).toBe(1);
  });
});
