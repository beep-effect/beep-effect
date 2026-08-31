// fallow-ignore-file unused-file -- spawned crash-probe process entry resolved by path at runtime
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { NonNegativeInt, PosInt } from "@beep/schema";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Duration, Effect, Layer, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { F1FixtureId } from "@/fixtures/F1";
import { LedgerLive } from "@/layers/LedgerLive";
import { RdfProjectionLive } from "@/layers/RdfProjectionLive";
import { LabConfig } from "@/runtime/Config";
import { contentDigestSync } from "@/schema/Digest";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { DocumentId, RunId } from "@/schema/Ids";
import { EventBody, makeProvenanceEventId, ProvenanceEvent } from "@/schema/Provenance";
import { ParseOutcome } from "@/schema/Text";
import { Ledger } from "@/services/Ledger";
import { RdfProjection } from "@/services/RdfProjection";

const [mode, ledgerRoot] = A.drop(process.argv, 2);
if (mode === undefined || ledgerRoot === undefined) {
  process.stderr.write("Expected a probe mode and ledger root.\n");
  process.exit(2);
}

const runId = RunId.make(Str.repeat(64)("c"));
const documentId = DocumentId.make(Str.repeat(64)("d"));
const body = EventBody.cases.Ingested.make({ document: documentId, kind: "Ingested" });
const event = ProvenanceEvent.make({
  body,
  id: Result.getOrThrow(makeProvenanceEventId({ body, prev: O.none() })),
  prev: O.none(),
});
const document = SourceDocument.make({
  acquired: event.id,
  bytes: NonNegativeInt.make(7),
  id: documentId,
  mediaType: "text/markdown",
  origin: Origin.cases.Fixture.make({
    declared: FixtureDeclaration.make({ degradedKind: O.some("invalid-utf8"), expectation: "degraded" }),
    fixtureId: F1FixtureId.make("md-invalid-utf8"),
    kind: "Fixture",
    relativePath: "documents/md-invalid-utf8.md",
  }),
  sha256: documentId,
});
const degraded = ParseOutcome.cases.Degraded.make({
  detail: "crash probe",
  document: document.id,
  kind: "invalid-utf8",
  outcome: "Degraded",
});
const config = Layer.succeed(
  LabConfig,
  LabConfig.of({
    corpusRoot: O.none(),
    embeddingDimension: PosInt.make(1536),
    embeddingModel: "text-embedding-3-small",
    embeddingRevision: "text-embedding-3-small@2024-01-25",
    extractionTimeout: Duration.minutes(15),
    extractorModel: "crash-probe",
    goldDirectory: "fixtures/gold/v1",
    goldGenerationTimeout: Duration.minutes(45),
    goldModel: "crash-probe",
    ledgerRoot,
    mode: "replay",
    offline: true,
    projectionTimeout: Duration.seconds(30),
    providerCacheDirectory: ".beep/semantica/provider-cache",
  })
);
const ledgerLayer = LedgerLive({ ledgerRoot, mode: "replay", runId }).pipe(Layer.provide(BunServices.layer));
const rdfLayer = RdfProjectionLive.pipe(Layer.provide(OxigraphSparqlQueryServiceLive), Layer.provide(config));
const services = Layer.merge(ledgerLayer, rdfLayer).pipe(Layer.provide(BunServices.layer));
const provideServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(Layer.build(services).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

if (mode === "commit") {
  await Effect.runPromise(
    provideServices(
      Ledger.pipe(Effect.flatMap((ledger) => ledger.appendDocument(document, degraded, O.none(), [], [event])))
    )
  );
  await Bun.write(Bun.stdout, "ledger-committed\n");
  process.kill(process.pid, "SIGKILL");
} else {
  const digest = await Effect.runPromise(
    provideServices(
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const rdf = yield* RdfProjection;
        const snapshot = yield* ledger.read(runId);
        const projection = yield* rdf.rebuild(snapshot);
        return Result.getOrThrow(contentDigestSync(S.Array(S.String))(projection.serializedQuads));
      })
    )
  );
  process.stdout.write(`${digest}\n`);
}
