/** Portable export/test/disposition accounting for the two exact donor pins. */
import { CitationTypescriptDonors } from "@beep/law-practice-use-cases/test";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const hash = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const reject = (reason: string) => Effect.fail(new Error(reason));
const unique = (values: ReadonlyArray<string>) => A.length(A.dedupe(values)) === values.length;
const sameIds = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  unique(left) && unique(right) && left.length === right.length && A.every(left, (id) => A.contains(right, id));
const canonical = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, canonical);
  if (!P.isObject(value)) return value;
  return R.fromEntries(
    A.map(
      A.sort(
        R.toEntries(value),
        Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key)
      ),
      ([key, item]) => [key, canonical(item)] as const
    )
  );
};
const program = Effect.gen(function* () {
  const path =
    process.argv[2] && process.argv[2] !== "--complete"
      ? process.argv[2]
      : new URL(
          "../../../packages/law-practice/use-cases/test/fixtures/eyecite/typescript-extensions.json",
          import.meta.url
        );
  const text = yield* Effect.tryPromise(() => Bun.file(path).text());
  const report = yield* S.decodeUnknownEffect(S.fromJsonString(CitationTypescriptDonors))(text);
  for (const [file, expected] of [
    ["export-typescript-donors.py", report.exporterSha256],
    ["inventory-typescript-donors.mjs", report.staticExporterSha256],
  ]) {
    const bytes = yield* Effect.tryPromise(() => Bun.file(new URL(`./${file}`, import.meta.url)).bytes());
    if (hash(bytes) !== expected) return yield* reject("donor generator hash mismatch");
  }
  if (
    !sameIds(
      A.map(report.donors, (donor) => donor.id),
      ["eyecite-ts", "eyecite-js"]
    ) ||
    !unique(A.map(report.dispositions, (row) => row.id))
  )
    return yield* reject("duplicate or missing donor/disposition identities");
  const expectedObligations: Array<string> = [];
  let passingCases = 0;
  for (const donor of report.donors) {
    const inventory = donor.static;
    const expectedSubpaths = donor.id === "eyecite-ts" ? [".", "./data", "./annotate", "./utils"] : ["."];
    if (
      !sameIds(expectedSubpaths, R.keys(donor.packageExports)) ||
      !sameIds(
        expectedSubpaths,
        A.map(inventory.publishedEntrypoints, (row) => row.subpath)
      ) ||
      !sameIds(
        inventory.entrypoints,
        A.map(inventory.publishedEntrypoints, (row) => row.sourcePath)
      )
    )
      return yield* reject("published package entrypoint coverage mismatch");
    if (inventory.generatorSha256 !== report.staticExporterSha256) return yield* reject("stale static inventory");
    if (
      !unique(A.map(inventory.files, (row) => row.path)) ||
      !unique(A.map(inventory.fixtures, (row) => row.path)) ||
      !unique(A.map(inventory.exports, (row) => row.id)) ||
      !unique(A.map(inventory.testDeclarations, (row) => row.id)) ||
      !unique(A.map(inventory.assertionSources, (row) => row.id)) ||
      !unique(A.map(donor.runtimeCases, (row) => row.id))
    )
      return yield* reject("duplicate source/runtime identities");
    const sources = R.fromEntries(
      A.map([...inventory.files, ...inventory.fixtures], (row) => [row.path, row.sha256] as const)
    );
    const declarations = R.fromEntries(A.map(inventory.testDeclarations, (row) => [row.id, row] as const));
    const originValid = (origin: {
      readonly path: string;
      readonly sourceSha256: string;
      readonly material: string;
      readonly line: number;
      readonly column: number;
      readonly endLine: number;
    }) =>
      origin.line > 0 &&
      origin.column > 0 &&
      origin.endLine >= origin.line &&
      (origin.material === "generated" || sources[origin.path] === origin.sourceSha256);
    const add = (kind: string, id: string) => {
      expectedObligations.push(`${donor.id}::${kind}::${id}`);
    };
    for (const row of inventory.exports) {
      if (
        !A.contains(inventory.entrypoints, row.entrypoint) ||
        row.id !== `${row.entrypoint}::${row.name}` ||
        row.origins.length === 0 ||
        !A.every(row.origins, originValid) ||
        !A.every(row.members, (member) => originValid(member.origin))
      )
        return yield* reject("export entrypoint/origin mismatch");
      add("publicExport", row.id);
      for (const member of row.members)
        add("exportedMember", `${row.id}::${member.name}::${member.origin.line}:${member.origin.column}`);
    }
    for (const row of inventory.testDeclarations) {
      if (
        !originValid(row) ||
        row.id !== `${row.path}:${row.line}:${row.column}:testDeclaration` ||
        row.runtimeLine < row.line ||
        row.runtimeLine > row.endLine ||
        row.runtimeColumn < 1
      )
        return yield* reject("invalid static registration");
    }
    for (const row of inventory.assertionSources) {
      if (!originValid(row) || (row.ownerDeclarationId !== null && declarations[row.ownerDeclarationId] === undefined))
        return yield* reject("assertion source ownership mismatch");
    }
    const counts: Record<string, number> = {};
    const statuses: Record<string, number> = {};
    for (const row of donor.runtimeCases) {
      const declaration = declarations[row.declarationId];
      const ordinal = (counts[row.declarationId] ?? 0) + 1;
      counts[row.declarationId] = ordinal;
      statuses[row.status] = (statuses[row.status] ?? 0) + 1;
      if (
        declaration === undefined ||
        row.path !== declaration.path ||
        row.line !== declaration.runtimeLine ||
        (donor.id === "eyecite-ts" && row.column !== declaration.runtimeColumn) ||
        row.ordinal !== ordinal ||
        row.id !== `${row.declarationId}::${ordinal}`
      )
        return yield* reject("runtime registration/expansion mismatch");
      const original = R.remove(row, "normalizedSha256");
      const encoded = yield* S.encodeUnknownEffect(S.fromJsonString(S.Json))(canonical(original));
      if (hash(encoded) !== row.normalizedSha256) return yield* reject("runtime observation hash mismatch");
      add("testBehavior", row.id);
    }
    if (
      (statuses.passed ?? 0) !== donor.suite.passed ||
      (statuses.skipped ?? 0) !== donor.suite.skipped ||
      (statuses.todo ?? 0) !== donor.suite.todo
    )
      return yield* reject("runtime suite summary mismatch");
    passingCases += donor.suite.passed;
    const unobserved = A.filter(inventory.testDeclarations, (row) => counts[row.id] === undefined);
    if (
      !sameIds(
        A.map(unobserved, (row) => row.id),
        A.map(donor.unobservedDeclarations, (row) => row.declarationId)
      )
    )
      return yield* reject("unclassified unobserved registration");
    for (const row of donor.unobservedDeclarations) {
      if (
        donor.id !== "eyecite-ts" ||
        row.declarationId !== "tests/integration/expandedCorpus.test.ts:86:11:testDeclaration" ||
        row.fixturePath !== "tests/fixtures/expanded-corpus.json" ||
        row.fixtureRows !== 165 ||
        sources[row.fixturePath] !== row.fixtureSha256
      )
        return yield* reject("unobserved branch evidence mismatch");
      add("unobservedDeclaration", row.declarationId);
    }
  }
  if (
    !sameIds(
      expectedObligations,
      A.map(report.dispositions, (row) => row.id)
    ) ||
    !A.every(report.dispositions, (row) => row.id === `${row.donorId}::${row.sourceKind}::${row.sourceId}`)
  )
    return yield* reject("disposition source coverage mismatch");
  let pending = 0;
  for (const row of report.dispositions) {
    if (row.workflowState !== "complete" || row.disposition === "unresolved") {
      pending++;
      continue;
    }
    if (
      row.rationale === null ||
      row.proof === null ||
      ((row.disposition === "adopted" || row.disposition === "subsumed") && row.targetTest === null)
    )
      return yield* reject("terminal donor disposition lacks proof");
    const repositoryRoot = new URL("../../../", import.meta.url);
    for (const reference of [row.proof.evidencePath, ...(row.targetTest === null ? [] : [row.targetTest.path])]) {
      const url = new URL(reference, repositoryRoot);
      if (!url.href.startsWith(repositoryRoot.href) || !(yield* Effect.tryPromise(() => Bun.file(url).exists())))
        return yield* reject("terminal donor evidence does not exist in repository");
    }
    if (row.disposition === "follow-up") {
      if (row.successorGoal === null) return yield* reject("follow-up lacks successor");
      const exists = yield* Effect.tryPromise(() =>
        Bun.file(new URL(`../../../${row.successorGoal}/GOAL.md`, import.meta.url)).exists()
      );
      if (!exists) return yield* reject("follow-up successor does not exist");
    }
  }
  if (A.contains(process.argv, "--complete") && pending > 0) return yield* reject("unfinished donor dispositions");
  yield* Console.log(
    `Donor accounting valid: ${report.donors.length} pins, ${passingCases} passed cases, ${report.dispositions.length} obligations; ${pending} dispositions remain unfinished.`
  );
});
Effect.runPromise(
  program.pipe(
    Effect.catchCause(() =>
      Console.error(
        "TypeScript donor validation failed; inspect source/runtime accounting, hashes and dispositions."
      ).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            process.exitCode = 1;
          })
        )
      )
    )
  )
);
