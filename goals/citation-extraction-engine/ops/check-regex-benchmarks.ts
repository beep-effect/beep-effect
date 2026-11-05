/** Corpus/control accounting; source-family approval requires actual execution proof. */
import {
  CitationOracleLedgers,
  CitationRegexBenchmarkContract,
  CitationRegexBenchmarkControls,
  CitationRegexBenchmarkResults,
} from "@beep/law-practice-use-cases/test";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

class BenchmarkError extends S.TaggedError<BenchmarkError, { readonly brand: unique symbol }>()(
  "CitationRegexBenchmarkError",
  { message: S.String }
) {}
const reject = () => Effect.fail(BenchmarkError.make({ message: "Citation regex benchmark validation failed." }));
const hash = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const read = (file: string | URL) => Effect.tryPromise(() => Bun.file(file).text());
const same = S.toEquivalence(S.Json);
const unique = (values: ReadonlyArray<string>) => A.dedupe(values).length === values.length;
const median = (values: ReadonlyArray<number>) => A.sort(values, Order.Number)[2]!;
const failsScaling = (values: ReadonlyArray<number>) => {
  let consecutive = 0;
  for (let index = 1; index < values.length; index++) {
    consecutive = values[index]! / values[index - 1]! > 3.5 ? consecutive + 1 : 0;
    if (consecutive >= 2) return true;
  }
  return false;
};
const root = new URL("../../../", import.meta.url);
const program = Effect.gen(function* () {
  let fixtures: string | URL = new URL("packages/law-practice/use-cases/test/fixtures/eyecite/", root);
  let evidence: string | URL = new URL("../history/evidence/", import.meta.url);
  let audit = false;
  const args = A.drop(process.argv, 2);
  const seen: Array<string> = [];
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === undefined || A.contains(seen, flag)) return yield* reject();
    seen.push(flag);
    if (flag === "--audit") {
      audit = true;
      continue;
    }
    const value = args[++index];
    if (value === undefined || Str.startsWith("--")(value) || (flag !== "--fixtures" && flag !== "--evidence"))
      return yield* reject();
    if (flag === "--fixtures") fixtures = `${value}/`;
    else evidence = `${value}/`;
  }
  const file = (base: string | URL, name: string) =>
    typeof base === "string" ? `${base}${name}` : new URL(name, base);
  const contractRaw = yield* read(file(fixtures, "regex-adversarial-corpus.json"));
  const contract = yield* S.decodeEffect(S.fromJsonString(CitationRegexBenchmarkContract))(contractRaw);
  const planRaw = yield* read(new URL("./regex-benchmark-plan.json", import.meta.url));
  const plan = yield* S.decodeEffect(
    S.fromJsonString(
      S.Struct({
        schemaVersion: S.tag("citation-regex-benchmark-plan/v1"),
        scope: S.String,
        sizes: S.NonEmptyArray(S.Natural),
        recipes: S.NonEmptyArray(S.Struct({ id: S.NonEmptyString, seed: S.NonEmptyString, suffix: S.String })),
        warmups: S.tag(2),
        repetitions: S.tag(5),
        evaluationsPerSample: S.tag(256),
        ratioThreshold: S.tag(3.5),
        consecutiveBreaches: S.tag(2),
        controlSizes: S.NonEmptyArray(S.Natural),
        controlWatchdogMillis: S.tag(1000),
        cleanupMillis: S.tag(2000),
        requiredRuntimes: S.Array(S.Literals(["node", "bun"])),
      })
    )
  )(planRaw);
  const controlRaw = yield* read(file(evidence, "regex-benchmark-controls.json"));
  const controls = yield* S.decodeEffect(S.fromJsonString(CitationRegexBenchmarkControls))(controlRaw);
  if (
    plan.scope !== contract.scope ||
    hash(planRaw) !== contract.planSha256 ||
    hash(planRaw) !== controls.planSha256 ||
    hash(controlRaw) !== contract.controlsSha256
  )
    return yield* reject();
  for (const [name, expected] of [
    ["export-regex-contract.py", contract.generatorSha256],
    ["probe-regex-benchmark.py", controls.parentSha256],
    ["regex-benchmark-control.child.mjs", controls.childSha256],
  ]) {
    if (hash(yield* read(new URL(`./${name}`, import.meta.url))) !== expected) return yield* reject();
  }
  if (hash(yield* read(new URL("LICENSE", root))) !== contract.syntheticLicense.sha256) return yield* reject();
  if (
    plan.sizes.length !== 10 ||
    plan.sizes[0] !== 8 ||
    !A.every(plan.sizes, (size, index) => size === 8 * 2 ** index) ||
    !same(plan.controlSizes, A.take(plan.sizes, 7)) ||
    !same(plan.requiredRuntimes, ["node", "bun"]) ||
    plan.recipes.length !== 12 ||
    !unique(A.map(plan.recipes, (row) => row.id))
  )
    return yield* reject();
  const corpusIds = A.flatMap(plan.recipes, (recipe) => A.map(plan.sizes, (size) => `${recipe.id}@${size}`));
  if (
    !same(
      A.map(contract.cases, (row) => row.id),
      corpusIds
    ) ||
    !unique(corpusIds)
  )
    return yield* reject();
  for (const row of contract.cases) {
    const recipe = A.findFirst(plan.recipes, (item) => item.id === row.recipeId);
    if (
      recipe._tag === "None" ||
      !A.contains(plan.sizes, row.size) ||
      row.id !== `${row.recipeId}@${row.size}` ||
      Str.length(row.text) !== row.size ||
      hash(row.text) !== row.inputSha256
    )
      return yield* reject();
    const points = A.fromIterable(recipe.value.seed);
    const parts: Array<string> = [];
    let remaining = row.size - Str.length(recipe.value.suffix);
    let index = 0;
    if (remaining < 0) return yield* reject();
    while (remaining > 0) {
      const point = points[index++ % points.length]!;
      const next = Str.length(point) > remaining ? "a" : point;
      parts.push(next);
      remaining -= Str.length(next);
    }
    if (`${A.join(parts, "")}${recipe.value.suffix}` !== row.text) return yield* reject();
  }
  const bundle = yield* S.decodeUnknownEffect(CitationOracleLedgers)({
    inventory: yield* read(file(fixtures, "source-inventory.json")).pipe(
      Effect.flatMap(S.decodeEffect(S.fromJsonString(S.JsonObject)))
    ),
    canonical: yield* read(file(fixtures, "canonical-cases.json")).pipe(
      Effect.flatMap(S.decodeEffect(S.fromJsonString(S.JsonObject)))
    ),
    regex: yield* read(file(fixtures, "regex-inventory.json")).pipe(
      Effect.flatMap(S.decodeEffect(S.fromJsonString(S.JsonObject)))
    ),
  });
  const regex = bundle.regex;
  const source = contract.sourceProjection.value;
  if (
    hash(contract.sourceProjection.raw) !== contract.sourceProjectionSha256 ||
    source.families.length !== 110 ||
    source.extractorInstances.length !== 13610 ||
    !same(
      source.families,
      A.map(regex.families, (row) => ({ id: row.id, form: row.form }))
    ) ||
    !same(
      source.extractorInstances,
      A.map(regex.extractorInstances, (row) => ({
        id: row.id,
        artifactSha256: row.artifactSha256,
        index: row.index,
        patternSha256: row.patternSha256,
        flags: row.flags,
        constructor: row.constructor,
      }))
    )
  )
    return yield* reject();
  const runIds = A.map(controls.runs, (row) => `${row.runtimeKind}::${row.control}`);
  if (
    runIds.length !== 4 ||
    !unique(runIds) ||
    !failsScaling([1, 4, 16]) ||
    failsScaling([4, 14, 49]) ||
    failsScaling([1, 4, 4])
  )
    return yield* reject();
  for (const run of controls.runs) {
    if (
      run.rows.length > plan.controlSizes.length ||
      !same(
        A.map(run.rows, (row) => row.size),
        A.take(plan.controlSizes, run.rows.length)
      )
    )
      return yield* reject();
    const medians: Array<number> = [];
    let decision = "accepted";
    for (const [index, row] of A.map(run.rows, (row, index) => [index, row] as const)) {
      if (row.outcome === "deadline") {
        if (index !== run.rows.length - 1 || run.control === "safe-linear") return yield* reject();
        decision = "rejected-deadline";
      } else {
        if (
          row.sample.size !== row.size ||
          row.sample.control !== run.control ||
          row.sample.samplesNanos.length !== 5 ||
          row.sample.matched !== (run.control === "safe-linear") ||
          (run.runtimeKind === "node"
            ? row.sample.runtime !== "v24.22.1" || row.sample.bunVersion !== null
            : row.sample.bunVersion !== "1.4.4")
        )
          return yield* reject();
        medians.push(median(row.sample.samplesNanos));
        if (failsScaling(medians)) {
          if (index !== run.rows.length - 1) return yield* reject();
          decision = "rejected-scaling";
        }
      }
    }
    if (
      decision !== run.decision ||
      (run.control === "safe-linear" ? decision !== "accepted" || run.rows.length !== 7 : decision === "accepted")
    )
      return yield* reject();
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootPath = yield* fs.realPath(yield* path.fromFileUrl(root));
  const checkReference = Effect.fn("CitationRegexBenchmarks.checkReference")(function* (
    reference: CitationRegexBenchmarkResults["families"][number]["staticReview"]
  ) {
    if (path.isAbsolute(reference.path)) return yield* reject();
    const resolved = path.resolve(rootPath, reference.path);
    if (!Str.startsWith(`${rootPath}/`)(resolved)) return yield* reject();
    const real = yield* fs.realPath(resolved);
    if (!Str.startsWith(`${rootPath}/`)(real) || hash(yield* fs.readFile(real)) !== reference.sha256)
      return yield* reject();
  });
  const resultsFile = file(fixtures, "regex-benchmark-results.json");
  const hasResults = yield* Effect.tryPromise(() => Bun.file(resultsFile).exists());
  if (hasResults) {
    const results = yield* read(resultsFile).pipe(
      Effect.flatMap(S.decodeEffect(S.fromJsonString(CitationRegexBenchmarkResults)))
    );
    if (
      results.contractSha256 !== hash(contractRaw) ||
      results.environment.platform !== controls.platform ||
      results.environment.architecture !== controls.architecture ||
      results.environment.cpuModel !== controls.cpuModel ||
      !same(
        A.map(results.families, (row) => row.id),
        A.map(source.families, (row) => row.id)
      ) ||
      !same(
        A.map(results.instanceCoverage, (row) => row.instanceId),
        A.map(source.extractorInstances, (row) => row.id)
      )
    )
      return yield* reject();
    yield* checkReference(results.producer);
    const patterns = R.fromEntries(A.map(source.extractorInstances, (row) => [row.id, row.patternSha256] as const));
    const families = A.map(source.families, (row) => row.id);
    for (const row of results.instanceCoverage)
      if (
        row.sourcePatternSha256 !== patterns[row.instanceId] ||
        !unique(row.familyIds) ||
        !A.every(row.familyIds, (id) => A.contains(families, id))
      )
        return yield* reject();
    const requiredBenchmarks = A.flatMap(plan.requiredRuntimes, (runtime) =>
      A.map(plan.recipes, (recipe) => `${runtime}::${recipe.id}`)
    );
    for (const family of results.families) {
      yield* checkReference(family.staticReview);
      yield* checkReference(family.targetTest);
      for (const reference of [...family.implementation, ...family.positiveCaseProofs, ...family.adversarialCaseProofs])
        yield* checkReference(reference);
      const benchmarkIds = A.map(family.benchmarks, (row) => `${row.runtimeKind}::${row.recipeId}`);
      if (!unique(benchmarkIds) || !same(A.sort(benchmarkIds, Order.String), A.sort(requiredBenchmarks, Order.String)))
        return yield* reject();
      for (const benchmark of family.benchmarks) {
        if (
          !same(
            A.map(benchmark.sizes, (row) => row.size),
            plan.sizes
          ) ||
          !A.every(benchmark.sizes, (row) => row.samplesNanos.length === 5) ||
          failsScaling(A.map(benchmark.sizes, (row) => median(row.samplesNanos)))
        )
          return yield* reject();
        for (const row of benchmark.sizes) yield* checkReference(row.workCapsProof);
      }
    }
  }
  const pending = A.filter(
    [...regex.families, ...regex.extractorInstances],
    (row) => row.workflowState !== "complete" || row.proof === null
  ).length;
  if (!audit && (!hasResults || pending > 0)) return yield* reject();
  yield* Console.log(
    `Regex benchmark contract valid: 120 adversarial inputs, 110 families, 13610 instances; synthetic controls accepted/rejected as required; ${pending} source proof rows unfinished; family results ${hasResults ? "present" : "missing"}.`
  );
});
// @effect-diagnostics-next-line strictEffectProvide:off -- Standalone package-command entry point.
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
