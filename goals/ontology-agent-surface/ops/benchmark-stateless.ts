import { OntologyToolsLive } from "@beep/ontology-server/tools";
import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session";
import {
  OntologyFingerprint,
  OntologySparqlQueryRequest,
  OntologyToolService,
  OpenInspectRequest,
  SnapshotDescribeRequest,
} from "@beep/ontology-use-cases/tools";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Console, Data, Duration, Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const benchmarkSizes = A.make(1_000, 10_000, 100_000);
const fingerprintEquivalence = S.toEquivalence(OntologyFingerprint);

class OntologyStatelessBenchmarkFailure extends Data.TaggedError("OntologyStatelessBenchmarkFailure")<{
  readonly sizes: ReadonlyArray<number>;
}> {}

const makeTurtle = (size: number): string =>
  `@prefix ex: <https://example.test/benchmark#> .\n${A.join(
    A.makeBy(size, (index) => `ex:item-${index} ex:value "${index}" .`),
    "\n"
  )}\n`;

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E3, R>(effect: Effect.Effect<A2, E3, R>): Effect.Effect<A2, E2 | E3, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const toolLayerForRoot = (root: string) =>
  OntologyToolsLive.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: root }))),
    Layer.provide(NodeServices.layer)
  );

const measure = Effect.fn("OntologyBenchmark.measure")(<A2, E2, R>(effect: Effect.Effect<A2, E2, R>) =>
  effect.pipe(
    Effect.result,
    Effect.timed,
    Effect.map(([duration, result]) => ({ elapsedMs: Duration.toMillis(duration), result }))
  )
);

const formatMs = (elapsedMs: number): string => `${elapsedMs.toFixed(2)} ms`;

const formatMeasurement = <A2, E2 extends { readonly _tag: string }>(measurement: {
  readonly elapsedMs: number;
  readonly result: Result.Result<A2, E2>;
}): string =>
  Result.match(measurement.result, {
    onFailure: (error) => `${formatMs(measurement.elapsedMs)} (${error._tag})`,
    onSuccess: () => formatMs(measurement.elapsedMs),
  });

const runCase = Effect.fn("OntologyBenchmark.runCase")(function* (
  tools: typeof OntologyToolService.Service,
  root: string,
  size: number
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const relativePath = yield* S.decodeUnknownEffect(OntologyFilePath)(`benchmark-${size}.ttl`);
  yield* fileSystem.writeFileString(pathApi.join(root, relativePath), makeTurtle(size));

  const opened = yield* measure(tools.openInspect(OpenInspectRequest.make({ path: relativePath })));
  const snapshot = yield* measure(tools.snapshotDescribe(SnapshotDescribeRequest.make({ path: relativePath })));
  const query = yield* measure(
    tools.sparqlQuery(
      OntologySparqlQueryRequest.make({
        path: relativePath,
        profile: "select",
        query: "SELECT ?s ?p ?o WHERE { ?s ?p ?o }",
      })
    )
  );

  const successful = O.all({
    opened: Result.getSuccess(opened.result),
    query: Result.getSuccess(query.result),
    snapshot: Result.getSuccess(snapshot.result),
  });
  const fingerprintAgreement = pipe(
    successful,
    O.map(
      ({ opened: openedResult, query: queryResult, snapshot: snapshotResult }) =>
        fingerprintEquivalence(openedResult.fingerprint, snapshotResult.fingerprint) &&
        fingerprintEquivalence(openedResult.fingerprint, queryResult.fingerprint)
    )
  );
  const fingerprintsAgree = pipe(
    fingerprintAgreement,
    O.match({
      onNone: () => "n/a",
      onSome: Bool.match({ onFalse: () => "no", onTrue: () => "yes" }),
    })
  );
  const snapshotResources = pipe(
    Result.getSuccess(snapshot.result),
    O.map((result) => `${result.snapshot.resources.length}`),
    O.getOrElse(() => "n/a")
  );
  const queryBudget = pipe(
    Result.getSuccess(query.result),
    O.map(
      (result) =>
        `${result.query.displayedResultCount}/${result.query.effectiveLimit}${Bool.match(result.query.limitInjected, {
          onFalse: () => "",
          onTrue: () => " (injected)",
        })}`
    ),
    O.getOrElse(() => "n/a")
  );

  return {
    passed: pipe(
      fingerprintAgreement,
      O.getOrElse(() => false)
    ),
    row: `| ${size} | ${formatMeasurement(opened)} | ${formatMeasurement(snapshot)} | ${formatMeasurement(
      query
    )} | ${fingerprintsAgree} | ${snapshotResources} | ${queryBudget} |`,
    size,
  };
});

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-stateless-benchmark-" });
  yield* Console.log(
    A.join(
      [
        "| Triples | Open + rdfc-1.0 | Snapshot + reopen/rdfc-1.0 | SPARQL + reopen/rdfc-1.0 | Fingerprints agree | Snapshot resources | Query rows/limit |",
        "| ---: | ---: | ---: | ---: | :---: | ---: | :--- |",
      ],
      "\n"
    )
  );
  const results = yield* Effect.gen(function* () {
    const tools = yield* OntologyToolService;
    return yield* Effect.forEach(
      benchmarkSizes,
      (size) => runCase(tools, root, size).pipe(Effect.tap((result) => Console.log(result.row))),
      { concurrency: 1 }
    );
  }).pipe(provideScopedLayer(toolLayerForRoot(root)));
  const failedSizes = pipe(
    results,
    A.filter((result) => Bool.not(result.passed)),
    A.map((result) => result.size)
  );
  yield* A.match(failedSizes, {
    onEmpty: () => Effect.void,
    onNonEmpty: (sizes) => Effect.fail(new OntologyStatelessBenchmarkFailure({ sizes })),
  });
});

program.pipe(Effect.provide(NodeServices.layer), Effect.scoped, NodeRuntime.runMain);
