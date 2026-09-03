/**
 * Stateless ontology agent tool orchestration.
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import {
  applyChangeOperationsWithDelta,
  ChangeOperation,
  classifySessionDatasetPartitions,
  deriveSessionGraphPartitions,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import { makeDataset, serializeQuad } from "@beep/rdf/Rdf";
import { NonNegativeInt } from "@beep/schema";
import { CanonicalizationService, FingerprintDatasetRequest } from "@beep/semantic-web/services/canonicalization";
import { A, O } from "@beep/utils";
import { Config, Context, Effect, FileSystem, Layer, Path, pipe, Semaphore } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import {
  buildOntologySnapshot,
  ExportOntologyProvenanceCommand,
  InferOntologySessionInput,
  OntologyFilePath,
  OntologyFileStore,
  OntologyReasoner,
  OntologySparqlRunner,
  OntologySparqlSafeguards,
  OntologyValidationRunner,
  OpenOntologyFileCommand,
  ReadOntologyFileRequest,
  RunOntologySparqlInput,
  RunOntologyValidationInput,
  SaveOntologyFileCommand,
  SessionUseCases,
  searchOntologyResources,
} from "../aggregates/Session/index.ts";
import {
  CapabilityMetadataResponse,
  ExportProvenanceResponse,
  OntologyBudgetRefusal,
  OntologyCasConflict,
  OntologyFingerprint,
  OntologyNoOpRefusal,
  OntologyReasonerDriftRefusal,
  OntologySearchResponse,
  OntologySparqlQueryResponse,
  OntologyToolCapability,
  OntologyToolExecutionError,
  OpenInspectResponse,
  ontologyToolBudgets,
  ProposeChangeBatchRequest,
  ProposeChangeBatchResponse,
  RepairOntologyResponse,
  SnapshotDescribeResponse,
  ValidateOntologyResponse,
} from "./OntologyToolkit.ts";
import type { OntologyChangeActor, Session, SessionChangeApplication } from "@beep/ontology-domain/aggregates/Session";
import type {
  CapabilityMetadataRequest,
  ExportProvenanceRequest,
  OntologyFingerprint as OntologyFingerprintType,
  OntologySearchRequest,
  OntologySparqlQueryRequest,
  OntologyToolFailure,
  OpenInspectRequest,
  RepairOntologyRequest,
  SnapshotDescribeRequest,
  ValidateOntologyRequest,
} from "./OntologyToolkit.ts";

const $I = $OntologyUseCasesId.create("tools/OntologyToolService");
const fingerprintEquivalence = S.toEquivalence(OntologyFingerprint);

type OpenedOntology = {
  readonly session: Session;
  readonly fingerprint: OntologyFingerprintType;
};

const executionError = (operation: string, message: string, recoverable = false): OntologyToolExecutionError =>
  OntologyToolExecutionError.make({ operation, message, recoverable });

const mapLayerError = (operation: string) => (error: { readonly message: string }) =>
  executionError(operation, error.message);

const fingerprintSession = Effect.fn("Ontology.Tools.fingerprintSession")(function* (session: Session) {
  const canonicalization = yield* CanonicalizationService;
  const result = yield* canonicalization
    .fingerprint(
      FingerprintDatasetRequest.make({
        dataset: session.baseDataset,
        algorithm: "rdfc-1.0",
      })
    )
    .pipe(Effect.mapError(mapLayerError("fingerprint")));

  return OntologyFingerprint.make(result.fingerprint);
});

const openSavedOntology = Effect.fn("Ontology.Tools.openSavedOntology")(function* (
  request:
    | OpenInspectRequest
    | SnapshotDescribeRequest
    | OntologySearchRequest
    | OntologySparqlQueryRequest
    | ValidateOntologyRequest
    | ExportProvenanceRequest
    | RepairOntologyRequest
    | ProposeChangeBatchRequest
) {
  const sessions = yield* SessionUseCases;
  const opened = yield* sessions
    .openFile(
      OpenOntologyFileCommand.make({
        sessionId: SessionId.make(request.path),
        path: request.path,
        baseIri: request.baseIri,
      })
    )
    .pipe(Effect.mapError(mapLayerError("open")));
  const fingerprint = yield* fingerprintSession(opened.session);

  return { session: opened.session, fingerprint } satisfies OpenedOntology;
});

const ensureCas = (
  expectedFingerprint: OntologyFingerprintType,
  currentFingerprint: OntologyFingerprintType
): Effect.Effect<void, OntologyCasConflict> =>
  fingerprintEquivalence(expectedFingerprint, currentFingerprint)
    ? Effect.void
    : Effect.fail(
        OntologyCasConflict.make({
          expectedFingerprint,
          currentFingerprint,
          guidance: "Refetch the saved ontology, rebuild the proposal against the current fingerprint, and retry.",
          recoverable: true,
        })
      );

const ensureBatchBudget = (operations: ReadonlyArray<ChangeOperation>) => {
  const actual = A.length(operations);
  return actual > ontologyToolBudgets.maxChangeOperations
    ? Effect.fail(
        OntologyBudgetRefusal.make({
          kind: "changeOperations",
          actual: NonNegativeInt.make(actual),
          limit: ontologyToolBudgets.maxChangeOperations,
          guidance: "Split the proposed changes into smaller CAS-guarded batches.",
          recoverable: true,
        })
      )
    : Effect.void;
};

const ensureReasonerDriftCap = (operations: ReadonlyArray<ChangeOperation>) => {
  const actual = A.length(operations);
  return actual > ontologyToolBudgets.reasonerDriftCap
    ? Effect.fail(
        OntologyReasonerDriftRefusal.make({
          actual: NonNegativeInt.make(actual),
          cap: ontologyToolBudgets.reasonerDriftCap,
          guidance: "Submit a smaller change batch so incremental reasoning stays within the fixed drift cap.",
          recoverable: true,
        })
      )
    : Effect.void;
};

const ensurePersistableOperations = (operations: ReadonlyArray<ChangeOperation>) =>
  A.every(operations, (operation) => operation.partition === "asserted")
    ? Effect.void
    : Effect.fail(
        executionError(
          "change-batch",
          "V1 saved-file mutations accept asserted-partition operations only; derived and shape partitions are read-only.",
          true
        )
      );

const hasRealDelta = (application: SessionChangeApplication): boolean =>
  A.length(application.delta.added) > 0 || A.length(application.delta.removed) > 0;

const ensureRealDelta = (application: SessionChangeApplication) =>
  hasRealDelta(application)
    ? Effect.void
    : Effect.fail(
        OntologyNoOpRefusal.make({
          guidance: "Refetch the ontology and remove operations that are already satisfied or target absent quads.",
          recoverable: true,
        })
      );

const operationIntroducesShape = (application: SessionChangeApplication, operation: ChangeOperation): boolean => {
  const partitions = deriveSessionGraphPartitions(application.session);
  const persisted = makeDataset(pipe(partitions.asserted.quads, A.appendAll(partitions.shapes.quads)));
  const classified = classifySessionDatasetPartitions(persisted);
  const shapeQuadKeys = A.map(classified.shapes.quads, serializeQuad);

  return operation.kind === "addQuad" && pipe(shapeQuadKeys, A.contains(serializeQuad(operation.quad)));
};

const ensureSharedPartitionClassification = (
  application: SessionChangeApplication,
  operations: ReadonlyArray<ChangeOperation>
) =>
  A.some(operations, (operation) => operationIntroducesShape(application, operation))
    ? Effect.fail(
        executionError(
          "change-batch",
          "The shared ingestion classifier routed at least one proposed quad to the SHACL shapes partition, which is read-only in V1.",
          true
        )
      )
    : Effect.void;

const applyAndSave = Effect.fn("Ontology.Tools.applyAndSave")(function* (
  request: ProposeChangeBatchRequest,
  opened: OpenedOntology,
  actor: OntologyChangeActor
) {
  yield* ensureCas(request.expectedFingerprint, opened.fingerprint);
  yield* ensureBatchBudget(request.operations);
  yield* ensureReasonerDriftCap(request.operations);
  yield* ensurePersistableOperations(request.operations);
  const attributedOperations = A.map(request.operations, (operation) => ChangeOperation.make({ ...operation, actor }));
  const application = applyChangeOperationsWithDelta(opened.session, attributedOperations);
  yield* ensureRealDelta(application);
  yield* ensureSharedPartitionClassification(application, request.operations);

  const sessions = yield* SessionUseCases;
  yield* sessions
    .saveFile(SaveOntologyFileCommand.make({ path: request.path, session: application.session }))
    .pipe(Effect.mapError(mapLayerError("save")));
  const saved = yield* openSavedOntology(request);
  const validation = yield* OntologyValidationRunner;
  const provPath = yield* S.decodeEffect(OntologyFilePath)(`${request.path}.${saved.fingerprint}.prov.ttl`).pipe(
    Effect.mapError(mapLayerError("provenance-journal-path"))
  );
  const datasetPath = yield* S.decodeEffect(OntologyFilePath)(`${request.path}.${saved.fingerprint}.dataset.ttl`).pipe(
    Effect.mapError(mapLayerError("provenance-journal-path"))
  );
  yield* validation
    .exportProvenance(ExportOntologyProvenanceCommand.make({ session: application.session, provPath, datasetPath }))
    .pipe(Effect.mapError(mapLayerError("provenance-journal")));

  return ProposeChangeBatchResponse.make({
    path: request.path,
    previousFingerprint: opened.fingerprint,
    currentFingerprint: saved.fingerprint,
    appliedOperations: attributedOperations,
    delta: application.delta,
  });
});

const inferForTool = Effect.fn("Ontology.Tools.inferForTool")(function* (session: Session) {
  const reasoner = yield* OntologyReasoner;
  const result = yield* reasoner.infer(
    InferOntologySessionInput.make({
      session,
      driftCap: ontologyToolBudgets.reasonerDriftCap,
    })
  );
  return result.drifted
    ? yield* OntologyReasonerDriftRefusal.make({
        actual: NonNegativeInt.make(A.length(session.changeLog)),
        cap: ontologyToolBudgets.reasonerDriftCap,
        guidance: "Refetch and submit a smaller mutation window before requesting inferred results.",
        recoverable: true,
      })
    : result;
});

const validateSession = Effect.fn("Ontology.Tools.validateSession")(function* (
  session: Session,
  includeInferred: boolean
) {
  const validation = yield* OntologyValidationRunner;
  const inference = includeInferred ? O.some(yield* inferForTool(session)) : O.none();
  return yield* validation
    .run(
      RunOntologyValidationInput.make({
        session,
        inference,
        maxResults: ontologyToolBudgets.maxValidationResults,
      })
    )
    .pipe(Effect.mapError(mapLayerError("validate")));
});

const capabilities = [
  OntologyToolCapability.make({ name: "ontology_open_inspect", mutating: false }),
  OntologyToolCapability.make({ name: "ontology_snapshot_describe", mutating: false }),
  OntologyToolCapability.make({ name: "ontology_search", mutating: false }),
  OntologyToolCapability.make({ name: "ontology_sparql_query", mutating: false }),
  OntologyToolCapability.make({ name: "ontology_propose_change_batch", mutating: true }),
  OntologyToolCapability.make({ name: "ontology_validate", mutating: false }),
  OntologyToolCapability.make({ name: "ontology_repair", mutating: true }),
  OntologyToolCapability.make({ name: "ontology_export_provenance", mutating: true }),
  OntologyToolCapability.make({ name: "ontology_capability_metadata", mutating: false }),
];

/**
 *  Service shape implemented by real ontology agent tool orchestration.
 *
 * **Example** (Accept service shape type)
 *
 * ```ts
 * import type { OntologyToolServiceShape } from "@beep/ontology-use-cases/tools"
 * const accept = (service: OntologyToolServiceShape) => service
 * console.log(accept)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OntologyToolServiceShape {
  readonly capabilityMetadata: (request: CapabilityMetadataRequest) => Effect.Effect<CapabilityMetadataResponse>;
  readonly exportProvenance: (
    request: ExportProvenanceRequest
  ) => Effect.Effect<ExportProvenanceResponse, OntologyToolFailure>;
  readonly openInspect: (request: OpenInspectRequest) => Effect.Effect<OpenInspectResponse, OntologyToolFailure>;
  readonly proposeChangeBatch: (
    request: ProposeChangeBatchRequest,
    actor: OntologyChangeActor
  ) => Effect.Effect<ProposeChangeBatchResponse, OntologyToolFailure>;
  readonly repair: (
    request: RepairOntologyRequest,
    actor: OntologyChangeActor
  ) => Effect.Effect<RepairOntologyResponse, OntologyToolFailure>;
  readonly search: (request: OntologySearchRequest) => Effect.Effect<OntologySearchResponse, OntologyToolFailure>;
  readonly snapshotDescribe: (
    request: SnapshotDescribeRequest
  ) => Effect.Effect<SnapshotDescribeResponse, OntologyToolFailure>;
  readonly sparqlQuery: (
    request: OntologySparqlQueryRequest
  ) => Effect.Effect<OntologySparqlQueryResponse, OntologyToolFailure>;
  readonly validate: (request: ValidateOntologyRequest) => Effect.Effect<ValidateOntologyResponse, OntologyToolFailure>;
}

/**
 *  Stateless ontology agent tool orchestration service.
 *
 * **Example** (Yield service in Effect)
 *
 * ```ts
 * import { OntologyToolService } from "@beep/ontology-use-cases/tools"
 * import { Effect } from "effect"
 * const program = Effect.gen(function* () { return yield* OntologyToolService })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OntologyToolService extends Context.Service<OntologyToolService, OntologyToolServiceShape>()(
  $I`OntologyToolService`
) {}

const makeOntologyToolService = Effect.gen(function* () {
  const sessions = yield* SessionUseCases;
  const fileStore = yield* OntologyFileStore;
  const sparql = yield* OntologySparqlRunner;
  const validation = yield* OntologyValidationRunner;
  const canonicalization = yield* CanonicalizationService;
  const reasoner = yield* OntologyReasoner;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspaceRoot = yield* Config.nonEmptyString("ONTOLOGY_WORKSPACE_ROOT");
  const canonicalWorkspaceRoot = yield* fileSystem.realPath(workspaceRoot);
  // The desktop sidecar is the sole v1 write authority for files exposed via
  // /mcp. This semaphore closes compare/apply/write TOCTOU inside that process;
  // deliberately no cross-process lock or stateful session repository exists.
  const mutationSemaphore = yield* Semaphore.make(1);
  const ensureProvenanceDestinationsAvailable = Effect.fn("Ontology.Tools.ensureProvenanceDestinationsAvailable")(
    function* (request: ExportProvenanceRequest) {
      const sourcePath = path.resolve(canonicalWorkspaceRoot, path.normalize(request.path));
      const provPath = path.resolve(canonicalWorkspaceRoot, path.normalize(request.provPath));
      const datasetPath = path.resolve(canonicalWorkspaceRoot, path.normalize(request.datasetPath));
      if (Eq.equals(sourcePath, provPath) || Eq.equals(sourcePath, datasetPath) || Eq.equals(provPath, datasetPath)) {
        return yield* executionError(
          "export-provenance",
          "Provenance output paths must be distinct from the source ontology and from each other.",
          true
        );
      }

      yield* Effect.forEach(
        [request.provPath, request.datasetPath],
        (path) =>
          fileStore.read(ReadOntologyFileRequest.make({ path })).pipe(
            Effect.matchEffect({
              onFailure: (error) =>
                error.reason === "notFound"
                  ? Effect.void
                  : Effect.fail(executionError("export-provenance", error.message, true)),
              onSuccess: () =>
                Effect.fail(
                  executionError(
                    "export-provenance",
                    `Refusing to overwrite existing provenance output: ${path}.`,
                    true
                  )
                ),
            })
          ),
        { discard: true }
      );
    }
  );
  const provideDependencies = <A2, E>(
    effect: Effect.Effect<
      A2,
      E,
      SessionUseCases | OntologySparqlRunner | OntologyValidationRunner | CanonicalizationService | OntologyReasoner
    >
  ) =>
    effect.pipe(
      Effect.provideService(SessionUseCases, sessions),
      Effect.provideService(OntologySparqlRunner, sparql),
      Effect.provideService(OntologyValidationRunner, validation),
      Effect.provideService(CanonicalizationService, canonicalization),
      Effect.provideService(OntologyReasoner, reasoner)
    );

  return OntologyToolService.of({
    capabilityMetadata: Effect.fn("Ontology.Tools.capabilityMetadata")(() =>
      Effect.succeed(
        CapabilityMetadataResponse.make({
          capabilities,
          budgets: ontologyToolBudgets,
          casAlgorithm: "rdfc-1.0",
          casSemantics: "semantic",
          stateless: true,
          reasonerProfile: "structural-rdfs-owl-rl-subset",
        })
      )
    ),
    openInspect: Effect.fn("Ontology.Tools.openInspect")((request) =>
      provideDependencies(
        openSavedOntology(request).pipe(
          Effect.map((opened) =>
            OpenInspectResponse.make({
              path: request.path,
              sessionId: opened.session.id,
              fingerprint: opened.fingerprint,
              quadCount: NonNegativeInt.make(A.length(opened.session.baseDataset.quads)),
              prefixes: opened.session.prefixes,
            })
          )
        )
      )
    ),
    snapshotDescribe: Effect.fn("Ontology.Tools.snapshotDescribe")((request) =>
      provideDependencies(
        openSavedOntology(request).pipe(
          Effect.map((opened) =>
            SnapshotDescribeResponse.make({
              fingerprint: opened.fingerprint,
              snapshot: buildOntologySnapshot(opened.session),
            })
          )
        )
      )
    ),
    search: Effect.fn("Ontology.Tools.search")((request) =>
      provideDependencies(
        openSavedOntology(request).pipe(
          Effect.map((opened) => {
            const matches = searchOntologyResources(buildOntologySnapshot(opened.session), {
              query: request.query,
              mode: request.mode,
            });
            const results = A.take(matches, ontologyToolBudgets.maxSearchResults);
            return OntologySearchResponse.make({
              fingerprint: opened.fingerprint,
              results,
              resultCount: NonNegativeInt.make(A.length(results)),
              truncated: A.length(matches) > A.length(results),
            });
          })
        )
      )
    ),
    sparqlQuery: Effect.fn("Ontology.Tools.sparqlQuery")((request) =>
      provideDependencies(
        Effect.gen(function* () {
          const opened = yield* openSavedOntology(request);
          const inference = request.includeInferred ? O.some(yield* inferForTool(opened.session)) : O.none();
          const result = yield* sparql
            .run(
              RunOntologySparqlInput.make({
                session: opened.session,
                profile: request.profile,
                query: request.query,
                includeInferred: request.includeInferred,
                inference,
                safeguards: OntologySparqlSafeguards.make({
                  defaultLimit: ontologyToolBudgets.maxQueryResults,
                  maxResultCount: ontologyToolBudgets.maxQueryResults,
                }),
              })
            )
            .pipe(Effect.mapError(mapLayerError("sparql-query")));
          return OntologySparqlQueryResponse.make({ fingerprint: opened.fingerprint, query: result });
        })
      )
    ),
    proposeChangeBatch: Effect.fn("Ontology.Tools.proposeChangeBatch")((request, actor) =>
      mutationSemaphore.withPermit(
        provideDependencies(
          openSavedOntology(request).pipe(Effect.flatMap((opened) => applyAndSave(request, opened, actor)))
        )
      )
    ),
    validate: Effect.fn("Ontology.Tools.validate")((request) =>
      provideDependencies(
        Effect.gen(function* () {
          const opened = yield* openSavedOntology(request);
          const result = yield* validateSession(opened.session, request.includeInferred);
          return ValidateOntologyResponse.make({ fingerprint: opened.fingerprint, result });
        })
      )
    ),
    repair: Effect.fn("Ontology.Tools.repair")((request, actor) =>
      mutationSemaphore.withPermit(
        provideDependencies(
          Effect.gen(function* () {
            const opened = yield* openSavedOntology(request);
            yield* ensureCas(request.expectedFingerprint, opened.fingerprint);
            const before = yield* validateSession(opened.session, false);
            const proposal = yield* pipe(
              before.repairs,
              A.findFirst((candidate) => candidate.id === request.proposalId),
              Effect.fromOption(() =>
                executionError(
                  "repair",
                  "The requested verified repair proposal is not available for the current file.",
                  true
                )
              )
            );
            const operations = yield* A.match(proposal.operations, {
              onEmpty: () =>
                Effect.fail(
                  OntologyNoOpRefusal.make({
                    guidance: "Refetch validation results because the selected repair has no operations.",
                    recoverable: true,
                  })
                ),
              onNonEmpty: Effect.succeed,
            });
            const changeRequest = ProposeChangeBatchRequest.make({
              path: request.path,
              baseIri: request.baseIri,
              sessionHandle: request.sessionHandle,
              expectedFingerprint: request.expectedFingerprint,
              operations,
            });
            const change = yield* applyAndSave(changeRequest, opened, actor);
            const saved = yield* openSavedOntology(request);
            const after = yield* validateSession(saved.session, false);
            return RepairOntologyResponse.make({ proposal, change, validation: after });
          })
        )
      )
    ),
    exportProvenance: Effect.fn("Ontology.Tools.exportProvenance")((request) =>
      mutationSemaphore.withPermit(
        provideDependencies(
          Effect.gen(function* () {
            const opened = yield* openSavedOntology(request);
            yield* ensureCas(request.expectedFingerprint, opened.fingerprint);
            yield* ensureProvenanceDestinationsAvailable(request);
            const result = yield* validation
              .exportProvenance(
                ExportOntologyProvenanceCommand.make({
                  session: opened.session,
                  provPath: request.provPath,
                  datasetPath: request.datasetPath,
                })
              )
              .pipe(Effect.mapError(mapLayerError("export-provenance")));
            return ExportProvenanceResponse.make({
              fingerprint: opened.fingerprint,
              provPath: result.provPath,
              datasetPath: result.datasetPath,
            });
          })
        )
      )
    ),
  });
}).pipe(Effect.withSpan("Ontology.Tools.makeService"));

/**
 *  Live ontology tool orchestration layer over real ontology service ports.
 *
 * **Example** (Inspect live layer export)
 *
 * ```ts
 * import { OntologyToolServiceLive } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyToolServiceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OntologyToolServiceLive = Layer.effect(OntologyToolService, makeOntologyToolService);
