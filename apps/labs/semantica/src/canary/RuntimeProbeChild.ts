// fallow-ignore-file unused-file -- the C2 canary spawns this runtime probe child by file path, so no import reaches it. Owner: @beep/semantica. Exit: remove when the probe runs in-process or fallow learns spawned entries.

import { $SemanticaId } from "@beep/identity/packages";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { LiteralKit } from "@beep/schema";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import { LedgerLive } from "@/layers/LedgerLive";
import { RdfProjectionLive } from "@/layers/RdfProjectionLive";
import { LabConfigLive, RuntimeMode } from "@/runtime/Config";
import { RuntimeLayer } from "@/runtime/Layer";
import { contentDigestSync } from "@/schema/Digest";
import { RunId } from "@/schema/Ids";
import { CrashProjectionInput } from "@/schema/Reasoning";
import { Ledger } from "@/services/Ledger";
import { RdfProjection } from "@/services/RdfProjection";
import { LedgerLiveOptions } from "../layers/LedgerLive.ts";

const decodeCrashProjectionInput = S.decodeEffect(S.fromJsonString(CrashProjectionInput));
const $I = $SemanticaId.create("canary/RuntimeProbeChild");

class ProbeUsageError extends S.TaggedError<ProbeUsageError, { readonly brand: unique symbol }>($I`ProbeUsageError`)(
  "ProbeUsageError",
  { message: S.String },
  $I.annoteError<ProbeUsageError>("ProbeUsageError", { description: "Invalid runtime probe arguments." })
) {
  override readonly [Runtime.errorExitCode] = 2;
  override readonly [Runtime.errorReported] = false;
}

const ProbeMode = LiteralKit(["bundle", "crash", "recover"]);
const ProbeModeArgv = S.Tuple([ProbeMode]);
const CrashArgv = S.Tuple([S.String, RunId, RuntimeMode, S.String]);
const RecoverArgv = S.Tuple([S.String, RunId, RuntimeMode]);

const decodeUnknownProbeModeArgv = S.decodeUnknownEffect(ProbeModeArgv);
const decodeUnknownCrashArgv = S.decodeUnknownEffect(CrashArgv);
const decodeUnknownRecoverArgv = S.decodeUnknownEffect(RecoverArgv);

const usageError = ProbeUsageError.make({
  message:
    "Expected bundle, crash <ledger-root> <run-id> <runtime-mode> <input-path>, or recover <ledger-root> <run-id> <runtime-mode>.",
});

const writeStdout = (text: string) =>
  Stdio.Stdio.pipe(Effect.flatMap((stdio) => Stream.make(text).pipe(Stream.run(stdio.stdout()))));

const bundleProbe = Effect.gen(function* () {
  yield* RuntimeLayer.pipe(Layer.build, Effect.scoped);
  yield* Console.log("bundle-ready");
});

const makeProvideServices = (ledgerRoot: string, runtimeMode: typeof RuntimeMode.Type, runId: RunId) => {
  const ledgerLayer = LedgerLive(LedgerLiveOptions.make({ ledgerRoot, mode: runtimeMode, runId })).pipe(
    Layer.provide(BunServices.layer)
  );
  const rdfLayer = RdfProjectionLive.pipe(Layer.provide(OxigraphSparqlQueryServiceLive), Layer.provide(LabConfigLive));
  const services = Layer.merge(ledgerLayer, rdfLayer).pipe(Layer.provide(BunServices.layer));
  return <A2, E, R>(effect: Effect.Effect<A2, E, R>) =>
    services.pipe(
      Layer.build,
      Effect.flatMap((context) => effect.pipe(Effect.provide(context))),
      Effect.scoped
    );
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
  yield* writeStdout("projection-state-committed\n");
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
  yield* Console.log(digest);
});

const runProbe = (mode: typeof ProbeMode.Type, rest: ReadonlyArray<string>) =>
  ProbeMode.match(mode, {
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
  const argv = yield* (yield* Stdio.Stdio).args;
  const [mode] = yield* decodeUnknownProbeModeArgv(A.take(argv, 1));
  return yield* runProbe(mode, A.drop(argv, 1));
}).pipe(
  Effect.catchTag("SchemaError", () => Console.error(usageError.message).pipe(Effect.andThen(Effect.fail(usageError))))
);

BunRuntime.runMain(
  Layer.merge(BunServices.layer, BunCrypto.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(probe, context)),
    Effect.scoped
  )
);
