import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session";
import {
  ExportOntologyProvenanceCommand,
  ExportOntologyProvenanceResult,
  OntologyFilePath,
  OntologyReasoner,
  OntologyRpcs,
  OntologySparqlRunner,
  OntologyValidationRunner,
  RunOntologyValidationInput,
  RunOntologyValidationResult,
  SessionUseCases,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { RpcTest } from "effect/rpc";
import * as S from "effect/Schema";
import { OntologyHandlersLive } from "@/ontology/OntologyOrchestrator";
import { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";

const decodeRunOntologyValidationResult = S.decodeUnknownEffect(RunOntologyValidationResult);
const decodeSessionId = S.decodeEffect(SessionId);
const decodeOntologyFilePath = S.decodeEffect(OntologyFilePath);

const registrationLayerTimeout = vitestCoverageRunActive || fcDeepSweepActive ? "5 minutes" : "10 seconds";
const makeRegistrationFixture = Effect.gen(function* () {
  const sessionId = yield* decodeSessionId("session-rpc-validation");
  const provPath = yield* decodeOntologyFilePath("tmp/session-rpc-validation.prov.ttl");
  const datasetPath = yield* decodeOntologyFilePath("tmp/session-rpc-validation.dataset.ttl");
  const material = makeNamedNode("http://example.org/materials#Material");
  const metal = makeNamedNode("http://example.org/materials#Metal");
  const subclassOf = makeNamedNode(`${RDFS_NAMESPACE}subClassOf`);
  const session = createSession(
    CreateSessionInput.make({
      id: sessionId,
      baseDataset: makeDataset([makeQuad(material, RDF_TYPE, OWL_CLASS), makeQuad(metal, RDF_TYPE, OWL_CLASS)]),
    })
  );
  const validationResult = yield* decodeRunOntologyValidationResult({
    validation: {
      conforms: false,
      violations: [
        {
          focusNode: metal.value,
          path: subclassOf,
          message: `Expected value ${material.value} for ${subclassOf.value}.`,
          severity: "violation",
        },
      ],
      truncated: false,
    },
    repairs: [],
    shapeCount: 1,
    dataQuadCount: 2,
    inferredQuadCount: 0,
  });
  const exportResult = ExportOntologyProvenanceResult.make({
    provPath,
    datasetPath,
    provSource: "@prefix prov: <http://www.w3.org/ns/prov#> .",
    datasetSource: "@prefix void: <http://rdfs.org/ns/void#> .",
  });
  let validationInvocations = 0;
  let exportInvocations = 0;
  const handlersLayer = OntologyHandlersLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(
          SessionUseCases,
          SessionUseCases.of({
            openFile: Effect.fn("SessionUseCases.openFile")(() => Effect.die(new Error("open not used"))),
            saveFile: Effect.fn("SessionUseCases.saveFile")(() => Effect.die(new Error("save not used"))),
            serialize: Effect.fn("SessionUseCases.serialize")(() => Effect.die(new Error("serialize not used"))),
          })
        ),
        Layer.succeed(
          OntologyReasoner,
          OntologyReasoner.of({
            infer: Effect.fn("OntologyReasoner.infer")(() => Effect.die(new Error("infer not used"))),
          })
        ),
        Layer.succeed(
          OntologySparqlRunner,
          OntologySparqlRunner.of({
            run: Effect.fn("OntologySparqlRunner.run")(() => Effect.die(new Error("sparql not used"))),
          })
        ),
        Layer.succeed(
          OntologyValidationRunner,
          OntologyValidationRunner.of({
            run: Effect.fn("test.validation.run")(() =>
              Effect.sync(() => {
                validationInvocations += 1;
                return validationResult;
              })
            ),
            exportProvenance: Effect.fn("test.validation.exportProvenance")(() =>
              Effect.sync(() => {
                exportInvocations += 1;
                return exportResult;
              })
            ),
          })
        )
      )
    )
  );

  return {
    session,
    provPath,
    datasetPath,
    handlersLayer,
    validationInvocations: () => validationInvocations,
    exportInvocations: () => exportInvocations,
  };
});

class RegistrationFixture extends Context.Service<
  RegistrationFixture,
  Effect.Success<typeof makeRegistrationFixture>
>()("@beep/professional-desktop/test/ontology-sidecar-registration.test/RegistrationFixture") {}

const RegistrationLive = Layer.unwrap(
  Effect.map(makeRegistrationFixture, (fixture) =>
    Layer.merge(fixture.handlersLayer, Layer.succeed(RegistrationFixture, fixture))
  )
);

it.layer(RegistrationLive, { timeout: registrationLayerTimeout })(
  "@beep/professional-desktop ontology sidecar registration",
  (it) => {
    it.effect(
      "serves validation and provenance RPCs through OntologyRpcs",
      Effect.fnUntraced(function* () {
        const fixture = yield* RegistrationFixture;
        const { session, provPath, datasetPath } = fixture;

        const client = yield* RpcTest.makeClient(OntologyRpcs);
        const validation = yield* client.RunOntologyValidation(RunOntologyValidationInput.make({ session }));
        const exported = yield* client.ExportOntologyProvenance(
          ExportOntologyProvenanceCommand.make({ session, provPath, datasetPath })
        );

        expect(fixture.validationInvocations()).toBe(1);
        expect(fixture.exportInvocations()).toBe(1);
        expect(validation.validation.violations).toHaveLength(1);
        expect(exported.provPath).toBe(provPath);
        expect(exported.datasetPath).toBe(datasetPath);
      })
    );
  }
);
