// fallow-ignore-file unused-file -- spawned C2 runtime probe entry resolved by path at runtime
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { LiteralKit } from "@beep/schema";
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

const ProbeMode = LiteralKit(["bundle", "crash", "recover"]);
const ProbeModeArgv = S.Tuple([ProbeMode]);
const CrashArgv = S.Tuple([S.String, RunId, RuntimeMode, S.String]);
const RecoverArgv = S.Tuple([S.String, RunId, RuntimeMode]);

const decodeUnknownProbeModeArgv = S.decodeUnknownEffect(ProbeModeArgv);
const decodeUnknownCrashArgv = S.decodeUnknownEffect(CrashArgv);
const decodeUnknownRecoverArgv = S.decodeUnknownEffect(RecoverArgv);

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

const runProbe = (mode: typeof ProbeMode.Type, rest: ReadonlyArray<string>) =>
  ProbeMode.$match(mode, {
    bundle: () => bundleProbe,
    crash: () =>
      decodeUnknownCrashArgv(rest).pipe(
        Effect.flatMap(([ledgerRoot, runId, runtimeMode, inputPath]) =>
          crashProbe(makeProvideServices(ledgerRoot, runtimeMode, runId), inputPath)
        )
      ),
    recover: () =>
      decodeUnknownRecoverArgv(rest).pipe(
        Effect.flatMap(([ledgerRoot, runId, runtimeMode]) =>
          recoverProbe(makeProvideServices(ledgerRoot, runtimeMode, runId), runId)
        )
      ),
  });

const probe = Effect.gen(function* () {
  const argv = A.drop(process.argv, 2);
  const [mode] = yield* decodeUnknownProbeModeArgv(A.take(argv, 1));
  return yield* runProbe(mode, A.drop(argv, 1));
}).pipe(Effect.catchTag("SchemaError", () => Effect.sync(usageExit)));

await Effect.runPromise(probe);
