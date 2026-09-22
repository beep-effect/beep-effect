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
import { RunId } from "@/schema/Ids";
import { CrashProjectionInput } from "@/schema/Reasoning";
import { Ledger } from "@/services/Ledger";
import { RdfProjection } from "@/services/RdfProjection";

const decodeCrashProjectionInput = S.decodeEffect(S.fromJsonString(CrashProjectionInput));

const ProbeArgs = S.Union([
  S.Tuple([S.Literal("bundle")]),
  S.Tuple([S.Literal("crash"), S.String, RunId, RuntimeMode, S.String]),
  S.Tuple([S.Literal("recover"), S.String, RunId, RuntimeMode]),
]);

const decodeUnknownProbeArgs = S.decodeUnknownEffect(ProbeArgs);

const usageExit = (): never => {
  process.stderr.write(
    "Expected bundle, crash <ledger-root> <run-id> <runtime-mode> <input-path>, or recover <ledger-root> <run-id> <runtime-mode>.\n"
  );
  return process.exit(2);
};

const bundleProbe = Effect.gen(function* () {
  yield* Effect.scoped(Layer.build(RuntimeLayer));
  process.stdout.write("bundle-ready\n");
});

const makeProvideServices = (ledgerRoot: string, runtimeMode: typeof RuntimeMode.Type, runId: RunId) => {
  const ledgerLayer = LedgerLive({ ledgerRoot, mode: runtimeMode, runId }).pipe(Layer.provide(BunServices.layer));
  const rdfLayer = RdfProjectionLive.pipe(Layer.provide(OxigraphSparqlQueryServiceLive), Layer.provide(LabConfigLive));
  const services = Layer.merge(ledgerLayer, rdfLayer).pipe(Layer.provide(BunServices.layer));
  return <A2, E, R>(effect: Effect.Effect<A2, E, R>) =>
    Effect.scoped(Layer.build(services).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));
};

type ProvideServices = ReturnType<typeof makeProvideServices>;

const crashProbe = Effect.fn("crashProbe")(function* (provideServices: ProvideServices, inputPath: string) {
  const input = yield* decodeCrashProjectionInput(yield* Effect.promise(() => Bun.file(inputPath).text()));
  yield* provideServices(
    Ledger.pipe(
      Effect.flatMap((ledger) =>
        Effect.forEach(input.outcomes, (outcome) => ledger.appendBatch(outcome, input.events), {
          concurrency: 1,
          discard: true,
        })
      )
    )
  );
  yield* Effect.promise(() => Bun.write(Bun.stdout, "projection-state-committed\n"));
  process.kill(process.pid, "SIGKILL");
});

const recoverProbe = Effect.fn("recoverProbe")(function* (provideServices: ProvideServices, runId: RunId) {
  const digest = yield* provideServices(
    Effect.gen(function* () {
      const ledger = yield* Ledger;
      const rdf = yield* RdfProjection;
      const snapshot = yield* ledger.read(runId);
      const projection = yield* rdf.rebuild(snapshot);
      return Result.getOrThrow(contentDigestSync(S.Array(S.String))(projection.serializedQuads));
    })
  );
  process.stdout.write(`${digest}\n`);
});

type ProbeFailure =
  | Effect.Error<typeof bundleProbe>
  | Effect.Error<ReturnType<typeof crashProbe>>
  | Effect.Error<ReturnType<typeof recoverProbe>>;

const runProbe = (args: typeof ProbeArgs.Type): Effect.Effect<void, ProbeFailure> => {
  switch (args[0]) {
    case "bundle":
      return bundleProbe;
    case "crash":
      return crashProbe(makeProvideServices(args[1], args[3], args[2]), args[4]);
    case "recover":
      return recoverProbe(makeProvideServices(args[1], args[3], args[2]), args[2]);
  }
};

const probe = decodeUnknownProbeArgs(A.drop(process.argv, 2)).pipe(
  Effect.catchTag("SchemaError", () => Effect.sync(usageExit)),
  Effect.flatMap(runProbe)
);

await Effect.runPromise(probe);
