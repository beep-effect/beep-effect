/** Validate comparison-law accounting; no semantic waiver or fixture commands. */
import {
  CitationDivergenceProofReceipt,
  CitationDivergences,
  CitationSupplementalExtraction,
} from "@beep/law-practice-use-cases/test";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

class DivergenceError extends S.TaggedError<DivergenceError, { readonly brand: unique symbol }>()(
  "CitationDivergenceError",
  { message: S.String }
) {}
const reject = () => Effect.fail(DivergenceError.make({ message: "Citation divergence validation failed." }));
const hash = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const same = S.toEquivalence(S.Json);
const read = (file: string | URL) => Effect.tryPromise(() => Bun.file(file).text());
const root = new URL("../../../", import.meta.url);
const program = Effect.gen(function* () {
  const args = A.drop(process.argv, 2);
  let fixtures: string | URL = new URL("packages/law-practice/use-cases/test/fixtures/eyecite/", root);
  let audit = false;
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
    if (flag !== "--fixtures" || value === undefined || Str.startsWith("--")(value)) return yield* reject();
    fixtures = `${value}/`;
  }
  const file = (name: string) => (typeof fixtures === "string" ? `${fixtures}${name}` : new URL(name, fixtures));
  const report = yield* read(file("divergences.json")).pipe(
    Effect.flatMap(S.decodeEffect(S.fromJsonString(CitationDivergences)))
  );
  const planRaw = yield* read(new URL("./divergence-plan.json", import.meta.url));
  const plan = yield* S.decodeEffect(
    S.fromJsonString(
      S.Struct({
        schemaVersion: S.tag("citation-divergence-plan/v1"),
        scope: S.String,
        normalizations: S.NonEmptyArray(
          S.Struct({
            id: S.NonEmptyString,
            statement: S.NonEmptyString,
            referencePaths: S.NonEmptyArray(S.NonEmptyString),
            targetTest: S.Struct({ path: S.NonEmptyString, name: S.NonEmptyString }),
          })
        ),
        questions: S.NonEmptyArray(
          S.Struct({
            id: S.NonEmptyString,
            blocker: S.NonEmptyString,
            observationIds: S.NonEmptyArray(S.NonEmptyString),
            targetTest: S.Struct({ path: S.NonEmptyString, name: S.NonEmptyString }),
          })
        ),
      })
    )
  )(planRaw);
  const exporter = yield* read(new URL("./export-divergences.py", import.meta.url));
  const supplementalRaw = yield* read(file("supplemental-extraction.json"));
  const supplemental = yield* S.decodeEffect(S.fromJsonString(CitationSupplementalExtraction))(supplementalRaw);
  if (
    hash(planRaw) !== report.planSha256 ||
    hash(exporter) !== report.exporterSha256 ||
    hash(supplementalRaw) !== report.supplementalSha256 ||
    plan.scope !== report.scope
  )
    return yield* reject();
  const ids = A.map([...report.normalizations, ...report.questions], (row) => row.id);
  if (
    report.normalizations.length !== 11 ||
    report.questions.length !== 4 ||
    A.dedupe(ids).length !== 15 ||
    !same(
      A.map(report.normalizations, (row) => row.id),
      A.map(plan.normalizations, (row) => row.id)
    ) ||
    !same(
      A.map(report.questions, (row) => row.id),
      A.map(plan.questions, (row) => row.id)
    )
  )
    return yield* reject();

  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootPath = yield* fs.realPath(yield* path.fromFileUrl(root));
  const readReference = Effect.fn("CitationDivergences.readReference")(function* (
    reference: (typeof report.normalizations)[number]["references"][number]
  ) {
    if (path.isAbsolute(reference.path)) return yield* reject();
    const resolved = path.resolve(rootPath, reference.path);
    if (!Str.startsWith(`${rootPath}/`)(resolved)) return yield* reject();
    const real = yield* fs.realPath(resolved);
    if (!Str.startsWith(`${rootPath}/`)(real)) return yield* reject();
    const bytes = yield* fs.readFile(real);
    if (hash(bytes) !== reference.sha256) return yield* reject();
    return bytes;
  });
  const verifyProof = Effect.fn("CitationDivergences.verifyProof")(function* (
    id: string,
    proof: (typeof report.normalizations)[number]["proof"],
    evidence: ReadonlyArray<(typeof report.normalizations)[number]["references"][number]>,
    targetTest: (typeof report.normalizations)[number]["targetTest"]
  ) {
    if (
      proof === null ||
      proof.test.path !== targetTest.path ||
      proof.test.name !== targetTest.name ||
      !Str.startsWith("packages/")(proof.test.path) ||
      !Str.includes("/test/")(proof.test.path) ||
      !Str.endsWith(".test.ts")(proof.test.path) ||
      !Str.startsWith("goals/citation-extraction-engine/history/evidence/")(proof.receipt.path) ||
      !Str.endsWith(".json")(proof.receipt.path)
    )
      return yield* reject();
    const testBytes = yield* readReference(proof.test);
    if (!Str.includes(proof.test.name)(new TextDecoder().decode(testBytes))) return yield* reject();
    const receiptBytes = yield* readReference(proof.receipt);
    const receipt = yield* S.decodeEffect(S.fromJsonString(CitationDivergenceProofReceipt))(
      new TextDecoder().decode(receiptBytes)
    );
    if (
      receipt.subjectId !== id ||
      receipt.planSha256 !== report.planSha256 ||
      !same(receipt.test, proof.test) ||
      !same(receipt.evidence, evidence)
    )
      return yield* reject();
    yield* readReference(receipt.producer);
    for (const reference of receipt.evidence) yield* readReference(reference);
    const runner = yield* read(new URL("node_modules/vitest/package.json", root)).pipe(
      Effect.flatMap(S.decodeEffect(S.fromJsonString(S.Struct({ version: S.String }))))
    );
    if (receipt.runnerVersion !== runner.version) return yield* reject();
  });
  for (const row of report.normalizations) {
    const expected = A.findFirst(plan.normalizations, (item) => item.id === row.id);
    if (
      expected._tag === "None" ||
      row.statement !== expected.value.statement ||
      !same(row.targetTest, expected.value.targetTest) ||
      !same(
        A.map(row.references, (reference) => reference.path),
        expected.value.referencePaths
      ) ||
      A.dedupe(expected.value.referencePaths).length !== row.references.length
    )
      return yield* reject();
    for (const reference of row.references) yield* readReference(reference);
    if (row.workflowState === "complete") yield* verifyProof(row.id, row.proof, row.references, row.targetTest);
  }
  for (const row of report.questions) {
    const expected = A.findFirst(plan.questions, (item) => item.id === row.id);
    if (
      expected._tag === "None" ||
      !same(row.targetTest, expected.value.targetTest) ||
      !same(
        A.map(row.observations, (observation) => observation.id),
        expected.value.observationIds
      ) ||
      A.dedupe(expected.value.observationIds).length !== row.observations.length
    )
      return yield* reject();
    for (const observation of row.observations) {
      const observed = A.findFirst(supplemental.textCases, (item) => item.id === observation.id);
      if (
        observed._tag === "None" ||
        observed.value.normalizedSha256 !== observation.normalizedSha256 ||
        hash(observed.value.payload.raw) !== observation.normalizedSha256
      )
        return yield* reject();
    }
    if (row.workflowState === "audit") {
      if (row.blocker !== expected.value.blocker) return yield* reject();
    } else {
      yield* verifyProof(
        row.id,
        row.proof,
        [
          {
            path: "packages/law-practice/use-cases/test/fixtures/eyecite/supplemental-extraction.json",
            sha256: report.supplementalSha256,
          },
        ],
        row.targetTest
      );
    }
  }
  const pending = A.filter(
    [...report.normalizations, ...report.questions],
    (row) => row.workflowState !== "complete"
  ).length;
  if (!audit && pending > 0) return yield* reject();
  yield* Console.log(
    `Divergence ledger valid: 11 representation laws, 4 fidelity questions, ${pending} unfinished proof rows; no semantic waiver.`
  );
});
// @effect-diagnostics-next-line strictEffectProvide:off -- Standalone package-command process entry point.
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
