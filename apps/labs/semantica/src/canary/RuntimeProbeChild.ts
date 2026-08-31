// fallow-ignore-file unused-file -- spawned C2 runtime probe entry resolved by path at runtime
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { LedgerLive } from "@/layers/LedgerLive";
import { RdfProjectionLive } from "@/layers/RdfProjectionLive";
import { LabConfigLive, RuntimeMode } from "@/runtime/Config";
import { RuntimeLayer } from "@/runtime/Layer";
import { contentDigestSync } from "@/schema/Digest";
import { ExtractOutcome } from "@/schema/Evidence";
import { RunId } from "@/schema/Ids";
import { ProvenanceEvent } from "@/schema/Provenance";
import { Ledger } from "@/services/Ledger";
import { RdfProjection } from "@/services/RdfProjection";

const [probeMode, ledgerRoot, encodedRunId, encodedRuntimeMode, encodedOutcome, encodedEvent] = A.drop(process.argv, 2);

if (probeMode === "bundle") {
  await Effect.runPromise(Effect.scoped(Layer.build(RuntimeLayer)));
  process.stdout.write("bundle-ready\n");
} else {
  if (
    (probeMode !== "crash" && probeMode !== "recover") ||
    ledgerRoot === undefined ||
    encodedRunId === undefined ||
    encodedRuntimeMode === undefined
  ) {
    process.stderr.write("Expected bundle or crash/recover with a ledger root, run id, and runtime mode.\n");
    process.exit(2);
  }

  const runId = S.decodeSync(RunId)(encodedRunId);
  const runtimeMode = S.decodeUnknownSync(RuntimeMode)(encodedRuntimeMode);
  const ledgerLayer = LedgerLive({ ledgerRoot, mode: runtimeMode, runId }).pipe(Layer.provide(BunServices.layer));
  const rdfLayer = RdfProjectionLive.pipe(Layer.provide(OxigraphSparqlQueryServiceLive), Layer.provide(LabConfigLive));
  const services = Layer.merge(ledgerLayer, rdfLayer).pipe(Layer.provide(BunServices.layer));
  const provideServices = <A2, E, R>(effect: Effect.Effect<A2, E, R>) =>
    Effect.scoped(Layer.build(services).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

  if (probeMode === "crash") {
    if (encodedOutcome === undefined || encodedEvent === undefined) {
      process.stderr.write("Crash mode requires an extraction outcome and provenance event.\n");
      process.exit(2);
    }
    const outcome = S.decodeSync(S.fromJsonString(ExtractOutcome))(encodedOutcome);
    const event = S.decodeSync(S.fromJsonString(ProvenanceEvent))(encodedEvent);
    await Effect.runPromise(
      provideServices(Ledger.pipe(Effect.flatMap((ledger) => ledger.appendBatch(outcome, [event]))))
    );
    await Bun.write(Bun.stdout, "projection-state-committed\n");
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
}
