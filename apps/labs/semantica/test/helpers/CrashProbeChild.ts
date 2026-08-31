// fallow-ignore-file unused-file -- spawned crash-probe process entry resolved by path at runtime
import { NonNegativeInt } from "@beep/schema";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { F1FixtureId } from "@/fixtures/F1";
import { LedgerLive } from "@/layers/LedgerLive";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { DocumentId, RunId } from "@/schema/Ids";
import { EventBody, makeProvenanceEventId, ProvenanceEvent } from "@/schema/Provenance";
import { ParseOutcome } from "@/schema/Text";
import { Ledger } from "@/services/Ledger";

const [mode, ledgerRoot] = A.drop(process.argv, 2);
if (mode !== "seed" || ledgerRoot === undefined) {
  process.stderr.write("Expected seed and a ledger root.\n");
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
const ledgerLayer = LedgerLive({ ledgerRoot, mode: "replay", runId }).pipe(Layer.provide(BunServices.layer));
const services = ledgerLayer;
const provideServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(Layer.build(services).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

await Effect.runPromise(
  provideServices(
    Ledger.pipe(Effect.flatMap((ledger) => ledger.appendDocument(document, degraded, O.none(), [], [event])))
  )
);
await Bun.write(Bun.stdout, "ledger-committed\n");
